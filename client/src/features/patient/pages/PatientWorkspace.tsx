import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { registerToken, getSelectedHospitalId } from '../../../lib/api';
import { Token, Priority, Department, DEPARTMENT_LABEL } from '../../../types';
import { AuthUser } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { useMQIDAuth } from '../../../hooks/useMQIDAuth';
import { MQIDRegistrationForm } from '../../../components/patient/MQIDRegistrationForm';
import { cacheOfflineData, getOfflineCache, clearOfflineCache } from '../../../lib/indexedDb';
import {
  User, Building2, Ticket, CheckCircle, Loader2, AlertCircle,
  Clock, FileText, Download, Search, Stethoscope, X, Printer,
  PhoneCall, Calendar, ShieldAlert, WifiOff, FileSpreadsheet, Lock, Home
} from 'lucide-react';
import { TenantConfig } from '../../../lib/tenant';

const DEPARTMENTS: Department[] = [
  'general', 'cardiology', 'orthopedics', 'pediatrics',
  'gynecology', 'neurology', 'dermatology', 'ent', 'ophthalmology', 'pharmacy'
];

const DEPT_ICONS: Record<Department, string> = {
  general: '🩺',
  cardiology: '🫀',
  orthopedics: '🦴',
  pediatrics: '👶',
  gynecology: '🍼',
  neurology: '🧬',
  dermatology: '🧴',
  ent: '👂',
  ophthalmology: '👁️',
  pharmacy: '💊'
};

