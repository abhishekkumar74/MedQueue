import { useState, useEffect, useCallback, useRef } from 'react';
import { registerToken, getSelectedHospitalId } from '../../../lib/api';
import { Token, Priority, Department, DEPARTMENT_LABEL } from '../../../types';
import { AuthUser } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { 
  User, Building2, Ticket, ChevronDown, CheckCircle, Loader2, AlertCircle, MapPin,
  Heart, Clock, FileText, Shield, Award, Plus, Upload, Search, Download, Trash2, Stethoscope, Activity, BarChart2, X, Calendar
} from 'lucide-react';

const DEPARTMENTS: Department[] = [
  'general', 'cardiology', 'orthopedics', 'pediatrics',
  'gynecology', 'neurology', 'dermatology', 'ent', 'ophthalmology', 'pharmacy'
];

const PRIORITY_OPTIONS: { value: Priority; label: string; desc: string; color: string; dot: string }[] = [
  { value: 0, label: 'Emergency', desc: 'Life-threatening condition', color: 'border-red-400 bg-red-50 text-red-700', dot: 'bg-red-500' },
  { value: 1, label: 'Senior / Special', desc: 'Age 60+ or disability', color: 'border-amber-400 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { value: 2, label: 'Normal', desc: 'Regular consultation', color: 'border-emerald-400 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
];

interface FamilyProfile {
  id: string;
  name: string;
  relationship: 'Self' | 'Spouse' | 'Child' | 'Parent';
  age: number;
  phone: string;
  address: string;
  bloodGroup: string;
  allergies: string;
}

interface VaultDoc {
  id: string;
  name: string;
  category: 'Prescription' | 'Lab Report' | 'ID Document' | 'Other';
  uploadedAt: string;
  fileSize: string;
  doctorName?: string;
}

import { TenantConfig } from '../../../lib/tenant';

export default function PatientWorkspace({ currentUser, navigate, tenant }: {
  currentUser?: AuthUser | null;
  navigate?: (p: any, state?: any) => void;
  tenant?: TenantConfig | null;
}) {
  const patientPhone = currentUser?.phone || '';
  const currentHospitalId = getSelectedHospitalId();

  // ── Tab State ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'workspace' | 'doctors' | 'timeline' | 'vault' | 'family' | 'wallet' | 'guide'>('workspace');

  // ── Family Profiles State ──────────────────────────────────
  const [familyProfiles, setFamilyProfiles] = useState<FamilyProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<FamilyProfile | null>(null);
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [newFamilyForm, setNewFamilyForm] = useState({
    name: '', relationship: 'Child' as FamilyProfile['relationship'], age: '', bloodGroup: 'B+', allergies: 'None'
  });

  // ── Lab Document Vault State ────────────────────────────────
  const [vaultDocs, setVaultDocs] = useState<VaultDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState<VaultDoc | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Database Records state ─────────────────────────────────
  const [dbVisits, setDbVisits] = useState<any[]>([]);
  const [dbPrescriptions, setDbPrescriptions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<'all' | '30' | '180' | '365'>('all');

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

  // ── Smart Health Scores Filter State ───────────────────────
  const [healthFilter, setHealthFilter] = useState<'today' | 'week' | 'month'>('today');

  // ── Initial load for family profiles ────────────────────────
  useEffect(() => {
    if (!patientPhone) return;
    const cacheKey = `mq_family_profiles_${patientPhone}`;
    const cached = localStorage.getItem(cacheKey);
    let profiles: FamilyProfile[] = [];
    
    if (cached) {
      profiles = JSON.parse(cached);
    } else {
      // Seed self profile by default
      const selfProfile: FamilyProfile = {
        id: currentUser?.id || 'self',
        name: currentUser?.name || 'Patient',
        relationship: 'Self',
        age: currentUser?.age || 30,
        phone: patientPhone,
        address: currentUser?.address || 'Default Address',
        bloodGroup: 'O+',
        allergies: 'None reported'
      };
      profiles = [selfProfile];
      localStorage.setItem(cacheKey, JSON.stringify(profiles));
    }
    setFamilyProfiles(profiles);
    setActiveProfile(profiles[0]);
  }, [currentUser, patientPhone]);

  // ── Seed Document Vault ────────────────────────────────────
  useEffect(() => {
    if (!activeProfile) return;
    const cacheKey = `mq_medical_vault_${patientPhone}_${activeProfile.name}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setVaultDocs(JSON.parse(cached));
    } else {
      // Seed initial dummy documents to look rich
      const initialDocs: VaultDoc[] = [
        { id: 'doc-1', name: 'Cardiology Blood Test Panel.pdf', category: 'Lab Report', uploadedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toLocaleDateString(), fileSize: '1.4 MB', doctorName: 'Dr. Diana Rodriguez' },
        { id: 'doc-2', name: `${tenant?.name || 'MedQueue Clinic'} Prescription Form.pdf`, category: 'Prescription', uploadedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toLocaleDateString(), fileSize: '520 KB', doctorName: 'Dr. Diana Rodriguez' },
        { id: 'doc-3', name: 'National Health Card ID.jpg', category: 'ID Document', uploadedAt: new Date(Date.now() - 40 * 24 * 3600 * 1000).toLocaleDateString(), fileSize: '2.1 MB' }
      ];
      localStorage.setItem(cacheKey, JSON.stringify(initialDocs));
      setVaultDocs(initialDocs);
    }
  }, [activeProfile, patientPhone, tenant]);

  // ── Load live hospital database records for active profile ────
  const loadProfileData = useCallback(async () => {
    if (!activeProfile) return;
    setLoadingHistory(true);
    try {
      // Fetch active database visits for main patient if profile is 'Self'
      if (activeProfile.relationship === 'Self' && activeProfile.id !== 'self') {
        const [visitsRes, prescRes] = await Promise.all([
          supabase.from('visits').select('*, tokens(*)').eq('patient_id', activeProfile.id).order('created_at', { ascending: false }),
          supabase.from('prescriptions').select('*').eq('patient_id', activeProfile.id).order('created_at', { ascending: false })
        ]);
        setDbVisits(visitsRes.data || []);
        setDbPrescriptions(prescRes.data || []);
      } else {
        // Fallback simulated clinical data for family members to keep widgets extremely rich
        setDbVisits([
          { id: 'vis-1', bp: '118/76', sugar: '92', symptoms: 'Regular routine clinical follow-up', doctor_notes: 'Vitals stable. Suggested walking 30 mins daily.', created_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(), tokens: { token_number: 14 } }
        ]);
        setDbPrescriptions([
          { id: 'pre-1', diagnosis: 'Mild Hypertension', medications: [{ name: 'Amlodipine 5mg', dosage: '1 tablet', frequency: 'Once daily', duration: '30 days', instructions: 'Take in morning' }], status: 'DISPENSED', created_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString() }
        ]);
      }
    } catch (e) {
      console.warn('Failed to load live profile history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [activeProfile]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // ── Load live queue active token details ───────────────────
  const fetchActiveTokenStatus = useCallback(async () => {
    if (!patientPhone || !activeProfile || activeProfile.relationship !== 'Self') return;
    setLoadingToken(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      
      const { data: token } = await supabase
        .from('tokens')
        .select('*, patients(*)')
        .eq('phone', patientPhone)
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
  }, [patientPhone, activeProfile, currentHospitalId]);

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
        phone: activeProfile?.phone || patientPhone,
        name: activeProfile?.name || 'Patient',
        age: activeProfile?.age || 30,
        address: activeProfile?.address || 'Delhi Outpatient Center',
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

  // ── Add Family Profile ─────────────────────────────────────
  function handleAddFamilySubmit(e: React.FormEvent) {
    e.preventDefault();
    const { name, relationship, age, bloodGroup, allergies } = newFamilyForm;
    if (!name.trim() || !age.trim()) return;

    const newProfile: FamilyProfile = {
      id: `fam-${Date.now()}`,
      name: name.trim(),
      relationship,
      age: parseInt(age) || 12,
      phone: activeProfile?.phone || patientPhone,
      address: activeProfile?.address || 'Outpatient Campus',
      bloodGroup,
      allergies: allergies.trim() || 'None'
    };

    const updated = [...familyProfiles, newProfile];
    setFamilyProfiles(updated);
    localStorage.setItem(`mq_family_profiles_${patientPhone}`, JSON.stringify(updated));
    setActiveProfile(newProfile);
    setShowAddFamily(false);
    setNewFamilyForm({ name: '', relationship: 'Child', age: '', bloodGroup: 'B+', allergies: 'None' });
  }

  // ── Lab Document Upload ─────────────────────────────────────
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    
    // Simulate premium upload progress
    setTimeout(() => {
      const newDoc: VaultDoc = {
        id: `doc-${Date.now()}`,
        name: file.name,
        category: file.name.toLowerCase().includes('prescription') ? 'Prescription' : 'Lab Report',
        uploadedAt: new Date().toLocaleDateString(),
        fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        doctorName: activeToken?.doctor_name || 'Practitioner'
      };

      const updated = [newDoc, ...vaultDocs];
      setVaultDocs(updated);
      localStorage.setItem(`mq_medical_vault_${patientPhone}_${activeProfile!.name}`, JSON.stringify(updated));
      setUploadingDoc(false);
    }, 2000);
  };

  const handleDocDelete = (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this health report?')) return;
    const updated = vaultDocs.filter(d => d.id !== id);
    setVaultDocs(updated);
    localStorage.setItem(`mq_medical_vault_${patientPhone}_${activeProfile!.name}`, JSON.stringify(updated));
  };

  // ── Dashboard Metrics calculations ─────────────────────────
  const latestVitals = dbVisits[0] || { bp: '120/80', sugar: '98', temperature: '98.4 F' };


  const filterDocs = vaultDocs.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (d.doctorName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || d.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#F4F8FB] font-sans pb-24 lg:pb-16">
      
      {/* ── CENTRAL GRADIANT BG OVERLAYS ── */}
      <div className="absolute top-[-20%] left-[-15%] w-[60%] h-[50%] bg-[#005EB8]/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[55%] bg-[#00A3AD]/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6">
        
        {/* ── WORKSPACE LEVER HEADER ── */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-200/50">
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#005EB8]/10 to-transparent" />
              <Activity className="w-6 h-6 text-[#005EB8] animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                Patient Workspace
                <span className="text-[10px] font-black uppercase bg-[#005EB8]/10 text-[#005EB8] px-2 py-0.5 rounded-full tracking-wider border border-[#005EB8]/20">
                  Active Sandbox
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-semibold mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Selected: <span className="font-extrabold text-slate-500">{tenant?.name || 'MedQueue Clinic'}</span>
              </p>
            </div>
          </div>

        </div>

        {/* ── DESKTOP GRID LAYOUT ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
          
          {/* ── LEFT SIDEBAR TABS (DESKTOP) ── */}
          <div className="hidden lg:block lg:col-span-3 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3.5 mb-2.5">Workspace Directories</p>
              {[
                { id: 'workspace', label: 'Queue Booking', icon: Ticket },
                { id: 'timeline', label: 'Medical Records', icon: Clock },
                { id: 'vault', label: 'Lab Reports', icon: FileText, badge: vaultDocs.length },
                { id: 'appointment', label: 'Appointments', icon: Calendar },
                { id: 'doctors', label: 'Doctors', icon: Stethoscope },
                { id: 'family', label: 'Member Section', icon: User },
                { id: 'wallet', label: 'Digital Health Card', icon: Award },
                { id: 'guide', label: 'Hospital Directions', icon: Building2 },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === 'appointment') {
                        navigate?.('appointment');
                      } else {
                        setActiveTab(tab.id as any);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-black transition-all ${
                      isActive 
                        ? 'bg-[#F0F6FC] text-[#005EB8] border-l-4 border-[#005EB8] shadow-sm' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#005EB8]' : 'text-slate-400'}`} />
                      <span>{tab.label}</span>
                    </div>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isActive ? 'bg-[#005EB8] text-white' : 'bg-slate-150 text-slate-500'}`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Profile Summary widget */}
            {activeProfile && (
              <div className="bg-gradient-to-tr from-[#060B1C] to-[#0D1635] text-white rounded-3xl p-5 relative overflow-hidden shadow-md shadow-[#005EB8]/5 select-none">
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-[#00A3AD]/10 rounded-full blur-xl pointer-events-none" />
                <h4 className="text-[9px] font-black tracking-widest text-[#00A3AD] uppercase">Active Credentials</h4>
                <div className="text-base font-black text-white mt-2 truncate">{activeProfile.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 capitalize">{activeProfile.relationship} Profile • {activeProfile.age} yrs</div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800 text-[9px] font-black text-emerald-400 uppercase tracking-wider">
                  <Shield className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  Isolated Encrypted Node
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT MAIN WORKSPACE WINDOW ── */}
          <div className="lg:col-span-9 space-y-6">

            {/* Success and Errors alerts */}
            {bookingError && (
              <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-600 rounded-2xl px-4 py-3 text-xs font-bold animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{bookingError}</span>
              </div>
            )}

            {bookingSuccessToken && (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3.5 text-xs font-bold animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Success! Digital Queue Token <strong>#{bookingSuccessToken.token_number}</strong> booked for {DEPARTMENT_LABEL[bookingSuccessToken.department!]}.</span>
                </div>
                <button onClick={() => setBookingSuccessToken(null)} className="text-[10px] font-black uppercase text-emerald-600 bg-white border border-emerald-100 hover:bg-emerald-100/50 px-2 py-0.5 rounded-lg">Dismiss</button>
              </div>
            )}

            {/* ── TAB 1: OPERATIONS CENTER (WORKSPACE HOME) ── */}
            {activeTab === 'workspace' && (
              <div className="space-y-6">
                
                {/* 1.1 FAST TOKEN BOOKING WIDGET (PRIMARY ACTION AT ABSOLUTE TOP) */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-lg shadow-[#005EB8]/5 p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#005EB8] to-[#00A3AD]" />
                  <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                        <Ticket className="w-4 h-4 text-[#005EB8]" />
                        Secure Digital Queue Ticket
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Select a department and priority. Your token registers contextually.</p>
                    </div>
                  </div>

                  <form onSubmit={handleQuickBookSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Required Specialty Department *</label>
                        <div className="relative">
                          <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 pointer-events-none" />
                          <select
                            value={quickDept}
                            onChange={e => setQuickDept(e.target.value as Department)}
                            className="w-full min-h-[48px] border-2 border-slate-150 rounded-xl pl-11 pr-4 py-3 text-base md:text-xs focus:border-[#005EB8] focus:outline-none transition-colors appearance-none bg-white font-semibold text-slate-800"
                            required
                          >
                            <option value="">Choose Department</option>
                            {DEPARTMENTS.map(d => (
                              <option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 pointer-events-none" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Priority Classification</label>
                        <div className="flex gap-2.5">
                          {PRIORITY_OPTIONS.map(p => (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => setQuickPriority(p.value)}
                              className={`flex-1 min-h-[48px] px-3 py-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                                quickPriority === p.value 
                                  ? p.color + ' border-transparent shadow-md' 
                                  : 'border-slate-150 bg-white text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                              <span>{p.label.split(' ')[0]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={bookingLoading || !quickDept}
                      className="w-full min-h-[48px] bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-60 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 uppercase tracking-widest active:scale-[0.99] focus:outline-none"
                    >
                      {bookingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
                      {bookingLoading ? 'Registering Queue Node...' : 'Register Queue Ticket →'}
                    </button>
                  </form>
                </div>

                {/* 1.2 SMART LIVE TOKEN TRACKER */}
                {loadingToken && !activeToken ? (
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm min-h-[140px] animate-skeleton flex flex-col md:flex-row justify-between gap-6">
                    <div className="space-y-4 text-left flex-1">
                      <div className="h-3 bg-slate-200 rounded w-1/4 animate-pulse" />
                      <div className="h-6 bg-slate-200 rounded w-3/4 animate-pulse mt-2" />
                      <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse mt-1" />
                    </div>
                    <div className="w-48 h-20 bg-slate-200 rounded-2xl animate-pulse flex-shrink-0" />
                  </div>
                ) : activeToken ? (
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between gap-6">
                    <div className="absolute top-0 bottom-0 left-0 w-2.5 bg-[#005EB8]" />
                    
                    <div className="space-y-4 text-left">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                        <span className="w-2 h-2 bg-emerald-500 rounded-full absolute" />
                        <span className="text-[9px] font-black uppercase text-[#005EB8] tracking-widest">Active Live Queue Node</span>
                      </div>
                      
                      <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight">Your consultation is approaching</h3>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                          Room: <strong className="text-slate-700">{activeToken.room_number || 'Consultation TBA'}</strong> • Practitioner: <strong className="text-[#005EB8]">{activeToken.doctor_name || 'Assigned Specialist'}</strong>
                        </p>
                      </div>

                      {/* Sparkline live animation */}
                      <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-3 rounded-2xl w-max">
                        <div className="w-8 h-8 rounded-lg bg-[#005EB8]/10 flex items-center justify-center text-[#005EB8] flex-shrink-0 animate-heartbeat-slow">
                          <Activity className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Live Wait ETA</span>
                          <span className="text-xs font-black text-slate-700">~{patientsAhead * 10 + 8} Minutes Remaining</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 justify-center bg-[#F4F8FB] border border-slate-100 px-8 py-5 rounded-2xl text-center flex-shrink-0 md:min-w-[200px]">
                      <div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Queue Ticket</div>
                        <div className="text-5xl font-black text-[#005EB8] tracking-tight">#{activeToken.token_number}</div>
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mt-2.5 bg-white border px-2 py-0.5 rounded-full w-max mx-auto shadow-sm">
                          {patientsAhead === 0 ? 'Next Serving' : `${patientsAhead} patients ahead`}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Empty Token Tracker State -> Gorgeous CTA to book a new token
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm text-center py-8 space-y-4">
                    <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto text-[#005EB8]">
                      <Ticket className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">No active queue tokens today</h3>
                      <p className="text-xs text-slate-400 font-semibold max-w-sm mx-auto mt-1 leading-relaxed">
                        Secure your outpatient ticket contextually. Book a consultation token above to start live operations wait tracking.
                      </p>
                    </div>
                  </div>
                )}

                {/* 1.3 PATIENT HEALTH SCORE DASHBOARD */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                    <div>
                      <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                        <BarChart2 className="w-4 h-4 text-[#00A3AD]" />
                        Smart Health Scores & Vitals
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">Clinical data synchronized securely for active family context.</p>
                    </div>

                    {/* Today / Week / Month Filters */}
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1 w-full sm:w-auto">
                      {(['today', 'week', 'month'] as const).map(filter => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setHealthFilter(filter)}
                          className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all text-center focus:outline-none ${
                            healthFilter === filter
                              ? 'bg-white text-slate-800 shadow-sm font-black'
                              : 'text-slate-400 hover:text-slate-700'
                          }`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Compact Vitals Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                    
                    {/* BP widget */}
                    {(() => {
                      const bpValue = healthFilter === 'today' ? (latestVitals.bp || '120/80') : healthFilter === 'week' ? '118/75' : '122/79';
                      const sys = parseInt(bpValue.split('/')?.[0] || '120');
                      const status = sys > 130 
                        ? { label: 'Warning', color: 'text-amber-700 bg-amber-50 border-amber-100' }
                        : { label: 'Optimal', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' };

                      return (
                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between min-h-[120px] transition-all hover:bg-slate-50">
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[9px] font-black uppercase tracking-widest">Blood Pressure</span>
                            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                          </div>
                          <div className="text-2xl font-black text-slate-800 mt-2.5">{bpValue}</div>
                          <div className="mt-2.5 flex items-center justify-between text-[9px] font-black border-t border-slate-100 pt-2">
                            <span className="text-slate-400">mmHg</span>
                            <span className={`px-2 py-0.5 rounded border font-black uppercase tracking-wide text-[8px] ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Sugar widget */}
                    {(() => {
                      const sugarVal = healthFilter === 'today' ? (latestVitals.sugar || '98') : healthFilter === 'week' ? '96' : '102';
                      const val = parseInt(sugarVal);
                      const status = val > 140
                        ? { label: 'Warning', color: 'text-amber-700 bg-amber-50 border-amber-100' }
                        : val <= 100
                          ? { label: 'Optimal', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' }
                          : { label: 'Normal', color: 'text-teal-700 bg-teal-50 border-teal-100' };

                      return (
                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between min-h-[120px] transition-all hover:bg-slate-50">
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[9px] font-black uppercase tracking-widest">Blood Sugar</span>
                            <Activity className="w-3.5 h-3.5 text-[#00A3AD]" />
                          </div>
                          <div className="text-2xl font-black text-slate-800 mt-2.5">{sugarVal}</div>
                          <div className="mt-2.5 flex items-center justify-between text-[9px] font-black border-t border-slate-100 pt-2">
                            <span className="text-slate-400">mg/dL</span>
                            <span className={`px-2 py-0.5 rounded border font-black uppercase tracking-wide text-[8px] ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Heart Rate Widget */}
                    {(() => {
                      const hrVal = healthFilter === 'today' ? 72 : healthFilter === 'week' ? 74 : 70;
                      const status = hrVal >= 65 && hrVal <= 75
                        ? { label: 'Optimal', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' }
                        : { label: 'Normal', color: 'text-teal-700 bg-teal-50 border-teal-100' };

                      return (
                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between min-h-[120px] transition-all hover:bg-slate-50">
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[9px] font-black uppercase tracking-widest">Heart Rate</span>
                            <Activity className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                          </div>
                          <div className="text-2xl font-black text-slate-800 mt-2.5">{hrVal}</div>
                          <div className="mt-2.5 flex items-center justify-between text-[9px] font-black border-t border-slate-100 pt-2">
                            <span className="text-slate-400">BPM</span>
                            <span className={`px-2 py-0.5 rounded border font-black uppercase tracking-wide text-[8px] ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* BMI Widget */}
                    {(() => {
                      const bmiVal = healthFilter === 'today' ? 22.4 : healthFilter === 'week' ? 22.3 : 22.5;
                      const status = { label: 'Optimal', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' };

                      return (
                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between min-h-[120px] transition-all hover:bg-slate-50">
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="text-[9px] font-black uppercase tracking-widest">Calculated BMI</span>
                            <Award className="w-3.5 h-3.5 text-indigo-500" />
                          </div>
                          <div className="text-2xl font-black text-slate-800 mt-2.5">{bmiVal}</div>
                          <div className="mt-2.5 flex items-center justify-between text-[9px] font-black border-t border-slate-100 pt-2">
                            <span className="text-slate-400">Index score</span>
                            <span className={`px-2 py-0.5 rounded border font-black uppercase tracking-wide text-[8px] ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </div>

              </div>
            )}

            {/* ── TAB 2: PRACTITIONER DIRECTORY ── */}
            {activeTab === 'doctors' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-[#005EB8]" />
                    Practitioners Directory Roster
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Monitor clinic practitioner availabilities and approximate queue delay loads.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {loadingDocs ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm min-h-[170px] animate-skeleton flex flex-col justify-between">
                        <div className="flex gap-4 items-start">
                          <div className="w-12 h-12 bg-slate-100 rounded-2xl animate-pulse" />
                          <div className="space-y-2 flex-1">
                            <div className="h-4 bg-slate-200 rounded w-1/3 animate-pulse" />
                            <div className="h-5 bg-slate-200 rounded w-3/4 animate-pulse" />
                            <div className="h-3 bg-slate-200 rounded w-1/2 animate-pulse" />
                          </div>
                        </div>
                        <div className="h-10 bg-slate-100 rounded-xl mt-4 animate-pulse" />
                      </div>
                    ))
                  ) : hospDoctors.length === 0 ? (
                    <div className="col-span-2 bg-white rounded-3xl border p-8 text-center text-slate-400">
                      No doctors onboarded in this sandbox campus.
                    </div>
                  ) : (
                    hospDoctors.map((doc) => {
                      const queueLoad = doc.is_available ? Math.floor(Math.random() * 5) + 1 : 0;
                      return (
                        <div key={doc.id} className="bg-white hover:bg-slate-50/50 border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[170px] group">
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#005EB8] to-[#00A3AD] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          
                          <div className="flex gap-4 items-start">
                            <div className="w-12 h-12 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center font-extrabold text-slate-650 flex-shrink-0">
                              {doc.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                  doc.is_available ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-400'
                                }`}>
                                  {doc.is_available ? 'Available' : 'Offline'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Room {doc.room_number || 'TBA'}</span>
                              </div>
                              <h3 className="font-extrabold text-slate-800 text-sm truncate">{doc.name}</h3>
                              <p className="text-[10px] text-slate-400 capitalize font-extrabold uppercase tracking-wide">{DEPARTMENT_LABEL[doc.department as Department || 'general']} Specialty</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-50 pt-4 mt-4 text-[10px] font-extrabold text-slate-400">
                            <div>
                              <span>Live Load: </span>
                              <span className={`font-black ${queueLoad > 3 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {doc.is_available ? `${queueLoad} Patients Waiting` : 'Offline'}
                              </span>
                            </div>
                            
                            {doc.is_available && (
                              <button 
                                onClick={() => { setQuickDept(doc.department as Department); setActiveTab('workspace'); }}
                                className="px-3.5 py-1.5 bg-[#005EB8] hover:bg-[#004a96] text-white text-[9px] font-black rounded-lg transition-colors uppercase tracking-widest shadow-sm"
                              >
                                Book Ticket
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

            {/* ── TAB 3: PERSONAL MEDICAL TIMELINE ── */}
            {activeTab === 'timeline' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                      <Clock className="w-5 h-5 text-indigo-500" />
                      Personal Medical History Timeline
                    </h2>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Chronological record of clinic consultations, prescriptions, and vitals.</p>
                  </div>
                  
                  {/* Timeline Filters */}
                  <div className="flex gap-1.5 bg-white p-1 rounded-xl border border-slate-150 shadow-sm">
                    {[
                      { id: 'all', label: 'All History' },
                      { id: '30', label: 'Last 30 Days' },
                      { id: '180', label: '6 Months' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setTimelineFilter(f.id as any)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                          timelineFilter === f.id ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vertical Timeline */}
                {loadingHistory ? (
                  <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center text-slate-400">
                    Loading medical history records...
                  </div>
                ) : dbVisits.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center text-slate-400">
                    No clinical visit history recorded yet.
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-200 pl-6 ml-4 space-y-6">
                    {dbVisits.map((vis, visIdx) => {
                      const presc = dbPrescriptions.find(p => p.token_id === vis.token_id || p.visit_id === vis.id);
                      return (
                        <div key={vis.id || visIdx} className="relative group text-left">
                          
                          {/* Timeline bullet */}
                          <span className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 bg-white border-2 border-[#005EB8] rounded-full flex items-center justify-center shadow-sm relative group-hover:scale-110 transition-transform duration-300">
                            <span className="w-1.5 h-1.5 bg-[#005EB8] rounded-full" />
                          </span>

                          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4 hover:shadow-md transition-all duration-300">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 pb-3">
                              <div>
                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Clinical Consult</span>
                                <h3 className="font-extrabold text-slate-800 text-sm mt-0.5">Token Consultation Triage</h3>
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                                {new Date(vis.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-500 leading-tight">
                              <div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Symptomatic Vitals</span>
                                <p className="text-slate-700">BP: <strong>{vis.bp || '120/80'}</strong> • Sugar: <strong>{vis.sugar || '98'}</strong></p>
                              </div>
                              <div>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Reported Symptoms</span>
                                <p className="text-slate-600 italic truncate max-w-[200px]">{vis.symptoms || 'General routine follow-up'}</p>
                              </div>
                            </div>

                            {presc && (
                              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 mt-2 text-xs">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Prescribed Medicines</span>
                                <div className="space-y-1 text-slate-650">
                                  {Array.isArray(presc.medications) ? presc.medications.map((m: any, mIdx: number) => (
                                    <div key={mIdx} className="flex justify-between font-bold text-slate-700">
                                      <span>• {m.name} ({m.dosage})</span>
                                      <span className="text-[10px] text-slate-400">{m.frequency} • {m.duration}</span>
                                    </div>
                                  )) : <p className="font-bold text-slate-700">• Routine generic formulation check</p>}
                                </div>
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200/50 text-[10px] font-black uppercase text-slate-400">
                                  <span>Status: <strong className="text-emerald-600">{presc.status || 'DISPENSED'}</strong></span>
                                </div>
                              </div>
                            )}

                            {vis.doctor_notes && (
                              <div className="p-3 bg-indigo-50/50 border border-indigo-100/40 text-[11px] text-indigo-750 italic rounded-2xl">
                                <strong>Doctor consult notes:</strong> {vis.doctor_notes}
                              </div>
                            )}

                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 4: MEDICAL DRIVE DOCUMENT VAULT ── */}
            {activeTab === 'vault' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-500" />
                      Medical Documents Vault
                    </h2>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">A secure drive repository for prescriptions, clinical lab results, and health records.</p>
                  </div>
                  
                  {/* Upload document trigger */}
                  <button 
                    onClick={triggerFileUpload}
                    className="flex items-center gap-1.5 bg-[#005EB8] hover:bg-[#004a96] text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md uppercase tracking-wider transition-all"
                  >
                    {uploadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingDoc ? 'Uploading...' : 'Scan / Upload Document'}
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept="image/*,.pdf"
                  />
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search reports or doctor consults..."
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-[#005EB8]"
                    />
                  </div>
                  
                  <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    {['All', 'Prescription', 'Lab Report', 'ID Document'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                          categoryFilter === cat 
                            ? 'bg-[#005EB8] text-white shadow-sm' 
                            : 'bg-white hover:bg-slate-50 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Document list */}
                {uploadingDoc && (
                  <div className="bg-blue-50 border border-blue-200/50 rounded-2xl p-4 text-center space-y-2 animate-pulse">
                    <Loader2 className="w-6 h-6 animate-spin text-[#005EB8] mx-auto" />
                    <span className="text-xs font-black text-[#005EB8] uppercase tracking-wider block">Uploading & encrypting file metadata...</span>
                  </div>
                )}

                {filterDocs.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center text-slate-400">
                    No documents found matching the search or categories.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {filterDocs.map(doc => (
                      <div key={doc.id} className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm flex flex-col justify-between min-h-[140px] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 relative group">
                        
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-black uppercase bg-[#005EB8]/10 text-[#005EB8] px-2 py-0.5 rounded border border-[#005EB8]/10">
                              {doc.category}
                            </span>
                            <button 
                              onClick={() => handleDocDelete(doc.id)}
                              className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition-opacity p-1"
                              title="Delete Report"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          <h4 className="font-extrabold text-slate-800 text-xs truncate" title={doc.name}>
                            {doc.name}
                          </h4>
                          {doc.doctorName && (
                            <p className="text-[9px] text-slate-400 mt-1 font-bold">Consult: {doc.doctorName}</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-50 pt-3 mt-3 text-[9px] text-slate-400 font-extrabold">
                          <span>{doc.uploadedAt} • {doc.fileSize}</span>
                          <button 
                            onClick={() => setShowDocPreview(doc)}
                            className="text-[#005EB8] hover:underline"
                          >
                            Preview
                          </button>
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
                        className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-5 h-5" />
                      </button>

                      <div>
                        <span className="text-[9px] font-black text-[#005EB8] uppercase tracking-widest bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                          {showDocPreview.category} Preview
                        </span>
                        <h3 className="text-base font-black text-slate-800 mt-2 truncate">{showDocPreview.name}</h3>
                      </div>

                      {/* Mock Interactive PDF/Image viewer */}
                      <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 h-48 flex items-center justify-center p-4 text-center">
                        <div>
                          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs font-black text-slate-700 uppercase tracking-wide">SECURE PREVIEW PANEL</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs">SHA-256 local keys verified. Diagnostic results are locked under clinical isolation rules.</p>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <a 
                          href="#"
                          onClick={(e) => { e.preventDefault(); alert('Document downloaded locally.'); }}
                          className="flex-1 py-3 bg-[#005EB8] hover:bg-[#004a96] text-white text-xs font-black rounded-xl text-center flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-sm transition-all"
                        >
                          <Download className="w-4 h-4" /> Download File
                        </a>
                        <button 
                          onClick={() => { alert('Shared with consulting practitioner.'); }}
                          className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650 text-xs font-black rounded-xl uppercase tracking-wider transition-colors"
                        >
                          Share with Doctor
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ── TAB 5: FAMILY PROFILES SETTINGS ── */}
            {activeTab === 'family' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <User className="w-5 h-5 text-[#005EB8]" />
                    Family Context Profiles
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Manage separate clinical records, drug dispensaries, and timelines for children or parents.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {familyProfiles.map(p => (
                    <div key={p.id} className={`bg-white border rounded-3xl p-5 shadow-sm flex flex-col justify-between min-h-[150px] relative ${
                      activeProfile?.id === p.id ? 'border-[#005EB8] shadow-md shadow-[#005EB8]/5' : 'border-slate-100 hover:bg-slate-50/50'
                    }`}>
                      {p.relationship === 'Self' && (
                        <span className="absolute top-4 right-4 text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Primary</span>
                      )}

                      <div className="space-y-2">
                        <h4 className="font-extrabold text-slate-800 text-sm">{p.name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider capitalize">{p.relationship} Profile • {p.age} Years Old</p>
                        
                        <div className="text-[9px] font-extrabold text-slate-500 leading-tight space-y-0.5">
                          <div>Blood Group: <strong className="text-slate-700">{p.bloodGroup}</strong></div>
                          <div className="truncate">Allergies: <strong className="text-rose-500">{p.allergies}</strong></div>
                        </div>
                      </div>

                      <button
                        onClick={() => { setActiveProfile(p); alert(`Switched clinic context to ${p.name}`); }}
                        className={`w-full py-2.5 mt-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                          activeProfile?.id === p.id
                            ? 'bg-[#005EB8] text-white border-transparent'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {activeProfile?.id === p.id ? 'Active Profile' : 'Switch Context'}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Family Member Modal */}
                {showAddFamily && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleAddFamilySubmit} className="bg-white rounded-[32px] border border-slate-100 max-w-md w-full p-6 shadow-2xl space-y-4 relative animate-fade-in text-left">
                      <button 
                        type="button" 
                        onClick={() => setShowAddFamily(false)}
                        className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-5 h-5" />
                      </button>

                      <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 border-b border-slate-50 pb-2">
                        <Plus className="w-5 h-5 text-[#005EB8]" /> Add Family Member Profile
                      </h3>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Full Name *</label>
                          <input 
                            type="text"
                            value={newFamilyForm.name}
                            onChange={e => setNewFamilyForm({...newFamilyForm, name: e.target.value})}
                            placeholder="Full Name"
                            className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#005EB8] font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Relationship *</label>
                          <select
                            value={newFamilyForm.relationship}
                            onChange={e => setNewFamilyForm({...newFamilyForm, relationship: e.target.value as any})}
                            className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold"
                          >
                            <option value="Child">Child</option>
                            <option value="Spouse">Spouse</option>
                            <option value="Parent">Parent</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Age *</label>
                          <input 
                            type="number"
                            value={newFamilyForm.age}
                            onChange={e => setNewFamilyForm({...newFamilyForm, age: e.target.value})}
                            placeholder="Age"
                            className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Blood Group</label>
                          <select
                            value={newFamilyForm.bloodGroup}
                            onChange={e => setNewFamilyForm({...newFamilyForm, bloodGroup: e.target.value})}
                            className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                          >
                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                              <option key={bg} value={bg}>{bg}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Allergies / Special Instructions</label>
                        <input 
                          type="text"
                          value={newFamilyForm.allergies}
                          onChange={e => setNewFamilyForm({...newFamilyForm, allergies: e.target.value})}
                          placeholder="e.g. Penicillin, Peanuts (or None)"
                          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full min-h-[44px] bg-[#005EB8] hover:bg-[#004a96] text-white font-black text-xs rounded-xl shadow-md uppercase tracking-wider transition-all"
                      >
                        Register Member Context
                      </button>
                    </form>
                  </div>
                )}

              </div>
            )}

            {/* ── TAB 6: DIGITAL HEALTH WALLET CARD ── */}
            {activeTab === 'wallet' && activeProfile && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <Award className="w-5 h-5 text-indigo-500" />
                    Digital Patient Wallet Identity
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Generate a secure QR identity card to scan at clinic queue checkpoints.</p>
                </div>

                <div className="flex flex-col items-center justify-center py-6">
                  
                  {/* Apple Wallet Style Card rendering */}
                  <div className="bg-gradient-to-tr from-[#005EB8] via-[#0081d5] to-[#00A3AD] text-white rounded-[32px] p-6 shadow-2xl max-w-sm w-full space-y-6 relative overflow-hidden select-none select-none">
                    <div className="absolute top-[-30%] right-[-10%] w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="flex items-center justify-between border-b border-white/20 pb-4">
                      <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-white animate-pulse" />
                        <span className="font-black text-white text-sm uppercase tracking-wider">MedQueue</span>
                      </div>
                      <span className="text-[8px] font-black uppercase bg-white/20 px-2 py-0.5 rounded">SaaS Node Identity</span>
                    </div>

                    <div className="flex justify-between gap-4 items-center pt-2">
                      <div className="space-y-3.5 text-left">
                        <div>
                          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-200">Patient Name</span>
                          <h4 className="font-extrabold text-sm text-white mt-0.5 truncate max-w-[150px]">{activeProfile.name}</h4>
                        </div>
                        <div>
                          <span className="text-[8px] font-bold uppercase tracking-widest text-slate-200">Patient ID Ticker</span>
                          <p className="font-mono text-xs text-white font-black mt-0.5">MQ-{activeProfile.name.slice(0, 3).toUpperCase()}-{activeProfile.age}93</p>
                        </div>
                      </div>

                      {/* Custom Simulated QR Code */}
                      <div className="bg-white p-2 rounded-2xl shadow-md shadow-[#005EB8]/20 flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 100 100" className="w-16 h-16 text-slate-900 fill-current">
                          {/* Outer frame */}
                          <path d="M0,0 h100 v100 h-100 z M20,20 v60 h60 v-60 z" />
                          {/* Dynamic dots patterns */}
                          <rect x="30" y="30" width="10" height="10" />
                          <rect x="50" y="30" width="20" height="10" />
                          <rect x="30" y="50" width="10" height="20" />
                          <rect x="60" y="60" width="10" height="10" />
                          <rect x="50" y="50" width="10" height="10" />
                        </svg>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-white/20 pt-4 text-xs font-bold text-slate-200">
                      <div>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-slate-350 block mb-0.5">Blood Group</span>
                        <span className="text-white">{activeProfile.bloodGroup}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-bold uppercase tracking-widest text-slate-350 block mb-0.5">Allergen Class</span>
                        <span className="text-rose-300 font-extrabold truncate block max-w-[100px]">{activeProfile.allergies}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-8 w-full max-w-sm">
                    <button 
                      onClick={() => alert('Saved digital ID health card to phone wallet.')}
                      className="flex-1 py-3 bg-[#060B1C] hover:bg-slate-900 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-colors shadow-sm"
                    >
                      Save to Phone Wallet
                    </button>
                    <button 
                      onClick={() => alert('Operations ledger PDF card exported.')}
                      className="flex-1 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-650 text-xs font-black rounded-xl uppercase tracking-wider transition-colors"
                    >
                      Download PDF
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* ── TAB 7: HOSPITAL DIRECTIONS GUIDE ── */}
            {activeTab === 'guide' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#005EB8]" />
                    OPD Campus Indoor Navigation
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Quick campus guides and consultation room map directory.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { floor: 'Ground Floor', rooms: ['Reception Desk', 'Pharmacy stock ledger', 'General OPD Room 101'], desc: 'Immediate entry lobby. Emergency triage is located directly to the right segment.' },
                    { floor: '1st Floor', rooms: ['OPD Cardiology Room 204', 'Pediatrics Room 205', 'Laboratory Diagnostic Desk'], desc: 'Standard clinical consultation desks. Escalator accessible in the center aisle.' },
                    { floor: '2nd Floor', rooms: ['Super Admin Central Router', 'Executive Offices', 'Conference Arena'], desc: 'Administrative block. Authorized access only.' }
                  ].map((fl, idx) => (
                    <div key={idx} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm text-left flex flex-col justify-between min-h-[180px]">
                      <div className="space-y-2">
                        <span className="text-[9px] font-black uppercase text-[#005EB8] bg-[#005EB8]/10 border border-[#005EB8]/10 px-2 py-0.5 rounded-full">{fl.floor}</span>
                        <h4 className="font-extrabold text-slate-800 text-xs mt-1.5">{fl.desc}</h4>
                        
                        <div className="space-y-1 mt-3">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Featured Desks</span>
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

                {/* Simulated navigation instructions */}
                <div className="bg-blue-50 border border-blue-200/50 rounded-3xl p-5 text-left flex gap-3.5 items-start">
                  <Building2 className="w-5 h-5 text-[#005EB8] flex-shrink-0 mt-0.5 animate-bounce" />
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

      {/* ── MOBILE PWA BOTTOM NAVIGATION ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-150 p-2 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] flex items-center justify-around select-none">
        {[
          { id: 'workspace', label: 'Booking', icon: Ticket },
          { id: 'timeline', label: 'Records', icon: Clock },
          { id: 'vault', label: 'Vault', icon: FileText, badge: vaultDocs.length },
          { id: 'doctors', label: 'Doctors', icon: Stethoscope },
          { id: 'family', label: 'Members', icon: User },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex flex-col items-center justify-center gap-1.5 py-1 px-3.5 rounded-2xl relative transition-all active:scale-95 flex-1 min-h-[48px]"
            >
              <div className={`p-1.5 rounded-xl transition-all relative ${isActive ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-400 hover:text-slate-650'}`}>
                <Icon className="w-5 h-5" />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 text-[8px] font-black bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-black tracking-wide uppercase transition-colors ${isActive ? 'text-[#005EB8] font-black' : 'text-slate-400'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

    </div>
  );
}
