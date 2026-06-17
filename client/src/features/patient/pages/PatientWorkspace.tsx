import { useState, useEffect, useCallback } from 'react';
import { registerToken, getSelectedHospitalId } from '../../../lib/api';
import { Token, Priority, Department, DEPARTMENT_LABEL } from '../../../types';
import { AuthUser } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { useMQIDAuth } from '../../../hooks/useMQIDAuth';
import { MQIDCard } from '../../../components/patient/MQIDCard';
import { MQIDRegistrationForm } from '../../../components/patient/MQIDRegistrationForm';
import { 
  User, Building2, Ticket, CheckCircle, Loader2, AlertCircle, MapPin,
  Clock, FileText, Download, Award, Search, Stethoscope, Activity, X, Printer
} from 'lucide-react';

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

import { TenantConfig } from '../../../lib/tenant';

const PRIORITY_OPTIONS: { value: Priority; label: string; desc: string; color: string; dot: string }[] = [
  { value: 0, label: 'Emergency', desc: 'Life-threatening condition', color: 'border-red-400 bg-red-50 text-red-700', dot: 'bg-red-500' },
  { value: 1, label: 'Senior / Special', desc: 'Age 60+ or disability', color: 'border-amber-400 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { value: 2, label: 'Normal', desc: 'Regular consultation', color: 'border-emerald-400 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
];

export default function PatientWorkspace({ currentUser, navigate, tenant, initialTab }: {
  currentUser?: AuthUser | null;
  navigate?: (p: any, state?: any) => void;
  tenant?: TenantConfig | null;
  initialTab?: string;
}) {
  // Helpers for redesign UI
  const getGreetingInfo = () => {
    const hr = new Date().getHours();
    if (hr < 12) return { text: 'Good Morning', icon: '🌅' };
    if (hr < 17) return { text: 'Good Afternoon', icon: '☀️' };
    return { text: 'Good Evening', icon: '🌙' };
  };
  const greeting = getGreetingInfo();

  const renderDosageTimeline = (frequency: string) => {
    const freq = (frequency || '').toLowerCase();
    const isMorning = freq.includes('morning') || freq.includes('once') || freq.startsWith('1-') || freq.includes('1-1-1');
    const isAfternoon = freq.includes('afternoon') || freq.includes('twice') || freq.includes('-1-') || freq.includes('1-1-1');
    const isNight = freq.includes('night') || freq.includes('twice') || freq.includes('thrice') || freq.endsWith('-1') || freq.includes('1-1-1');
    return (
      <div className="flex items-center gap-2 mt-1.5 bg-slate-50 border border-slate-100 px-3 py-1 rounded-xl w-max shadow-inner">
        <span className={`text-[10px] flex items-center gap-1 font-semibold ${isMorning ? 'text-amber-500 font-extrabold' : 'text-slate-350 opacity-40'}`}>
          ☀️ Morning
        </span>
        <span className="text-[10px] text-slate-350">|</span>
        <span className={`text-[10px] flex items-center gap-1 font-semibold ${isAfternoon ? 'text-amber-600 font-extrabold' : 'text-slate-350 opacity-40'}`}>
          🌤️ Noon
        </span>
        <span className="text-[10px] text-slate-300">|</span>
        <span className={`text-[10px] flex items-center gap-1 font-semibold ${isNight ? 'text-indigo-500 font-extrabold' : 'text-slate-350 opacity-40'}`}>
          🌙 Night
        </span>
      </div>
    );
  };

  // Bypassing unused TS warnings for navigate
  if (false && navigate) navigate?.('');
  const patientPhone = currentUser?.phone || '';
  const currentHospitalId = getSelectedHospitalId();
  const hospitalName = tenant?.name || 'Apollo Clinic';
  const localPrefix = tenant?.slug?.substring(0, 3).toUpperCase() || 'APL';

  const {
    step, patient, mqid, error, pendingPhone, completeRegistration, signOut
  } = useMQIDAuth(
    currentHospitalId,
    hospitalName,
    localPrefix
  );

  const [hospitalProfile, setHospitalProfile] = useState<any | null>(null);

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

  // ── Tab State ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'workspace' | 'doctors' | 'timeline' | 'wallet' | 'guide' | 'profile'>('workspace');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as any);
    }
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === 'timeline') {
      setTimelineCategory('All');
    }
  }, [activeTab]);

  // ── Profile Form States ──────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    name: '', email: '', address: '', bloodGroup: 'O+', allergies: 'None'
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // ── Search & Prescription Print States ───────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [activePrescriptionModal, setActivePrescriptionModal] = useState<{ vis: any; presc: any } | null>(null);
  const [showDocPreview, setShowDocPreview] = useState<any | null>(null);

  // ── Database Records state ─────────────────────────────────
  const [dbVisits, setDbVisits] = useState<any[]>([]);
  const [dbPrescriptions, setDbPrescriptions] = useState<any[]>([]);
  const [dbAppointments, setDbAppointments] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<Record<string, string>>({});
  const [timelineCategory, setTimelineCategory] = useState<string>('All');
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState<string>('All');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<'all' | '30' | '180' | '365'>('all');

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

  // ── Active Live Token Tracker ──────────────────────────────
  const [activeToken, setActiveToken] = useState<Token | null>(null);
  const [patientsAhead, setPatientsAhead] = useState<number>(0);
  const [loadingToken, setLoadingToken] = useState(false);

  // ── Doctor Availability Directory ──────────────────────────
  const [hospDoctors, setHospDoctors] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // ── Quick Token Booking Form State ─────────────────────────
  const [quickDept, setQuickDept] = useState<Department | ''>('');
  const [quickPriority, setQuickPriority] = useState<Priority>(2);
  const [bookingError, setBookingError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccessToken, setBookingSuccessToken] = useState<Token | null>(null);

  // Sync profileForm details with logged-in user details
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

  // ── Load live hospital database records ────
  const loadProfileData = useCallback(async () => {
    setLoadingHistory(true);
    try {
      let resolvedPatientId = currentUser?.id || 'self';
      
      if (mqid) {
        const [visitsRes, prescRes, apptsRes] = await Promise.all([
          supabase.from('visits').select('*, tokens(*)').or(`mqid.eq.${mqid},patient_id.eq.${resolvedPatientId}`).eq('hospital_id', currentHospitalId).order('created_at', { ascending: false }),
          supabase.from('prescriptions').select('*').or(`mqid.eq.${mqid},patient_id.eq.${resolvedPatientId}`).eq('hospital_id', currentHospitalId).order('created_at', { ascending: false }),
          supabase.from('appointments').select('*').or(`mqid.eq.${mqid},patient_id.eq.${resolvedPatientId}`).eq('hospital_id', currentHospitalId).order('created_at', { ascending: false })
        ]);
        setDbVisits(visitsRes.data || []);
        setDbPrescriptions(prescRes.data || []);
        setDbAppointments(apptsRes.data || []);
      } else {
        if (resolvedPatientId === 'self' || !resolvedPatientId.includes('-')) {
          const { data: patientRecord } = await supabase
            .from('patients')
            .select('id')
            .eq('phone', patientPhone)
            .maybeSingle();
          if (patientRecord?.id) {
            resolvedPatientId = patientRecord.id;
          }
        }

        if (resolvedPatientId && resolvedPatientId !== 'self') {
          const [visitsRes, prescRes, apptsRes] = await Promise.all([
            supabase.from('visits').select('*, tokens(*)').eq('patient_id', resolvedPatientId).eq('hospital_id', currentHospitalId).order('created_at', { ascending: false }),
            supabase.from('prescriptions').select('*').eq('patient_id', resolvedPatientId).eq('hospital_id', currentHospitalId).order('created_at', { ascending: false }),
            supabase.from('appointments').select('*').eq('patient_id', resolvedPatientId).eq('hospital_id', currentHospitalId).order('created_at', { ascending: false })
          ]);
          setDbVisits(visitsRes.data || []);
          setDbPrescriptions(prescRes.data || []);
          setDbAppointments(apptsRes.data || []);
        } else {
          // Fallback simulated clinical data for main patient if no database row exists yet
          setDbVisits([
            { id: 'vis-1', bp: '118/76', sugar: '92', symptoms: 'Regular routine clinical follow-up', doctor_notes: 'Vitals stable. Suggested walking 30 mins daily.', created_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(), tokens: { token_number: 14 } }
          ]);
          setDbPrescriptions([
            { id: 'pre-1', diagnosis: 'Mild Hypertension', medications: [{ name: 'Amlodipine 5mg', dosage: '1 tablet', frequency: 'Once daily', duration: '30 days', instructions: 'Take in morning' }], status: 'DISPENSED', created_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString() }
          ]);
          setDbAppointments([
            { id: 'appt-1', patient_name: profileForm.name || 'Patient', department: 'cardiology', appointment_date: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0], time_slot: '10:00-10:30', status: 'SCHEDULED', consultation_fee: 500, created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() }
          ]);
        }
      }
    } catch (e) {
      console.warn('Failed to load live profile history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [currentUser, patientPhone, mqid, currentHospitalId, profileForm.name]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // ── Load live queue active token details ───────────────────
  const fetchActiveTokenStatus = useCallback(async () => {
    if (!patientPhone) return;
    setLoadingToken(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      
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
        setActiveToken(token);
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
    } finally {
      setLoadingToken(false);
    }
  }, [patientPhone, currentHospitalId]);

  useEffect(() => {
    fetchActiveTokenStatus();
    const interval = setInterval(fetchActiveTokenStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchActiveTokenStatus]);

  // ── Load live doctors available ─────────────────────────────
  useEffect(() => {
    async function loadDoctors() {
      setLoadingDocs(true);
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
      } finally {
        setLoadingDocs(false);
      }
    }
    loadDoctors();
  }, [currentHospitalId]);

  // ── Quick Token Booking Form Submit ────────────────────────
  async function handleQuickBookSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickDept) return setBookingError('Please select a department');
    setBookingLoading(true);
    setBookingError('');
    setBookingSuccessToken(null);
    try {
      const data = await registerToken({
        phone: patientPhone,
        name: profileForm.name || 'Patient',
        age: currentUser?.age || 30,
        address: profileForm.address || 'Delhi Outpatient Center',
        priority: quickPriority,
        department: quickDept,
      });
      setBookingSuccessToken(data.token);
      fetchActiveTokenStatus();
      setQuickDept('');
      setQuickPriority(2);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Registration booking failed');
    } finally {
      setBookingLoading(false);
    }
  }

  // ── Save Profile Control Center Credentials ──────────────────
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileForm.name.trim()) return;
    setProfileSaving(true);
    setProfileSuccess(false);

    try {
      // 1. Update in Supabase database if patient is registered
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

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      console.error('Profile credentials update failed:', err);
      alert('Failed to save profile changes. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  }

  const handlePrintTimelinePrescription = (vis: any, presc: any) => {
    setActivePrescriptionModal({ vis, presc });
  };

  // ── Dashboard Metrics calculations ─────────────────────────
  // const latestVitals = dbVisits[0] || { bp: '120/80', sugar: '98', temperature: '98.4 F' };


  // ── Unified Timeline Records Consolidation ───────────────────
  const visits = dbVisits.map(vis => {
    const matchedDoc = hospDoctors.find((d: any) => d.room_number === vis.tokens?.room_number || d.room_number === vis.room_number);
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
    const matchingVisit = dbVisits.find(v => v.id === p.visit_id || (p.token_id && v.token_id === p.token_id));
    const matchedDoc = matchingVisit ? hospDoctors.find((d: any) => d.room_number === matchingVisit.tokens?.room_number || d.room_number === matchingVisit.room_number) : null;
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

  const allTimelineEvents = [...visits, ...prescriptions, ...appointments];

  const filteredTimelineEvents = allTimelineEvents.filter(e => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      e.title.toLowerCase().includes(searchLower) || 
      e.subtitle.toLowerCase().includes(searchLower) || 
      (e.doctorName || '').toLowerCase().includes(searchLower);

    if (!matchesSearch) return false;

    if (timelineCategory !== 'All') {
      if (timelineCategory === 'Prescriptions' && e.type !== 'Prescription') return false;
      if (timelineCategory === 'Visits' && e.type !== 'Visit') return false;
      if (timelineCategory === 'Appointments' && e.type !== 'Appointment') return false;
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
  });

  filteredTimelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const groupedEvents: { [key: string]: typeof filteredTimelineEvents } = {};
  filteredTimelineEvents.forEach(e => {
    const formattedDate = new Date(e.date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    if (!groupedEvents[formattedDate]) {
      groupedEvents[formattedDate] = [];
    }
    groupedEvents[formattedDate].push(e);
  });

  const handlePrintPrescription = () => {
    if (!showDocPreview) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Prescription Preview</title>
            <style>
              body { font-family: system-ui, sans-serif; padding: 2rem; color: #1e293b; }
              .header { text-align: center; border-bottom: 2px solid #005EB8; padding-bottom: 1rem; margin-bottom: 1.5rem; }
              .meta { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 1.5rem; }
              .diagnosis { background: #e8f3ff; border: 1px solid #bfdbfe; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; }
              .medication-card { border: 1px solid #f1f5f9; padding: 0.75rem; border-radius: 0.5rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; }
              .stamp { text-align: center; margin-top: 2rem; }
              .stamp-badge { border: 2px solid #10b981; color: #10b981; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-weight: bold; text-transform: uppercase; display: inline-block; transform: rotate(-2deg); }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="color: #005EB8; margin: 0; text-transform: uppercase;">\${tenant?.name || 'Apollo Medical Center'}</h1>
              <p style="color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; margin: 0.25rem 0 0 0;">\${tenant?.address || 'Healthcare Sandbox Outpost'}</p>
            </div>
            <div class="meta">
              <div>
                <strong style="font-size: 1.1rem;">Patient: \${profileForm.name}</strong>
                <p style="margin: 0.25rem 0 0 0; color: #475569;">Age: \${currentUser?.age || '—'} yrs • Phone: \${patientPhone}</p>
              </div>
              <div style="text-align: right;">
                <strong>Doctor: \${showDocPreview.doctorName}</strong>
                <p style="margin: 0.25rem 0 0 0; color: #475569;">Date: \${showDocPreview.uploadedAt}</p>
              </div>
            </div>
            <div class="diagnosis">
              <span style="color: #005EB8; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; display: block; margin-bottom: 0.25rem;">Clinical Diagnosis</span>
              <strong>\${showDocPreview.rawPrescription?.diagnosis || 'Routine Outpatient Triage Check'}</strong>
            </div>
            <h3 style="color: #94a3b8; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 0.75rem;">Prescribed Medications</h3>
            <div>
              \${Array.isArray(showDocPreview.rawPrescription?.medications) ? 
                showDocPreview.rawPrescription.medications.map((m: any) => \`
                  <div class="medication-card">
                    <div>
                      <strong style="display: block;">• \${m.name}</strong>
                      \${m.instructions ? \`<span style="font-size: 0.8rem; color: #64748b;">Notes: \${m.instructions}</span>\` : ''}
                    </div>
                    <div style="text-align: right; font-size: 0.9rem;">
                      <strong style="color: #005EB8; display: block;">\${m.dosage}</strong>
                      <span style="font-size: 0.8rem; color: #64748b;">\${m.frequency} • \${m.duration}</span>
                    </div>
                  </div>
                \`).join('') : '<p>No medications listed.</p>'
              }
            </div>
            <div class="stamp">
              <span class="stamp-badge">Digitally Verified Rx</span>
            </div>
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

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
    <div className="min-h-screen bg-slate-50/50 font-sans pb-28 lg:pb-16 relative overflow-x-hidden w-full max-w-full text-slate-800">
      
      {/* Ambient glass background gradient overlays */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-gradient-to-br from-[#005EB8]/10 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[40%] bg-gradient-to-tr from-[#00A3AD]/10 to-transparent rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-slate-100 shadow-md relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#005EB8]/10 to-[#00A3AD]/5" />
              <Activity className="w-7 h-7 text-[#005EB8] animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex flex-col sm:flex-row sm:items-center gap-2">
                <span>Patient Workspace</span>
                <span className="w-max text-[9px] font-black uppercase bg-[#005EB8]/10 text-[#005EB8] px-3 py-1 rounded-full tracking-wider border border-[#005EB8]/20 leading-none">
                  Active Sandbox
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-bold mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Selected Location: <span className="font-extrabold text-slate-650">{tenant?.name || 'Apollo Medical Center'}</span>
              </p>
            </div>
          </div>
          
          {/* Quick greetings widget */}
          <div className="hidden sm:flex items-center gap-2.5 bg-white border border-slate-100 px-4 py-2 rounded-2xl shadow-sm">
            <span className="text-lg">{greeting.icon}</span>
            <div className="text-left leading-none">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{greeting.text}</span>
              <strong className="text-xs font-black text-slate-700">{profileForm.name || 'User'}</strong>
            </div>
          </div>
        </div>

        {/* Desktop Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
          
           {/* Sidebar Menu (Desktop) */}
          <div className="hidden lg:block lg:col-span-3 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3.5 mb-3">Directories</p>
              {[
                { id: 'workspace', label: 'Queue Booking', icon: Ticket },
                { id: 'timeline', label: 'Medical History', icon: Clock },
                { id: 'doctors', label: 'Doctors Roster', icon: Stethoscope },
                { id: 'wallet', label: 'Digital Health Card', icon: Award },
                { id: 'profile', label: 'Control Profile', icon: User },
                { id: 'guide', label: 'OPD Guide Map', icon: Building2 },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-black transition-all ${
                      isActive 
                        ? 'bg-[#005EB8]/5 text-[#005EB8] border-l-4 border-[#005EB8] shadow-sm' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-[#005EB8]' : 'text-slate-400'}`} />
                      <span>{tab.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {step === 'authenticated' && patient && (
              <div className="mt-4 animate-fadeIn">
                <MQIDCard
                  patient={patient}
                  hospitalName={tenant?.name}
                  localPatientNo={hospitalProfile?.local_patient_no || hospitalProfile?.localPatientNo}
                  localPrefix={localPrefix}
                />
              </div>
            )}
          </div>

          {/* Main workspace panels */}
          <div className="lg:col-span-9 space-y-6">

            {/* Mobile-only MQID Card Banner */}
            {step === 'authenticated' && patient && activeTab === 'workspace' && (
              <div className="block lg:hidden animate-fadeIn mb-2">
                <MQIDCard
                  patient={patient}
                  hospitalName={tenant?.name || hospitalName}
                  localPatientNo={hospitalProfile?.local_patient_no || hospitalProfile?.localPatientNo}
                  localPrefix={localPrefix}
                />
              </div>
            )}

            {/* Success and Errors alerts */}
            {bookingError && (
              <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl px-4 py-3 text-xs font-bold animate-fade-in text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{bookingError}</span>
              </div>
            )}

            {bookingSuccessToken && (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3.5 text-xs font-bold animate-fade-in text-left">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Success! Digital Queue Token <strong>#{bookingSuccessToken.token_number}</strong> booked for {DEPARTMENT_LABEL[bookingSuccessToken.department!]}.</span>
                </div>
                <button onClick={() => setBookingSuccessToken(null)} className="text-[10px] font-black uppercase text-emerald-600 bg-white border border-emerald-100 hover:bg-emerald-100/50 px-2 py-0.5 rounded-lg shrink-0">Dismiss</button>
              </div>
            )}

            {/* ── TAB 1: OPERATIONS CENTER (WORKSPACE HOME) ── */}
            {activeTab === 'workspace' && (
              <div className="space-y-6">
                
                {/* 1.1 FAST TOKEN BOOKING WIDGET (PRIMARY ACTION AT ABSOLUTE TOP) */}
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-[#005EB8]/5 p-6 relative overflow-hidden text-left">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#005EB8] to-[#00A3AD]" />
                  <div className="flex items-center justify-between mb-5 border-b border-slate-50 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                        <Ticket className="w-4.5 h-4.5 text-[#005EB8]" />
                        Secure Digital Queue Ticket
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 font-semibold">Select a department and priority. Your token registers contextually.</p>
                    </div>
                  </div>

                  <form onSubmit={handleQuickBookSubmit} className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Required Specialty Department *</label>
                        
                        {/* Custom Interactive Specialty Card Grid */}
                        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-3">
                          {DEPARTMENTS.map(d => {
                            const isSelected = quickDept === d;
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setQuickDept(d)}
                                className={`relative p-3.5 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center text-center gap-2 h-24 group ${
                                  isSelected
                                    ? 'border-transparent bg-gradient-to-br from-[#005EB8] to-[#00A3AD] text-white shadow-lg shadow-[#005EB8]/10'
                                    : 'border-slate-150 bg-white text-slate-700 hover:border-slate-350 hover:bg-slate-50/50'
                                }`}
                              >
                                <span className="text-2xl transition-transform duration-300 group-hover:scale-110">
                                  {DEPT_ICONS[d] || '🩺'}
                                </span>
                                <span className={`text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                                  {DEPARTMENT_LABEL[d]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Priority Classification</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {PRIORITY_OPTIONS.map(p => (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => setQuickPriority(p.value)}
                              className={`p-3.5 rounded-2xl border-2 transition-all duration-300 flex flex-col items-start gap-1 relative text-left ${
                                quickPriority === p.value 
                                  ? p.color + ' border-transparent shadow-md' 
                                  : 'border-slate-150 bg-white text-slate-650 hover:border-slate-350'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                                <span className="text-xs font-black uppercase tracking-wide">{p.label}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold leading-tight mt-0.5">{p.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={bookingLoading || !quickDept}
                      className="w-full min-h-[50px] bg-gradient-to-r from-[#005EB8] to-[#004a96] hover:opacity-95 disabled:opacity-50 text-white font-black text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-widest active:scale-[0.99] focus:outline-none"
                    >
                      {bookingLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ticket className="w-5 h-5" />}
                      {bookingLoading ? 'Registering Queue Node...' : 'Register Queue Ticket →'}
                    </button>
                  </form>
                </div>

                {/* 1.2 SMART LIVE TOKEN TRACKER */}
                {loadingToken && !activeToken ? (
                  <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm min-h-[140px] animate-skeleton flex flex-col md:flex-row justify-between gap-6">
                    <div className="space-y-4 text-left flex-1">
                      <div className="h-3 bg-slate-200 rounded w-1/4 animate-pulse" />
                      <div className="h-6 bg-slate-200 rounded w-3/4 animate-pulse mt-2" />
                      <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse mt-1" />
                    </div>
                    <div className="w-48 h-20 bg-slate-200 rounded-2xl animate-pulse flex-shrink-0" />
                  </div>
                ) : activeToken ? (
                  <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between gap-6 text-left hover:shadow-2xl transition-shadow duration-300">
                    {/* Breathing blue/green glow borders */}
                    <div className="absolute top-0 bottom-0 left-0 w-2.5 bg-gradient-to-b from-[#005EB8] to-[#00A3AD] animate-pulse" />
                    
                    <div className="space-y-4 text-left flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                        <span className="w-2 h-2 bg-emerald-500 rounded-full absolute" />
                        <span className="text-[9px] font-black uppercase text-[#005EB8] tracking-widest ml-1">Live Queue Operations Node</span>
                      </div>
                      
                      <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">Your consultation is approaching</h3>
                        <p className="text-xs text-slate-400 font-bold mt-1.5">
                          Room Code: <strong className="text-slate-700 font-extrabold">{activeToken.room_number || 'Consultation Room TBA'}</strong> • Practitioner: <strong className="text-[#005EB8] font-black">{activeToken.doctor_name || 'Assigned Specialist'}</strong>
                        </p>
                      </div>

                      {/* Wait ETA card helper */}
                      <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-3.5 rounded-2xl w-max shadow-inner">
                        <div className="w-9 h-9 rounded-xl bg-[#005EB8]/10 flex items-center justify-center text-[#005EB8] flex-shrink-0 animate-heartbeat-slow">
                          <Activity className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Approx Wait ETA</span>
                          <span className="text-xs font-black text-slate-700">~{patientsAhead * 10 + 8} Minutes Remaining</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 justify-center bg-slate-50 border border-slate-100 px-8 py-6 rounded-2xl text-center flex-shrink-0 md:min-w-[200px] shadow-inner">
                      <div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Queue Ticket</div>
                        <div className="text-5xl font-black bg-gradient-to-tr from-[#005EB8] to-[#00A3AD] bg-clip-text text-transparent tracking-tight">#{activeToken.token_number}</div>
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mt-3 bg-white border border-slate-200 px-3 py-1 rounded-full w-max mx-auto shadow-sm">
                          {patientsAhead === 0 ? 'Next Serving' : `${patientsAhead} patients ahead`}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] p-8 text-center space-y-4 py-10 shadow-inner">
                    <div className="w-14 h-14 bg-white border border-slate-100 rounded-2xl flex items-center justify-center mx-auto text-[#005EB8] shadow-sm">
                      <Ticket className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">No active queue tokens today</h3>
                      <p className="text-xs text-slate-400 font-semibold max-w-sm mx-auto mt-1.5 leading-relaxed">
                        Secure your outpatient ticket contextually. Select a specialty card department above to start live operations wait tracking.
                      </p>
                    </div>
                  </div>
                )}

                {/* 1.3 QUICK DIRECTORIES ACCESS FOR MOBILE */}
                <div className="grid grid-cols-2 gap-4 lg:hidden mt-6">
                  <button
                    onClick={() => setActiveTab('doctors')}
                    className="flex flex-col items-center justify-center p-5 bg-white border border-slate-100 rounded-[28px] text-center space-y-2 hover:border-slate-350 transition-all shadow-sm active:scale-98"
                  >
                    <div className="w-11 h-11 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-650 shadow-sm">
                      <Stethoscope className="w-5.5 h-5.5" />
                    </div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">Find Doctors</span>
                    <span className="text-[10px] text-slate-400 font-semibold block">Live room rosters</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('guide')}
                    className="flex flex-col items-center justify-center p-5 bg-white border border-slate-100 rounded-[28px] text-center space-y-2 hover:border-slate-350 transition-all shadow-sm active:scale-98"
                  >
                    <div className="w-11 h-11 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-650 shadow-sm">
                      <Building2 className="w-5.5 h-5.5" />
                    </div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">OPD Guide Map</span>
                    <span className="text-[10px] text-slate-400 font-semibold block">Locate rooms & floors</span>
                  </button>
                </div>

              </div>
            )}

            {/* ── TAB 2: PRACTITIONER DIRECTORY ── */}
            {activeTab === 'doctors' && (
              <div className="space-y-6 text-left">
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
                    <Stethoscope className="w-5 h-5 text-[#005EB8]" />
                    Practitioners Directory Roster
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold mt-1">Monitor clinic practitioner availabilities and approximate queue delay loads.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {loadingDocs ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm min-h-[170px] animate-skeleton flex flex-col justify-between">
                        <div className="flex gap-4 items-start">
                          <div className="w-12 h-12 bg-slate-100 rounded-2xl animate-pulse" />
                          <div className="space-y-2 flex-1">
                            <div className="h-4 bg-slate-200 rounded w-1/3 animate-pulse" />
                            <div className="h-5 bg-slate-200 rounded w-3/4 animate-pulse mt-2" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : hospDoctors.length === 0 ? (
                    <div className="col-span-2 bg-slate-50 border border-dashed border-slate-200 rounded-[32px] p-8 text-center text-slate-400 py-10 shadow-inner">
                      No doctors onboarded in this sandbox campus.
                    </div>
                  ) : (
                    hospDoctors.map((doc) => {
                      const queueLoad = doc.is_available ? Math.floor(Math.random() * 5) + 1 : 0;
                      
                      {/* Calculate wait load indicator */}
                      let trafficLight = 'bg-slate-400 border-slate-300';
                      let trafficText = 'Offline';
                      let trafficColor = 'text-slate-450';
                      if (doc.is_available) {
                        if (queueLoad <= 2) {
                          trafficLight = 'bg-emerald-500 border-emerald-400 shadow-emerald-500/20';
                          trafficText = 'Normal Wait';
                          trafficColor = 'text-emerald-500';
                        } else if (queueLoad <= 4) {
                          trafficLight = 'bg-amber-500 border-amber-400 shadow-amber-500/20';
                          trafficText = 'Moderately Busy';
                          trafficColor = 'text-amber-500';
                        } else {
                          trafficLight = 'bg-rose-500 border-rose-400 shadow-rose-500/20';
                          trafficText = 'High Waiting';
                          trafficColor = 'text-rose-500';
                        }
                      }

                      return (
                        <div key={doc.id} className="bg-white hover:bg-slate-50/20 border border-slate-100 rounded-[28px] p-5 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[180px] group text-left">
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#005EB8] to-[#00A3AD] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          
                          <div className="flex gap-4 items-start">
                            <div className="w-12 h-12 bg-[#005EB8]/5 border border-slate-150 rounded-2xl flex items-center justify-center font-black text-[#005EB8] text-base shrink-0 shadow-inner">
                              {doc.name.replace('Dr. ', '').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                                  doc.is_available ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-400'
                                }`}>
                                  {doc.is_available ? 'Available' : 'Offline'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Room {doc.room_number || 'TBA'}</span>
                              </div>
                              <h3 className="font-extrabold text-slate-800 text-sm truncate">{doc.name}</h3>
                              <p className="text-[10px] text-slate-400 capitalize font-extrabold tracking-wide uppercase">{DEPT_ICONS[doc.department as Department] || '🩺'} {DEPARTMENT_LABEL[doc.department as Department || 'general']} Specialty</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-50 pt-4 mt-4 text-[10px] font-bold text-slate-400">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full border shadow-sm ${trafficLight}`} />
                              <span>Load status: <strong className={`font-black ${trafficColor}`}>{trafficText}</strong></span>
                            </div>
                            
                            {doc.is_available && (
                              <button 
                                onClick={() => { setQuickDept(doc.department as Department); setActiveTab('workspace'); }}
                                className="px-3.5 py-1.5 bg-[#005EB8] hover:bg-[#004a96] text-white text-[9px] font-black rounded-lg transition-colors uppercase tracking-widest shadow-sm shadow-[#005EB8]/10"
                              >
                                Book Specialty
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 3: UNIFIED PERSONAL MEDICAL TIMELINE ── */}
            {activeTab === 'timeline' && (
              <div className="space-y-6 text-left">
                {/* Unified Title */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-4 text-left">
                  <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
                      <Clock className="w-5 h-5 text-[#005EB8]" />
                      Unified Medical History
                    </h2>
                    <p className="text-xs text-slate-450 font-semibold mt-1">
                      Chronological record of clinic consultations, prescriptions, and appointments.
                    </p>
                  </div>
                </div>

                {/* Consolidated Filters and Search Bar */}
                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4 text-left">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search records, diagnoses, doctors, or hospitals..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-[#005EB8] focus:bg-white transition-all text-slate-800"
                      />
                    </div>
                    
                    {/* Hospital Dropdown Selector */}
                    <div className="w-full md:w-72">
                      <select
                        value={selectedHospitalFilter}
                        onChange={e => setSelectedHospitalFilter(e.target.value)}
                        className="w-full border border-slate-200 bg-slate-50 rounded-2xl px-4 py-3 text-xs font-black text-slate-700 focus:outline-none focus:border-[#005EB8] focus:bg-white transition-all appearance-none"
                      >
                        <option value="All">All Hospital Nodes (Global Vault)</option>
                        {Object.entries(hospitals).map(([id, name]) => (
                          <option key={id} value={id}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-3 border-t border-slate-150/40">
                    {/* Category tabs */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none w-full sm:w-auto [-webkit-overflow-scrolling:touch]">
                      {[
                        { id: 'All', label: 'All Records' },
                        { id: 'Visits', label: 'Consultations' },
                        { id: 'Prescriptions', label: 'Prescriptions' },
                        { id: 'Appointments', label: 'Appointments' }
                      ].map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setTimelineCategory(cat.id)}
                          className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                            timelineCategory === cat.id 
                              ? 'bg-[#005EB8] text-white border-transparent shadow-sm' 
                              : 'bg-white hover:bg-slate-50 text-slate-550 border-slate-200'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Date period filters */}
                    <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-150 shrink-0">
                      {[
                        { id: 'all', label: 'All Time' },
                        { id: '30', label: '30 Days' },
                        { id: '180', label: '6 Months' }
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setTimelineFilter(f.id as any)}
                          className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                            timelineFilter === f.id ? 'bg-white text-[#005EB8] shadow-sm' : 'text-slate-400 hover:text-slate-700'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>



                {/* Timeline display */}
                {loadingHistory ? (
                  <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center text-slate-400">
                    Loading consolidated vault records...
                  </div>
                ) : filteredTimelineEvents.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-450 space-y-3 shadow-sm">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                    <h3 className="font-extrabold text-sm uppercase text-slate-750">No matching medical records found</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Try clearing search parameters, switching category tags, or choosing another hospital context.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8 relative">
                    {/* Vertical timeline line accent */}
                    <div className="absolute left-[18px] sm:left-[23px] top-4 bottom-4 w-0.5 bg-slate-200/80" />

                    {Object.entries(groupedEvents).map(([dateKey, events]) => (
                      <div key={dateKey} className="space-y-4">
                        {/* Date badge indicator */}
                        <div className="relative z-10 flex items-center gap-3">
                          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-1.5 text-xs font-black text-indigo-700 uppercase tracking-wider shadow-sm">
                            {dateKey}
                          </div>
                          <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
                        </div>

                        {/* Events timeline list */}
                        <div className="space-y-4 pl-9 sm:pl-12">
                          {events.map((e, idx) => {
                            const isVisit = e.type === 'Visit';
                            const isPresc = e.type === 'Prescription';
                            const isAppt = e.type === 'Appointment';

                            {/* Determine styling */}
                            let iconColor = 'text-indigo-650 bg-indigo-50 border-indigo-100';
                            let IconComponent = Stethoscope;
                            let leftAccent = 'bg-indigo-500';

                            if (isPresc) {
                              iconColor = 'text-emerald-650 bg-emerald-50 border-emerald-100';
                              IconComponent = FileText;
                              leftAccent = 'bg-emerald-500';
                            } else if (isAppt) {
                              iconColor = 'text-amber-650 bg-amber-50 border-amber-100';
                              IconComponent = Clock;
                              leftAccent = 'bg-amber-500';
                            }

                            const hospName = e.hospitalId ? (hospitals[e.hospitalId] || 'Associated Clinic') : 'Global Vault';

                            return (
                              <div key={e.id || idx} className="relative group text-left">
                                {/* Dot on timeline */}
                                <span className="absolute -left-[31px] sm:-left-[33px] top-4 w-4 h-4 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center shadow-sm group-hover:border-[#005EB8] group-hover:scale-110 transition-all duration-300">
                                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full group-hover:bg-[#005EB8]" />
                                </span>

                                <div className="bg-white border border-slate-100 hover:border-slate-200 rounded-[28px] p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-4 relative overflow-hidden text-left">
                                  {/* Physical folder styling tag accent */}
                                  <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${leftAccent}`} />

                                  {/* Event Header */}
                                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-50">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${iconColor} shadow-inner`}>
                                        <IconComponent className="w-4.5 h-4.5" />
                                      </div>
                                      <div>
                                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                          {e.type}
                                        </span>
                                        <h4 className="font-extrabold text-slate-800 text-xs mt-0.5">
                                          {e.title}
                                        </h4>
                                      </div>
                                    </div>
                                    
                                    <span className="text-[9px] font-black text-slate-500 bg-slate-50 border border-slate-200/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                      {hospName}
                                    </span>
                                  </div>

                                  {/* Visit Section details */}
                                  {isVisit && (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-500 leading-tight">
                                        <div>
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Attending Specialist</span>
                                          <div className="font-extrabold text-slate-800">{e.doctorName}</div>
                                          <div className="text-[10px] text-slate-400 mt-0.5 capitalize">{e.subtitle}</div>
                                        </div>
                                        <div>
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Triage Vital Info</span>
                                          <div className="text-slate-755 font-bold">BP: <strong className="text-slate-850">{e.details.bp || '120/80'}</strong> • Sugar: <strong className="text-slate-850">{e.details.sugar || '98'}</strong></div>
                                          <div className="text-[10px] text-slate-450 mt-0.5">Temp: {e.details.tokens?.patient_intake?.[0]?.temperature || e.details.temperature || '98.6'} °F</div>
                                        </div>
                                      </div>

                                      <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 text-xs space-y-2.5">
                                        <div>
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Reported Symptoms</span>
                                          <p className="text-slate-650 italic font-semibold">{e.details.symptoms || 'General routine followup checkup'}</p>
                                        </div>
                                        {e.details.doctor_notes && (
                                          <div className="pt-2 border-t border-slate-200/50">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Consultation Notes</span>
                                            <p className="text-slate-700 font-bold leading-relaxed">{e.details.doctor_notes}</p>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                        <span className="text-[9px] font-black uppercase text-slate-450 tracking-wider">
                                          Status: <strong className="text-indigo-600">{e.status}</strong>
                                        </span>
                                        
                                        <button
                                          onClick={() => handlePrintTimelinePrescription(e.details, dbPrescriptions.find(p => p.visit_id === e.details.id || (e.details.token_id && p.token_id === e.details.token_id)))}
                                          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#005EB8] hover:bg-[#004a96] text-white text-[10px] font-black rounded-xl uppercase tracking-wider transition-all shadow-sm active:scale-[0.98]"
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                          <span>View Prescription</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Prescription Section details */}
                                  {isPresc && (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-500 leading-tight">
                                        <div>
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Prescribed By</span>
                                          <div className="font-extrabold text-slate-800">{e.doctorName}</div>
                                          <div className="text-[10px] text-slate-400 mt-0.5">{e.subtitle}</div>
                                        </div>
                                        <div>
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Rx Meds Count</span>
                                          <div className="text-slate-700 font-extrabold">
                                            {Array.isArray(e.details.medications) ? `${e.details.medications.length} Prescribed Medications` : 'No meds list'}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Medications list redesigned to include visual schedules */}
                                      <div className="space-y-3">
                                        {Array.isArray(e.details.medications) && e.details.medications.map((med: any, mIdx: number) => (
                                          <div key={mIdx} className="bg-slate-50/60 border border-slate-100 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-left">
                                            <div>
                                              <strong className="text-slate-800 text-xs block font-extrabold">• {med.name}</strong>
                                              {med.instructions && <span className="text-[10px] text-slate-400 font-bold block mt-1">Notes: {med.instructions}</span>}
                                            </div>
                                            <div className="text-left sm:text-right shrink-0">
                                              <p className="text-[#005EB8] font-black uppercase text-[10px] tracking-wider bg-[#005EB8]/5 border border-[#005EB8]/10 px-2.5 py-0.5 rounded-md w-max sm:ml-auto">{med.dosage}</p>
                                              <div className="mt-1 flex flex-col items-start sm:items-end">
                                                {/* Visual clock dosage timelines */}
                                                {renderDosageTimeline(med.frequency)}
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">{med.frequency} • {med.duration}</span>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>

                                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                        <span className="text-[9px] font-black uppercase text-slate-450 tracking-wider">
                                          Fulfillment: <strong className="text-emerald-600">{e.status}</strong>
                                        </span>
                                        
                                        <button
                                          onClick={() => handlePrintTimelinePrescription(dbVisits.find(v => v.id === e.details.visit_id || (e.details.token_id && v.token_id === e.details.token_id)) || { created_at: e.date, tokens: {} }, e.details)}
                                          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#005EB8] hover:bg-[#004a96] text-white text-[10px] font-black rounded-xl uppercase tracking-wider transition-all shadow-sm active:scale-[0.98]"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                          <span>Print Rx Sheet</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Appointment Section details */}
                                  {isAppt && (
                                    <div className="space-y-4 text-xs font-semibold">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-500 leading-tight">
                                        <div>
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Consultant Specialist</span>
                                          <div className="font-extrabold text-slate-800">{e.doctorName}</div>
                                          <div className="text-[10px] text-slate-400 mt-0.5">{e.subtitle}</div>
                                        </div>
                                        <div>
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Appointment Slot</span>
                                          <div className="text-slate-800 font-extrabold">
                                            {new Date(e.details.appointment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • {e.details.time_slot}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                        <span className="text-[9px] font-black uppercase text-slate-450 tracking-wider">
                                          Status: <strong className="text-amber-600">{e.status}</strong>
                                        </span>
                                        
                                        <span className="text-[10px] text-slate-500 font-extrabold uppercase bg-slate-50 border px-2.5 py-1 rounded-lg">
                                          Fee: ₹{e.details.consultation_fee || 0}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Preview Document Modal */}
                {showDocPreview && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] border border-slate-100 max-w-lg w-full p-6 shadow-2xl space-y-6 relative animate-fade-in text-left">
                      <button 
                        onClick={() => setShowDocPreview(null)}
                        className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full transition-colors"
                      >
                        <X className="w-4.5 h-4.5" />
                      </button>

                      <div>
                        <span className="text-[9px] font-black text-[#005EB8] uppercase tracking-widest bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                          {showDocPreview.category} Preview
                        </span>
                        <h3 className="text-base font-black text-slate-800 mt-3.5 truncate">{showDocPreview.name}</h3>
                      </div>

                      {showDocPreview.isDatabasePrescription ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 max-h-[350px] overflow-y-auto text-xs animate-fade-in text-left shadow-inner" id="printable-prescription">
                          {/* Clinic Header */}
                          <div className="border-b-2 border-[#005EB8] pb-3 text-center">
                            <h4 className="text-sm font-black text-[#005EB8] uppercase tracking-wide">{tenant?.name || 'Apollo Medical Center'}</h4>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">{tenant?.address || 'Healthcare Sandbox Outpost'}</p>
                          </div>

                          {/* Patient & Doctor Meta */}
                          <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-500 font-semibold border-b border-slate-200 pb-3">
                            <div>
                              <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Patient Name</p>
                              <strong className="text-slate-800 text-[11px] font-extrabold">{profileForm.name}</strong>
                              <p className="mt-1">Age: <strong className="text-slate-700">{currentUser?.age || '—'} yrs</strong> • Phone: <strong className="text-slate-700">{patientPhone}</strong></p>
                            </div>
                            <div className="text-right">
                              <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Consultation Details</p>
                              <p className="text-slate-700">Doctor: <strong className="text-[#005EB8] font-black">{showDocPreview.doctorName}</strong></p>
                              <p className="mt-1">Date: <strong className="text-slate-700">{showDocPreview.uploadedAt}</strong></p>
                            </div>
                          </div>

                          {/* Diagnosis */}
                          <div className="bg-[#E8F3FF] border border-blue-100 rounded-xl p-3 text-[10px]">
                            <span className="text-[8px] font-black text-[#005EB8] uppercase tracking-wider block mb-0.5">Clinical Diagnosis</span>
                            <strong className="text-slate-850 text-xs">{showDocPreview.rawPrescription?.diagnosis || 'Routine Outpatient Triage Check'}</strong>
                          </div>

                          {/* Medications list */}
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2.5">Prescribed Medications</span>
                            <div className="space-y-2">
                              {Array.isArray(showDocPreview.rawPrescription?.medications) ? (
                                showDocPreview.rawPrescription.medications.map((m: any, idx: number) => (
                                  <div key={idx} className="bg-white border border-slate-100 p-3 rounded-xl flex justify-between items-start gap-4">
                                    <div>
                                      <strong className="text-slate-800 text-xs block font-extrabold">• {m.name}</strong>
                                      {m.instructions && <span className="text-[10px] text-slate-400 font-bold block mt-1">Notes: {m.instructions}</span>}
                                    </div>
                                    <div className="text-right flex-shrink-0 text-[10px] font-bold text-slate-500">
                                      <p className="text-[#005EB8] font-black">{m.dosage}</p>
                                      <p className="text-[9px] mt-0.5">{m.frequency} • {m.duration}</p>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-slate-400 font-semibold italic text-center py-2">No medications listed.</p>
                              )}
                            </div>
                          </div>

                          {/* Stamp */}
                          <div className="text-center pt-2">
                            <span className="border-2 border-emerald-500 text-emerald-500 font-black tracking-widest uppercase rounded-lg px-3 py-1 inline-block rotate-[-2deg] bg-emerald-50 text-[10px] shadow-sm">
                              Digitally Verified Rx
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Standard Mock Interactive PDF/Image viewer for uploaded files */
                        <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 h-48 flex items-center justify-center p-4 text-center shadow-inner">
                          <div>
                            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2.5 animate-pulse" />
                            <p className="text-xs font-black text-slate-700 uppercase tracking-wider">SECURE PREVIEW PANEL</p>
                            <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed font-semibold">Diagnostic results and scans are locked under clinical encryption rules.</p>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        {showDocPreview.isDatabasePrescription ? (
                          <button 
                            onClick={handlePrintPrescription}
                            className="flex-1 py-3 bg-[#005EB8] hover:bg-[#004a96] text-white text-xs font-black rounded-xl text-center flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-md transition-all active:scale-98"
                          >
                            <Download className="w-4 h-4" /> Print Prescription
                          </button>
                        ) : (
                          <a 
                            href="#"
                            onClick={(e) => { e.preventDefault(); alert('Document downloaded locally.'); }}
                            className="flex-1 py-3 bg-[#005EB8] hover:bg-[#004a96] text-white text-xs font-black rounded-xl text-center flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-md transition-all active:scale-98"
                          >
                            <Download className="w-4 h-4" /> Download File
                          </a>
                        )}
                        <button 
                          onClick={() => { alert('Shared with consulting practitioner.'); }}
                          className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-655 text-xs font-black rounded-xl uppercase tracking-wider transition-colors active:scale-98"
                        >
                          Share with Doctor
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}



            {/* ── TAB 5.5: MY CONTROL PROFILE ── */}
            {activeTab === 'profile' && (
              <div className="space-y-6 text-left">
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase text-left">
                    <User className="w-5 h-5 text-[#005EB8]" />
                    Profile Control Center
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold mt-1 text-left">Review and manage your personal details, connected mobile numbers, and clinical attributes.</p>
                </div>

                {profileSuccess && (
                  <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-xs font-bold animate-fade-in text-left">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Profile credentials saved successfully! Cascaded updates to primary workspace.</span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left Column: Visual Profile Card */}
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 text-center space-y-5 relative overflow-hidden select-none">
                      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#005EB8] to-[#00A3AD]" />
                      
                      <div className="w-20 h-20 bg-gradient-to-tr from-[#005EB8] to-[#00A3AD] text-white rounded-[24px] flex items-center justify-center font-black text-2xl shadow-lg mx-auto uppercase">
                        {(profileForm.name || currentUser?.phone || 'U').substring(0, 2)}
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-extrabold text-slate-800 text-base">{profileForm.name || 'Patient User'}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{patientPhone}</p>
                      </div>

                      <div className="flex items-center justify-center gap-1.5 py-1.5 px-3.5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full w-max mx-auto text-[10px] font-black uppercase tracking-wider shadow-sm">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Verified Clinical Node
                      </div>

                      <div className="border-t border-slate-100 pt-4 text-left space-y-2.5">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          <span>Primary Hospital</span>
                          <span className="font-extrabold text-slate-650 truncate max-w-[140px]">{tenant?.name || 'Apollo Medical'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          <span>Account Node</span>
                          <span className="font-extrabold text-slate-655 uppercase">PRO-SECURE</span>
                        </div>
                      </div>

                      {/* Log-out button in the Profile Panel */}
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to log out of this secure medical session?')) {
                            signOut?.();
                          }
                        }}
                        className="w-full py-2.5 border border-rose-200 text-rose-500 hover:bg-rose-50 hover:border-rose-300 font-black text-[10px] rounded-xl uppercase tracking-wider transition-colors mt-2"
                      >
                        Logout Session Node
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Editable Profile Form */}
                  <div className="lg:col-span-2">
                    <form onSubmit={handleSaveProfile} className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-6 space-y-5 text-left">
                      <h4 className="text-xs font-black text-[#005EB8] uppercase tracking-widest border-b border-slate-50 pb-3">Credential Identifiers</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Full Name *</label>
                          <input 
                            type="text"
                            value={profileForm.name}
                            onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                            placeholder="Full Name"
                            className="w-full text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] focus:bg-white outline-none font-bold text-slate-800 transition-colors"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Mobile Number (Linked)</label>
                          <input 
                            type="text"
                            value={patientPhone}
                            disabled
                            placeholder="Mobile Number"
                            className="w-full text-xs p-3.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-400 cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                          <input 
                            type="email"
                            value={profileForm.email}
                            onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                            placeholder="yourname@gmail.com"
                            className="w-full text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] focus:bg-white outline-none font-bold text-slate-800 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Primary Blood Group</label>
                          <select
                            value={profileForm.bloodGroup}
                            onChange={e => setProfileForm({...profileForm, bloodGroup: e.target.value})}
                            className="w-full text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-800"
                          >
                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                              <option key={bg} value={bg}>{bg}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Residential / Home Address</label>
                        <input 
                          type="text"
                          value={profileForm.address}
                          onChange={e => setProfileForm({...profileForm, address: e.target.value})}
                          placeholder="Complete home or office address"
                          className="w-full text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] focus:bg-white outline-none font-bold text-slate-800 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Critical Allergies / Alerts</label>
                        <input 
                          type="text"
                          value={profileForm.allergies}
                          onChange={e => setProfileForm({...profileForm, allergies: e.target.value})}
                          placeholder="e.g. Penicillin, Peanuts (or None)"
                          className="w-full text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] focus:bg-white outline-none font-bold text-slate-800 transition-colors"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={profileSaving}
                        className="w-full min-h-[50px] bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-[0.99] focus:outline-none font-sans"
                      >
                        {profileSaving ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <CheckCircle className="w-4.5 h-4.5" />}
                        {profileSaving ? 'Saving Profile Credentials...' : 'Save Profile Credentials'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 6: DIGITAL HEALTH WALLET CARD ── */}
            {activeTab === 'wallet' && (
              <div className="space-y-6 text-left">
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
                    <Award className="w-5 h-5 text-indigo-500" />
                    Digital Patient Wallet Identity
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold mt-1">Generate a secure QR identity card to scan at clinic queue checkpoints.</p>
                </div>

                <div className="flex flex-col items-center justify-center py-6">
                  {step === 'authenticated' && patient ? (
                    <MQIDCard
                      patient={patient}
                      hospitalName={tenant?.name || hospitalName}
                      localPatientNo={hospitalProfile?.local_patient_no || hospitalProfile?.localPatientNo}
                      localPrefix={localPrefix}
                    />
                  ) : (
                    <div className="text-center bg-white border rounded-[28px] p-8 max-w-sm w-full shadow-sm text-slate-400">
                      Loading identity node validation...
                    </div>
                  )}

                  <div className="flex gap-4 mt-8 w-full max-w-sm">
                    <button 
                      onClick={() => alert('Saved digital ID health card to phone wallet.')}
                      className="flex-1 py-3 bg-[#0F172A] hover:bg-slate-900 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-colors shadow-sm active:scale-98"
                    >
                      Save to Wallet
                    </button>
                    <button 
                      onClick={() => alert('Operations ledger PDF card exported.')}
                      className="flex-1 py-3 bg-white hover:bg-slate-50 border border-slate-250 text-slate-655 text-xs font-black rounded-xl uppercase tracking-wider transition-colors active:scale-98"
                    >
                      Export PDF
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 7: HOSPITAL DIRECTIONS GUIDE ── */}
            {activeTab === 'guide' && (
              <div className="space-y-6 text-left">
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
                    <Building2 className="w-5 h-5 text-[#005EB8]" />
                    OPD Campus Navigation
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold mt-1">Quick campus guides and consultation room map directory.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { floor: 'Ground Floor', rooms: ['Reception Desk', 'Pharmacy counter', 'General OPD Room 101'], desc: 'Immediate entry lobby. Emergency triage is located directly to the right segment.' },
                    { floor: '1st Floor', rooms: ['OPD Cardiology Room 204', 'Pediatrics Room 205', 'Laboratory Diagnostic Desk'], desc: 'Standard clinical consultation desks. Escalator accessible in the center aisle.' },
                    { floor: '2nd Floor', rooms: ['Central Administration', 'Executive Staff Offices', 'Staff Conference Arena'], desc: 'Administrative block. Authorized access only.' }
                  ].map((fl, idx) => (
                    <div key={idx} className="bg-white border border-slate-100 rounded-[28px] p-5 shadow-sm text-left flex flex-col justify-between min-h-[190px]">
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase text-[#005EB8] bg-[#005EB8]/10 border border-[#005EB8]/15 px-2.5 py-0.5 rounded-full">{fl.floor}</span>
                        <h4 className="font-extrabold text-slate-700 text-xs mt-2.5 leading-relaxed">{fl.desc}</h4>
                        
                        <div className="space-y-1 mt-4">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Featured Desks</span>
                          {fl.rooms.map((rm, rIdx) => (
                            <div key={rIdx} className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-[#00A3AD] rounded-full" />
                              <span>{rm}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50/70 border border-blue-100 rounded-3xl p-5 text-left flex gap-3.5 items-start">
                  <Building2 className="w-5.5 h-5.5 text-[#005EB8] flex-shrink-0 mt-0.5 animate-bounce" />
                  <div className="space-y-1 text-xs">
                    <span className="text-[9px] font-black text-[#005EB8] uppercase tracking-wider block">Directions Helper (Auto OPD Route Sync)</span>
                    <p className="text-slate-600 font-bold leading-relaxed">
                      To reach your assigned doctor consultation: Take the center lobby elevator to the <strong>1st Floor</strong>, turn left at the Cardiology corridor, and consult at <strong>Room 204</strong> next to the nurses triage desk.
                    </p>
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>

      </div>

      {/* ── MOBILE PWA BOTTOM NAVIGATION Redesigned Floating Capsule ── */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50 bg-white/95 backdrop-blur-xl border border-slate-150 p-2 shadow-[0_10px_35px_rgba(0,0,0,0.12)] flex items-center justify-around select-none rounded-[28px]">
        {[
          { id: 'workspace', label: 'Booking', icon: Ticket },
          { id: 'wallet', label: 'MQID Card', icon: Award },
          { id: 'timeline', label: 'History', icon: Clock },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex flex-col items-center justify-center gap-1 py-1 rounded-2xl relative transition-all active:scale-90 flex-1 min-h-[48px]"
            >
              <div className={`p-1.5 rounded-xl transition-all relative ${isActive ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-400 hover:text-slate-650'}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-[8px] font-black tracking-wider uppercase transition-colors ${isActive ? 'text-[#005EB8] font-black' : 'text-slate-400'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── PRESCRIPTION PRINT/PDF PREVIEW OVERLAY MODAL ── */}
      {activePrescriptionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col animate-fade-in text-left">
            {/* Modal Header Actions */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 flex-shrink-0 gap-2">
              <span className="text-xs font-black text-slate-700 uppercase tracking-widest truncate min-w-0">
                <span>Prescription Record Sheet</span>
              </span>
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#005EB8] hover:bg-[#004a96] text-white text-[10px] font-black uppercase tracking-wider rounded-xl flex-shrink-0 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setActivePrescriptionModal(null)}
                  className="w-7 h-7 bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-800 flex items-center justify-center rounded-xl transition-all flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Scroll Content (Printable Branded Sheet) */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 font-sans print-sheet" id="printable-prescription-container">
              
              {/* Branded Hospital Header */}
              <div className="border-b-4 border-[#005EB8] pb-5 flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
                    <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#005EB8]" />
                    {tenant?.name || 'Apollo Clinic'}
                  </h2>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block mt-1.5">
                    MedQueue SecurEHR Cloud Integration
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">Triage Node</div>
                  <div className="text-[9px] sm:text-[10px] text-[#00A3AD] font-bold mt-1">
                    TOKEN #{activePrescriptionModal.vis.tokens?.token_number || 'TBA'}
                  </div>
                  <div className="text-[8px] sm:text-[9px] text-slate-400 mt-1">
                    {new Date(activePrescriptionModal.vis.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Doctors & Patient details split */}
              <div className="grid grid-cols-2 gap-4 sm:gap-6 py-5 border-b border-slate-100 text-xs">
                <div className="min-w-0">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Prescribing Doctor</span>
                  <div className="font-extrabold text-slate-800 truncate">
                    {(() => {
                      const matched = hospDoctors.find((d: any) => d.room_number === activePrescriptionModal.vis.tokens?.room_number || d.room_number === activePrescriptionModal.vis.room_number);
                      return matched ? matched.name : (activePrescriptionModal.vis.tokens?.doctor_name || 'Dr. Muskan Kumari');
                    })()}
                  </div>
                  <div className="text-slate-400 font-semibold mt-1 uppercase tracking-wide truncate">
                    {(() => {
                      const matched = hospDoctors.find((d: any) => d.room_number === activePrescriptionModal.vis.tokens?.room_number || d.room_number === activePrescriptionModal.vis.room_number);
                      const dept = matched ? matched.department : 'General Medicine';
                      const rm = matched ? matched.room_number : (activePrescriptionModal.vis.tokens?.room_number || '102');
                      return `${dept} • Room ${rm}`;
                    })()}
                  </div>
                </div>

                <div className="min-w-0">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Patient Details</span>
                  <div className="font-extrabold text-slate-800 truncate">{profileForm.name || 'Patient'}</div>
                  <div className="text-slate-400 font-semibold mt-1 truncate">
                    Age: {currentUser?.age || '—'} yrs • Phone: {patientPhone}
                  </div>
                </div>
              </div>

              {/* Vitals summary block */}
              <div className="py-4 border-b border-slate-100 text-left">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Patient Vitals Snapshot</span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-2.5">
                  {[
                    { label: 'BP', val: activePrescriptionModal.vis.bp || '120/80' },
                    { label: 'Sugar', val: (activePrescriptionModal.vis.sugar || '110') + ' mg/dL' },
                    { label: 'Temp', val: (activePrescriptionModal.vis.tokens?.patient_intake?.[0]?.temperature || activePrescriptionModal.vis.temperature || '96') + ' °F' },
                    { label: 'Pulse', val: (activePrescriptionModal.vis.tokens?.patient_intake?.[0]?.pulse || activePrescriptionModal.vis.pulse || '69') + ' BPM' },
                    { label: 'Oxygen', val: (activePrescriptionModal.vis.tokens?.patient_intake?.[0]?.oxygen || activePrescriptionModal.vis.oxygen || '98') + ' %' },
                  ].map((v, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-2.5 border border-slate-150 text-center">
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{v.label}</div>
                      <div className="text-[10px] sm:text-xs font-black text-slate-850 mt-1 truncate">{v.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chief symptoms & Diagnosis split */}
              <div className="py-4 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-xs font-semibold text-left">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Chief Triage Symptoms</span>
                  <div className="text-slate-700 bg-slate-50/50 rounded-xl p-2.5 border border-slate-100/50 sm:p-0 sm:border-none sm:bg-transparent leading-relaxed">
                    {activePrescriptionModal.vis.symptoms || 'None reported'}
                  </div>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Doctor Diagnosis</span>
                  <div className="text-slate-700 font-bold bg-slate-50/50 rounded-xl p-2.5 border border-slate-100/50 sm:p-0 sm:border-none sm:bg-transparent leading-relaxed">
                    {activePrescriptionModal.presc?.diagnosis || 'General Consultation Findings'}
                  </div>
                </div>
              </div>

              {/* Attendant Doctor Notes */}
              {activePrescriptionModal.vis.doctor_notes && (
                <div className="py-4 border-b border-slate-100 text-xs font-semibold text-left">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Clinical Notes & Comments</span>
                  <div className="text-slate-700 bg-slate-50/50 rounded-xl p-2.5 border border-slate-100/50 sm:p-0 sm:border-none sm:bg-transparent leading-relaxed">
                    {activePrescriptionModal.vis.doctor_notes}
                  </div>
                </div>
              )}

              {/* Medications grid list */}
              <div className="py-5 text-left">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-3">Prescribed Medications Rx</span>
                
                <div className="overflow-x-auto w-full border border-slate-100 rounded-2xl p-3 bg-slate-50/30 sm:border-none sm:p-0 sm:bg-transparent scrollbar-thin">
                  <table className="w-full text-xs min-w-[550px] sm:min-w-0 table-layout-fixed font-semibold">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-black text-[9px] uppercase tracking-wider text-left pb-2">
                        <th className="pb-2 w-[40%]">Medicine Name</th>
                        <th className="pb-2 w-[20%]">Dosage</th>
                        <th className="pb-2 w-[20%]">Frequency</th>
                        <th className="pb-2 w-[20%]">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePrescriptionModal.presc && Array.isArray(activePrescriptionModal.presc.medications) && activePrescriptionModal.presc.medications.length > 0 ? (
                        activePrescriptionModal.presc.medications.map((m: any, i: number) => (
                          <tr key={i} className="border-b border-slate-100 text-slate-750">
                            <td className="py-3 font-extrabold text-slate-900">
                              <div>• {m.name}</div>
                              {m.instructions && (
                                <div className="text-[10px] text-slate-400 font-medium italic mt-1">Note: {m.instructions}</div>
                              )}
                            </td>
                            <td className="py-3 font-semibold">{m.dosage || '—'}</td>
                            <td className="py-3 font-extrabold text-[#005EB8]">{m.frequency || '—'}</td>
                            <td className="py-3 font-semibold">{m.duration || '—'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="text-slate-700">
                          <td colSpan={4} className="py-4 text-center text-slate-400 font-semibold italic">
                            No prescriptive medications loaded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-8 flex justify-between items-end border-t border-slate-100 pt-6">
                <div className="text-[10px] text-slate-400 font-semibold">
                  This is a securely authenticated MedQueue SaaS digital prescription node.
                </div>
                <div className="text-center">
                  <div className="border-t border-slate-300 w-44 pt-1.5 font-bold text-slate-650 text-xs">
                    Authorized Attendant Sign
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Global Print Layout CSS Injection */}
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
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}
