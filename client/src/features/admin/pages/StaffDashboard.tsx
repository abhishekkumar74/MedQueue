import { useState, useEffect, useCallback } from 'react';
import { AuthUser } from '../../../lib/auth';
import { WardBoyIntake } from '../../queue';
import { DoctorPanel } from '../../doctor';
import AdminDashboard from './AdminDashboard';
import { getQueue, getSelectedHospitalId } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { Token, PatientIntake, Department, DEPARTMENT_LABEL } from '../../../types';
import { 
  Shield, RefreshCw, AlertCircle, Users, Search, Building2, MapPin, 
  Activity, ShieldAlert, ChevronDown
} from 'lucide-react';

interface Props {
  onNavigate?: (p: string) => void;
  currentUser?: AuthUser | null;
}

/**
 * StaffDashboard — automatically shows the correct panel based on role.
 * Doctor  → DoctorPanel (filtered to their department)
 * Ward Boy → WardBoyDashboard (filtered to their department)
 * Pharmacy → PharmacyDashboard (redirect)
 * Admin   → AdminDashboard (full overview)
 */
export default function StaffDashboard({ onNavigate, currentUser }: Props) {

  // Auto-redirect pharmacy to pharmacy page
  useEffect(() => {
    if (currentUser?.role === 'PHARMACY') {
      onNavigate?.('pharmacy');
    }
  }, [currentUser?.role, onNavigate]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Not logged in</p>
      </div>
    );
  }

  const role = currentUser.role;

  // ── DOCTOR: sees only their department queue ──────────────
  if (role === 'DOCTOR') {
    return (
      <DoctorPanel
        doctorDepartment={currentUser.department}
        doctorName={currentUser.name}
        roomNumber={currentUser.room_number}
        doctorStaffId={currentUser.id}
      />
    );
  }

  // ── WARD BOY: sees triage intake operations workspace ────
  if (role === 'WARD_BOY') {
    return <WardBoyDashboard department={currentUser.department} />;
  }

  // ── PHARMACY: redirect handled in useEffect ───────────────
  if (role === 'PHARMACY') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400">Redirecting to Pharmacy...</p>
      </div>
    );
  }

  // ── ADMIN / SUPER_ADMIN: full overview ────────────────────
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return <AdminDashboard onNavigate={onNavigate} currentUser={currentUser} />;
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Unknown role: {role}</p>
        <p className="text-gray-400 text-sm">Contact your administrator</p>
      </div>
    </div>
  );
}

// ── Ward Boy Dashboard ────────────────────────────────────────────────────────

interface WardBoyDashboardProps {
  department?: string; // if set, only show patients from this department
}

interface DoctorListRow {
  id: string;
  name: string;
  department: string;
  room_number: string;
  is_available: boolean;
}

