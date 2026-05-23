import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import PatientLoginPage from './pages/PatientLoginPage';
import StaffLoginPage from './pages/StaffLoginPage';
import SuperAdminLoginPage from './pages/SuperAdminLoginPage';
import RegisterPage from './pages/RegisterPage';
import StaffDashboard from './pages/StaffDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DisplayBoard from './pages/DisplayBoard';
import LiveTokenTracker from './pages/LiveTokenTracker';
import AppointmentBooking from './pages/AppointmentBooking';
import PharmacyDashboard from './pages/PharmacyDashboard';
import PatientHistory from './pages/PatientHistory';
import OfflineIndicator from './components/OfflineIndicator';
import SetupBanner from './components/SetupBanner';
import UniversalHeader from './components/UniversalHeader';
import { supabase, isMissingConfig } from './lib/supabase';
import { AuthUser, getCachedUser, fetchMe, logout, getAccessToken } from './lib/auth';
import { getTokenStatus } from './lib/api';
import { LogOut, Clock, Calendar, FileText, Home, AlertTriangle, ShieldAlert } from 'lucide-react';
import { getTenantSlug, resolveTenantConfig, TenantConfig } from './lib/tenant';

type Page = 'landing' | 'patient-login' | 'staff-login' | 'register' | 'staff'
  | 'display' | 'tracker' | 'appointment' | 'pharmacy' | 'history' | 'super-admin' | 'super-admin-login';

interface PageState {
  tokenNumber?: number;
  phone?: string;
}