const PRIORITY_OPTIONS = [
  { value: 0 as Priority, label: 'Emergency', desc: 'Critical/urgent cases', color: 'border-red-400 bg-red-50 text-red-700', dot: 'bg-red-500' },
  { value: 1 as Priority, label: 'Senior / Special', desc: 'Elderly / disabled', color: 'border-amber-400 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { value: 2 as Priority, label: 'Normal', desc: 'Standard walk-in visit', color: 'border-emerald-400 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
];

export default function PatientWorkspace({ currentUser, navigate, tenant, initialTab, onLogout }: {
  currentUser?: AuthUser | null;
  navigate?: (p: any, state?: any) => void;
  tenant?: TenantConfig | null;
  initialTab?: string;
  onLogout?: () => void;
}) {
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return { text: 'Good Morning', icon: '🌅' };
    if (hr < 17) return { text: 'Good Afternoon', icon: '☀️' };
    return { text: 'Good Evening', icon: '🌙' };
  };
  const greeting = getGreeting();

  const patientPhone = currentUser?.phone || '';
  const currentHospitalId = getSelectedHospitalId();
  const hospitalName = tenant?.name || 'Apollo Clinic';
  const localPrefix = tenant?.slug?.substring(0, 3).toUpperCase() || 'APL';

  const {
    step, mqid, error, pendingPhone, completeRegistration, signOut
  } = useMQIDAuth(
    currentHospitalId,
    hospitalName,
    localPrefix
  );

  const [hospitalProfile, setHospitalProfile] = useState<any | null>(null);

  // ── Tab State ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'profile' | 'guide' | 'reports'>('home');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as any);
    }
  }, [initialTab]);

  // ── Profile Form States ──────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    name: '', email: '', address: '', bloodGroup: 'O+', allergies: 'None'
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // ── Search & Prescription Print States ───────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activePrescriptionModal, setActivePrescriptionModal] = useState<{ vis: any; presc: any } | null>(null);

  // ── Database Records State ─────────────────────────────────
  const [dbVisits, setDbVisits] = useState<any[]>([]);
  const [dbPrescriptions, setDbPrescriptions] = useState<any[]>([]);
  const [dbAppointments, setDbAppointments] = useState<any[]>([]);
  const [dbLabReports, setDbLabReports] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<Record<string, string>>({});
  
  // Timeline Filters
  const [timelineCategory, setTimelineCategory] = useState<string>('All');
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState<string>('All');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<'all' | '30' | '180' | '365'>('all');

  // ── Active Live Token Tracker ──────────────────────────────
  const [activeToken, setActiveToken] = useState<Token | null>(null);
  const [patientsAhead, setPatientsAhead] = useState<number>(0);

  // ── Doctor Availability Directory ──────────────────────────
  const [hospDoctors, setHospDoctors] = useState<any[]>([]);

  // ── Quick Token Booking Form Overlay ────────────────────────
  const [showBookingOverlay, setShowBookingOverlay] = useState(false);
  const [quickDept, setQuickDept] = useState<Department | ''>('');
  const [quickPriority, setQuickPriority] = useState<Priority>(2);
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  // Sync profile details with cached data
  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        name: currentUser.name || '',
        email: currentUser.email || '',
        address: currentUser.address || '',
        bloodGroup: 'O+',
        allergies: 'None reported'
      });
    }
  }, [currentUser]);

  // Load hospital info mapping
  useEffect(() => {
    async function fetchHospitals() {
      try {
        const { data } = await supabase.from('hospitals').select('id, name');
        if (data) {
          const map: Record<string, string> = {};
          data.forEach(h => {
            map[h.id] = h.name;
          });
          setHospitals(map);
        }
      } catch (e) {
        console.warn('Failed to load hospitals list:', e);
      }
    }
    fetchHospitals();
  }, []);

  // Fetch hospital profile (local medical no)
  useEffect(() => {
    if (!mqid || !currentHospitalId) return;
    const fetchHospitalProfile = async () => {
      try {
        const { data } = await supabase
          .from('hospital_patients')
          .select('*')
          .eq('mqid', mqid)
          .eq('hospital_id', currentHospitalId)
          .maybeSingle();
        if (data) {
          setHospitalProfile({
            localPatientNo: data.local_patient_no,
            ...data
          });
        }
      } catch (e) {
        console.warn('Failed to fetch hospital patient profile:', e);
      }
    };
    fetchHospitalProfile();
  }, [mqid, currentHospitalId]);

  // ── Load live clinical records ────
  const loadProfileData = useCallback(async () => {
    if (!mqid && !patientPhone) return;
    setLoadingHistory(true);
    try {
      let resolvedPatientId = currentUser?.id || 'self';
      
      const [visitsRes, prescRes, apptsRes] = await Promise.all([
        supabase.from('visits').select('*, tokens(*)').or(`mqid.eq.${mqid},patient_id.eq.${resolvedPatientId}`).eq('hospital_id', currentHospitalId).order('created_at', { ascending: false }),
        supabase.from('prescriptions').select('*').or(`mqid.eq.${mqid},patient_id.eq.${resolvedPatientId}`).eq('hospital_id', currentHospitalId).order('created_at', { ascending: false }),
        supabase.from('appointments').select('*').or(`mqid.eq.${mqid},patient_id.eq.${resolvedPatientId}`).eq('hospital_id', currentHospitalId).order('created_at', { ascending: false })
      ]);

      setDbVisits(visitsRes.data || []);
      setDbPrescriptions(prescRes.data || []);
      setDbAppointments(apptsRes.data || []);

      try {
        const { data: labRes, error: labErr } = await supabase
          .from('lab_reports')
          .select('*')
          .or(`mqid.eq.${mqid},patient_id.eq.${resolvedPatientId}`)
          .order('created_at', { ascending: false });

        if (!labErr && labRes) {
          setDbLabReports(labRes);
        } else {
          setDbLabReports([]);
        }
      } catch (err) {
        console.warn('lab_reports table does not exist or fails. Gracefully defaulting to empty reports state.');
        setDbLabReports([]);
      }
    } catch (e) {
      console.warn('Failed to load profile history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [currentUser, mqid, patientPhone, currentHospitalId]);

  // ── Queue Status Fetch ──
  const fetchActiveTokenStatus = useCallback(async () => {
    if (!patientPhone) return;
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const { data: token } = await supabase
        .from('tokens')
        .select('*, patients(*)')
        .eq('phone', patientPhone)
        .eq('hospital_id', currentHospitalId)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (token) {
        setActiveToken(token as unknown as Token);
        if (token.status === 'WAITING') {
          const { count } = await supabase
            .from('tokens')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'WAITING')
            .eq('hospital_id', currentHospitalId)
            .or(`priority.lt.${token.priority},and(priority.eq.${token.priority},created_at.lt.${token.created_at})`);
          setPatientsAhead(count || 0);
        } else {
          setPatientsAhead(0);
        }
      } else {
        setActiveToken(null);
      }
    } catch (e) {
      console.warn('Failed to resolve active token status:', e);
    }
  }, [patientPhone, currentHospitalId]);

  // Load doctors catalog
  useEffect(() => {
    async function loadDoctors() {
      try {
        const { data, error } = await supabase
          .from('doctors')
          .select('*')
          .eq('hospital_id', currentHospitalId);
        
        if (!error && data) {
          setHospDoctors(data);
        }
      } catch (e) {
        console.warn('Failed to load doctors catalog:', e);
      }
    }
    loadDoctors();
  }, [currentHospitalId]);

  // ── Supabase Realtime Queue Updates ───────────────────────
  useEffect(() => {
    if (!patientPhone || !currentHospitalId) return;

    let fallbackInterval: any = null;

    const channel = supabase
      .channel(`live-queue-patient-${patientPhone}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tokens',
          filter: `phone=eq.${patientPhone}`,
        },
        () => {
          fetchActiveTokenStatus();
        }
      );

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') {
        if (!fallbackInterval) {
          fallbackInterval = setInterval(fetchActiveTokenStatus, 30000);
        }
      } else {
        if (fallbackInterval) {
          clearInterval(fallbackInterval);
          fallbackInterval = null;
        }
      }
    });

    fetchActiveTokenStatus();

    return () => {
      supabase.removeChannel(channel);
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [patientPhone, currentHospitalId, fetchActiveTokenStatus]);

  // ── IndexedDB Caching Sync Hooks ─────────────────────────
  useEffect(() => {
    if (mqid && !isOffline) {
      cacheOfflineData({
        profile: { hospitalProfile, profileForm },
        timeline: dbVisits,
        prescriptions: dbPrescriptions,
        appointments: dbAppointments,
        activeToken,
        labReports: dbLabReports
      }).catch(err => console.warn('Cache write failed:', err));
    }
  }, [hospitalProfile, profileForm, dbVisits, dbPrescriptions, dbAppointments, activeToken, dbLabReports, mqid, isOffline]);

  // Read cache when offline or on mount fallback
  useEffect(() => {
    async function loadCachedAssets() {
      if (isOffline) {
        const cache = await getOfflineCache();
        if (cache) {
          if (cache.profile) {
            if (cache.profile.hospitalProfile) setHospitalProfile(cache.profile.hospitalProfile);
            if (cache.profile.profileForm) setProfileForm(cache.profile.profileForm);
          }
          setDbVisits(cache.timeline || []);
          setDbPrescriptions(cache.prescriptions || []);
          setDbAppointments(cache.appointments || []);
          setActiveToken(cache.activeToken || null);
          setDbLabReports(cache.labReports || []);
        }
      } else {
        loadProfileData();
      }
    }
    loadCachedAssets();
  }, [isOffline, loadProfileData]);

  // Sync reconnection handlers
  useEffect(() => {
    const handleDeviceOnline = () => {
      setIsOffline(false);
      loadProfileData();
      fetchActiveTokenStatus();
    };
    const handleDeviceOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleDeviceOnline);
    window.addEventListener('offline', handleDeviceOffline);
    return () => {
      window.removeEventListener('online', handleDeviceOnline);
      window.removeEventListener('offline', handleDeviceOffline);
    };
  }, [loadProfileData, fetchActiveTokenStatus]);

  // ── Quick Token Booking Form Submit ────────────────────────
  async function handleQuickBookSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickDept) return setBookingError('Please select a department');
    setBookingLoading(true);
    setBookingError('');
    try {
      await registerToken({
        phone: patientPhone,
        mqid: mqid || undefined,
        name: profileForm.name || 'Patient',
        age: currentUser?.age || 30,
        address: profileForm.address || 'Delhi Outpatient Center',
        priority: quickPriority,
        department: quickDept,
      });
      fetchActiveTokenStatus();
      setQuickDept('');
      setQuickPriority(2);
      setShowBookingOverlay(false);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Registration booking failed');
    } finally {
      setBookingLoading(false);
    }
  }

  // ── Profile Form Actions ────────────────────────────────────
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileForm.name.trim()) return;
    setProfileSaving(true);
    setProfileSuccess(false);

    try {
      // 1. Update local hospital patient record
      const { data: patientRecord } = await supabase
        .from('patients')
        .select('id')
        .eq('phone', patientPhone)
        .maybeSingle();

      if (patientRecord?.id) {
        await supabase.from('patients')
          .update({
            name: profileForm.name.trim(),
            address: profileForm.address.trim()
          })
          .eq('id', patientRecord.id);
      }

      // 2. Update global patient record if mqid exists
      if (mqid) {
        await supabase.from('mq_patients')
          .update({
            full_name: profileForm.name.trim(),
            blood_group: profileForm.bloodGroup,
          })
          .eq('mqid', mqid);

        if (currentHospitalId) {
          await supabase.from('hospital_patients')
            .update({
              address: profileForm.address.trim(),
              allergies: profileForm.allergies.split(',').map(s => s.trim()).filter(Boolean)
            })
            .eq('mqid', mqid)
            .eq('hospital_id', currentHospitalId);
        }
      }

      // 3. Update email in Supabase Auth user database if changed
      if (profileForm.email.trim()) {
        await supabase.auth.updateUser({
          email: profileForm.email.trim()
        });
      }

      // 4. Synchronize local cache for the active user session
      const cached = localStorage.getItem('mq_user');
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.email = profileForm.email.trim();
        parsed.name = profileForm.name.trim();
        parsed.address = profileForm.address.trim();
        localStorage.setItem('mq_user', JSON.stringify(parsed));
      }

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      console.error('Profile credentials update failed:', err);
      alert('Failed to save profile changes. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  }

  // Prescription print helper
  const handlePrintTimelinePrescription = (vis: any, presc: any) => {
    setActivePrescriptionModal({ vis, presc });
  };

  // Memoized doctor room mapping to optimize lookup from O(N * M) to O(N + M)
  const docByRoomMap = useMemo(() => {
    const map: Record<string, any> = {};
    hospDoctors.forEach(doc => {
      if (doc.room_number) {
        map[doc.room_number] = doc;
      }
    });
    return map;
  }, [hospDoctors]);

  // Memoized visits lookup to optimize prescription pairing from O(P * V) to O(P + V)
  const visitsLookup = useMemo(() => {
    const byId: Record<string, any> = {};
    const byTokenId: Record<string, any> = {};
    dbVisits.forEach(v => {
      if (v.id) byId[v.id] = v;
      if (v.token_id) byTokenId[v.token_id] = v;
    });
    return { byId, byTokenId };
  }, [dbVisits]);

  // ── Consolidated Timeline Events Array ──────────────────────
  const allTimelineEvents = useMemo(() => {
    const visits = dbVisits.map(vis => {
      const matchedDoc = docByRoomMap[vis.tokens?.room_number || vis.room_number];
      const docName = matchedDoc ? matchedDoc.name : (vis.tokens?.doctor_name || vis.doctor_name || 'Dr. Muskan Kumari');
      const docDept = matchedDoc ? matchedDoc.department : 'General Medicine';
      return {
        id: vis.id || `vis-${vis.created_at}`,
        date: vis.created_at,
        type: 'Visit' as const,
        title: 'Clinical Consultation',
        subtitle: `Specialty: ${docDept}`,
        hospitalId: vis.hospital_id,
        doctorName: docName,
        status: vis.tokens?.status || 'COMPLETED',
        details: vis
      };
    });

    const prescriptions = dbPrescriptions.map(p => {
      const matchingVisit = visitsLookup.byId[p.visit_id] || (p.token_id ? visitsLookup.byTokenId[p.token_id] : null);
      const matchedDoc = matchingVisit ? docByRoomMap[matchingVisit.tokens?.room_number || matchingVisit.room_number] : null;
      const docName = p.doctor_name || (matchedDoc ? matchedDoc.name : 'Consulting Specialist');
      return {
        id: p.id || `pre-${p.created_at}`,
        date: p.created_at,
        type: 'Prescription' as const,
        title: 'Digital Rx Prescription',
        subtitle: `Diagnosis: ${p.diagnosis || 'General Treatment'}`,
        hospitalId: p.hospital_id,
        doctorName: docName,
        status: p.status || 'DISPENSED',
        details: p
      };
    });

    const appointments = dbAppointments.map(a => {
      return {
        id: a.id || `appt-${a.created_at}`,
        date: a.appointment_date ? (a.appointment_date + 'T' + (a.time_slot ? a.time_slot.split('-')[0] : '09:00') + ':00') : a.created_at,
        type: 'Appointment' as const,
        title: 'Confirmed Appointment',
        subtitle: `Time: ${a.time_slot || 'Morning Slot'} • Fee: ₹${a.consultation_fee || 0}`,
        hospitalId: a.hospital_id,
        doctorName: a.doctor_name || 'Specialist Doctor',
        status: a.status || 'SCHEDULED',
        details: a
      };
    });

    const reports = dbLabReports.map(r => {
      return {
        id: r.id || `report-${r.created_at}`,
        date: r.created_at,
        type: 'Report' as const,
        title: r.test_name || 'Lab Report',
        subtitle: `Category: ${r.category || 'Diagnostics'}`,
        hospitalId: r.hospital_id,
        doctorName: r.doctor_name || 'Lab Incharge',
        status: r.status || 'VERIFIED',
        details: r
      };
    });

    return [...visits, ...prescriptions, ...appointments, ...reports];
  }, [dbVisits, dbPrescriptions, dbAppointments, dbLabReports, docByRoomMap, visitsLookup]);

  const filteredTimelineEvents = useMemo(() => {
    return allTimelineEvents.filter(e => {
      const searchLower = deferredSearchQuery.toLowerCase();
      const matchesSearch = 
        e.title.toLowerCase().includes(searchLower) || 
        e.subtitle.toLowerCase().includes(searchLower) || 
        (e.doctorName || '').toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      if (timelineCategory !== 'All') {
        if (timelineCategory === 'Prescriptions' && e.type !== 'Prescription') return false;
        if (timelineCategory === 'Visits' && e.type !== 'Visit') return false;
        if (timelineCategory === 'Appointments' && e.type !== 'Appointment') return false;
        if (timelineCategory === 'Reports' && e.type !== 'Report') return false;
      }

      if (selectedHospitalFilter !== 'All') {
        if (e.hospitalId && e.hospitalId !== selectedHospitalFilter) return false;
      }

      if (timelineFilter !== 'all') {
        const days = timelineFilter === '30' ? 30 : 180;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        if (new Date(e.date).getTime() < cutoffDate.getTime()) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allTimelineEvents, deferredSearchQuery, timelineCategory, selectedHospitalFilter, timelineFilter]);

  // Group events by Year -> Month -> Date
  const groupedEvents = useMemo(() => {
    const groups: { [year: string]: { [month: string]: { [dateKey: string]: typeof filteredTimelineEvents } } } = {};
    
    filteredTimelineEvents.forEach(e => {
      const dt = new Date(e.date);
      const year = dt.getFullYear().toString();
      const month = dt.toLocaleDateString('en-IN', { month: 'long' });
      const dateKey = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      if (!groups[year]) groups[year] = {};
      if (!groups[year][month]) groups[year][month] = {};
      if (!groups[year][month][dateKey]) groups[year][month][dateKey] = [];
      
      groups[year][month][dateKey].push(e);
    });

    return groups;
  }, [filteredTimelineEvents]);

  // Dosage Timeline Visual helper
  const renderDosageTimeline = (frequency: string) => {
    const freq = (frequency || '').toLowerCase();
    const isMorning = freq.includes('morning') || freq.includes('once') || freq.startsWith('1-') || freq.includes('1-1-1');
    const isAfternoon = freq.includes('afternoon') || freq.includes('twice') || freq.includes('-1-') || freq.includes('1-1-1');
    const isNight = freq.includes('night') || freq.includes('twice') || freq.includes('thrice') || freq.endsWith('-1') || freq.includes('1-1-1');
    
    return (
      <div className="flex items-center gap-1 mt-0.5 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded w-max select-none text-[7.5px] font-bold">
        <span className={isMorning ? 'text-amber-500 font-black' : 'text-slate-350 opacity-40'}>☀️ Morning</span>
        <span className="text-slate-200">|</span>
        <span className={isAfternoon ? 'text-amber-600 font-black' : 'text-slate-350 opacity-40'}>🌤️ Noon</span>
        <span className="text-slate-200">|</span>
        <span className={isNight ? 'text-indigo-500 font-black' : 'text-slate-350 opacity-40'}>🌙 Night</span>
      </div>
    );
  };

  // Bypass unused navigate warnings
  if (false && navigate) navigate?.('');

  // ── ONBOARDING / AUTH STATUS OVERLAYS ──
  if (step === 'needs_registration' || step === 'creating_profile') {
    return (
      <div className="min-h-screen bg-[#F4F8FB] font-sans flex items-center justify-center p-4">
        <MQIDRegistrationForm
          phone={pendingPhone}
          onSubmit={completeRegistration}
          loading={step === 'creating_profile'}
          error={error}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20 md:pb-6 relative overflow-x-hidden w-full max-w-full text-slate-800 antialiased text-left">
      
      {/* Ambient background decoration */}
      <div className="absolute top-0 left-[-5%] w-[45%] h-[30%] bg-gradient-to-br from-[#005EB8]/3 to-transparent rounded-full blur-[60px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-5%] w-[45%] h-[30%] bg-gradient-to-tr from-[#00A3AD]/3 to-transparent rounded-full blur-[60px] pointer-events-none" />

      {/* Connectivity Banner */}
      {isOffline && (
        <div className="bg-rose-50 text-rose-700 border-b border-rose-100 py-1 px-3 text-[9px] font-black text-center flex items-center justify-center gap-1.5 shadow-inner z-50 sticky top-0 uppercase tracking-wider">
          <WifiOff className="w-3 h-3 animate-bounce" />
          <span>Offline Mode — Displaying Cached Records</span>
        </div>
      )}

      {/* Page Body Grid */}
      <main className="max-w-2xl mx-auto px-4 pt-3.5 space-y-3.5">

        {/* ── TAB 1: HOME DASHBOARD ── */}
        {activeTab === 'home' && (
          <div className="space-y-3.5 animate-fade-in text-left">
            
            {/* Ambient greeting & hospital welcome chip */}
            <div className="flex items-center justify-between py-1.5 select-none border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#005EB8]/10 text-[#005EB8] flex items-center justify-center font-black text-[11px] uppercase tracking-wider">
                  {profileForm.name ? profileForm.name.substring(0, 2).toUpperCase() : 'PT'}
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none">{greeting.text} {greeting.icon}</span>
                  <h3 className="text-[11px] font-black text-slate-800 mt-1 leading-none">{profileForm.name || 'Verified Patient'}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  {tenant?.name || 'Apollo Medical'}
                </span>
              </div>
            </div>
            
            {/* 1.1 ZOMATO/UBER STYLE LIVE TRACKER CARD */}
            {activeToken ? (
              <div className="bg-white border border-slate-200/60 rounded-xl p-3.5 shadow-sm space-y-3.5 text-left relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#005EB8] to-[#00A3AD]" />
                
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full absolute" />
                    <span className="text-[7.5px] font-black text-[#005EB8] uppercase tracking-widest ml-1">Live Queue Track</span>
                  </div>
                  <div className="text-[8.5px] text-slate-400 font-bold uppercase">
                    Token <strong className="text-slate-800 text-xs font-black">#{activeToken.token_number}</strong>
                  </div>
                </div>

                {/* Progress Tracking Bar */}
                <div className="relative pt-1 pb-1 select-none">
                  {/* Progress Line Background */}
                  <div className="absolute top-[18px] left-[5%] right-[5%] h-0.5 bg-slate-100 rounded-full" />
                  
                  {/* Progress Line Fill */}
                  <div 
                    className="absolute top-[18px] left-[5%] h-0.5 bg-[#005EB8] rounded-full transition-all duration-500" 
                    style={{
                      width: 
                        activeToken.status === 'SERVING' ? '90%' :
                        activeToken.intake_status === 'READY_FOR_DOCTOR' || activeToken.intake_status === 'WITH_DOCTOR' ? '60%' :
                        activeToken.intake_status === 'INTAKE_DONE' ? '35%' : '10%'
                    }}
                  />

                  {/* Tracker Steps */}
                  <div className="relative flex justify-between text-center">
                    {[
                      { label: 'Booked', active: true },
                      { label: 'Vitals', active: activeToken.intake_status !== 'ARRIVED' },
                      { label: 'Wait List', active: activeToken.intake_status === 'READY_FOR_DOCTOR' || activeToken.intake_status === 'WITH_DOCTOR' || activeToken.status === 'SERVING' },
                      { label: 'Serving', active: activeToken.status === 'SERVING' },
                    ].map((step, idx) => (
                      <div key={idx} className="flex flex-col items-center w-1/4">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all relative z-10 text-[8px] font-bold ${
                          step.active 
                            ? 'bg-[#005EB8] border-[#005EB8] text-white shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}>
                          {step.active ? '✓' : idx + 1}
                        </div>
                        <span className={`text-[7px] font-black uppercase tracking-wider mt-1 block ${
                          step.active ? 'text-[#005EB8]' : 'text-slate-450'
                        }`}>{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Doctor, Room and ETA details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 bg-slate-50 border border-slate-200/30 rounded-xl p-2.5 text-[10.5px] font-semibold">
                  <div className="space-y-0.5">
                    <div className="text-slate-400 text-[7.5px] uppercase tracking-wider font-bold">Consulting Specialist</div>
                    <div className="font-extrabold text-slate-800 text-[11px] truncate flex items-center gap-1">
                      <Stethoscope className="w-3 h-3 text-[#005EB8]" />
                      {activeToken.doctor_name || 'Assigned Practitioner'}
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase">Room: <strong className="text-slate-700">{activeToken.room_number || 'TBA'}</strong></div>
                  </div>
                  <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-200/50 pt-2 md:pt-0 md:pl-2.5">
                    <div className="w-6 h-6 rounded-lg bg-[#005EB8]/10 flex items-center justify-center text-[#005EB8]">
                      <Clock className="w-3.5 h-3.5 animate-pulse" />
                    </div>
                    <div>
                      <div className="text-slate-400 text-[7.5px] uppercase tracking-wider font-bold">Approximate Wait</div>
                      <div className="text-[10.5px] font-black text-slate-800">
                        {activeToken.status === 'SERVING' ? 'You are being served now' : `~${patientsAhead * 10 + 8} mins remaining`}
                      </div>
                      {activeToken.status === 'WAITING' && (
                        <span className="text-[8px] text-slate-400 block mt-0.5">{patientsAhead} patients ahead in queue</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-[#005EB8]/10 to-[#00A3AD]/5 border border-[#005EB8]/15 rounded-xl p-4 text-center space-y-3 shadow-inner">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mx-auto text-[#005EB8] shadow-sm">
                  <Ticket className="w-4 h-4 animate-pulse" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-[11px] font-black text-slate-855 uppercase tracking-wider">No Active Queue Token Today</h3>
                  <p className="text-[9.5px] text-slate-400 font-semibold max-w-xs mx-auto leading-relaxed">
                    Instantly book your clinic walk-in outpatient token to secure your position in queue.
                  </p>
                </div>
                <button
                  onClick={() => setShowBookingOverlay(true)}
                  className="px-4 py-2 bg-[#005EB8] hover:bg-[#004a96] text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shadow-sm shadow-[#005EB8]/10 min-h-[34px]"
                >
                  Book Walk-in Token →
                </button>
              </div>
            )}

            {/* 1.2 UPCOMING APPOINTMENT CHECK */}
            {dbAppointments.length > 0 && (
              <div className="bg-white border border-slate-200/60 rounded-xl p-3 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-500" />
                    Upcoming Visit
                  </span>
                  <span className="text-[7.5px] font-black uppercase text-amber-600 bg-amber-50 border border-amber-100/50 px-1.5 py-0.5 rounded">
                    Confirmed
                  </span>
                </div>
                <div className="flex justify-between items-start text-[10.5px] font-semibold gap-3">
                  <div className="space-y-0.5">
                    <h4 className="font-extrabold text-slate-850">{dbAppointments[0].doctor_name || 'Specialist Doctor'}</h4>
                    <p className="text-[9px] text-slate-400 capitalize">{dbAppointments[0].department} Specialty</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      {new Date(dbAppointments[0].appointment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • {dbAppointments[0].time_slot}
                    </p>
                  </div>
                  <button 
                    onClick={() => { setActiveTab('guide'); }}
                    className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-655 text-[9px] font-black uppercase tracking-wider rounded transition-all min-h-[26px]"
                  >
                    OPD Map
                  </button>
                </div>
              </div>
            )}

            {/* 1.3 VITALS SUMMARY CARD */}
            {dbVisits.length > 0 && (
              <div className="bg-white border border-slate-200/60 rounded-xl p-3 shadow-sm space-y-2.5">
                <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-100 pb-1.5">
                  Latest Triage Vitals Snapshot
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'BP', val: dbVisits[0].bp || '120/80', unit: 'mmHg', color: 'text-indigo-650 bg-indigo-50/50' },
                    { label: 'Sugar', val: dbVisits[0].sugar || '98', unit: 'mg/dL', color: 'text-emerald-650 bg-emerald-50/50' },
                    { label: 'Oxygen', val: dbVisits[0].tokens?.patient_intake?.[0]?.oxygen || '98', unit: '%', color: 'text-blue-650 bg-blue-50/50' },
                    { label: 'Pulse', val: dbVisits[0].tokens?.patient_intake?.[0]?.pulse || '72', unit: 'BPM', color: 'text-rose-650 bg-rose-50/50' },
                  ].map((v, i) => (
                    <div key={i} className={`p-2 rounded-lg ${v.color} flex flex-col justify-center`}>
                      <span className="text-[7.5px] uppercase font-bold tracking-wider opacity-60">{v.label}</span>
                      <strong className="text-[11px] font-extrabold block mt-0.5 tracking-tight">{v.val}</strong>
                      <span className="text-[7px] opacity-50 block mt-0.5">{v.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 1.4 LATEST PRESCRIPTION CHECKLIST */}
            {dbPrescriptions.length > 0 && (
              <div className="bg-white border border-slate-200/60 rounded-xl p-3 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <FileText className="w-3 h-3 text-emerald-500" />
                    Current Medication Schedule
                  </span>
                  <span className="text-[7px] font-black text-slate-400 uppercase">
                    Dispensed
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-[10.5px] font-semibold">
                    <strong className="text-slate-800">{dbPrescriptions[0].diagnosis || 'Mild Diagnosis'}</strong>
                  </div>
                  <div className="space-y-1.5 mt-1">
                    {Array.isArray(dbPrescriptions[0].medications) && dbPrescriptions[0].medications.slice(0, 2).map((med: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 border border-slate-100/50 p-2 rounded-md flex items-center justify-between text-[10.5px] font-semibold gap-3">
                        <div>
                          <strong className="text-slate-800 font-extrabold block">• {med.name}</strong>
                          <span className="text-[8px] text-slate-400 block mt-0.5">{med.instructions || 'Take post meals'}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[8px] text-[#005EB8] font-black uppercase tracking-wider bg-[#005EB8]/5 border border-[#005EB8]/10 px-1.5 py-0.5 rounded">
                            {med.dosage}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {dbPrescriptions[0].medications?.length > 2 && (
                    <button 
                      onClick={() => { setActiveTab('history'); setTimelineCategory('Prescriptions'); }}
                      className="text-[7.5px] font-black uppercase text-[#005EB8] tracking-wider block mt-1 hover:underline"
                    >
                      + View {dbPrescriptions[0].medications.length - 2} more medications
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 1.5 QUICK ACTIONS GRID */}
            <div className="space-y-1">
              <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest block px-1">Quick Shortcuts</span>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Register Token', icon: Ticket, action: () => setShowBookingOverlay(true), desc: 'Outpatient queue token' },
                  { label: 'Health Vault', icon: Clock, action: () => setActiveTab('history'), desc: 'Consultations & Rx logs' },
                  { label: 'OPD Guide Map', icon: Building2, action: () => setActiveTab('guide'), desc: 'Floor room maps' },
                  { label: 'Lab Reports', icon: FileSpreadsheet, action: () => setActiveTab('reports'), desc: 'Diagnostics status' }
                ].map((act, i) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={i}
                      onClick={act.action}
                      className="bg-white hover:bg-slate-50 border border-slate-200/50 rounded-xl p-2.5 text-left shadow-sm flex gap-2 items-start group transition-all duration-200 min-h-[56px] select-none active:scale-[0.98]"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#005EB8]/5 group-hover:bg-[#005EB8]/10 flex items-center justify-center text-[#005EB8] shrink-0 transition-colors">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <strong className="text-[10.5px] font-black text-slate-800 block truncate leading-tight group-hover:text-[#005EB8] transition-colors">{act.label}</strong>
                        <span className="text-[8px] text-slate-400 font-bold block mt-0.5 truncate">{act.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1.6 EMERGENCY SPEED DIAL */}
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex gap-3 items-start">
              <ShieldAlert className="w-4.5 h-4.5 text-rose-500 flex-shrink-0 mt-0.5 animate-bounce" />
              <div className="space-y-1 text-[10.5px] font-semibold text-left">
                <span className="text-[7.5px] font-black text-rose-700 uppercase tracking-widest block">Emergency Services Contact</span>
                <p className="text-rose-600 leading-relaxed font-bold text-[10.0px]">
                  Facing severe pain or health crisis? Skip standard booking queues and dial the clinic triage desk immediately.
                </p>
                <a
                  href="tel:+919999999991"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[8.5px] font-black uppercase tracking-wider rounded transition-all shadow-sm w-max min-h-[28px]"
                >
                  <PhoneCall className="w-2.5 h-2.5" />
                  <span>Call Hospital Help</span>
                </a>
              </div>
            </div>

          </div>
        )}

        {/* ── TAB 2: MEDICAL HISTORY TIMELINE (APPLE HEALTH VAULT) ── */}
        {activeTab === 'history' && (
          <div className="space-y-3.5 animate-fade-in text-left">
            <div>
              <h2 className="text-[10px] font-black text-slate-850 tracking-widest flex items-center gap-1.5 uppercase leading-none">
                <Clock className="w-3.5 h-3.5 text-[#005EB8]" />
                Medical EHR Vault
              </h2>
              <p className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                Your medical history consolidated across MedQueue network nodes.
              </p>
            </div>

            {/* Timelines Search & Filter Pane */}
            <div className="bg-white border border-slate-200/50 rounded-xl p-2.5 shadow-sm space-y-2.5">
              <div className="flex gap-1.5 items-center">
                {/* Search Index Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-6 pr-2 py-0.5 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-semibold focus:outline-none focus:border-[#005EB8] focus:bg-white transition-all min-h-[28px]"
                  />
                </div>
                {/* Hospital Node Vault Dropdown */}
                <div className="w-32 shrink-0">
                  <select
                    value={selectedHospitalFilter}
                    onChange={e => setSelectedHospitalFilter(e.target.value)}
                    className="w-full border border-slate-200 bg-slate-50 rounded-md px-2 py-0.5 text-[10px] font-semibold text-slate-700 focus:outline-none focus:border-[#005EB8] focus:bg-white transition-all min-h-[28px] appearance-none"
                  >
                    <option value="All">All Vaults</option>
                    {Object.entries(hospitals).map(([id, name]) => (
                      <option key={id} value={id}>{name.split(' ')[0]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tag Categories & Periods */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                  {[
                    { id: 'All', label: 'All Logs' },
                    { id: 'Visits', label: 'Consultations' },
                    { id: 'Prescriptions', label: 'Prescriptions' },
                    { id: 'Reports', label: 'Lab Reports' },
                    { id: 'Appointments', label: 'Appointments' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setTimelineCategory(cat.id)}
                      className={`flex-shrink-0 px-2 py-1 rounded text-[7.5px] font-black uppercase tracking-wider transition-all border min-h-[26px] ${
                        timelineCategory === cat.id
                          ? 'bg-[#005EB8] border-transparent text-white shadow-sm'
                          : 'bg-white hover:bg-slate-50 text-slate-550 border-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between items-center text-[7.5px] font-black text-slate-400 uppercase tracking-wider pt-1.5 border-t border-slate-100">
                  <span>Date Filter</span>
                  <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded border border-slate-200/30">
                    {[
                      { id: 'all', label: 'All' },
                      { id: '30', label: '30D' },
                      { id: '180', label: '6M' }
                    ].map(per => (
                      <button
                        key={per.id}
                        onClick={() => setTimelineFilter(per.id as any)}
                        className={`px-1 py-0.5 rounded-[3px] text-[6.5px] font-black tracking-wider transition-all uppercase min-h-[16px] ${
                          timelineFilter === per.id ? 'bg-white text-[#005EB8] shadow-sm' : 'text-slate-455 hover:text-slate-855'
                        }`}
                      >
                        {per.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Apple Health Timeline */}
            {loadingHistory ? (
              <div className="p-5 text-center text-slate-450 font-semibold bg-white border border-slate-200/50 rounded-xl animate-pulse text-[11px]">
                ⏳ Accessing digital core registries...
              </div>
            ) : filteredTimelineEvents.length === 0 ? (
              <div className="bg-white border border-slate-200/50 rounded-xl p-6 text-center text-slate-450 space-y-2 shadow-sm select-none">
                <Clock className="w-7 h-7 text-slate-300 mx-auto" />
                <h3 className="font-extrabold text-[10px] uppercase text-slate-750">No medical records found</h3>
                <p className="text-[9px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Modify your keywords, categories, date limits, or check hospital filters.
                </p>
              </div>
            ) : (
              <div className="space-y-4 relative">
                {/* Visual Timeline line connector */}
                <div className="absolute left-[10px] top-4.5 bottom-4.5 w-0.5 bg-slate-200" />

                {Object.entries(groupedEvents).map(([year, months]) => (
                  <div key={year} className="space-y-2.5">
                    {/* Year badge indicator */}
                    <div className="sticky top-[80px] z-20 w-max bg-slate-900 text-white text-[7.5px] font-black px-2 py-0.5 rounded uppercase tracking-widest shadow-sm">
                      Year {year}
                    </div>

                    {Object.entries(months).map(([month, dateGroups]) => (
                      <div key={month} className="space-y-2.5 pl-1">
                        <span className="text-[8.5px] font-black text-[#00A3AD] uppercase tracking-widest block">{month}</span>
                        
                        {Object.entries(dateGroups).map(([dateKey, events]) => (
                          <div key={dateKey} className="space-y-2">
                            <div className="text-[7px] font-bold text-slate-450 uppercase tracking-widest pl-4">
                              {dateKey}
                            </div>
                            
                            {events.map((e, idx) => {
                              const isVisit = e.type === 'Visit';
                              const isPresc = e.type === 'Prescription';
                              const isAppt = e.type === 'Appointment';
                              const isReport = e.type === 'Report';

                              let accentColor = 'bg-[#005EB8] text-white border-transparent';
                              let IconComponent = Stethoscope;
                              if (isPresc) {
                                accentColor = 'bg-emerald-500 text-white border-transparent';
                                IconComponent = FileText;
                              } else if (isAppt) {
                                accentColor = 'bg-amber-500 text-white border-transparent';
                                IconComponent = Calendar;
                              } else if (isReport) {
                                accentColor = 'bg-indigo-500 text-white border-transparent';
                                IconComponent = FileSpreadsheet;
                              }

                              const hospName = e.hospitalId ? (hospitals[e.hospitalId] || 'Clinic Outlet') : 'Global Vault';

                              return (
                                <div key={e.id || idx} className="relative pl-4 text-left group">
                                  {/* Dot connector */}
                                  <div className={`absolute left-[-1.5px] top-3 w-2.5 h-2.5 rounded-full border border-white flex items-center justify-center shadow-sm z-10 transition-transform group-hover:scale-110 ${accentColor}`}>
                                    <IconComponent className="w-1 h-1" />
                                  </div>

                                  <div className="bg-white border border-slate-200/50 rounded-xl py-2.5 px-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                    {/* Physical status line tag */}
                                    <div className={`absolute top-0 bottom-0 left-0 w-1 ${
                                      isPresc ? 'bg-emerald-500' :
                                      isAppt ? 'bg-amber-500' :
                                      isReport ? 'bg-indigo-500' : 'bg-[#005EB8]'
                                    }`} />

                                    {/* Event header info */}
                                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 mb-1.5">
                                      <div>
                                        <span className="text-[6.5px] font-black uppercase text-slate-400 tracking-wider block">
                                          {e.type}
                                        </span>
                                        <h4 className="font-extrabold text-slate-800 text-[10.5px] mt-0.5 truncate max-w-[170px]">
                                          {e.title}
                                        </h4>
                                      </div>
                                      <span className="text-[7px] font-black text-slate-500 bg-slate-50 border border-slate-200/50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                        {hospName}
                                      </span>
                                    </div>

                                    {/* Visit Details */}
                                    {isVisit && (
                                      <div className="space-y-1.5 text-[10px] font-semibold text-slate-500">
                                        <div className="flex justify-between items-start gap-2.5">
                                          <div>
                                            <span className="text-[6.5px] font-bold text-slate-400 uppercase tracking-widest block">Attending specialist</span>
                                            <strong className="text-slate-850 text-[10.5px] block mt-0.5">{e.doctorName}</strong>
                                            <span className="text-[8.5px] text-slate-400 capitalize">{e.subtitle}</span>
                                          </div>
                                          <div className="text-right">
                                            <span className="text-[6.5px] font-bold text-slate-400 uppercase tracking-widest block">Recorded vitals</span>
                                            <span className="text-slate-700 font-extrabold text-[10.5px] block mt-0.5">BP: {e.details.bp || '120/80'}</span>
                                            <span className="text-[9px] text-slate-450 block">Sugar: {e.details.sugar || '98'} mg/dL</span>
                                          </div>
                                        </div>
                                        <div className="bg-slate-50 p-2 rounded-md border border-slate-100 text-[9.5px] space-y-0.5 leading-relaxed">
                                          <div>
                                            <span className="text-[6.5px] uppercase font-bold text-slate-400 tracking-widest block">Chief Symptoms</span>
                                            <p className="text-slate-655 italic">{e.details.symptoms || 'Regular health follow-up'}</p>
                                          </div>
                                          {e.details.doctor_notes && (
                                            <div className="pt-1 border-t border-slate-200/50">
                                              <span className="text-[6.5px] uppercase font-bold text-slate-400 tracking-widest block">Doctor Notes</span>
                                              <p className="text-slate-800 font-bold">{e.details.doctor_notes}</p>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex justify-between items-center pt-1 border-t border-slate-50">
                                          <span className="text-[7.5px] font-black uppercase text-slate-400">
                                            Status: <strong className="text-[#005EB8]">{e.status}</strong>
                                          </span>
                                          <button
                                            onClick={() => handlePrintTimelinePrescription(e.details, dbPrescriptions.find(p => p.visit_id === e.details.id || (e.details.token_id && p.token_id === e.details.token_id)))}
                                            className="px-2 py-1 bg-[#005EB8] hover:bg-[#004a96] text-white text-[7.5px] font-black rounded uppercase tracking-wider transition-all animate-fade-in min-h-[24px]"
                                          >
                                            View Rx Details
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Prescription Details */}
                                    {isPresc && (
                                      <div className="space-y-1.5 text-[10px] font-semibold text-slate-500">
                                        <div className="flex justify-between items-start gap-2.5">
                                          <div>
                                            <span className="text-[6.5px] font-bold text-slate-400 uppercase tracking-widest block">Prescribed By</span>
                                            <strong className="text-slate-850 text-[10.5px] block mt-0.5">{e.doctorName}</strong>
                                            <span className="text-[8.5px] text-slate-400">{e.subtitle}</span>
                                          </div>
                                          <div className="text-right">
                                            <span className="text-[6.5px] font-bold text-slate-400 uppercase tracking-widest block">Meds count</span>
                                            <strong className="text-slate-700 text-[10.5px] block mt-0.5">{e.details.medications?.length || 0} items</strong>
                                          </div>
                                        </div>
                                        <div className="space-y-1">
                                          {Array.isArray(e.details.medications) && e.details.medications.map((m: any, mIdx: number) => (
                                            <div key={mIdx} className="bg-slate-50 p-1.5 border border-slate-100 rounded-md flex justify-between items-center text-[9.5px] font-bold gap-2">
                                              <div>
                                                <span className="text-slate-800">{m.name}</span>
                                                {renderDosageTimeline(m.frequency)}
                                              </div>
                                              <span className="text-[#005EB8] uppercase tracking-wider text-[7.5px] bg-[#005EB8]/5 border border-[#005EB8]/10 px-1.5 py-0.5 rounded">
                                                {m.dosage}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="flex justify-between items-center pt-1 border-t border-slate-50">
                                          <span className="text-[7.5px] font-black uppercase text-slate-400">
                                            Fulfillment: <strong className="text-emerald-500">{e.status}</strong>
                                          </span>
                                          <button
                                            onClick={() => handlePrintTimelinePrescription(dbVisits.find(v => v.id === e.details.visit_id || (e.details.token_id && v.token_id === e.details.token_id)) || { created_at: e.date, tokens: {} }, e.details)}
                                            className="px-2 py-1 bg-[#005EB8] hover:bg-[#004a96] text-white text-[7.5px] font-black rounded uppercase tracking-wider transition-all min-h-[24px]"
                                          >
                                            Print Rx Sheet
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Appointment Details */}
                                    {isAppt && (
                                      <div className="space-y-1.5 text-[10px] font-semibold text-slate-500">
                                        <div className="grid grid-cols-2 gap-2.5">
                                          <div>
                                            <span className="text-[6.5px] font-bold text-slate-400 uppercase tracking-widest block">Attending Consultant</span>
                                            <strong className="text-slate-805 block mt-0.5">{e.doctorName}</strong>
                                            <span className="text-[8.5px] text-slate-400 capitalize">{e.subtitle}</span>
                                          </div>
                                          <div>
                                            <span className="text-[6.5px] font-bold text-slate-400 uppercase tracking-widest block">Time Slot</span>
                                            <strong className="text-slate-805 block mt-0.5">
                                              {new Date(e.details.appointment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            </strong>
                                            <span className="text-[8.5px] text-slate-400">{e.details.time_slot}</span>
                                          </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                                          <span className="text-[7.5px] font-black uppercase text-slate-400">
                                            Status: <strong className="text-amber-500">{e.status}</strong>
                                          </span>
                                          <span className="text-[8px] text-slate-500 font-extrabold uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                                            Fee: ₹{e.details.consultation_fee || 0}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Lab Report Details */}
                                    {isReport && (
                                      <div className="space-y-1.5 text-[10px] font-semibold text-slate-500">
                                        <div className="flex justify-between items-start gap-2.5">
                                          <div>
                                            <span className="text-[6.5px] font-bold text-slate-400 uppercase tracking-widest block">Test Category</span>
                                            <strong className="text-slate-850 text-[10.5px] block mt-0.5">{e.title}</strong>
                                            <span className="text-[8.5px] text-slate-400">{e.subtitle}</span>
                                          </div>
                                          <div className="text-right">
                                            <span className="text-[6.5px] uppercase font-black px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600">
                                              {e.status}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex gap-2 pt-1 border-t border-slate-50">
                                          <button
                                            onClick={() => alert('Diagnostic PDF Report downloaded locally')}
                                            className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-655 text-[8px] font-black uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1 min-h-[24px]"
                                          >
                                            <Download className="w-2.5 h-2.5" /> Download PDF
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 5: PROFILE CONTROL CENTER ── */}
        {activeTab === 'profile' && (
          <div className="space-y-3.5 animate-fade-in text-left">
            <div>
              <h2 className="text-[10px] font-black text-slate-850 tracking-widest flex items-center gap-1.5 uppercase leading-none">
                <User className="w-3.5 h-3.5 text-[#005EB8]" />
                Profile Control Center
              </h2>
              <p className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                Manage your credentials, emergency contacts, and allergies.
              </p>
            </div>

            {profileSuccess && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl px-3 py-2 text-[10.5px] font-bold">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>Profile synchronized successfully.</span>
              </div>
            )}

            <div className="bg-white border border-slate-200/60 rounded-xl p-3.5 shadow-sm">
              <form onSubmit={handleSaveProfile} className="space-y-3.5">
                <div>
                  <label className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full text-base md:text-xs p-2 bg-slate-50 border border-slate-200 rounded-md focus:border-[#005EB8] focus:bg-white outline-none font-bold text-slate-800 transition-colors min-h-[36px]"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Email Address</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full text-base md:text-xs p-2 bg-slate-50 border border-slate-200 rounded-md focus:border-[#005EB8] focus:bg-white outline-none font-bold text-slate-800 transition-colors min-h-[36px]"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={profileForm.address}
                    onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="w-full text-base md:text-xs p-2 bg-slate-50 border border-slate-200 rounded-md focus:border-[#005EB8] focus:bg-white outline-none font-bold text-slate-800 transition-colors min-h-[36px]"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Critical Allergies / Alerts</label>
                  <input
                    type="text"
                    value={profileForm.allergies}
                    onChange={e => setProfileForm({ ...profileForm, allergies: e.target.value })}
                    placeholder="e.g. Penicillin, Latex (or None)"
                    className="w-full text-base md:text-xs p-2 bg-slate-50 border border-slate-200 rounded-md focus:border-[#005EB8] focus:bg-white outline-none font-bold text-slate-800 transition-colors min-h-[36px]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={profileSaving}
                  className="w-full min-h-[38px] py-1.5 px-3.5 bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-50 text-white font-black text-[9.5px] rounded-lg shadow-md uppercase tracking-wider transition-all flex items-center justify-center gap-1 outline-none font-sans"
                >
                  {profileSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  <span>{profileSaving ? 'Saving Profile...' : 'Save Profile Credentials'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await clearOfflineCache();
                    await signOut();
                    if (onLogout) onLogout();
                  }}
                  className="w-full min-h-[38px] py-1.5 px-3.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-black text-[9.5px] rounded-lg uppercase tracking-wider transition-all flex items-center justify-center gap-1 outline-none mt-2 active:scale-95"
                >
                  Log Out from Account
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── TAB 6: OPD CAMPUS NAVIGATION GUIDE ── */}
        {activeTab === 'guide' && (
          <div className="space-y-3.5 animate-fade-in text-left">
            <div>
              <h2 className="text-[10px] font-black text-slate-850 tracking-widest flex items-center gap-1.5 uppercase leading-none">
                <Building2 className="w-3.5 h-3.5 text-[#005EB8]" />
                OPD Guide Map
              </h2>
              <p className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                Step-by-step directions to locate consulting rooms and medical facilities.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {[
                { floor: 'Ground Floor', rooms: ['Reception Desk', 'Pharmacy counter', 'General OPD Room 101'], desc: 'Lobby area. Emergency triage desk is immediately to the right side of the main lobby entry.' },
                { floor: '1st Floor', rooms: ['OPD Cardiology Room 204', 'Pediatrics Room 205', 'Diagnostic Labs'], desc: 'Consultation suites. Escalators are located in the center aisle, and lifts are past reception.' },
                { floor: '2nd Floor', rooms: ['Administrative Blocks', 'Executive Conference Hall'], desc: 'Office spaces. Authorized administrative access only.' }
              ].map((fl, idx) => (
                <div key={idx} className="bg-white border border-slate-200/50 rounded-xl p-3 shadow-sm text-left flex flex-col justify-between min-h-[140px]">
                  <div className="space-y-1">
                    <span className="text-[6.5px] font-black uppercase text-[#005EB8] bg-[#005EB8]/10 border border-[#005EB8]/15 px-1.5 py-0.5 rounded">{fl.floor}</span>
                    <h4 className="font-extrabold text-slate-750 text-[10px] mt-1 leading-relaxed">{fl.desc}</h4>
                    
                    <div className="space-y-0.5 mt-2">
                      <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Featured Rooms</span>
                      {fl.rooms.map((rm, rIdx) => (
                        <div key={rIdx} className="text-[9px] text-slate-500 font-bold flex items-center gap-1">
                          <span className="w-1 h-1 bg-[#00A3AD] rounded-full" />
                          <span>{rm}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Contextual directions sync banner */}
            <div className="bg-blue-50 border border-blue-105 rounded-xl p-3 text-left flex gap-2.5 items-start">
              <Building2 className="w-4.5 h-4.5 text-[#005EB8] flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5 text-[10.5px] font-semibold">
                <span className="text-[7.5px] font-black text-[#005EB8] uppercase tracking-wider block">OPD Campus Directions Helper</span>
                <p className="text-slate-600 font-bold leading-relaxed text-[10.0px]">
                  {activeToken ? (
                    <>
                      Your active token is registered for <strong>{activeToken.doctor_name || 'Specialist'}</strong>. Go to the <strong>1st Floor</strong>, turn left into the Cardiology corridor, and queue outside <strong>Room {activeToken.room_number || '204'}</strong>.
                    </>
                  ) : (
                    <>No active queue ticket sync found. Select a quick action department on the dashboard to register directions guides.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 7: LAB REPORTS DIAGNOSTICS VAULT ── */}
        {activeTab === 'reports' && (
          <div className="space-y-3.5 animate-fade-in text-left">
            <div>
              <h2 className="text-[10px] font-black text-slate-850 tracking-widest flex items-center gap-1.5 uppercase leading-none">
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />
                Diagnostics Reports
              </h2>
              <p className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                Access your verified blood counts, ECGs, and scans.
              </p>
            </div>

            {dbLabReports.length === 0 ? (
              <div className="bg-white border border-slate-200/50 rounded-xl p-5 text-center space-y-3 shadow-sm select-none py-6">
                <div className="w-8 h-8 bg-slate-50 border border-slate-200/50 rounded-lg flex items-center justify-center mx-auto text-indigo-500 shadow-sm">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-[10px] uppercase text-slate-700">Diagnostics Reports Not Linked</h3>
                  <p className="text-[9.5px] text-slate-400 font-bold max-w-xs mx-auto leading-relaxed font-sans">
                    Test reports (CBC blood tests, scan panels, radiology metrics) will appear here automatically once uploaded and verified by clinicians.
                  </p>
                </div>
                <button
                  onClick={() => alert('Syncing diagnostics records...')}
                  className="px-4 py-2 bg-slate-105 hover:bg-slate-200 border border-slate-200 text-slate-650 text-[9px] font-black uppercase tracking-wider rounded transition-all shadow-inner min-h-[34px]"
                >
                  Verify Lab Linkage
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {dbLabReports.map(rep => (
                  <div key={rep.id} className="bg-white border border-slate-200/50 rounded-xl p-2.5 flex items-center justify-between gap-2.5 text-left shadow-sm">
                    <div className="flex gap-2 items-center">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-[11px] text-slate-800">{rep.test_name || 'Lab Report'}</h4>
                        <span className="text-[8.5px] text-slate-400 font-bold block mt-0.5">{new Date(rep.created_at).toLocaleDateString('en-IN')} • {rep.category || 'Labs'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600">
                        {rep.status || 'VERIFIED'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── MOBILE PWA BOTTOM FLOATING NAVIGATION CAPSULE ── */}
      <nav className="fixed bottom-4 left-4 right-4 z-50 bg-white/90 backdrop-blur-md border border-slate-200/60 p-1.5 shadow-lg flex items-center justify-around select-none rounded-2xl max-w-md mx-auto">
        {[
          { id: 'home', label: 'Home', icon: Home },
          { id: 'history', label: 'Vault', icon: Clock },
          { id: 'profile', label: 'Profile', icon: User },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex flex-col items-center justify-center gap-0.5 py-0.5 rounded-lg transition-all active:scale-90 flex-1 min-h-[38px] outline-none"
              aria-label={`Navigate to ${tab.label}`}
            >
              <div className={`p-1 rounded-lg transition-all relative ${isActive ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-400 hover:text-slate-650'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-[7.5px] font-black tracking-wider uppercase transition-colors ${isActive ? 'text-[#005EB8]' : 'text-slate-400'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── SLIDING QUICK BOOKING MODAL OVERLAY ── */}
      {showBookingOverlay && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end justify-center p-0 transition-opacity animate-fade-in">
          <div className="bg-white rounded-t-xl w-full max-w-lg p-4 space-y-4 animate-slide-in max-h-[75vh] overflow-y-auto text-left relative">
            <button
              onClick={() => { setShowBookingOverlay(false); setBookingError(''); }}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1 rounded-full transition-colors outline-none"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="border-b border-slate-100 pb-2">
              <span className="text-[7.5px] font-black text-[#005EB8] uppercase tracking-widest bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                Queue Registration
              </span>
              <h3 className="text-[11px] font-black text-slate-800 mt-2">Register Outpatient Queue Ticket</h3>
              <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Register walk-in tokens for immediate specialist triage tracking.</p>
            </div>

            <form onSubmit={handleQuickBookSubmit} className="space-y-4">
              {bookingError && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-[10px] font-bold flex items-center gap-1.5 text-left">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{bookingError}</span>
                </div>
              )}

              {/* Specialty Grid */}
              <div className="space-y-1">
                <label className="block text-[7.5px] font-black text-slate-400 uppercase tracking-widest">Select Specialty Department *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {DEPARTMENTS.map(d => {
                    const isSelected = quickDept === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setQuickDept(d)}
                        className={`p-1 rounded-md border transition-all flex flex-col items-center justify-center text-center gap-0.5 min-h-[42px] outline-none ${
                          isSelected
                            ? 'border-transparent bg-gradient-to-br from-[#005EB8] to-[#00A3AD] text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-750 hover:border-slate-350'
                        }`}
                      >
                        <span className="text-sm leading-none">{DEPT_ICONS[d] || '🩺'}</span>
                        <span className="text-[7.5px] font-black uppercase tracking-wider block">
                          {DEPARTMENT_LABEL[d]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority Selectors */}
              <div className="space-y-1">
                <label className="block text-[7.5px] font-black text-slate-400 uppercase tracking-widest">Priority Classification</label>
                <div className="grid grid-cols-3 gap-1">
                  {PRIORITY_OPTIONS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setQuickPriority(p.value)}
                      className={`p-1.5 rounded-md border transition-all flex flex-col items-center justify-center text-center gap-0.5 min-h-[42px] outline-none ${
                        quickPriority === p.value 
                          ? p.color + ' border-transparent shadow-sm' 
                          : 'border-slate-200 bg-white text-slate-655 hover:border-slate-350'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                      <span className="text-[7.5px] font-black uppercase tracking-wider block leading-none">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={bookingLoading || !quickDept}
                className="w-full min-h-[38px] bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-50 text-white font-black text-[10px] rounded-lg shadow-md uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 outline-none active:scale-[0.98]"
              >
                {bookingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5" />}
                <span>{bookingLoading ? 'Registering Queue Token...' : 'Register Queue Ticket →'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── PRESCRIPTION PRINT/PDF PREVIEW MODAL ── */}
      {activePrescriptionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-3 overflow-y-auto transition-opacity">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 max-h-[85vh] flex flex-col animate-fade-in text-left">
            <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50 flex-shrink-0 gap-2 select-none">
              <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">
                Prescription Sheet Vault
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#005EB8] hover:bg-[#004a96] text-white text-[8.5px] font-black uppercase tracking-wider rounded shadow-sm min-h-[28px]"
                >
                  <Printer className="w-2.5 h-2.5" />
                  <span>Print Sheet</span>
                </button>
                <button
                  onClick={() => setActivePrescriptionModal(null)}
                  className="w-6 h-6 bg-slate-200 hover:bg-slate-350 text-slate-500 hover:text-slate-800 flex items-center justify-center rounded transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="p-3.5 sm:p-4.5 overflow-y-auto flex-1 font-sans print-sheet" id="printable-prescription-container">
              {/* Branded Hospital Header */}
              <div className="border-b border-[#005EB8] pb-3 flex justify-between items-start gap-2.5">
                <div>
                  <h2 className="text-[13px] font-black text-slate-800 tracking-tight flex items-center gap-1 uppercase">
                    <Building2 className="w-4 h-4 text-[#005EB8]" />
                    {tenant?.name || 'Apollo Clinic'}
                  </h2>
                  <span className="text-[7.5px] text-slate-400 font-extrabold uppercase tracking-widest block mt-0.5">
                    MedQueue EHR Cloud Record Node
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[7.5px] font-black text-slate-700 uppercase">Triage Token</div>
                  <div className="text-[8.5px] text-[#00A3AD] font-bold mt-0.5">
                    TOKEN #{activePrescriptionModal.vis.tokens?.token_number || 'TBA'}
                  </div>
                  <div className="text-[7.5px] text-slate-400 mt-0.5">
                    {new Date(activePrescriptionModal.vis.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Doctors & Patient split details */}
              <div className="grid grid-cols-2 gap-2.5 py-2.5 border-b border-slate-100 text-[10px] font-semibold">
                <div className="min-w-0">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Prescribing Doctor</span>
                  <div className="font-extrabold text-slate-800 truncate">
                    {(() => {
                      const matched = docByRoomMap[activePrescriptionModal.vis.tokens?.room_number || activePrescriptionModal.vis.room_number];
                      return matched ? matched.name : (activePrescriptionModal.vis.tokens?.doctor_name || 'Dr. Muskan Kumari');
                    })()}
                  </div>
                  <div className="text-slate-400 font-semibold mt-0.5 uppercase tracking-wide truncate">
                    {(() => {
                      const matched = docByRoomMap[activePrescriptionModal.vis.tokens?.room_number || activePrescriptionModal.vis.room_number];
                      const dept = matched ? matched.department : 'General Medicine';
                      const rm = matched ? matched.room_number : (activePrescriptionModal.vis.tokens?.room_number || '102');
                      return `${dept} • Room ${rm}`;
                    })()}
                  </div>
                </div>

                <div className="min-w-0">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Patient Details</span>
                  <div className="font-extrabold text-slate-800 truncate">{profileForm.name || 'Patient'}</div>
                  <div className="text-slate-400 font-semibold mt-0.5 truncate">
                    Age: {currentUser?.age || '—'} yrs • Phone: {patientPhone}
                  </div>
                </div>
              </div>

              {/* Vitals Summary */}
              <div className="py-2.5 border-b border-slate-100">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-1">Vitals Recorded</span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                  {[
                    { label: 'BP', val: activePrescriptionModal.vis.bp || '120/80' },
                    { label: 'Sugar', val: (activePrescriptionModal.vis.sugar || '110') + ' mg/dL' },
                    { label: 'Temp', val: (activePrescriptionModal.vis.tokens?.patient_intake?.[0]?.temperature || activePrescriptionModal.vis.temperature || '98.6') + ' °F' },
                    { label: 'Pulse', val: (activePrescriptionModal.vis.tokens?.patient_intake?.[0]?.pulse || activePrescriptionModal.vis.pulse || '72') + ' BPM' },
                    { label: 'Oxygen', val: (activePrescriptionModal.vis.tokens?.patient_intake?.[0]?.oxygen || activePrescriptionModal.vis.oxygen || '98') + ' %' },
                  ].map((v, i) => (
                    <div key={i} className="bg-slate-50 rounded p-1 border border-slate-150 text-center">
                      <div className="text-[6.5px] font-black text-slate-400 uppercase tracking-wider">{v.label}</div>
                      <div className="text-[9px] font-black text-slate-800 mt-0.5 truncate">{v.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Symptoms and Diagnosis */}
              <div className="py-2.5 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[10px] font-semibold">
                <div>
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Chief Symptoms</span>
                  <div className="text-slate-700 bg-slate-50 rounded p-1.5 leading-relaxed">
                    {activePrescriptionModal.vis.symptoms || 'General routine followup checkup'}
                  </div>
                </div>
                <div>
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Diagnosis</span>
                  <div className="text-slate-700 font-bold bg-slate-50 rounded p-1.5 leading-relaxed">
                    {activePrescriptionModal.presc?.diagnosis || 'Outpatient Consultation Findings'}
                  </div>
                </div>
              </div>

              {/* Medications grid table */}
              <div className="py-2.5">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block mb-1">Medications List (Rx)</span>
                <table className="w-full text-[10px] font-semibold">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-black text-[7px] uppercase tracking-wider text-left">
                      <th className="pb-1 w-[40%]">Medicine</th>
                      <th className="pb-1 w-[20%]">Dosage</th>
                      <th className="pb-1 w-[20%]">Frequency</th>
                      <th className="pb-1 w-[20%]">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePrescriptionModal.presc && Array.isArray(activePrescriptionModal.presc.medications) && activePrescriptionModal.presc.medications.length > 0 ? (
                      activePrescriptionModal.presc.medications.map((m: any, i: number) => (
                        <tr key={i} className="border-b border-slate-100 text-slate-700">
                          <td className="py-1.5 font-extrabold text-slate-900">
                            <div>• {m.name}</div>
                            {m.instructions && (
                              <div className="text-[8px] text-slate-400 font-bold italic mt-0.5">{m.instructions}</div>
                            )}
                          </td>
                          <td className="py-1.5">{m.dosage || '—'}</td>
                          <td className="py-1.5 font-extrabold text-[#005EB8]">{m.frequency || '—'}</td>
                          <td className="py-1.5">{m.duration || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-2 text-center text-slate-450 font-semibold italic">
                          No medications prescribed.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Verified Badge and Signature */}
              <div className="mt-3.5 flex justify-between items-end border-t border-slate-100 pt-3">
                <span className="border border-emerald-500 text-emerald-500 font-black tracking-widest uppercase rounded px-1.5 py-0.5 rotate-[-2deg] bg-emerald-50 text-[8.5px] shadow-sm select-none">
                  Verified EHR Rx
                </span>
                <div className="text-center font-semibold">
                  <div className="border-t border-slate-350 w-24 pt-1 text-slate-500 text-[7.5px] uppercase">
                    Authorized Sign
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS style injection for printable templates */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-prescription-container, #printable-prescription-container * {
            visibility: visible;
          }
          #printable-prescription-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 10px;
          }
        }
      `}</style>
    </div>
  );
}