function WardBoyDashboard({ department }: WardBoyDashboardProps) {
  const [queue, setQueue] = useState<{
    waiting: Array<Token & { patient_intake?: PatientIntake[] }>;
    serving: (Token & { patient_intake?: PatientIntake[] }) | null;
  }>({ waiting: [], serving: null });
  
  const [doctors, setDoctors] = useState<DoctorListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  
  // Interactive UI State
  const [activeIntake, setActiveIntake] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'needs-intake' | 'ready'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const currentHospitalId = getSelectedHospitalId();

  // ── Load database queue and active staff ────────────────────────
  const fetchQueue = useCallback(async (showSyncLoader = false) => {
    if (showSyncLoader) setSyncing(true);
    try {
      // 1. Fetch live queue tokens
      const data = await getQueue(department);
      setQueue(data);

      // 2. Fetch all registered doctors (regardless of availability) for sidebar
      const { data: staffDoctors } = await supabase
        .from('doctors')
        .select('id, name, department, room_number, is_available')
        .eq('hospital_id', currentHospitalId);

      setDoctors(staffDoctors || []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to synchronize triage metrics');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [department, currentHospitalId]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(() => fetchQueue(false), 6000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Compute Active Doctor Patient Loads
  const getDoctorLoadMap = () => {
    const loadMap: Record<string, number> = {};
    queue.waiting.forEach(t => {
      if (t.room_number) {
        loadMap[t.room_number] = (loadMap[t.room_number] || 0) + 1;
      }
    });
    if (queue.serving?.room_number) {
      loadMap[queue.serving.room_number] = (loadMap[queue.serving.room_number] || 0) + 1;
    }
    return loadMap;
  };

  const doctorLoadMap = getDoctorLoadMap();

  // ── Emergency Alarm / Threshold Checking ────────────────────────
  const isEmergencyVital = (intake?: PatientIntake) => {
    if (!intake) return false;
    
    // BP check
    if (intake.bp) {
      const parts = intake.bp.split('/');
      const sys = parseInt(parts[0]);
      const dia = parseInt(parts[1]);
      if (!isNaN(sys) && (sys > 140 || sys < 90)) return true;
      if (!isNaN(dia) && (dia > 90 || dia < 60)) return true;
    }

    // Sugar level check
    if (intake.sugar) {
      const sugarVal = parseInt(intake.sugar);
      if (!isNaN(sugarVal) && (sugarVal > 180 || sugarVal < 70)) return true;
    }

    // Temperature check
    if (intake.temperature) {
      const tempVal = parseFloat(intake.temperature);
      if (!isNaN(tempVal) && (tempVal > 100.4 || tempVal < 95.0)) return true;
    }

    return false;
  };

  // Grouped and filtered tokens
  const arrivedTokens = queue.waiting.filter(t => t.intake_status === 'ARRIVED');
  const processedTokens = queue.waiting.filter(t => 
    t.intake_status === 'READY_FOR_DOCTOR' || t.intake_status === 'WITH_DOCTOR' || t.intake_status === 'INTAKE_DONE'
  );

  // Dynamic filter query
  const filteredTokens = queue.waiting.filter(token => {
    // 1. Tab filtering
    if (activeTab === 'needs-intake' && token.intake_status !== 'ARRIVED') return false;
    if (activeTab === 'ready' && token.intake_status === 'ARRIVED') return false;

    // 2. Search query filtering
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const nameMatch = token.patients?.name?.toLowerCase().includes(q);
      const tokenMatch = token.token_number.toString().includes(q);
      const phoneMatch = token.phone.includes(q);
      return nameMatch || tokenMatch || phoneMatch;
    }

    return true;
  });

  // Calculate Emergency Triage Count
  const emergencyTriageCount = queue.waiting.filter(t => {
    const intake = t.patient_intake?.[0];
    return t.priority === 0 || isEmergencyVital(intake);
  }).length;

  if (loading) {
    return (
      <div className="bg-slate-50/50 min-h-screen pb-16 font-sans animate-fade-in">
        {/* Station Top Bar Skeleton */}
        <div className="bg-white border-b border-slate-150 h-16 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-200 animate-skeleton" />
            <div className="space-y-2">
              <div className="w-40 h-4 bg-slate-200 rounded-md animate-skeleton" />
              <div className="w-24 h-3 bg-slate-100 rounded-md animate-skeleton" />
            </div>
          </div>
          <div className="w-20 h-9 bg-slate-100 rounded-xl animate-skeleton" />
        </div>

        {/* Content Skeleton */}
        <div className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Filter Tabs Skeleton */}
            <div className="bg-white border border-slate-150 h-14 rounded-2xl p-3 flex items-center justify-between shadow-sm animate-skeleton" />
            {/* Patient list skeleton */}
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white border border-slate-150 h-20 rounded-2xl p-4 flex items-center justify-between animate-skeleton" />
              ))}
            </div>
          </div>
          {/* Sidebar Stats Skeleton */}
          <div className="space-y-6">
            <div className="h-32 bg-slate-200 rounded-3xl animate-skeleton" />
            <div className="h-64 bg-white border border-slate-150 rounded-3xl animate-skeleton" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/50 min-h-screen pb-16 font-sans">
      
      {/* ── STICKY GLASSMORPHIC TOP HEADER ──────────────────────── */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-150 z-30 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#005EB8] flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-sm font-black text-slate-800 tracking-tight flex items-center">
                MedQueue Triage Control
              </span>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block mt-0.5">
                {department ? `${DEPARTMENT_LABEL[department as Department] ?? department} Station` : 'General Clinic Hub'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Blinking Live Operations indicator */}
            <div className="hidden md:flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/50 px-2.5 py-1 rounded-full text-[9px] font-black text-emerald-600">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span>STATION ONLINE</span>
            </div>

            <button
              onClick={() => fetchQueue(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#005EB8] ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 flex items-center gap-3 bg-rose-50 border border-rose-150 text-rose-700 rounded-2xl px-4 py-3 text-xs font-semibold">
            <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── TWO-COLUMN TABLET-OPTIMIZED WORKSPACE GRID ────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6 items-start">
          
          {/* 💻 LEFT COLUMN: MAIN WORKFLOW AND PATIENT LISTING */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Control Bar: Tab Filter & Search Box */}
            <div className="bg-white/90 border border-slate-150 rounded-2xl p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Tab Filters */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                {[
                  { id: 'all', label: 'All Waiting', count: queue.waiting.length },
                  { id: 'needs-intake', label: 'New Arrivals', count: arrivedTokens.length, badgeColor: 'bg-yellow-500 text-white' },
                  { id: 'ready', label: 'Triage Done', count: processedTokens.length, badgeColor: 'bg-violet-600 text-white' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as any); setActiveIntake(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                      activeTab === tab.id 
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold ${tab.badgeColor || 'bg-slate-200 text-slate-600'}`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Patient Search Input */}
              <div className="relative flex-1 md:max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search token, name, or phone..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:border-[#005EB8] bg-slate-50/50 focus:bg-white rounded-xl text-xs font-bold text-slate-700 focus:outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Arrived patient queue list */}
            <div className="space-y-3 animate-fade-in" key={activeTab}>
              {filteredTokens.length === 0 ? (
                <div className="bg-white/80 border border-slate-150 rounded-2xl p-12 text-center shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-slate-800 font-extrabold text-sm">No patients in queue</p>
                  <p className="text-xs text-slate-400 font-semibold mt-1">There are no tokens matching this filter category.</p>
                </div>
              ) : (
                filteredTokens.map(token => {
                  const intake = token.patient_intake?.[0];
                  const hasAbnormalVitals = isEmergencyVital(intake);
                  const isEmergency = token.priority === 0 || hasAbnormalVitals;
                  const isCurrentActive = activeIntake === token.id;

                  // Determine status pill
                  let statusLabel = 'Waiting';
                  let statusColor = 'bg-slate-100 text-slate-600';
                  if (token.intake_status === 'ARRIVED') {
                    statusLabel = 'Needs Triage';
                    statusColor = 'bg-yellow-50 text-yellow-700 border-yellow-250';
                  } else if (token.intake_status === 'READY_FOR_DOCTOR') {
                    statusLabel = 'Assigned';
                    statusColor = 'bg-violet-50 text-violet-700 border-violet-200';
                  } else if (token.intake_status === 'WITH_DOCTOR') {
                    statusLabel = 'In Consultation';
                    statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-250';
                  } else if (token.intake_status === 'COMPLETED') {
                    statusLabel = 'Completed';
                    statusColor = 'bg-slate-100 text-slate-600 border-slate-200';
                  }

                  return (
                    <div 
                      key={token.id} 
                      className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden relative shadow-sm ${
                        isCurrentActive 
                          ? 'border-violet-500 shadow-md ring-1 ring-violet-500/10'
                          : isEmergency
                            ? 'border-rose-200 bg-rose-50/10 hover:border-rose-300 shadow-[0_3px_10px_rgba(244,63,94,0.02)]'
                            : 'border-slate-150 hover:border-slate-350 hover:shadow-md'
                      }`}
                    >
                      {/* Emergency Top Indicator Stripe */}
                      {isEmergency && (
                        <div className="h-1 bg-gradient-to-r from-rose-500 to-red-600 absolute top-0 left-0 right-0 animate-pulse" />
                      )}

                      {/* Card Content Row */}
                      <div 
                        onClick={() => setActiveIntake(isCurrentActive ? null : token.id)}
                        className="p-4 flex items-center justify-between cursor-pointer gap-4 relative z-10"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Token Number circle badge */}
                          <div className={`w-11 h-11 rounded-xl font-black text-sm flex items-center justify-center shadow-sm flex-shrink-0 ${
                            isEmergency 
                              ? 'bg-rose-500 text-white shadow-rose-500/20 animate-pulse-glow'
                              : token.intake_status === 'ARRIVED'
                                ? 'bg-[#005EB8] text-white shadow-[#005EB8]/20'
                                : 'bg-slate-100 text-slate-800 border border-slate-200'
                          }`}>
                            #{token.token_number}
                          </div>

                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-800 text-xs flex items-center gap-2">
                              <span className="truncate">{token.patients?.name || 'Patient'}</span>
                              <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">
                                {token.patients?.age ? `${token.patients.age} yrs` : 'Age TBD'}
                              </span>
                              
                              {/* Emergency Badge */}
                              {isEmergency && (
                                <span className="bg-rose-500 text-white font-black text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0">
                                  <ShieldAlert className="w-2.5 h-2.5" /> Emergency
                                </span>
                              )}
                            </div>
                            
                            {token.mqid && (
                              <div className="text-[10px] font-mono font-bold text-indigo-600/70 mt-0.5">MQID: {token.mqid}</div>
                            )}
                            
                            <div className="text-[10px] text-slate-400 font-semibold mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>Phone: {token.phone}</span>
                              <span>•</span>
                              <span className="capitalize">{token.department || 'general'}</span>
                              {(() => {
                                const matchedDoc = doctors.find(d => d.room_number === token.room_number);
                                const docName = token.doctor_name || matchedDoc?.name;
                                if (!token.room_number) return null;
                                return (
                                  <>
                                    <span>•</span>
                                    <span className="text-violet-600 font-extrabold flex items-center gap-0.5">
                                      <MapPin className="w-3 h-3" /> Room {token.room_number} {docName ? `(${docName})` : ''}
                                    </span>
                                  </>
                                );
                              })()}
                            </div>

                            {/* Symptoms tag previews */}
                            {intake?.symptoms && (
                              <div className="flex gap-1.5 mt-2 flex-wrap">
                                {intake.symptoms.split(',').map((sy, idx) => (
                                  <span key={idx} className="bg-slate-50 border border-slate-200 text-[9px] font-extrabold text-slate-500 px-2 py-0.5 rounded-lg uppercase tracking-wide">
                                    {sy.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status Pillars & expand toggle */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusColor}`}>
                            {statusLabel}
                          </span>
                          <div className={`w-6 h-6 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-transform ${isCurrentActive ? 'rotate-180 text-violet-500 bg-violet-50' : ''}`}>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>

                      {/* Expanded Intake Portal Form Frame */}
                      {isCurrentActive && (
                        <div className="border-t border-slate-100 bg-slate-50/20 p-5 relative z-10">
                          <WardBoyIntake 
                            token={token} 
                            onDone={() => { fetchQueue(false); setActiveIntake(null); }} 
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* 💻 RIGHT COLUMN: STATION OVERVIEW / CLINIC DIRECTORY */}
          <div className="space-y-6">
            
            {/* Quick Station Stats Overview Card */}
            <div className="bg-gradient-to-tr from-[#005EB8] to-[#00A3AD] rounded-3xl p-5 text-white shadow-lg shadow-blue-500/10 relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-white/10 rounded-full blur-xl" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-100">Live Station Triage</h3>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <div className="text-3xl font-black">{arrivedTokens.length}</div>
                  <div className="text-[10px] text-blue-100 font-semibold mt-0.5 uppercase tracking-wide">New Arrivals</div>
                </div>
                <div>
                  {/* Alert triage numbers */}
                  <div className="text-3xl font-black text-rose-300 flex items-center gap-1.5">
                    {emergencyTriageCount}
                    {emergencyTriageCount > 0 && <ShieldAlert className="w-5 h-5 text-rose-300 animate-bounce" />}
                  </div>
                  <div className="text-[10px] text-blue-100 font-semibold mt-0.5 uppercase tracking-wide">Emergency Patients</div>
                </div>
              </div>

              {/* Sub-triage info */}
              <div className="border-t border-white/10 mt-5 pt-3 flex items-center justify-between text-[10px] text-blue-50 font-bold">
                <span>Active Waiting Queue: {queue.waiting.length}</span>
                <span>Serving Node: {queue.serving ? `#${queue.serving.token_number}` : 'Idle'}</span>
              </div>
            </div>

            {/* Clinic Doctors Roster and wait loads */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4.5 h-4.5 text-[#005EB8]" />
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Active Rooms & Loads</span>
                </div>
                <span className="text-[9px] bg-slate-100 text-slate-400 font-black px-1.5 py-0.5 rounded uppercase">
                  {doctors.length} Staff
                </span>
              </div>

              {doctors.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">No active doctors loaded for this branch.</p>
              ) : (
                <div className="space-y-3.5">
                  {doctors.map(doc => {
                    const currentLoad = doctorLoadMap[doc.room_number] || 0;
                    
                    return (
                      <div key={doc.id} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-b-0 last:pb-0">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 text-xs truncate">{doc.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{doc.room_number}</span>
                            <span>{DEPARTMENT_LABEL[doc.department as Department] ?? doc.department}</span>
                          </div>
                        </div>

                        {/* Patient queue size for doctor */}
                        <div className="text-right flex-shrink-0">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block ${
                            currentLoad > 4 
                              ? 'bg-amber-100 text-amber-700'
                              : currentLoad > 0 
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {currentLoad} queued
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">~{currentLoad * 10}m wait</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