export default function App() {
  const [page, setPage] = useState<Page>('landing');
  const [pageState, setPageState] = useState<PageState>({});
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('ACTIVE');
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  // ── Tenant Resolution & Theme Sync ───────────────────────
  useEffect(() => {
    async function initTenant() {
      setTenantLoading(true);
      const slug = getTenantSlug();
      if (slug) {
        const config = await resolveTenantConfig(slug);
        if (config) {
          setTenant(config);
          localStorage.setItem('mq_selected_hospital_id', config.id);
          document.title = `${config.name} | MedQueue Operations`;
          
          // Apply custom tenant CSS variables dynamically
          if (config.theme_color) {
            document.documentElement.style.setProperty('--primary-color', config.theme_color);
            let styleEl = document.getElementById('mq-tenant-theme-styles');
            if (!styleEl) {
              styleEl = document.createElement('style');
              styleEl.id = 'mq-tenant-theme-styles';
              document.head.appendChild(styleEl);
            }
            styleEl.innerHTML = `
              :root {
                --primary-color: ${config.theme_color};
              }
              .bg-\\[\\#005EB8\\] {
                background-color: ${config.theme_color} !important;
              }
              .text-\\[\\#005EB8\\] {
                color: ${config.theme_color} !important;
              }
              .hover\\:bg-\\[\\#004a96\\]:hover {
                filter: brightness(0.9) !important;
              }
              .border-\\[\\#005EB8\\] {
                border-color: ${config.theme_color} !important;
              }
              .shadow-\\[\\#005EB8\\/10\\] {
                box-shadow: 0 4px 6px -1px rgba(0, 94, 184, 0.1), 0 2px 4px -1px rgba(0, 94, 184, 0.06);
              }
            `;
          }
        } else {
          setTenant(null);
          document.title = 'MedQueue | Enterprise Healthcare Operations Cloud';
        }
      } else {
        setTenant(null);
        document.title = 'MedQueue | Enterprise Healthcare Operations Cloud';
      }
      setTenantLoading(false);
    }
    initTenant();
  }, []);

  // Real-time listener for current hospital status
  useEffect(() => {
    const hospId = (user?.role === 'SUPER_ADMIN' ? (localStorage.getItem('mq_selected_hospital_id') || user?.hospital_id) : user?.hospital_id) || localStorage.getItem('mq_selected_hospital_id') || 'd290f1ee-6c54-4b01-90e6-d701748f0851';
    
    if (page === 'landing' || page === 'super-admin-login' || page === 'super-admin') {
      setSubscriptionStatus('ACTIVE');
      return;
    }

    async function fetchStatus() {
      try {
        const { data, error } = await supabase
          .from('hospitals')
          .select('subscription_status')
          .eq('id', hospId)
          .maybeSingle();

        if (error) {
          console.warn('Error fetching subscription status:', error.message);
        } else if (data) {
          setSubscriptionStatus(data.subscription_status || 'ACTIVE');
        }
      } catch (err) {
        console.error('Failed to retrieve subscription status:', err);
      }
    }

    fetchStatus();

    const channel = supabase
      .channel('hospital_status_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'hospitals',
          filter: `id=eq.${hospId}`
        },
        (payload) => {
          if (payload.new && 'subscription_status' in payload.new) {
            setSubscriptionStatus(payload.new.subscription_status || 'ACTIVE');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, page]);

  const isBlocked = (subscriptionStatus === 'HOLD' || subscriptionStatus === 'SUSPENDED') && user?.role !== 'SUPER_ADMIN';

  // ── Session restore ───────────────────────────────────
  useEffect(() => {
    async function restoreSession() {
      // 1. Check for secret Super Admin portal query param
      const params = new URLSearchParams(window.location.search);
      const hasSecret = params.get('secret') === 'superadmin' || params.get('portal') === 'superadmin';
      const isPortalSession = sessionStorage.getItem('mq_superadmin_portal_active') === 'true';

      if (hasSecret || isPortalSession) {
        if (hasSecret) {
          sessionStorage.setItem('mq_superadmin_portal_active', 'true');
        }

        // Automatically clear any existing non-admin user session to prevent conflict
        const cached = getCachedUser();
        if (cached && cached.role !== 'SUPER_ADMIN') {
          await logout();
          setUser(null);
        }

        // Clean URL query params to preserve security
        if (window.location.search) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        setPage('super-admin-login');
        setAuthLoading(false);
        return;
      }

      const cached = getCachedUser();
      const token = getAccessToken();
      if (cached && token) {
        setUser(cached);
        fetchMe().then(fresh => { if (fresh) setUser(fresh); });

        if (cached.type === 'patient' && cached.phone) {
          try {
            const { token: activeToken } = await getTokenStatus(cached.phone);
            if (activeToken && (activeToken.status === 'WAITING' || activeToken.status === 'SERVING')) {
              setPage('tracker');
              setPageState({ tokenNumber: activeToken.token_number, phone: activeToken.phone });
            } else {
              // Returning patient → register page (quick token booking)
              setPage('register');
            }
          } catch {
            setPage('register');
          }
        } else if (cached.type === 'staff') {
          if (cached.role === 'SUPER_ADMIN') {
            setPage('super-admin');
          } else {
            setPage('staff');
          }
        }
      } else {
        setPage('landing');
      }
      setAuthLoading(false);
    }
    restoreSession();
  }, []);

  function navigate(p: string, state?: Record<string, unknown>) {
    setPage(p as Page);
    if (state) setPageState(state as PageState);
    setShowUserMenu(false);
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    const slug = getTenantSlug();
    if (slug) {
      setPage('patient-login');
    } else {
      setPage('landing');
    }
    setShowUserMenu(false);
  }

  // ── Patient login handler ─────────────────────────────
  async function handlePatientLogin(u: AuthUser) {
    setUser(u);
    if (u.phone) {
      try {
        const { token: activeToken } = await getTokenStatus(u.phone);
        if (activeToken && (activeToken.status === 'WAITING' || activeToken.status === 'SERVING')) {
          setPage('tracker');
          setPageState({ tokenNumber: activeToken.token_number, phone: activeToken.phone });
          return;
        }
      } catch { /* silent */ }
    }
    // New or returning patient → register page
    setPage('register');
  }

  // ── Tenant Loading ────────────────────────────────────
  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-[#F4F8FB] flex items-center justify-center">
        <div className="text-center text-slate-800">
          <div className="w-12 h-12 border-4 border-[#005EB8] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-semibold text-xs uppercase tracking-wider text-slate-400">Resolving Sandbox Context...</p>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#005EB8] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-semibold">Loading MedQueue...</p>
        </div>
      </div>
    );
  }

  if (isMissingConfig) return <SetupBanner />;

  // ── Tenant Mismatch Interceptor ──────────────────────
  const isTenantMismatch = tenant && user && user.role !== 'SUPER_ADMIN' && user.hospital_id !== tenant.id;

  if (isTenantMismatch) {
    const userHospName = user.hospital_id === 'd290f1ee-6c54-4b01-90e6-d701748f0851' ? 'Apollo Clinic' :
                         user.hospital_id === 'a4220b22-83b3-4f9e-a89e-cb01748ff002' ? 'Max Health' :
                         user.hospital_id === '7e90a5fe-4b01-90c6-ff22-a701748f0222' ? 'City Hospital' : 'Another Branch';
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Backdrop gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#005EB8]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-lg bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-8 rounded-[32px] shadow-2xl relative z-10 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg border bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse">
            <ShieldAlert className="w-8 h-8" />
          </div>
          
          <h2 className="text-2xl font-extrabold text-white tracking-tight mb-3">
            Cross-Tenant Sandbox Lock
          </h2>
          
          <div className="text-slate-400 text-sm leading-relaxed mb-8 px-2 font-medium">
            Your active {user.type === 'patient' ? 'patient session' : `staff account (${user.role})`} belongs strictly to <span className="text-white font-extrabold">{userHospName}</span>.
            <br /><br />
            You are attempting to access the isolated workspace for <span className="text-amber-400 font-extrabold">{tenant.name}</span>.
            MedQueue true multi-tenant architecture locks cross-clinic operations to protect patient safety and records.
          </div>
          
          <div className="w-full flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              onClick={handleLogout}
              className="px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              Sign Out & Switch Clinic
            </button>
            
            <a 
              href={user.hospital_id === 'd290f1ee-6c54-4b01-90e6-d701748f0851' ? '?hosp=apollo' : user.hospital_id === 'a4220b22-83b3-4f9e-a89e-cb01748ff002' ? '?hosp=max' : '?hosp=city'}
              className="px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-2xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
            >
              Go to My Workspace
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Landing ───────────────────────────────────────────
  if (page === 'landing') {
    return <LandingPage
      onGetStarted={() => setPage('patient-login')}
      onStaffLogin={() => setPage('staff-login')}
    />;
  }

  // ── Patient login ─────────────────────────────────────
  if (page === 'patient-login' && !user) {
    return <PatientLoginPage
      onLogin={handlePatientLogin}
      onBack={() => {
        if (tenant) {
          setPage('staff-login');
        } else {
          setPage('landing');
        }
      }}
    />;
  }

  // ── Staff login ───────────────────────────────────────
  if (page === 'staff-login' && !user) {
    return <StaffLoginPage
      onLogin={(u) => { 
        setUser(u); 
        if (u.role === 'SUPER_ADMIN') {
          setPage('super-admin');
        } else {
          setPage('staff');
        }
      }}
      onBack={() => {
        if (tenant) {
          setPage('patient-login');
        } else {
          setPage('landing');
        }
      }}
    />;
  }

  // ── Super Admin Login (Secret Secure Portal) ───────────
  if (page === 'super-admin-login' && !user) {
    return <SuperAdminLoginPage
      onLogin={(u) => {
        sessionStorage.removeItem('mq_superadmin_portal_active');
        setUser(u);
        setPage('super-admin');
      }}
      onBack={() => {
        sessionStorage.removeItem('mq_superadmin_portal_active');
        setPage('landing');
      }}
    />;
  }

  // ── Not logged in → landing ───────────────────────────
  if (!user) {
    if (tenant) {
      return <PatientLoginPage
        onLogin={handlePatientLogin}
        onBack={() => setPage('staff-login')}
      />;
    }
    return <LandingPage
      onGetStarted={() => setPage('patient-login')}
      onStaffLogin={() => setPage('staff-login')}
    />;
  }

  // ── Subscription Blockade Interceptor ────────────────
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Backdrop gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#005EB8]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-lg bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-8 rounded-[32px] shadow-2xl relative z-10 text-center flex flex-col items-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg border ${
            subscriptionStatus === 'HOLD' 
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            {subscriptionStatus === 'HOLD' ? (
              <AlertTriangle className="w-8 h-8" />
            ) : (
              <ShieldAlert className="w-8 h-8" />
            )}
          </div>
          
          <h2 className="text-2xl font-extrabold text-white tracking-tight mb-3">
            {subscriptionStatus === 'HOLD' 
              ? 'Service Temporarily on Hold' 
              : 'Account Suspended'}
          </h2>
          
          <div className="text-slate-400 text-sm leading-relaxed mb-8 px-2 font-medium">
            {subscriptionStatus === 'HOLD' ? (
              <>
                Your clinic's subscription renewal is currently <span className="text-amber-400 font-extrabold">delayed</span>. 
                Operations have been safely paused by central administration. 
                Please contact your MedQueue Account Executive or billing team to resume your queue systems immediately.
              </>
            ) : (
              <>
                This clinic's account has been <span className="text-rose-400 font-extrabold">administratively suspended</span>. 
                To reactivate access to patient forms, display boards, and clinical queues, please contact MedQueue administrator support.
              </>
            )}
          </div>
          
          <div className="w-full flex flex-col sm:flex-row gap-3 justify-center">
            <button 
              onClick={handleLogout}
              className="px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              Sign Out & Exit
            </button>
            
            <a 
              href="mailto:billing@medqueue.com"
              className={`px-6 py-3.5 font-extrabold text-xs rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                subscriptionStatus === 'HOLD'
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/10'
                  : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/10'
              }`}
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Display board ─────────────────────────────────────
  if (page === 'display') {
    return (
      <div>
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-end p-2">
          <button onClick={() => navigate('staff')}
            className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm transition-colors border border-white/30">
            Exit Display
          </button>
        </div>
        <DisplayBoard />
      </div>
    );
  }

  // ── Pharmacy ──────────────────────────────────────────
  if (page === 'pharmacy') {
    const isAuthorized = user && (user.role === 'PHARMACY' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');
    if (!isAuthorized) {
      return (
        <div className="min-h-screen bg-[#F4F8FB]">
          <UniversalHeader page={page} navigate={navigate} currentUser={user} handleLogout={handleLogout} />
          <div className="max-w-md mx-auto px-4 py-24 text-center">
            <div className="w-16 h-16 bg-red-50 border border-red-100 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Access Denied</h2>
            <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
              Your staff account (Role: <span className="font-extrabold text-[#005EB8]">{user?.role || 'Staff'}</span>) is not authorized to edit stock inventory or access the Pharmacy Console.
            </p>
            <button 
              onClick={() => navigate('staff')}
              className="mt-6 bg-[#005EB8] hover:bg-[#004a96] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all uppercase tracking-wider"
            >
              Return to Clinic
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#F4F8FB]">
        <UniversalHeader page={page} navigate={navigate} currentUser={user} handleLogout={handleLogout} />
        <PharmacyDashboard />
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#E8F3FF]">
      <UniversalHeader page={page} navigate={navigate} currentUser={user} handleLogout={handleLogout} />

      {/* Mobile bottom nav for patients */}
      {user.type === 'patient' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 z-40 md:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
          <div className="grid grid-cols-4 h-16">
            {[
              { id: 'register', label: 'Workspace', icon: <Home className="w-5.5 h-5.5" /> },
              { id: 'tracker', label: 'Live Queue', icon: <Clock className="w-5.5 h-5.5" /> },
              { id: 'appointment', label: 'Book Doc', icon: <Calendar className="w-5.5 h-5.5" /> },
              { id: 'history', label: 'Health Vault', icon: <FileText className="w-5.5 h-5.5" /> },
            ].map(link => (
              <button key={link.id} onClick={() => navigate(link.id)}
                className={`flex flex-col items-center justify-center gap-1.5 transition-all duration-300 ${
                  page === link.id ? 'text-[#005EB8] scale-105 font-extrabold' : 'text-gray-400 font-semibold'
                }`}>
                {link.icon}
                <span className="text-[10px] uppercase tracking-wider">{link.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showUserMenu && <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />}

      {/* Super Admin context banner */}
      {user && user.role === 'SUPER_ADMIN' && page === 'staff' && (
        <div className="bg-amber-500 text-white text-xs font-bold px-4 py-2 text-center flex items-center justify-center gap-2 shadow-inner">
          <span>🕵️‍♂️ Super Admin Mode: Currently managing </span>
          <span className="underline decoration-2 font-black">
            {localStorage.getItem('mq_selected_hospital_id') === 'd290f1ee-6c54-4b01-90e6-d701748f0851' ? 'Apollo Clinic' :
             localStorage.getItem('mq_selected_hospital_id') === 'a4220b22-83b3-4f9e-a89e-cb01748ff002' ? 'Max Health' :
             localStorage.getItem('mq_selected_hospital_id') === '7e90a5fe-4b01-90c6-ff22-a701748f0222' ? 'City Hospital' : 
             'Selected Clinic'}
          </span>
          <button 
            onClick={() => navigate('super-admin')}
            className="ml-4 bg-white/20 hover:bg-white/30 text-white rounded-md px-2 py-0.5 border border-white/20 transition-all font-extrabold"
          >
            Back to Central Controller ➜
          </button>
        </div>
      )}

      <main className={user.type === 'patient' ? 'pb-16 md:pb-0' : ''}>
        {page === 'register' && <RegisterPage onNavigate={navigate} currentUser={user} />}
        {page === 'staff' && <StaffDashboard onNavigate={navigate} currentUser={user} />}
        {page === 'super-admin' && <SuperAdminDashboard currentUser={user} onNavigate={navigate} />}
        {page === 'tracker' && (
          <LiveTokenTracker
            tokenNumber={pageState.tokenNumber}
            phone={pageState.phone ?? (user.type === 'patient' ? user.phone : undefined)}
          />
        )}
        {page === 'appointment' && <AppointmentBooking onNavigate={navigate} currentUser={user} />}
        {page === 'history' && user.type === 'patient' && <PatientHistory currentUser={user} />}
      </main>
      <OfflineIndicator />
    </div>
  );
}

