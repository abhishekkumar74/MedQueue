import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AuthUser } from '../lib/auth';
import { 
  Pill, Activity, Bell, Search, ShieldAlert, LogOut, Settings, 
  ChevronDown, User, BarChart2,
  Clock, Calendar, FileText, Home, Building2
} from 'lucide-react';

interface Props {
  page: string;
  navigate: (p: any, state?: any) => void;
  currentUser: AuthUser;
  handleLogout: () => void;
}

export default function UniversalHeader({ page, navigate, currentUser, handleLogout }: Props) {
  const hospitalId = (currentUser?.role === 'SUPER_ADMIN' ? (localStorage.getItem('mq_selected_hospital_id') || currentUser?.hospital_id) : currentUser?.hospital_id) || localStorage.getItem('mq_selected_hospital_id') || 'd290f1ee-6c54-4b01-90e6-d701748f0851';

  // ── Hospital Context States ────────────────────────────────
  const [hospitalName, setHospitalName] = useState<string>('Apollo Clinic');
  const [hospitalLocation, setHospitalLocation] = useState<string>('Main Campus');
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  const [showQuickActions, setShowQuickActions] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  // ── Live Telemetry Metrics (fetched for emergency banner only) ───────────
  const [emergencyActive, setEmergencyActive] = useState<boolean>(false);

  // ── Fetch dynamic hospital context and metrics ─────────────
  useEffect(() => {
    async function loadHospitalDetails() {
      try {
        const { data, error } = await supabase
          .from('hospitals')
          .select('*')
          .eq('id', hospitalId)
          .maybeSingle();

        if (!error && data) {
          setHospitalName(data.name || 'Apollo Clinic');
          setHospitalLocation(data.slug ? `${data.slug.toUpperCase()} Campus` : 'Main Campus');
        }
      } catch (e) {
        console.warn('Failed to resolve hospital branch context:', e);
      }
    }

    loadHospitalDetails();
  }, [hospitalId]);

  // Fetch operational telemetry metrics in real-time
  useEffect(() => {
    async function fetchLiveMetrics() {
      try {
        // Only fetch emergency mode setting — other metrics removed from header UI
        const settingsRes = await supabase
          .from('system_settings')
          .select('emergency_mode')
          .eq('hospital_id', hospitalId)
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
  }, [hospitalId]);

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
          filter: `hospital_id=eq.${hospitalId}`
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
  }, [hospitalId]);

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
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-150 shadow-[0_1px_3px_rgba(0,0,0,0.02)] h-14 select-none font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-4">
        
        {/* ── LEFT SECTION: Product, Logo, and Hospital Isolation Context ── */}
        <div className="flex items-center gap-3.5 flex-shrink-0">
          <button 
            onClick={() => navigate(currentUser.type === 'staff' ? 'staff' : 'register')} 
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

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          {/* Hospital Branch Context Details */}
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-black text-slate-700 leading-tight tracking-tight flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-[#005EB8]" />
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
                  <span>Global Platform Node</span>
                  <span className="text-slate-200">•</span>
                  <span className="font-mono text-[#00A3AD]">ID: CENTRAL</span>
                </>
              ) : (
                <>
                  <span>{hospitalLocation}</span>
                  <span className="text-slate-200">•</span>
                  <span className="font-mono text-slate-400">ID: {hospitalId.substring(0, 8)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center section removed for clean aesthetic */}
        <div className="hidden md:flex flex-1" />

        {/* ── RIGHT SECTION: Controls, Global Search, Actions, Profile Dropdown ── */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          
          {/* Global Search Box Widget */}
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search MedQueue..." 
              className="pl-7.5 pr-8 py-1 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#005EB8] focus:bg-white w-44 transition-all"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-white border border-slate-200 px-1 rounded text-[8px] font-bold text-slate-400 shadow-sm pointer-events-none select-none font-mono">
              /
            </span>
          </div>

          {/* Dynamic Navigation shortcuts for staff role */}
          {currentUser.type === 'staff' && (
            <div className="hidden md:flex gap-1">
              <button 
                onClick={() => navigate('staff')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  page === 'staff' ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                Clinic
              </button>
              
              {(currentUser.role === 'PHARMACY' || currentUser.role === 'ADMIN' || currentUser.role === 'SUPER_ADMIN') && (
                <button 
                  onClick={() => navigate('pharmacy')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    page === 'pharmacy' ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Pharmacy
                </button>
              )}

              {currentUser.role === 'SUPER_ADMIN' && (
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
          {currentUser.type === 'patient' && (
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
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-150 py-2.5 z-50 overflow-hidden text-left animate-fade-in font-sans">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Notifications</span>
                  </div>
                  <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                      <div className="font-extrabold text-slate-700">All Systems Nominal</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">MedQueue operations nodes are fully synced and active.</div>
                    </div>
                    {currentUser.type === 'patient' && (
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

          {/* User profile with initials & dropdown menu */}
          <div className="relative">
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
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-150 py-1.5 z-50 overflow-hidden transform scale-100 transition-all font-sans">
                  
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
                      onClick={() => { navigate(currentUser.type === 'staff' ? 'staff' : 'register'); setShowProfileMenu(false); }}
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
          </div>

        </div>

      </div>
    </header>
  );
}
