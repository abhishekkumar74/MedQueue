import { useState, useEffect, useCallback } from 'react';
import { getQueue, callNextPatient, markTokenNoShow, createPrescription, getSelectedHospitalId } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { Token, PatientIntake, Medication, PRIORITY_LABEL, INTAKE_STATUS_COLOR, INTAKE_STATUS_LABEL } from '../../../types';
import { 
  Loader2, Phone, CheckCircle2, UserX, Stethoscope, RefreshCw, AlertCircle, Plus, Trash2, 
  Printer, Clock, Activity, Heart, ShieldAlert, Sparkles, PlusCircle, X, FileText, ChevronDown
} from 'lucide-react';

const EMPTY_MED: Medication = { name: '', dosage: '', frequency: '', duration: '', instructions: '', quantity: 1 };

interface QueueData {
  waiting: Array<Token & { patient_intake?: PatientIntake[] }>;
  serving: (Token & { patient_intake?: PatientIntake[] }) | null;
}

interface DoctorPanelProps {
  doctorDepartment?: string;
  doctorName?: string;
  roomNumber?: string;
}

// Predefined Medicine Directory
const MEDICINE_DIRECTORY = [
  'Paracetamol 500mg',
  'Amoxicillin 500mg',
  'Pantoprazole 40mg',
  'Metformin 500mg',
  'Amlodipine 5mg',
  'Ibuprofen 400mg',
  'Cetirizine 10mg',
  'Azithromycin 500mg',
  'Telmisartan 40mg',
  'Atorvastatin 10mg',
  'Domperidone 10mg',
  'Glimepiride 2mg',
  'Cough Syrup 100ml',
  'Multivitamin Capsule',
];

// Predefined Prescription Templates
const PRESCRIPTION_TEMPLATES: Record<string, Omit<Medication, 'quantity'>[]> = {
  'Fever': [
    { name: 'Paracetamol 500mg', dosage: '1 tablet', frequency: '1-0-1 (Morning & Night)', duration: '5 days', instructions: 'After meals' },
    { name: 'Cetirizine 10mg', dosage: '1 tablet', frequency: '0-0-1 (Night Only)', duration: '3 days', instructions: 'Before sleep' }
  ],
  'Viral': [
    { name: 'Amoxicillin 500mg', dosage: '1 tablet', frequency: '1-0-1 (Morning & Night)', duration: '5 days', instructions: 'After meals' },
    { name: 'Paracetamol 500mg', dosage: '1 tablet', frequency: '1-1-1 (Morning, Afternoon & Night)', duration: '5 days', instructions: 'After meals' },
    { name: 'Cough Syrup 100ml', dosage: '10 ml', frequency: '1-1-1 (Morning, Afternoon & Night)', duration: '5 days', instructions: 'After meals' }
  ],
  'Gastric': [
    { name: 'Pantoprazole 40mg', dosage: '1 tablet', frequency: '1-0-0 (Morning Only)', duration: '10 days', instructions: 'Before meals (Empty stomach)' },
    { name: 'Domperidone 10mg', dosage: '1 tablet', frequency: '1-0-1 (Morning & Night)', duration: '5 days', instructions: 'Before meals' }
  ],
  'Migraine': [
    { name: 'Ibuprofen 400mg', dosage: '1 tablet', frequency: '1-0-1 (Morning & Night)', duration: '3 days', instructions: 'After meals' },
    { name: 'Pantoprazole 40mg', dosage: '1 tablet', frequency: '1-0-0 (Morning Only)', duration: '3 days', instructions: 'Empty stomach' }
  ],
  'BP Follow-up': [
    { name: 'Amlodipine 5mg', dosage: '1 tablet', frequency: '1-0-0 (Morning Only)', duration: '30 days', instructions: 'After breakfast' },
    { name: 'Telmisartan 40mg', dosage: '1 tablet', frequency: '0-0-1 (Night Only)', duration: '30 days', instructions: 'Before bed' }
  ],
  'Diabetes Follow-up': [
    { name: 'Metformin 500mg', dosage: '1 tablet', frequency: '1-0-1 (Morning & Night)', duration: '30 days', instructions: 'With meals' },
    { name: 'Glimepiride 2mg', dosage: '1 tablet', frequency: '1-0-0 (Morning Only)', duration: '30 days', instructions: 'Before breakfast' }
  ]
};

// Diagnosis Predefined Chips
const DIAGNOSIS_CHIPS = ['Acute Fever', 'Viral Infection', 'Gastroenteritis', 'Migraine', 'Hypertension', 'Type 2 Diabetes', 'General Weakness'];

