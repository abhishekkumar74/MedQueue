import { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import PatientLoginPage from './pages/PatientLoginPage';
import StaffLoginPage from './pages/StaffLoginPage';
import RegisterPage from './pages/RegisterPage';
import StaffDashboard from './pages/StaffDashboard';
import DisplayBoard from './pages/DisplayBoard';
import LiveTokenTracker from './pages/LiveTokenTracker';
import AppointmentBooking from './pages/AppointmentBooking';
import PharmacyDashboard from './pages/PharmacyDashboard';
import PatientHistory from './pages/PatientHistory';
import OfflineIndicator from './components/OfflineIndicator';
import SetupBanner from './components/SetupBanner';
import { isMissingConfig } from './lib/supabase';
import { AuthUser, getCachedUser, fetchMe, logout, getAccessToken } from './lib/auth';
import { getTokenStatus } from './lib/api';
import { LogOut, User, Clock, Calendar, FileText, Home } from 'lucide-react';

type Page = 'landing' | 'patient-login' | 'staff-login' | 'register' | 'staff'
  | 'display' | 'tracker' | 'appointment' | 'pharmacy' | 'history';

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

  // ── Session restore ───────────────────────────────────
  useEffect(() => {
    async function restoreSession() {
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
          setPage('staff');
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
    setPage('landing');
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
      onBack={() => setPage('landing')}
    />;
  }

  // ── Staff login ───────────────────────────────────────
  if (page === 'staff-login' && !user) {
    return <StaffLoginPage
      onLogin={(u) => { setUser(u); setPage('staff'); }}
      onBack={() => setPage('landing')}
    />;
  }

  // ── Not logged in → landing ───────────────────────────
  if (!user) {
    return <LandingPage
      onGetStarted={() => setPage('patient-login')}
      onStaffLogin={() => setPage('staff-login')}
    />;
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
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-[#005EB8] px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('staff')} className="text-white/80 hover:text-white text-sm font-medium">
            ← Staff Portal
          </button>
          <UserBadge user={user} onLogout={handleLogout} />
        </div>
        <PharmacyDashboard />
      </div>
    );
  }

  // ── Main layout ───────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#E8F3FF]">
      {/* Top bar */}
      <div className="bg-[#005EB8] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => navigate(user.type === 'staff' ? 'staff' : 'register')}
            className="flex items-center gap-2 text-white font-bold text-lg">
            <span>🏥</span> MedQueue
          </button>

          {/* Nav links */}
          <div className="hidden md:flex gap-1">
            {user.type === 'patient' && (
              <>
                {[
                  { id: 'register', label: 'Register', icon: <Home className="w-4 h-4" /> },
                  { id: 'tracker', label: 'My Token', icon: <Clock className="w-4 h-4" /> },
                  { id: 'appointment', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
                  { id: 'history', label: 'History', icon: <FileText className="w-4 h-4" /> },
                ].map(link => (
                  <button key={link.id} onClick={() => navigate(link.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      page === link.id ? 'bg-[#00A3AD] text-white' : 'text-blue-100 hover:bg-blue-700'
                    }`}>
                    {link.icon}
                    {link.label}
                  </button>
                ))}
              </>
            )}
            {user.type === 'staff' && (
              <>
                {[
                  { id: 'staff', label: 'Dashboard' },
                  { id: 'display', label: 'Display Board' },
                ].map(link => (
                  <button key={link.id} onClick={() => navigate(link.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      page === link.id ? 'bg-[#00A3AD] text-white' : 'text-blue-100 hover:bg-blue-700'
                    }`}>
                    {link.label}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button onClick={() => setShowUserMenu(s => !s)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition-colors">
              <User className="w-4 h-4" />
              <span className="text-sm font-medium max-w-[120px] truncate">{user.name || user.phone || 'User'}</span>
              {user.role && <span className="text-xs bg-[#00A3AD] px-2 py-0.5 rounded-full">{user.role}</span>}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="font-semibold text-gray-800 text-sm truncate">{user.name || user.phone}</p>
                  <p className="text-xs text-gray-500">{user.email || user.phone}</p>
                  {user.role && <p className="text-xs text-[#005EB8] font-bold mt-0.5">{user.role}</p>}
                </div>
                {user.type === 'patient' && (
                  <button onClick={() => { navigate('history'); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <FileText className="w-4 h-4" />
                    My Health Records
                  </button>
                )}
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom nav for patients */}
      {user.type === 'patient' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 md:hidden">
          <div className="grid grid-cols-4 h-16">
            {[
              { id: 'register', label: 'Register', icon: <Home className="w-5 h-5" /> },
              { id: 'tracker', label: 'Token', icon: <Clock className="w-5 h-5" /> },
              { id: 'appointment', label: 'Schedule', icon: <Calendar className="w-5 h-5" /> },
              { id: 'history', label: 'History', icon: <FileText className="w-5 h-5" /> },
            ].map(link => (
              <button key={link.id} onClick={() => navigate(link.id)}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  page === link.id ? 'text-[#005EB8]' : 'text-gray-400'
                }`}>
                {link.icon}
                <span className="text-xs font-medium">{link.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showUserMenu && <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />}

      <main className={user.type === 'patient' ? 'pb-16 md:pb-0' : ''}>
        {page === 'register' && <RegisterPage onNavigate={navigate} currentUser={user} />}
        {page === 'staff' && <StaffDashboard onNavigate={navigate} currentUser={user} />}
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

function UserBadge({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-white text-sm font-medium">{user.name}</span>
      <button onClick={onLogout} className="text-white/70 hover:text-white">
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
