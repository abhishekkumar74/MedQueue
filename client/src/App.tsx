import { useState, useEffect, lazy, Suspense } from 'react';

// ── Lazy-loaded feature pages (code-splitting for Lighthouse Performance) ──
const LandingPage = lazy(() => import('./features/landing/pages/LandingPage'));
const HospitalLandingPage = lazy(() => import('./features/hospitals/pages/HospitalLandingPage'));
const PatientLoginPage = lazy(() => import('./features/auth/pages/PatientLoginPage'));
const StaffLoginPage = lazy(() => import('./features/auth/pages/StaffLoginPage'));
const SuperAdminLoginPage = lazy(() => import('./features/auth/pages/SuperAdminLoginPage'));
const StaffDashboard = lazy(() => import('./features/admin/pages/StaffDashboard'));
const SuperAdminDashboard = lazy(() => import('./features/admin/pages/SuperAdminDashboard'));
const DisplayBoard = lazy(() => import('./features/queue/display/pages/DisplayBoard'));
const LiveTokenTracker = lazy(() => import('./features/queue/tracker/pages/LiveTokenTracker'));
const AppointmentBooking = lazy(() => import('./features/appointments/pages/AppointmentBooking'));
const PharmacyDashboard = lazy(() => import('./features/pharmacy/pages/PharmacyDashboard'));
const PatientHistory = lazy(() => import('./features/patient/pages/PatientHistory'));
const PatientWorkspace = lazy(() => import('./features/patient/pages/PatientWorkspace'));

// ── Eagerly loaded (critical path, lightweight) ──
import { OfflineIndicator, CookieBanner } from './components';
import { SetupBanner, UniversalHeader } from './layouts';
import { supabase, isMissingConfig } from './lib/supabase';
import { AuthUser, getCachedUser, fetchMe, logout, getAccessToken } from './lib/auth';
import { LogOut, Clock, FileText, Home, AlertTriangle, ShieldAlert, Mail, Phone } from 'lucide-react';
import { getTenantSlug, resolveTenantConfig, TenantConfig, getHomeRoute } from './lib/tenant';

// ── Suspense fallback for lazy-loaded pages ──
function PageLoader() {
  return (
    <div className="min-h-screen bg-[#F4F8FB] flex items-center justify-center" role="status" aria-label="Loading page">
      <div className="text-center animate-fade-in">
        <div className="w-10 h-10 border-3 border-[#005EB8] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading...</p>
      </div>
    </div>
  );
}

type Page = 'landing' | 'patient-login' | 'staff-login' | 'register' | 'staff'
  | 'display' | 'tracker' | 'appointment' | 'pharmacy' | 'history' | 'super-admin' | 'super-admin-login' | 'hospital-landing';

interface PageState {
  tokenNumber?: number;
  phone?: string;
  tab?: string;
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
  const [tenantInvalid, setTenantInvalid] = useState(false);

  // ── Tenant Resolution & Theme Sync ───────────────────────
  useEffect(() => {
    async function initTenant() {
      setTenantLoading(true);
      const slug = getTenantSlug();
      if (slug) {
        const config = await resolveTenantConfig(slug);
        if (config) {
          setTenantInvalid(false);
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
          setTenantInvalid(true);
          setTenant(null);
          document.title = 'Hospital Not Found | MedQueue';
        }
      } else {
        setTenantInvalid(false);
        setTenant(null);
        document.title = 'MedQueue | Enterprise Healthcare Operations Cloud';
        
        // Reset primary colors to standard/default MedQueue blue
        document.documentElement.style.setProperty('--primary-color', '#005EB8');
        let styleEl = document.getElementById('mq-tenant-theme-styles');
        if (styleEl) {
          styleEl.innerHTML = ''; // Clear custom styles
        }
      }
      setTenantLoading(false);
    }
    initTenant();
  }, [window.location.pathname, page]);

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