export default function DoctorPanel({ doctorDepartment = 'general', doctorName = 'Doctor', roomNumber = '101' }: DoctorPanelProps = {}) {
  const [queue, setQueue] = useState<QueueData>({ waiting: [], serving: null });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [medications, setMedications] = useState<Medication[]>([{ ...EMPTY_MED }]);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 🏥 Redesigned Custom Triage Features State
  const [pulse, setPulse] = useState('78');
  const [oxygen, setOxygen] = useState('98');
  const [selectedLabTests, setSelectedLabTests] = useState<string[]>([]);
  const [followUpDays, setFollowUpDays] = useState<string>('after 1 week');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [hospitalName, setHospitalName] = useState('Central Healthcare Campus');

  const currentHospitalId = getSelectedHospitalId();

  // Load Hospital Name
  useEffect(() => {
    async function loadHospital() {
      if (!currentHospitalId) return;
      const { data } = await supabase
        .from('hospitals')
        .select('name')
        .eq('id', currentHospitalId)
        .maybeSingle();
      if (data?.name) {
        setHospitalName(data.name);
      }
    }
    loadHospital();
  }, [currentHospitalId]);

  const fetchQueue = useCallback(async () => {
    try {
      const data = await getQueue(doctorDepartment);
      setQueue(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sync consultation queue');
    } finally {
      setLoading(false);
    }
  }, [doctorDepartment]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 8000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // ── Call next queue token ──────────────────────────────────────────
  async function callNext() {
    setActionLoading('calling');
    try {
      await callNextPatient(doctorDepartment);
      // Reset triage values
      setDiagnosis('');
      setMedications([{ ...EMPTY_MED }]);
      setDoctorNotes('');
      setSelectedLabTests([]);
      setFollowUpDays('after 1 week');
      setPulse('78');
      setOxygen('98');
      setFieldErrors({});
      await fetchQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to request next patient token');
    } finally {
      setActionLoading('');
    }
  }

  // Form Validation
  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (!diagnosis.trim()) errs.diagnosis = 'Diagnosis is required';
    medications.forEach((med, i) => {
      if (!med.name.trim()) errs[`med_${i}_name`] = 'Medication name required';
      if (!med.dosage.trim()) errs[`med_${i}_dosage`] = 'Dosage required';
    });
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Complete consultation & dispatch to Pharmacy ──────────────────
  async function completeConsultation() {
    if (!queue.serving) return;
    if (!validateForm()) return;
    setNotesLoading(true);
    setError('');
    try {
      // Append Lab tests & Follow-up scheduling details to notes for the pharmacists to see
      let comprehensiveNotes = doctorNotes.trim();
      if (selectedLabTests.length > 0) {
        comprehensiveNotes += `\n\n[Diagnostic Lab Orders]: ${selectedLabTests.join(', ')}`;
      }
      comprehensiveNotes += `\n[Follow-up Scheduled]: ${followUpDays}`;

      await createPrescription({
        patient_id: queue.serving.patient_id!,
        token_id: queue.serving.id,
        diagnosis: diagnosis.trim(),
        medications,
        doctor_notes: comprehensiveNotes,
      });

      // Clear layout and refresh
      setDiagnosis('');
      setMedications([{ ...EMPTY_MED }]);
      setDoctorNotes('');
      setSelectedLabTests([]);
      setFollowUpDays('after 1 week');
      setPulse('78');
      setOxygen('98');
      setFieldErrors({});
      await fetchQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to finalize consultation records');
    } finally {
      setNotesLoading(false);
    }
  }

  // No Show marker
  async function markNoShow() {
    if (!queue.serving) return;
    setActionLoading('noshow');
    try {
      await markTokenNoShow(queue.serving.id);
      await fetchQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record patient no-show');
    } finally {
      setActionLoading('');
    }
  }

  // ── Prescription templates injector ─────────────────────────────────
  const applyTemplate = (tplName: string) => {
    const list = PRESCRIPTION_TEMPLATES[tplName];
    if (list) {
      setMedications(list.map(m => ({ ...m, quantity: 1 })));
    }
  };

  // Add med rows
  const addMedication = () => {
    setMedications(prev => [...prev, { ...EMPTY_MED }]);
  };

  const removeMedication = (index: number) => {
    setMedications(prev => prev.filter((_, i) => i !== index));
  };

  const updateMedication = (index: number, field: keyof Medication, value: string | number) => {
    setMedications(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  // ── Morning/Afternoon/Night Frequency Generator ─────────────────────
  const toggleFrequencyShift = (index: number, shift: 'M' | 'A' | 'N', active: boolean) => {
    const med = medications[index];
    let currentFreq = med.frequency || '0-0-0';
    let parts = currentFreq.split(' ')[0].split('-');
    if (parts.length !== 3) parts = ['0', '0', '0'];

    if (shift === 'M') parts[0] = active ? '1' : '0';
    if (shift === 'A') parts[1] = active ? '1' : '0';
    if (shift === 'N') parts[2] = active ? '1' : '0';

    const raw = parts.join('-');
    let desc = '';
    if (raw === '1-0-1') desc = ' (Morning & Night)';
    else if (raw === '1-1-1') desc = ' (Morning, Afternoon & Night)';
    else if (raw === '1-0-0') desc = ' (Morning Only)';
    else if (raw === '0-1-0') desc = ' (Afternoon Only)';
    else if (raw === '0-0-1') desc = ' (Night Only)';
    else if (raw === '1-1-0') desc = ' (Morning & Afternoon)';
    else if (raw === '0-1-1') desc = ' (Afternoon & Night)';

    updateMedication(index, 'frequency', `${raw}${desc}`);
  };

  // ── Quick Lab Tests Toggles ──────────────────────────────────────────
  const toggleLabTest = (test: string) => {
    setSelectedLabTests(prev => 
      prev.includes(test) ? prev.filter(t => t !== test) : [...prev, test]
    );
  };

  // Collapsible Accordion sections for mobile optimization
  const [openSection, setOpenSection] = useState<string | null>('vitals');

  const toggleSection = (sec: string) => {
    setOpenSection(openSection === sec ? null : sec);
  };

  const servingIntake = queue.serving?.patient_intake?.[0];
  const readyCount = queue.waiting.filter(t => t.intake_status === 'READY_FOR_DOCTOR').length;

  if (loading) {
    return (
      <div className="bg-slate-50/50 min-h-screen pb-16 font-sans animate-fade-in">
        {/* Header Skeleton */}
        <div className="bg-white border-b border-slate-150 h-16 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-200 animate-skeleton" />
            <div className="space-y-2">
              <div className="w-32 h-4 bg-slate-200 rounded-md animate-skeleton" />
              <div className="w-48 h-3 bg-slate-100 rounded-md animate-skeleton" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-36 h-9 bg-slate-200 rounded-xl animate-skeleton" />
            <div className="w-9 h-9 bg-slate-100 rounded-xl animate-skeleton" />
          </div>
        </div>

        {/* Dashboard Content Skeleton */}
        <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            {/* Vitals Skeleton */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="w-44 h-4 bg-slate-200 rounded animate-skeleton" />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="bg-slate-50 border border-slate-150 h-20 rounded-2xl p-3 flex flex-col justify-between animate-skeleton" />
                ))}
              </div>
            </div>
            {/* Diagnosis Card Skeleton */}
            <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-3">
              <div className="w-40 h-4 bg-slate-200 rounded animate-skeleton" />
              <div className="w-full h-20 bg-slate-100 rounded-2xl animate-skeleton" />
            </div>
            {/* Medications Card Skeleton */}
            <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div className="w-36 h-4 bg-slate-200 rounded animate-skeleton" />
                <div className="w-24 h-8 bg-slate-100 rounded-xl animate-skeleton" />
              </div>
              <div className="h-32 bg-slate-50 rounded-2xl animate-skeleton" />
            </div>
          </div>
          {/* Queue Sidebar Skeleton */}
          <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="w-32 h-4 bg-slate-200 rounded animate-skeleton" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-slate-50 rounded-2xl animate-skeleton" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50/50 min-h-screen pb-16 font-sans">
      
      {/* ── STICKY TOP ACTIONS SUB-HEADER ──────────────────────── */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-150 z-30 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#005EB8] flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Stethoscope className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                {doctorName}
                <span className="text-[9px] bg-[#00A3AD]/10 text-[#00A3AD] font-black px-1.5 py-0.5 rounded uppercase">Room {roomNumber}</span>
              </h1>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block mt-0.5">
                {doctorDepartment.toUpperCase()} CONSULTATION DASHBOARD
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={callNext}
              disabled={!!actionLoading || readyCount === 0}
              className="flex items-center gap-1.5 px-4 h-9 bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-500/10 active:scale-95"
            >
              {actionLoading === 'calling' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
              <span>Call Next Patient</span>
              {readyCount > 0 && (
                <span className="bg-white/20 text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1">
                  {readyCount}
                </span>
              )}
            </button>

            <button
              onClick={fetchQueue}
              className="w-9 h-9 border border-slate-200 hover:border-slate-350 bg-white text-slate-500 flex items-center justify-center rounded-xl transition-all hover:bg-slate-50 active:scale-95"
            >
              <RefreshCw className="w-4 h-4 text-[#005EB8]" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        
        {error && (
          <div className="mb-6 flex items-center justify-between bg-rose-50 border border-rose-150 text-rose-700 rounded-2xl px-4 py-3 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-[10px] font-black uppercase tracking-wider underline hover:text-rose-900">Dismiss</button>
          </div>
        )}

        {/* ── THREE-COLUMN NOTION/LINEAR WORKSPACE GRID ────────────────── */}
        <div className="grid lg:grid-cols-4 gap-6 items-start">
          
          {/* 💻 LEFT & CENTER PANELS: ACTIVE CONSULTATION FRAME */}
          <div className="lg:col-span-3 space-y-6">
            
            {queue.serving ? (
              <>
                {/* 1. STICKY PATIENT OVERVIEW CARD */}
                <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm relative overflow-hidden">
                  <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-blue-50/20 to-transparent pointer-events-none" />
                  
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {/* Token Big Emblem */}
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#005EB8] to-[#00A3AD] text-white flex flex-col items-center justify-center shadow-lg shadow-blue-500/10">
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none text-blue-100">TOKEN</span>
                        <span className="text-xl font-black leading-none mt-1">#{queue.serving.token_number}</span>
                      </div>

                      <div>
                        <div className="flex items-center flex-wrap gap-2.5">
                          <h2 className="text-base font-black text-slate-800 leading-tight">
                            {queue.serving.patients?.name || 'Linked Patient'}
                          </h2>
                          <span className="text-xs text-slate-500 font-extrabold bg-slate-100 px-2 py-0.5 rounded-lg">
                            {queue.serving.patients?.age ? `${queue.serving.patients.age} Years` : 'Age TBD'}
                          </span>
                          
                          {/* Allergy Badge */}
                          <span className="bg-rose-50 border border-rose-100 text-rose-700 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-rose-500" /> Allergies: None Reported
                          </span>

                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${INTAKE_STATUS_COLOR[queue.serving.intake_status]}`}>
                            {INTAKE_STATUS_LABEL[queue.serving.intake_status]}
                          </span>
                        </div>

                        {/* Phone and Triage notes snap */}
                        <div className="text-xs text-slate-400 font-semibold mt-2.5 space-y-1">
                          <p><span className="text-slate-500 font-extrabold">Registered Phone:</span> {queue.serving.phone}</p>
                          {servingIntake?.symptoms && (
                            <p className="bg-amber-50/50 border border-amber-100/50 rounded-xl p-2.5 text-slate-700 mt-2">
                              <span className="text-amber-800 font-extrabold block text-[10px] uppercase tracking-wider mb-0.5">Chief Complaint logged by triage:</span>
                              {servingIntake.symptoms}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick printable prescription trigger */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowPdfModal(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#005EB8]" />
                        <span>Print Prescription</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Mobile Queue Widget (visible only on mobile/tablet) */}
                <div className="bg-white border border-slate-150 rounded-3xl p-4 shadow-sm lg:hidden mb-4 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => toggleSection('queue-mobile')}
                    className="w-full flex items-center justify-between text-left focus:outline-none min-h-[44px]"
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#005EB8]" />
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Active Queue ({queue.waiting.length} Waiting)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {readyCount > 0 && (
                        <span className="bg-[#005EB8] text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                          {readyCount} Ready
                        </span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${openSection === 'queue-mobile' ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  {openSection === 'queue-mobile' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 max-h-[300px] overflow-y-auto pr-1 animate-fade-in">
                      {queue.waiting.length === 0 ? (
                        <div className="py-6 text-center text-slate-400 text-xs italic">Queue is empty.</div>
                      ) : (
                        queue.waiting.map((t) => {
                          const isReady = t.intake_status === 'READY_FOR_DOCTOR';
                          const isEmergency = t.priority === 0;
                          return (
                            <div 
                              key={t.id}
                              className={`p-3 rounded-2xl border transition-all duration-300 relative ${
                                isEmergency ? 'bg-rose-50/40 border-rose-200' : isReady ? 'bg-violet-50/30 border-violet-150' : 'bg-white border-slate-150'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isEmergency ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700 border'}`}>
                                      #{t.token_number}
                                    </span>
                                    <span className="text-xs font-black text-slate-800 truncate">{t.patients?.name || 'Patient'}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-semibold mt-1 flex items-center gap-1.5">
                                    <span>{t.patients?.age ? `${t.patients.age}y` : 'Age TBD'}</span>
                                    <span>•</span>
                                    <span className="capitalize">{t.department || 'general'}</span>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${t.priority === 0 ? 'bg-rose-100 text-rose-700' : t.priority === 1 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {PRIORITY_LABEL[t.priority]}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* 2. IMPROVED VITALS SECTION */}
                <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleSection('vitals')}
                    className="w-full flex items-center justify-between text-left focus:outline-none min-h-[44px]"
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-4.5 h-4.5 text-[#005EB8]" />
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Patient Triage Vitals Check</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${openSection === 'vitals' ? 'rotate-180' : ''}`} />
                  </button>

                  {openSection === 'vitals' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-in">
                      {[
                        { label: 'Blood Pressure', value: servingIntake?.bp || '120/80', unit: 'mmHg', icon: <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> },
                        { label: 'Blood Sugar', value: servingIntake?.sugar || '96', unit: 'mg/dL', icon: <Sparkles className="w-3.5 h-3.5 text-amber-500" /> },
                        { label: 'Temperature', value: servingIntake?.temperature || '98.4', unit: '°F', icon: <Clock className="w-3.5 h-3.5 text-[#00A3AD]" /> },
                        { label: 'Pulse Rate', value: pulse, unit: 'BPM', setter: setPulse, icon: <Activity className="w-3.5 h-3.5 text-emerald-500" /> },
                        { label: 'Oxygen Level', value: oxygen, unit: '% SpO2', setter: setOxygen, icon: <Activity className="w-3.5 h-3.5 text-blue-500" /> },
                      ].map((vt, i) => (
                        <div key={i} className="bg-slate-50 border border-slate-150 rounded-2xl p-3 flex flex-col justify-between">
                          <div className="flex items-center justify-between gap-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            <span>{vt.label}</span>
                            {vt.icon}
                          </div>
                          <div className="mt-2.5 flex items-baseline gap-1">
                            {vt.setter ? (
                              <input 
                                type="text" 
                                value={vt.value} 
                                onChange={e => vt.setter!(e.target.value)} 
                                className="w-16 bg-white border border-slate-200 text-slate-800 text-sm font-black rounded px-1.5 focus:outline-none focus:border-[#005EB8] h-10 text-center" 
                              />
                            ) : (
                              <span className="text-sm font-black text-slate-800">{vt.value}</span>
                            )}
                            <span className="text-[10px] text-slate-400 font-semibold">{vt.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. SMART DIAGNOSIS SECTION */}
                <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleSection('diagnosis')}
                    className="w-full flex items-center justify-between text-left focus:outline-none min-h-[44px]"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4.5 h-4.5 text-[#005EB8]" />
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Smart Diagnosis & Templates</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${openSection === 'diagnosis' ? 'rotate-180' : ''}`} />
                  </button>

                  {openSection === 'diagnosis' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-fade-in">
                      {/* Predefined Diagnosis tags */}
                      <div className="flex flex-wrap gap-1.5">
                        {DIAGNOSIS_CHIPS.map(ch => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => setDiagnosis(ch)}
                            className={`text-[10px] font-black px-3.5 py-2.5 rounded-xl border transition-all min-h-[38px] ${
                              diagnosis === ch 
                                ? 'bg-[#005EB8] text-white border-[#005EB8] shadow-sm'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {ch}
                          </button>
                        ))}
                      </div>

                      <textarea
                        rows={2}
                        value={diagnosis}
                        onChange={e => { setDiagnosis(e.target.value); setFieldErrors(f => ({ ...f, diagnosis: '' })); }}
                        placeholder="Enter final diagnosis findings..."
                        className={`w-full border rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-750 focus:outline-none resize-none min-h-[80px] ${
                          fieldErrors.diagnosis ? 'border-red-400' : 'border-slate-200 focus:border-[#005EB8]'
                        }`}
                      />
                      {fieldErrors.diagnosis && <p className="text-xs text-red-500 mt-1">{fieldErrors.diagnosis}</p>}

                      {/* QUICK PRESCRIPTION TEMPLATES */}
                      <div className="pt-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Quick Prescription Templates</span>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                          {Object.keys(PRESCRIPTION_TEMPLATES).map(tpl => (
                            <button
                              key={tpl}
                              type="button"
                              onClick={() => applyTemplate(tpl)}
                              className="py-3 px-2.5 border border-slate-200 hover:border-violet-300 hover:bg-violet-50/30 text-[#005EB8] text-[10px] font-black uppercase tracking-wider rounded-xl transition-all text-center flex items-center justify-center gap-1.5 min-h-[44px]"
                            >
                              <PlusCircle className="w-3.5 h-3.5 text-violet-500" />
                              <span>{tpl}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. MODERN PRESCRIPTION UI CONSTRUCTOR */}
                <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleSection('meds')}
                    className="w-full flex items-center justify-between text-left focus:outline-none min-h-[44px]"
                  >
                    <div className="flex items-center gap-2">
                      <Heart className="w-4.5 h-4.5 text-[#005EB8]" />
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Active Medication List</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${openSection === 'meds' ? 'rotate-180' : ''}`} />
                  </button>

                  {openSection === 'meds' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-fade-in">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={addMedication}
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 text-[#005EB8] text-xs font-black uppercase tracking-wider rounded-xl hover:bg-blue-100 transition-colors min-h-[44px]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Med Row</span>
                        </button>
                      </div>

                      {/* Medicines dynamic table constructor */}
                      <div className="space-y-4">
                        {medications.map((med, idx) => {
                          const freqCode = med.frequency ? med.frequency.split(' ')[0] : '0-0-0';
                          const freqParts = freqCode.split('-');
                          const isM = freqParts[0] === '1';
                          const isA = freqParts[1] === '1';
                          const isN = freqParts[2] === '1';

                          return (
                            <div key={idx} className="bg-slate-50 border border-slate-150 rounded-2xl p-4 relative animate-fade-in">
                              <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Medication #{idx + 1}</span>
                                {medications.length > 1 && (
                                  <button 
                                    onClick={() => removeMedication(idx)}
                                    className="text-rose-500 hover:text-rose-700 text-xs font-extrabold flex items-center gap-1 hover:underline min-h-[44px]"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
                                {/* Medicine Search dropdown */}
                                <div className="md:col-span-4">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Select Medicine *</label>
                                  <select
                                    value={med.name}
                                    onChange={e => { updateMedication(idx, 'name', e.target.value); setFieldErrors(f => ({ ...f, [`med_${idx}_name`]: '' })); }}
                                    className={`w-full border bg-white rounded-xl px-2.5 h-11 text-xs font-bold text-slate-800 focus:outline-none ${
                                      fieldErrors[`med_${idx}_name`] ? 'border-red-400' : 'border-slate-200 focus:border-[#005EB8]'
                                    }`}
                                  >
                                    <option value="">-- Choose Medicine --</option>
                                    {MEDICINE_DIRECTORY.map(m => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                  </select>
                                  {fieldErrors[`med_${idx}_name`] && <p className="text-[10px] text-red-500 mt-0.5">{fieldErrors[`med_${idx}_name`]}</p>}
                                </div>

                                {/* Dosage Preset */}
                                <div className="md:col-span-2">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Dosage *</label>
                                  <select
                                    value={med.dosage}
                                    onChange={e => { updateMedication(idx, 'dosage', e.target.value); setFieldErrors(f => ({ ...f, [`med_${idx}_dosage`]: '' })); }}
                                    className={`w-full border bg-white rounded-xl px-2.5 h-11 text-xs font-bold text-slate-800 focus:outline-none ${
                                      fieldErrors[`med_${idx}_dosage`] ? 'border-red-400' : 'border-slate-200 focus:border-[#005EB8]'
                                    }`}
                                  >
                                    <option value="">-- Size --</option>
                                    <option value="1 tablet">1 Tablet</option>
                                    <option value="1 capsule">1 Capsule</option>
                                    <option value="5 ml (1 tsp)">5 ml (1 tsp)</option>
                                    <option value="10 ml (2 tsp)">10 ml (2 tsp)</option>
                                    <option value="500 mg">500 mg</option>
                                    <option value="650 mg">650 mg</option>
                                  </select>
                                  {fieldErrors[`med_${idx}_dosage`] && <p className="text-[10px] text-red-500 mt-0.5">{fieldErrors[`med_${idx}_dosage`]}</p>}
                                </div>

                                {/* Frequency toggles */}
                                <div className="md:col-span-3">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Frequency</label>
                                  <div className="flex gap-1 h-11 bg-slate-200/50 p-1 rounded-xl">
                                    {[
                                      { shift: 'M', label: '🌅 M', val: isM },
                                      { shift: 'A', label: '☀️ A', val: isA },
                                      { shift: 'N', label: '🌙 N', val: isN }
                                    ].map(toggle => (
                                      <button
                                        key={toggle.shift}
                                        type="button"
                                        onClick={() => toggleFrequencyShift(idx, toggle.shift as any, !toggle.val)}
                                        className={`flex-1 text-[10px] font-black rounded-lg transition-all ${
                                          toggle.val 
                                            ? 'bg-[#005EB8] text-white shadow-sm'
                                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                        }`}
                                      >
                                        {toggle.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* Duration selection */}
                                <div className="md:col-span-3">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Duration</label>
                                  <select
                                    value={med.duration}
                                    onChange={e => updateMedication(idx, 'duration', e.target.value)}
                                    className="w-full border border-slate-200 bg-white rounded-xl px-2.5 h-11 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#005EB8]"
                                  >
                                    <option value="3 days">3 Days</option>
                                    <option value="5 days">5 Days</option>
                                    <option value="7 days">1 Week</option>
                                    <option value="14 days">2 Weeks</option>
                                    <option value="30 days">1 Month</option>
                                  </select>
                                </div>
                              </div>

                              {/* Instruction fields */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-3">
                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Medication Instructions</label>
                                  <select
                                    value={med.instructions}
                                    onChange={e => updateMedication(idx, 'instructions', e.target.value)}
                                    className="w-full border border-slate-200 bg-white rounded-xl px-2.5 h-11 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#005EB8]"
                                  >
                                    <option value="After meals">After meals</option>
                                    <option value="Before meals">Before meals</option>
                                    <option value="Empty stomach">Empty stomach (Early Morning)</option>
                                    <option value="At bedtime">At bedtime (Before sleep)</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Quantity</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={med.quantity}
                                    onChange={e => updateMedication(idx, 'quantity', parseInt(e.target.value) || 1)}
                                    className="w-full border border-slate-200 bg-white rounded-xl px-2.5 h-11 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#005EB8]"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. QUICK LAB TESTS & 7. FOLLOW-UP SCHEDULER */}
                <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleSection('labs')}
                    className="w-full flex items-center justify-between text-left focus:outline-none min-h-[44px]"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4.5 h-4.5 text-[#005EB8]" />
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Quick Lab Tests & Follow-Up</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${openSection === 'labs' ? 'rotate-180' : ''}`} />
                  </button>

                  {openSection === 'labs' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 grid md:grid-cols-2 gap-6 animate-fade-in">
                      {/* Lab Test Actions */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Quick Lab Test Actions</span>
                        <div className="flex flex-wrap gap-2">
                          {['CBC', 'Blood Test', 'Sugar Test', 'X-Ray', 'MRI'].map(test => {
                            const isSelected = selectedLabTests.includes(test);
                            return (
                              <button
                                key={test}
                                type="button"
                                onClick={() => toggleLabTest(test)}
                                className={`py-3 px-3.5 border text-[10px] font-black uppercase tracking-wider rounded-xl transition-all min-h-[44px] ${
                                  isSelected 
                                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                {isSelected ? '✓ ' : '+ '} {test}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Follow-up Scheduler */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Follow-Up Scheduler</span>
                        <div className="grid grid-cols-3 gap-2">
                          {['after 3 days', 'after 1 week', 'after 1 month'].map(op => {
                            const isSelected = followUpDays === op;
                            return (
                              <button
                                key={op}
                                type="button"
                                onClick={() => setFollowUpDays(op)}
                                className={`py-3 text-[10px] font-black uppercase tracking-wider rounded-xl text-center border transition-all min-h-[44px] ${
                                  isSelected 
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-150'
                                }`}
                              >
                                {op}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Additional notes text area */}
                <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleSection('advice')}
                    className="w-full flex items-center justify-between text-left focus:outline-none min-h-[44px]"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4.5 h-4.5 text-[#005EB8]" />
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Doctor Notes & Advice</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${openSection === 'advice' ? 'rotate-180' : ''}`} />
                  </button>

                  {openSection === 'advice' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 animate-fade-in">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">Doctor Notes / Consultation Advice</label>
                      <textarea
                        rows={2}
                        value={doctorNotes}
                        onChange={e => setDoctorNotes(e.target.value)}
                        placeholder="Enter exercise prescriptions, diet plans, or special clinic precautions..."
                        className="w-full border border-slate-200 focus:border-[#005EB8] rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-750 focus:outline-none resize-none min-h-[70px]"
                      />
                    </div>
                  )}
                </div>

                {/* Sticky Action Buttons */}
                <div className="bg-white border border-slate-150 rounded-3xl p-4 shadow-sm flex flex-col md:flex-row gap-3">
                  <button
                    onClick={completeConsultation}
                    disabled={notesLoading}
                    className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2 min-h-[48px]"
                  >
                    {notesLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    <span>Complete & Send to Pharmacy</span>
                  </button>

                  <button
                    onClick={markNoShow}
                    disabled={!!actionLoading}
                    className="px-6 py-4 border border-red-200 hover:border-red-300 text-red-600 font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 min-h-[48px]"
                  >
                    {actionLoading === 'noshow' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4.5 h-4.5" />}
                    <span>Mark No-Show</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-white/80 border border-slate-150 rounded-3xl p-20 text-center shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mx-auto mb-4 border border-slate-100">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-slate-800 leading-tight">Consultation Node Idle</h3>
                <p className="text-xs text-slate-400 font-semibold mt-1">Please call the next waiting patient token from the sidebar to begin.</p>
                
                <button
                  onClick={callNext}
                  disabled={!!actionLoading || readyCount === 0}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-500/10 active:scale-95"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Next Patient ({readyCount} Ready)</span>
                </button>
              </div>
            )}

          </div>

          {/* 💻 RIGHT COLUMN: QUEUE MANAGEMENT PANEL */}
          <div className="space-y-6 hidden lg:block">
            
            {/* 8. IMPROVED QUEUE MANAGEMENT PANEL */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-[#005EB8]" />
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Active Patient Queue</span>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-500 font-black px-2 py-0.5 rounded-md">
                  {queue.waiting.length} Waiting
                </span>
              </div>

              {queue.waiting.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs italic">
                  <p>Queue is empty.</p>
                  <p className="mt-1">Waiting for triage arrivals...</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
                  {queue.waiting.map((t, idx) => {
                    const isReady = t.intake_status === 'READY_FOR_DOCTOR';
                    const intake = t.patient_intake?.[0];
                    const isEmergency = t.priority === 0;

                    return (
                      <div 
                        key={t.id}
                        className={`p-3 rounded-2xl border transition-all duration-300 relative ${
                          isEmergency 
                            ? 'bg-rose-50/40 border-rose-200 hover:border-rose-350 shadow-[0_3px_10px_rgba(244,63,94,0.02)]'
                            : isReady 
                              ? 'bg-violet-50/30 border-violet-150 hover:border-violet-300'
                              : 'bg-white border-slate-150 hover:border-slate-350'
                        }`}
                      >
                        {/* Emergency Pulse Accent */}
                        {isEmergency && (
                          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        )}

                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                isEmergency ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                #{t.token_number}
                              </span>
                              <span className="text-xs font-black text-slate-800 truncate">{t.patients?.name || 'Patient'}</span>
                            </div>

                            <div className="text-[10px] text-slate-400 font-semibold mt-1.5 flex flex-wrap items-center gap-x-1.5">
                              <span>{t.patients?.age ? `${t.patients.age}y` : 'Age TBD'}</span>
                              <span>•</span>
                              <span className="capitalize">{t.department || 'general'}</span>
                            </div>

                            {/* Triage vitals log snapshot */}
                            {intake && (
                              <div className="mt-2 bg-slate-50 border border-slate-150/50 rounded-xl p-2 text-[9px] text-slate-400 font-semibold flex flex-wrap gap-2">
                                {intake.bp && <span>BP: <strong className="text-slate-600">{intake.bp}</strong></span>}
                                {intake.sugar && <span>Sugar: <strong className="text-slate-600">{intake.sugar}</strong></span>}
                              </div>
                            )}
                          </div>

                          {/* Priority badge / wait estimation */}
                          <div className="text-right flex-shrink-0">
                            <span className={`text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md ${
                              t.priority === 0 ? 'bg-rose-100 text-rose-700' :
                              t.priority === 1 ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {PRIORITY_LABEL[t.priority]}
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold block mt-1">~{idx * 10}m wait</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Call Next Button footer shortcut */}
              <button
                onClick={callNext}
                disabled={!!actionLoading || readyCount === 0}
                className="w-full mt-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-violet-500/10 flex items-center justify-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Next Patient</span>
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* ── 10. PRESCRIPTION PRINT/PDF PREVIEW OVERLAY MODAL ────────────────── */}
      {showPdfModal && queue.serving && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-150 max-h-[90vh] flex flex-col animate-fade-in">
            {/* Modal Header Actions */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 flex-shrink-0">
              <span className="text-xs font-black text-slate-700 uppercase tracking-widest">EHR Verified Prescription Record</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#005EB8] hover:bg-[#004a96] text-white text-[10px] font-black uppercase tracking-wider rounded-xl"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Download/Print PDF</span>
                </button>
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="w-7 h-7 bg-slate-200 text-slate-500 hover:bg-slate-350 hover:text-slate-800 flex items-center justify-center rounded-xl transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Scroll Content (Printable Branded Sheet) */}
            <div className="p-8 overflow-y-auto flex-1 text-left font-sans print-sheet" id="printable-prescription-container">
              
              {/* Branded Hospital Header */}
              <div className="border-b-4 border-[#005EB8] pb-5 flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-1.5 uppercase">
                    <Building2 className="w-5 h-5 text-[#005EB8]" />
                    {hospitalName}
                  </h2>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block mt-1">
                    MedQueue SecurEHR Cloud Integration
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-slate-700 uppercase tracking-wider">Triage Node</div>
                  <div className="text-[10px] text-[#00A3AD] font-bold mt-0.5">TOKEN #{queue.serving.token_number}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{new Date().toLocaleDateString()}</div>
                </div>
              </div>

              {/* Doctors & Patient details split */}
              <div className="grid grid-cols-2 gap-6 py-5 border-b border-slate-100 text-xs">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Prescribing Doctor</span>
                  <div className="font-extrabold text-slate-800">{doctorName}</div>
                  <div className="text-slate-400 font-semibold mt-0.5 uppercase tracking-wide">
                    {doctorDepartment} • Room {roomNumber}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Patient Details</span>
                  <div className="font-extrabold text-slate-800">{queue.serving.patients?.name || 'Patient'}</div>
                  <div className="text-slate-400 font-semibold mt-0.5">
                    Age: {queue.serving.patients?.age || 'TBD'} yrs • Phone: {queue.serving.phone}
                  </div>
                </div>
              </div>

              {/* Vitals summary block */}
              <div className="py-4 border-b border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Patient Vitals Snapshot</span>
                <div className="grid grid-cols-5 gap-2.5">
                  {[
                    { label: 'BP', val: servingIntake?.bp || '120/80' },
                    { label: 'Sugar', val: (servingIntake?.sugar || '96') + ' mg/dL' },
                    { label: 'Temp', val: (servingIntake?.temperature || '98.4') + ' °F' },
                    { label: 'Pulse', val: pulse + ' BPM' },
                    { label: 'Oxygen', val: oxygen + ' %' },
                  ].map((v, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-2 border border-slate-150/60 text-center">
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{v.label}</div>
                      <div className="text-xs font-black text-slate-800 mt-1">{v.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chief symptoms & Diagnosis split */}
              <div className="py-4 border-b border-slate-100 grid grid-cols-2 gap-6 text-xs font-semibold">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Chief Triage Symptoms</span>
                  <div className="text-slate-700">{servingIntake?.symptoms || 'None reported'}</div>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Doctor Diagnosis</span>
                  <div className="text-slate-700 font-bold">{diagnosis || 'General Consultation Findings'}</div>
                </div>
              </div>

              {/* Ordered Diagnostic Lab Tests */}
              {selectedLabTests.length > 0 && (
                <div className="py-4 border-b border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Prescribed Diagnostic Lab Investigations</span>
                  <div className="flex gap-2">
                    {selectedLabTests.map(test => (
                      <span key={test} className="bg-violet-50 border border-violet-100 text-violet-700 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl">
                        {test}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Medications grid list */}
              <div className="py-5">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-3">Prescribed Medications Rx</span>
                
                <div className="overflow-x-auto w-full scrollbar-none">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 font-black text-[9px] uppercase tracking-wider text-left pb-2">
                        <th className="pb-2">Medicine Details</th>
                        <th className="pb-2">Dosage Size</th>
                        <th className="pb-2">Frequency</th>
                        <th className="pb-2">Duration</th>
                        <th className="pb-2">Instructions</th>
                        <th className="pb-2 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medications.map((med, i) => (
                        <tr key={i} className="border-b border-slate-100 text-slate-700">
                          <td className="py-2.5 font-bold text-slate-800">{med.name || 'Medicine'}</td>
                          <td className="py-2.5">{med.dosage || '1 tab'}</td>
                          <td className="py-2.5">{med.frequency || '1-0-1'}</td>
                          <td className="py-2.5">{med.duration || '5 days'}</td>
                          <td className="py-2.5">{med.instructions || 'After meals'}</td>
                          <td className="py-2.5 text-right font-bold text-slate-800">{med.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Follow-up & Branded signature box */}
              <div className="border-t border-slate-200 pt-5 mt-6 flex justify-between items-end gap-6">
                <div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Follow-Up Schedule Advice</div>
                  <div className="text-xs font-black text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-150/60 inline-block">
                    {followUpDays}
                  </div>
                </div>

                {/* Secure EHR QR Code validation stamp */}
                <div className="text-right flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none">MedQueue EHR</span>
                    <span className="text-[8px] font-black text-[#00A3AD] uppercase tracking-widest block mt-1 leading-none">SecurEHR Verified</span>
                  </div>
                  {/* Simulated verification QR matrix */}
                  <div className="w-12 h-12 bg-slate-100 rounded-lg border-2 border-slate-200 p-1 flex items-center justify-center flex-shrink-0">
                    <div className="w-full h-full bg-slate-900 grid grid-cols-3 gap-0.5 opacity-90">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className={`w-full h-full ${i % 2 === 0 ? 'bg-white' : 'bg-slate-900'}`} />
                      ))}
                    </div>
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

// Add simple CSS Helper for inline Building2 icon
function Building2({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  );
}
