import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AuthUser } from '../lib/auth';
import { getTenantSlug, resolveTenantConfig, getHomeRoute } from '../lib/tenant';
import { 
  Pill, Activity, Bell, Search, ShieldAlert, LogOut, Settings, 
  ChevronDown, User, BarChart2,
  Calendar, FileText, Building2, Menu, X
} from 'lucide-react';

interface Props {
  page: string;
  navigate: (p: any, state?: any) => void;
  currentUser: AuthUser | null;
  handleLogout: () => void;
}

export default function UniversalHeader({ page, navigate, currentUser, handleLogout }: Props) {
  const hospitalId = (currentUser?.role === 'SUPER_ADMIN' ? (localStorage.getItem('mq_selected_hospital_id') || currentUser?.hospital_id) : currentUser?.hospital_id) || localStorage.getItem('mq_selected_hospital_id') || 'd290f1ee-6c54-4b01-90e6-d701748f0851';

  // ── Hospital Context States ────────────────────────────────
  const [resolvedHospitalId, setResolvedHospitalId] = useState<string>(hospitalId);
  const [hospitalName, setHospitalName] = useState<string>('');
  const [hospitalLocation, setHospitalLocation] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [showQuickActions, setShowQuickActions] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState<boolean>(false);
  const [showPortalMenu, setShowPortalMenu] = useState<boolean>(false);

  // ── Live Telemetry Metrics (fetched for emergency banner only) ───────────
  const [emergencyActive, setEmergencyActive] = useState<boolean>(false);

  // ── Fetch dynamic hospital context and metrics ─────────────
  useEffect(() => {
    async function loadHospitalDetails() {
      try {
        // Detect path/query slug strictly from URL
        const pathParts = window.location.pathname.split('/');
        const hIndex = pathParts.indexOf('h');
        let slug: string | null = null;
        if (hIndex !== -1 && pathParts[hIndex + 1]) {
          slug = pathParts[hIndex + 1].toLowerCase().trim();
        } else {
          const params = new URLSearchParams(window.location.search);
          const querySlug = params.get('hosp') || params.get('h');
          if (querySlug) {
            slug = querySlug.toLowerCase().trim();
          }
        }

        let details: { id: string; name: string; slug: string; logo_url?: string; address?: string } | null = null;

        if (slug) {
          details = await resolveTenantConfig(slug);
        } else if (currentUser) {
          const { data, error } = await supabase
            .from('hospitals')
            .select('*')
            .eq('id', hospitalId)
            .maybeSingle();
          if (!error && data) {
            details = data;
          }
        }

        if (details) {
          setHospitalName(details.name || 'Apollo Clinic');
          setHospitalLocation(details.slug ? `${details.slug.toUpperCase()} Campus` : 'Main Campus');
          setResolvedHospitalId(details.id);
          
          const brandFallbacks: Record<string, string> = {
            apollo: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&q=80&w=100',
            max: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=100',
            citycare: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=100',
            city: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=100'
          };
          setLogoUrl(details.logo_url || brandFallbacks[details.slug] || null);
        } else {
          setHospitalName('');
          setHospitalLocation('');
          setLogoUrl(null);
        }
      } catch (e) {
        console.warn('Failed to resolve hospital branch context:', e);
      }
    }

    loadHospitalDetails();
  }, [hospitalId, window.location.pathname]);

  // Fetch operational telemetry metrics in real-time
  useEffect(() => {
    async function fetchLiveMetrics() {
      try {
        // Only fetch emergency mode setting — other metrics removed from header UI
        const settingsRes = await supabase
          .from('system_settings')
          .select('emergency_mode')
          .eq('hospital_id', resolvedHospitalId)
          .maybeSingle();

        if (settingsRes.data) {
          setEmergencyActive(settingsRes.data.emergency_mode === true);
        }
      } catch (err) {
        console.warn('Operational metrics sync failed:', err);
      }
    }

    fetchLiveMetrics();
    const interval = setInterval(fetchLiveMetrics, 12000);
    return () => clearInterval(interval);
  }, [resolvedHospitalId]);

  // Real-time PostgreSQL trigger listener for settings (Emergency Mode sync)
  useEffect(() => {
    const channel = supabase
      .channel('header-settings-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: `hospital_id=eq.${resolvedHospitalId}`
        },
        (payload) => {
          if (payload.new && 'emergency_mode' in payload.new) {
            setEmergencyActive(payload.new.emergency_mode === true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedHospitalId]);

  // Display user role nicely
  const getRoleLabel = () => {
    if (currentUser?.role === 'SUPER_ADMIN') return 'Super Admin';
    if (currentUser?.role === 'ADMIN') return 'Clinic Admin';
    if (currentUser?.role === 'PHARMACY') return 'Pharmacist';
    if (currentUser?.role === 'DOCTOR') return 'Practitioner';
    if (currentUser?.type === 'patient') return 'Patient';
    return currentUser?.role || 'Staff';
  };

  // Get initials for profile placeholder
  const getInitials = () => {
    if (!currentUser?.name) return 'U';
    return currentUser.name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header className="sticky top-0 z-[60] w-full bg-white border-b border-slate-150 shadow-[0_1px_3px_rgba(0,0,0,0.02)] h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] select-none font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
        
        {/* ── LEFT SECTION: Product, Logo, and Hospital Isolation Context ── */}
        <div className="flex items-center gap-3.5 flex-shrink-0">
          <button 
            onClick={() => {
              const slug = getTenantSlug();
              const homePage = getHomeRoute(currentUser, slug);
              navigate(homePage);
            }} 
            className="flex items-center gap-2 hover:opacity-90 transition-opacity focus:outline-none"
          >
            <div className="w-8 h-8 rounded-xl bg-[#005EB8] flex items-center justify-center shadow-md shadow-[#005EB8]/20 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#005EB8] to-[#00A3AD] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Activity className="w-4.5 h-4.5 text-white relative z-10 animate-pulse" />
            </div>
            <span className="text-sm font-black text-slate-800 tracking-tight flex items-center">
              MedQueue
              <span className="text-[#00A3AD] text-base font-extrabold ml-0.5">.</span>
            </span>
          </button>

          {hospitalName && <div className="h-6 w-px bg-slate-200 hidden md:block" />}

          {/* Hospital Branch Context Details */}
          {hospitalName && (
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-black text-slate-700 leading-tight tracking-tight flex items-center gap-1.5">
                {logoUrl ? (
                  <img src={logoUrl} alt={hospitalName} className="w-5 h-5 rounded-lg object-cover shadow-sm border border-slate-150" />
                ) : (
                  <Building2 className="w-3.5 h-3.5 text-[#005EB8]" />
                )}
                {currentUser?.role === 'SUPER_ADMIN' ? (
                  page === 'super-admin' ? (
                    <span className="text-[#00A3AD] font-black">SaaS Cloud Control Center</span>
                  ) : (
                    <span>{hospitalName} <span className="text-[9px] text-[#00A3AD] font-black bg-[#00A3AD]/10 px-1.5 py-0.5 rounded ml-1 uppercase">Impersonating</span></span>
                  )
                ) : (
                  hospitalName
                )}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                {currentUser?.role === 'SUPER_ADMIN' && page === 'super-admin' ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00A3AD] shadow-[0_0_8px_#00A3AD] animate-pulse" />
                    <span>Global Platform Node</span>
                    <span className="text-slate-200">•</span>
                    <span className="font-mono text-[#00A3AD]">ID: CENTRAL</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981] animate-pulse" />
                    <span className="text-slate-500 font-black">{hospitalLocation} Workspace</span>
                    <span className="text-slate-200">•</span>
                    <span className="font-mono text-slate-400">Node: {hospitalId.substring(0, 8)}</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Center section removed for clean aesthetic */}
        <div className="hidden md:flex flex-1" />

        {/* ── RIGHT SECTION: Controls, Global Search, Actions, Profile Dropdown ── */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          
          {/* Global Search Box Widget */}
          <div className="relative hidden md:block flex-shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search MedQueue..." 
              className="pl-10 pr-9 py-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#005EB8] focus:bg-white w-[180px] md:w-[220px] lg:w-[280px] transition-all overflow-hidden truncate text-ellipsis"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-white border border-slate-200 px-1 rounded text-[8px] font-bold text-slate-400 shadow-sm pointer-events-none select-none font-mono">
              /
            </span>
          </div>

          {/* Dynamic Navigation shortcuts for staff role */}
          {currentUser?.type === 'staff' && (
            <div className="hidden md:flex gap-1">
              <button 
                onClick={() => navigate('staff')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  page === 'staff' ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                Clinic
              </button>
              
              {(currentUser?.role === 'PHARMACY' || currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN') && (
                <button 
                  onClick={() => navigate('pharmacy')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    page === 'pharmacy' ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Pharmacy
                </button>
              )}

              {currentUser?.role === 'SUPER_ADMIN' && (
                <button 
                  onClick={() => navigate('super-admin')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    page === 'super-admin' ? 'bg-[#00A3AD]/10 text-[#00A3AD]' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Central Controller
                </button>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="h-5 w-px bg-slate-200 hidden md:block" />

          {/* Patient Quick Actions Dropdown (Desktop only) */}
          {currentUser?.type === 'patient' && (
            <div className="relative">
              <button 
                onClick={() => { setShowQuickActions(!showQuickActions); setShowNotifications(false); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#005EB8] hover:bg-[#004a96] text-white text-[11px] font-black rounded-xl shadow-sm transition-all focus:outline-none active:scale-95"
              >
                <span>Quick Actions</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-250 ${showQuickActions ? 'rotate-180' : ''}`} />
              </button>
              {showQuickActions && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowQuickActions(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-150 py-1.5 z-50 overflow-hidden text-left animate-fade-in font-sans">
                    <button 
                      onClick={() => { navigate('register'); setShowQuickActions(false); }} 
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                      <Building2 className="w-3.5 h-3.5 text-[#005EB8]" /> Patient Workspace
                    </button>
                    {currentUser?.type !== 'patient' && (
                      <>
                        <button 
                          onClick={() => { navigate('appointment'); setShowQuickActions(false); }} 
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                        >
                          <Calendar className="w-3.5 h-3.5 text-[#00A3AD]" /> Book Appointment
                        </button>
                        <button 
                          onClick={() => { navigate('history'); setShowQuickActions(false); }} 
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-violet-500" /> Medical Records
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Alarm Center & Emergency Active alerts with Animated notifications */}
          <div className="relative">
            {emergencyActive ? (
              <button className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center animate-bounce focus:outline-none">
                <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
              </button>
            ) : (
              <button 
                onClick={() => { setShowNotifications(!showNotifications); setShowQuickActions(false); }}
                className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200 flex items-center justify-center relative focus:outline-none transition-all active:scale-95"
              >
                <Bell className="w-4 h-4 text-slate-500" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00A3AD] border-2 border-white animate-ping" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#00A3AD] border-2 border-white" />
              </button>
            )}

            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-[-32px] sm:right-0 mt-2 w-[280px] sm:w-72 bg-white rounded-2xl shadow-xl border border-slate-150 py-2.5 z-50 overflow-hidden text-left animate-fade-in font-sans">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Notifications</span>
                  </div>
                  <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <div className="font-extrabold text-slate-700">All Systems Nominal</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">MedQueue operations nodes are fully synced and active.</div>
                    </div>
                    {currentUser?.type === 'patient' && (
                      <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-100/30 text-xs">
                        <div className="font-extrabold text-[#005EB8]">Smart Wait Tracking</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Register a token to receive real-time queue notifications in this drawer.</div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mobile burger menu for all users */}
          <button 
            onClick={() => { setShowMobileDrawer(!showMobileDrawer); setShowNotifications(false); }}
            className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center md:hidden focus:outline-none transition-all active:scale-95"
          >
            <Menu className="w-4 h-4 text-slate-500" />
          </button>

          {/* User profile with initials & dropdown menu */}
          <div className="relative">
            {currentUser ? (
              <>
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all focus:outline-none text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#005EB8] text-white flex items-center justify-center font-black text-xs shadow-inner uppercase tracking-wider">
                    {getInitials()}
                  </div>
                  <div className="hidden sm:flex flex-col select-none pr-1">
                    <span className="text-xs font-bold text-slate-700 tracking-tight leading-tight max-w-[100px] truncate">{currentUser.name || currentUser.phone}</span>
                    <span className="text-[9px] font-bold text-[#005EB8] uppercase tracking-wider leading-none mt-0.5">{getRoleLabel()}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                    <div className="fixed sm:absolute top-[56px] sm:top-auto right-4 sm:right-0 w-[240px] sm:w-56 bg-white rounded-2xl shadow-xl border border-slate-150 py-1.5 z-50 overflow-hidden transform scale-100 transition-all font-sans">
                      
                      {/* Context Header */}
                      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                        <p className="font-extrabold text-slate-800 text-xs truncate">{currentUser.name || currentUser.phone}</p>
                        <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">{currentUser.email || currentUser.phone}</p>
                        <span className="inline-block text-[9px] font-black text-white bg-[#005EB8] px-2 py-0.5 rounded-full mt-1.5 tracking-wide uppercase">
                          {getRoleLabel()}
                        </span>
                      </div>

                      {/* Operational Links */}
                      <div className="py-1">
                        <button 
                          onClick={() => { navigate(currentUser.type === 'staff' ? 'staff' : 'register', { tab: 'profile' }); setShowProfileMenu(false); }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          My Control Profile
                        </button>
                        
                        {currentUser.type === 'staff' && (
                          <>
                            {(currentUser.role === 'PHARMACY' || currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                              <button 
                                onClick={() => { navigate('pharmacy'); setShowProfileMenu(false); }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                <Pill className="w-3.5 h-3.5 text-slate-400" />
                                Pharmacy Console
                              </button>
                            )}

                            <button 
                              onClick={() => { navigate('staff'); setShowProfileMenu(false); }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
                              Operations Overview
                            </button>
                          </>
                        )}
                      </div>

                      {/* Settings and Actions */}
                      <div className="border-t border-slate-100 pt-1">
                        <button 
                          onClick={() => setShowProfileMenu(false)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5 text-slate-400" />
                          Clinic Settings
                        </button>
                        
                        <button 
                          onClick={() => { setShowProfileMenu(false); handleLogout(); }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign Out (Exit Node)
                        </button>
                      </div>

                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="relative hidden md:block">
                <button 
                  onClick={() => { setShowPortalMenu(!showPortalMenu); setShowNotifications(false); }}
                  className="px-4 py-1.5 bg-[#005EB8] hover:bg-[#004a96] text-white text-xs font-black rounded-xl shadow-sm transition-all focus:outline-none active:scale-95 flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Choose Portal</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-250 ${showPortalMenu ? 'rotate-180' : ''}`} />
                </button>
                {showPortalMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPortalMenu(false)} />
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-150 py-1.5 z-50 overflow-hidden text-left animate-fade-in font-sans">
                      <button 
                        onClick={() => { navigate('patient-login'); setShowPortalMenu(false); }} 
                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                      >
                        <User className="w-4 h-4 text-[#005EB8]" /> Patient Portal
                      </button>
                      <button 
                        onClick={() => { navigate('staff-login'); setShowPortalMenu(false); }} 
                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                      >
                        <Building2 className="w-4 h-4 text-violet-500" /> Staff Secure Login
                      </button>
                      <button 
                        onClick={() => { navigate('tracker'); setShowPortalMenu(false); }} 
                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                      >
                        <Activity className="w-4 h-4 text-[#00A3AD]" /> Live Queue Tracker
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Unified Mobile Navigation Drawer */}
      {showMobileDrawer && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] transition-opacity duration-300 animate-fade-in"
            onClick={() => setShowMobileDrawer(false)}
          />
          <div className="fixed top-0 right-0 h-full w-[280px] bg-white shadow-2xl border-l border-slate-150 z-[100] pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] px-6 flex flex-col justify-between animate-slide-in font-sans">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Navigation</span>
                <button 
                  onClick={() => setShowMobileDrawer(false)}
                  className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-150 text-slate-400 focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Items Group */}
              <div className="space-y-2">
                {!currentUser ? (
                  // Logged Out Guests
                  <>
                    <button 
                      onClick={() => { navigate('patient-login'); setShowMobileDrawer(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all text-slate-600 hover:bg-slate-50"
                    >
                      <User className="w-4.5 h-4.5 text-[#005EB8]" />
                      Patient Portal
                    </button>
                    <button 
                      onClick={() => { navigate('staff-login'); setShowMobileDrawer(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all text-slate-600 hover:bg-slate-50"
                    >
                      <Building2 className="w-4.5 h-4.5 text-violet-500" />
                      Staff Secure Login
                    </button>
                    <button 
                      onClick={() => { navigate('tracker'); setShowMobileDrawer(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all text-slate-600 hover:bg-slate-50"
                    >
                      <Activity className="w-4.5 h-4.5 text-[#00A3AD]" />
                      Live Queue Tracker
                    </button>
                  </>
                ) : currentUser.type === 'patient' ? (
                  // Logged In Patients
                  <>
                    <button 
                      onClick={() => { navigate('register'); setShowMobileDrawer(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${page === 'register' ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <Building2 className="w-4.5 h-4.5" />
                      Patient Workspace
                    </button>
                  </>
                ) : (
                  // Logged In Staff (Doctor, Pharmacy, Admin, Super Admin)
                  <>
                    <button 
                      onClick={() => { navigate('staff'); setShowMobileDrawer(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                        page === 'staff' ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Activity className="w-4.5 h-4.5" />
                      Clinic Control Panel
                    </button>

                    {(currentUser.role === 'PHARMACY' || currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                      <button 
                        onClick={() => { navigate('pharmacy'); setShowMobileDrawer(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                          page === 'pharmacy' ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Pill className="w-4.5 h-4.5" />
                        Pharmacy Console
                      </button>
                    )}

                    {currentUser.role === 'SUPER_ADMIN' && (
                      <button 
                        onClick={() => { navigate('super-admin'); setShowMobileDrawer(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all ${
                          page === 'super-admin' ? 'bg-[#00A3AD]/10 text-[#00A3AD]' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Building2 className="w-4.5 h-4.5" />
                        Central Cloud Controller
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Quick Context & Sign Out */}
            {currentUser && (
              <div className="space-y-4 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#005EB8] text-white flex items-center justify-center font-black text-sm uppercase">
                    {getInitials()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-800 text-xs truncate leading-tight">{currentUser.name || currentUser.phone}</p>
                    <p className="text-[10px] text-[#005EB8] font-bold uppercase tracking-wider mt-0.5">{getRoleLabel()}</p>
                  </div>
                </div>

                <button 
                  onClick={() => { setShowMobileDrawer(false); handleLogout(); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 border border-rose-100 text-rose-600 font-extrabold text-xs rounded-2xl transition-all active:scale-95"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out (Exit Node)
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </header>
  );
}