        if (cached.type === 'patient') {
          setPage('register');
        } else if (cached.type === 'staff') {
          if (cached.role === 'SUPER_ADMIN') {
            setPage('super-admin');
          } else if (cached.role === 'PHARMACY') {
            setPage('pharmacy');
          } else {
            setPage('staff');
          }
        }
      } else {
        const slug = getTenantSlug();
        const initialPage = getPageFromPath(window.location.pathname, slug);
        setPage(initialPage);
      }
      setAuthLoading(false);
    }
    restoreSession();
  }, []);

  // ── Browser Routing Sync & History Integration ─────────
  function getPathFromPage(p: Page, slug: string | null): string {
    if (!slug) {
      if (p === 'super-admin') return '/super-admin';
      if (p === 'super-admin-login') return '/super-admin-login';
      return '/';
    }
    
    switch (p) {
      case 'hospital-landing':
        return `/h/${slug}`;
      case 'patient-login':
        return `/h/${slug}/patient`;
      case 'staff-login':
        return `/h/${slug}/staff`;
      case 'register':
        return `/h/${slug}/patient`;
      case 'tracker':
        return `/h/${slug}/track`;
      case 'appointment':
        return `/h/${slug}/book`;
      case 'history':
        return `/h/${slug}/patient`;
      case 'staff':
        return `/h/${slug}/staff`;
      case 'pharmacy':
        return `/h/${slug}/staff`;
      case 'display':
        return `/h/${slug}/track`;
      case 'super-admin':
        return '/super-admin';
      case 'super-admin-login':
        return '/super-admin-login';
      default:
        return `/h/${slug}`;
    }
  }

  function getPageFromPath(path: string, slug: string | null): Page {
    if (!slug) {
      if (path.startsWith('/super-admin-login')) return 'super-admin-login';
      if (path.startsWith('/super-admin')) return 'super-admin';
      return 'landing';
    }
    
    const cleanPath = path.toLowerCase().trim();
    
    if (cleanPath.endsWith('/patient')) {
      const cachedUser = getCachedUser();
      if (cachedUser && cachedUser.type === 'patient') {
        return 'register';
      }
      return 'patient-login';
    }
    if (cleanPath.endsWith('/staff')) {
      const cachedUser = getCachedUser();
      if (cachedUser && cachedUser.type === 'staff') {
        if (cachedUser.role === 'PHARMACY') return 'pharmacy';
        return 'staff';
      }
      return 'staff-login';
    }
    if (cleanPath.endsWith('/admin')) {
      return 'staff';
    }
    if (cleanPath.endsWith('/track')) {
      return 'tracker';
    }
    if (cleanPath.endsWith('/book')) {
      return 'appointment';
    }
    
    // Exact match for `/h/:slug` (no trailing sub-routes)
    const slugPattern = new RegExp(`^/h/${slug}/?$`, 'i');
    if (slugPattern.test(cleanPath)) {
      return 'hospital-landing';
    }
    
    const cachedUser = getCachedUser();
    if (cachedUser) {
      if (cachedUser.type === 'staff') return 'staff';
      return 'register';
    }
    return 'hospital-landing';
  }

  // Listen to popstate event (browser back/forward button clicks)
  useEffect(() => {
    const handlePopState = () => {
      const slug = getTenantSlug();
      const resolvedPage = getPageFromPath(window.location.pathname, slug);
      setPage(resolvedPage);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function navigate(p: string, state?: Record<string, unknown>) {
    const pageTarget = p as Page;
    setPage(pageTarget);
    if (state) setPageState(state as PageState);
    setShowUserMenu(false);

    // Update browser history URL
    const slug = getTenantSlug();
    const targetPath = getPathFromPage(pageTarget, slug);
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
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
    setPage('register');
  }

  // ── Tenant Loading ────────────────────────────────────
  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-[#F4F8FB] flex items-center justify-center">
        <div className="text-center text-slate-800 animate-fade-in">
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
        <div className="text-center text-white animate-fade-in">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-semibold">Loading MedQueue...</p>
        </div>
      </div>
    );
  }

  if (isMissingConfig) return <SetupBanner />;

  function renderMainContent() {
    // ── Hospital Not Found Fallback Screen ─────────────────
  if (tenantInvalid) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Backdrop premium gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#005EB8]/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-rose-500/5 rounded-full blur-[140px] pointer-events-none" />

        <div className="w-full max-w-xl bg-white/[0.02] backdrop-blur-2xl border border-white/[0.08] p-8 sm:p-12 rounded-[36px] shadow-2xl relative z-10 text-center flex flex-col items-center animate-fade-in animate-duration-500">
          <div className="w-18 h-18 rounded-3xl flex items-center justify-center mb-6 shadow-xl border bg-rose-500/10 border-rose-500/20 text-rose-400">
            <AlertTriangle className="w-9 h-9" />
          </div>

          <h2 className="text-3xl font-black text-white tracking-tight mb-3">
            Hospital Not Found
          </h2>

          <p className="text-slate-400 text-sm leading-relaxed mb-8 px-4 font-semibold">
            We were unable to locate a registered clinic workspace matching this URL slug. 
            Please check the spelling or select a valid clinical node.
          </p>

          {/* Supportive info card */}
          <div className="w-full bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 mb-8 text-left space-y-3">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Need Assistance?</h4>
            <div className="flex items-center gap-3 text-xs text-slate-300 font-semibold">
              <Mail className="w-4 h-4 text-[#005EB8]" />
              <span>support@medqueue.com</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-300 font-semibold">
              <Phone className="w-4 h-4 text-[#00A3AD]" />
              <span>+1 (800) 555-QUEUE</span>
            </div>
          </div>

          <div className="w-full flex flex-col sm:flex-row gap-3.5 justify-center">
            <a 
              href="mailto:support@medqueue.com"
              className="px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-2"
            >
              Contact Support
            </a>
            
            <a 
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setTenantInvalid(false);
                setTenant(null);
                setPage('landing');
                window.history.pushState(null, '', '/');
              }}
              className="px-6 py-3.5 bg-[#005EB8] hover:bg-[#004a96] text-white font-extrabold text-xs rounded-2xl transition-all shadow-lg shadow-[#005EB8]/20 flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Return to MedQueue
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Tenant Mismatch Interceptor ──────────────────────
  const isTenantMismatch = tenant && user && user.type !== 'patient' && user.role !== 'SUPER_ADMIN' && user.hospital_id !== tenant?.id;

  if (isTenantMismatch) {
    const userHospName = user.hospital_id === 'd290f1ee-6c54-4b01-90e6-d701748f0851' ? 'Apollo Clinic' :
                         user.hospital_id === 'a4220b22-83b3-4f9e-a89e-cb01748ff002' ? 'Max Health' :
                         user.hospital_id === '7e90a5fe-4b01-90c6-ff22-a701748f0222' ? 'City Hospital' : 'Another Branch';
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Backdrop gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#005EB8]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-lg bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-8 rounded-[32px] shadow-2xl relative z-10 text-center flex flex-col items-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg border bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse">
            <ShieldAlert className="w-8 h-8" />
          </div>
          
          <h2 className="text-2xl font-extrabold text-white tracking-tight mb-3">
            Cross-Tenant Sandbox Lock
          </h2>
          
          <div className="text-slate-400 text-sm leading-relaxed mb-8 px-2 font-medium">
            Your active {user.type === 'patient' ? 'patient session' : `staff account (${user.role})`} belongs strictly to <span className="text-white font-extrabold">{userHospName}</span>.
            <br /><br />
            You are attempting to access the isolated workspace for <span className="text-amber-400 font-extrabold">{tenant?.name}</span>.
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
    return (
      <Suspense fallback={<PageLoader />}>
        <LandingPage
          onGetStarted={() => setPage('patient-login')}
          onStaffLogin={() => setPage('staff-login')}
        />
      </Suspense>
    );
  }

  // ── Patient login ─────────────────────────────────────
  if (page === 'patient-login' && !user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <PatientLoginPage
          onLogin={handlePatientLogin}
          onLogoClick={() => {
            const slug = getTenantSlug();
            navigate(slug ? 'hospital-landing' : 'landing');
          }}
          onBack={() => {
            const slug = getTenantSlug();
            if (window.history.length > 1) {
              window.history.back();
            } else {
              navigate(slug ? 'hospital-landing' : 'landing');
            }
          }}
        />
      </Suspense>
    );
  }

  // ── Staff login ───────────────────────────────────────
  if (page === 'staff-login' && !user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <StaffLoginPage
          onLogin={(u) => { 
            setUser(u); 
            const slug = getTenantSlug();
            const homePage = getHomeRoute(u, slug);
            setPage(homePage as Page);
          }}
          onLogoClick={() => {
            const slug = getTenantSlug();
            navigate(slug ? 'hospital-landing' : 'landing');
          }}
          onBack={() => {
            const slug = getTenantSlug();
            if (window.history.length > 1) {
              window.history.back();
            } else {
              navigate(slug ? 'hospital-landing' : 'landing');
            }
          }}
        />
      </Suspense>
    );
  }

  // ── Super Admin Login (Secret Secure Portal) ───────────
  if (page === 'super-admin-login' && !user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <SuperAdminLoginPage
          onLogin={(u) => {
            sessionStorage.removeItem('mq_superadmin_portal_active');
            setUser(u);
            setPage('super-admin');
          }}
          onBack={() => {
            sessionStorage.removeItem('mq_superadmin_portal_active');
            setPage('landing');
          }}
        />
      </Suspense>
    );
  }

  // ── Hospital Workspace Landing ─────────────────────────
  if (page === 'hospital-landing' && tenant) {
    return (
      <div className="min-h-screen bg-[#F4F8FB]">
        <UniversalHeader page={page} navigate={navigate} currentUser={user} handleLogout={handleLogout} />
        <Suspense fallback={<PageLoader />}>
          <HospitalLandingPage tenant={tenant} navigate={navigate} />
        </Suspense>
      </div>
    );
  }

  // ── Not logged in → landing ───────────────────────────
  if (!user) {
    if (tenant) {
      if (page === 'staff-login') {
        return (
          <Suspense fallback={<PageLoader />}>
            <StaffLoginPage
              onLogin={(u) => { 
                setUser(u); 
                const slug = getTenantSlug();
                const homePage = getHomeRoute(u, slug);
                setPage(homePage as Page);
              }}
              onLogoClick={() => {
                const slug = getTenantSlug();
                navigate(slug ? 'hospital-landing' : 'landing');
              }}
              onBack={() => {
                const slug = getTenantSlug();
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  navigate(slug ? 'hospital-landing' : 'landing');
                }
              }}
            />
          </Suspense>
        );
      }
      return (
        <Suspense fallback={<PageLoader />}>
          <PatientLoginPage
            onLogin={handlePatientLogin}
            onLogoClick={() => {
              const slug = getTenantSlug();
              navigate(slug ? 'hospital-landing' : 'landing');
            }}
            onBack={() => {
              const slug = getTenantSlug();
              if (window.history.length > 1) {
                window.history.back();
              } else {
                navigate(slug ? 'hospital-landing' : 'landing');
              }
            }}
          />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<PageLoader />}>
        <LandingPage
          onGetStarted={() => setPage('patient-login')}
          onStaffLogin={() => setPage('staff-login')}
        />
      </Suspense>
    );
  }

  // ── Subscription Blockade Interceptor ────────────────
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Backdrop gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#005EB8]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-50/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-lg bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-8 rounded-[32px] shadow-2xl relative z-10 text-center flex flex-col items-center animate-fade-in">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg border ${
            subscriptionStatus === 'HOLD' 
              ? 'bg-amber-50/10 border-amber-50/20 text-amber-400' 
              : 'bg-rose-50/10 border-rose-50/20 text-rose-400'
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
                  ? 'bg-amber-50 hover:bg-amber-600 text-slate-950 shadow-amber-500/10'
                  : 'bg-rose-50 hover:bg-rose-600 text-white shadow-rose-500/10'
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
      <Suspense fallback={<PageLoader />}>
        <div>
          <div className="fixed top-0 left-0 right-0 z-50 flex justify-end p-2">
            <button onClick={() => navigate('staff')}
              aria-label="Exit display board and return to staff dashboard"
              className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm transition-colors border border-white/30">
              Exit Display
            </button>
          </div>
          <DisplayBoard />
        </div>
      </Suspense>
    );
  }

  // ── Pharmacy ──────────────────────────────────────────
  if (page === 'pharmacy') {
    const isAuthorized = user && (user.role === 'PHARMACY' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');
    if (!isAuthorized) {
      return (
        <div className="min-h-screen bg-[#F4F8FB]">
          <UniversalHeader page={page} navigate={navigate} currentUser={user} handleLogout={handleLogout} />
          <div className="max-w-md mx-auto px-4 py-24 text-center animate-fade-in">
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
        <main id="main-content" role="main" key={page} className="animate-fade-in">
          <Suspense fallback={<PageLoader />}>
            <PharmacyDashboard currentUser={user} />
          </Suspense>
        </main>
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#E8F3FF] overflow-x-hidden w-full relative">
      {/* Accessibility: Skip to main content link */}
      <a href="#main-content" className="sr-only">Skip to main content</a>

      {user?.type !== 'patient' && (
        <UniversalHeader page={page} navigate={navigate} currentUser={user} handleLogout={handleLogout} />
      )}

      {/* Mobile bottom nav for patients */}
      {user.type === 'patient' && page !== 'register' && (
        <nav
          role="navigation"
          aria-label="Patient mobile navigation"
          className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 z-40 md:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.03)] pb-[env(safe-area-inset-bottom,0px)]"
        >
          <div className="grid grid-cols-3 h-16">
            {[
              { id: 'register', label: 'Workspace', icon: <Home className="w-5.5 h-5.5" /> },
              { id: 'tracker', label: 'Live Queue', icon: <Clock className="w-5.5 h-5.5" /> },
              { id: 'history', label: 'History', icon: <FileText className="w-5.5 h-5.5" /> },
            ].map(link => (
              <button key={link.id} onClick={() => navigate(link.id)}
                aria-label={`Navigate to ${link.label}`}
                aria-current={page === link.id ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1.5 transition-all duration-300 ${
                  page === link.id ? 'text-[#005EB8] scale-105 font-extrabold' : 'text-gray-400 font-semibold'
                }`}>
                {link.icon}
                <span className="text-[10px] uppercase tracking-wider">{link.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {showUserMenu && <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />}

      {/* Super Admin context banner */}
      {user && user.role === 'SUPER_ADMIN' && page === 'staff' && (
        <div className="bg-amber-50 text-white text-xs font-bold px-4 py-2 text-center flex items-center justify-center gap-2 shadow-inner" role="status">
          <span>🕵️‍♂️ Super Admin Mode: Currently managing </span>
          <span className="underline decoration-2 font-black">
            {localStorage.getItem('mq_selected_hospital_id') === 'd290f1ee-6c54-4b01-90e6-d701748f0851' ? 'Apollo Clinic' :
             localStorage.getItem('mq_selected_hospital_id') === 'a4220b22-83b3-4f9e-a89e-cb01748ff002' ? 'Max Health' :
             localStorage.getItem('mq_selected_hospital_id') === '7e90a5fe-4b01-90c6-ff22-a701748f0222' ? 'City Hospital' : 
             'Selected Clinic'}
          </span>
          <button 
            onClick={() => navigate('super-admin')}
            aria-label="Return to Super Admin central controller"
            className="ml-4 bg-white/20 hover:bg-white/30 text-white rounded-md px-2 py-0.5 border border-white/20 transition-all font-extrabold"
          >
            Back to Central Controller ➜
          </button>
        </div>
      )}

      <main id="main-content" role="main" key={page} className={`animate-fade-in ${user.type === 'patient' ? 'pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0' : ''}`}>
        <Suspense fallback={<PageLoader />}>
          {page === 'register' && <PatientWorkspace currentUser={user} navigate={navigate} tenant={tenant} initialTab={pageState.tab} />}
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
        </Suspense>
      </main>
      <OfflineIndicator />
    </div>
  );
}

return (
  <>
    {renderMainContent()}
    <CookieBanner />
  </>
);
}

