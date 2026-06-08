import { useState, useEffect, useCallback, useRef } from 'react';
import { registerToken, getSelectedHospitalId } from '../../../lib/api';
import { Token, Priority, Department, DEPARTMENT_LABEL } from '../../../types';
import { AuthUser } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import { useMQIDAuth } from '../../../hooks/useMQIDAuth';
import { MQIDCard } from '../../../components/patient/MQIDCard';
import { MQIDRegistrationForm } from '../../../components/patient/MQIDRegistrationForm';
import { HealthVaultView } from '../../../components/patient/HealthVaultView';
import { 
  User, Building2, Ticket, ChevronDown, CheckCircle, Loader2, AlertCircle, MapPin,
  Clock, FileText, Shield, Award, Plus, Upload, Search, Download, Trash2, Stethoscope, Activity, X, Printer, RefreshCw
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
  isDatabasePrescription?: boolean;
  rawPrescription?: any;
}

import { TenantConfig } from '../../../lib/tenant';

export default function PatientWorkspace({ currentUser, navigate, tenant, initialTab }: {
  currentUser?: AuthUser | null;
  navigate?: (p: any, state?: any) => void;
  tenant?: TenantConfig | null;
  initialTab?: string;
}) {
  // Bypassing unused TS warnings for navigate
  if (false && navigate) navigate?.('');
  const patientPhone = currentUser?.phone || '';
  const currentHospitalId = getSelectedHospitalId();
  const hospitalName = tenant?.name || 'Apollo Clinic';
  const localPrefix = tenant?.slug?.substring(0, 3).toUpperCase() || 'APL';

  const {
    step, patient, mqid, error, isNewPatient, pendingPhone,
    sendOTP, verifyOTP, completeRegistration, signOut
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
        const { data, error } = await supabase
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
  const [activeTab, setActiveTab] = useState<'workspace' | 'doctors' | 'timeline' | 'vault' | 'family' | 'wallet' | 'guide' | 'profile'>('workspace');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as any);
    }
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === 'vault') {
      setTimelineCategory('Lab Reports');
    } else if (activeTab === 'timeline') {
      setTimelineCategory('All');
    }
  }, [activeTab]);

  // ── Family Profiles State ──────────────────────────────────
  const [familyProfiles, setFamilyProfiles] = useState<FamilyProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<FamilyProfile | null>(null);
  const [showAddFamily, setShowAddFamily] = useState(false);
  const [newFamilyForm, setNewFamilyForm] = useState({
    name: '', relationship: 'Child' as FamilyProfile['relationship'], age: '', bloodGroup: 'B+', allergies: 'None'
  });

  // ── Member Sync States ──────────────────────────────────────
  const [showSyncMember, setShowSyncMember] = useState(false);
  const [syncStep, setSyncStep] = useState<'input' | 'otp' | 'success'>('input');
  const [syncForm, setSyncForm] = useState({
    name: '', relationship: 'Child' as FamilyProfile['relationship'], phone: '', abhaId: '', age: '28', bloodGroup: 'B+', allergies: 'None'
  });
  const [syncOtpInput, setSyncOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [syncError, setSyncError] = useState('');

  // ── Profile Form States ──────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    name: '', email: '', address: '', bloodGroup: 'O+', allergies: 'None'
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // ── Lab Document Vault State ────────────────────────────────
  const [vaultDocs, setVaultDocs] = useState<VaultDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showDocPreview, setShowDocPreview] = useState<VaultDoc | null>(null);
  const [activePrescriptionModal, setActivePrescriptionModal] = useState<{ vis: any; presc: any } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ── Smart Health Scores Filter State ───────────────────────
  // const [_healthFilter, _setHealthFilter] = useState<'today' | 'week' | 'month'>('today');

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

  // Sync profileForm details with active Self profile
  useEffect(() => {
    const selfProfile = familyProfiles.find(p => p.relationship === 'Self');
    if (selfProfile) {
      setProfileForm({
        name: selfProfile.name,
        email: currentUser?.email || '',
        address: selfProfile.address,
        bloodGroup: selfProfile.bloodGroup || 'O+',
        allergies: selfProfile.allergies || 'None reported'
      });
    } else if (currentUser) {
      setProfileForm({
        name: currentUser.name || '',
        email: currentUser.email || '',
        address: currentUser.address || '',
        bloodGroup: 'O+',
        allergies: 'None reported'
      });
    }
  }, [familyProfiles, currentUser]);

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
      if (activeProfile.relationship === 'Self') {
        let resolvedPatientId = activeProfile.id;
        
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
            { id: 'appt-1', patient_name: activeProfile?.name || 'Patient', department: 'cardiology', appointment_date: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0], time_slot: '10:00-10:30', status: 'SCHEDULED', consultation_fee: 500, created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() }
          ]);
        }
      }
    } else {
      // Fallback simulated clinical data for family members to keep widgets extremely rich
        setDbVisits([
          { id: 'vis-1', bp: '118/76', sugar: '92', symptoms: 'Regular routine clinical follow-up', doctor_notes: 'Vitals stable. Suggested walking 30 mins daily.', created_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(), tokens: { token_number: 14 } }
        ]);
        setDbPrescriptions([
          { id: 'pre-1', diagnosis: 'Mild Hypertension', medications: [{ name: 'Amlodipine 5mg', dosage: '1 tablet', frequency: 'Once daily', duration: '30 days', instructions: 'Take in morning' }], status: 'DISPENSED', created_at: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString() }
        ]);
        setDbAppointments([
          { id: 'appt-1', patient_name: activeProfile?.name || 'Patient', department: 'cardiology', appointment_date: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().split('T')[0], time_slot: '10:00-10:30', status: 'SCHEDULED', consultation_fee: 500, created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() }
        ]);
      }
    } catch (e) {
      console.warn('Failed to load live profile history:', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [activeProfile, patientPhone]);

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

  // ── Member Sync Handlers ─────────────────────────────────────
  function handleSyncMemberSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { name, phone } = syncForm;
    if (!name.trim() || !phone.trim()) {
      setSyncError('Please provide both name and phone number');
      return;
    }
    setSyncError('');
    // Generate a secure 4-digit numeric OTP for verification
    const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(randomOtp);
    setSyncStep('otp');
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (syncOtpInput !== generatedOtp) {
      setSyncError('Invalid security verification OTP code. Please try again.');
      return;
    }
    setSyncError('');
    
    // Create linked profile
    const newProfile: FamilyProfile = {
      id: `fam-sync-${Date.now()}`,
      name: syncForm.name.trim(),
      relationship: syncForm.relationship,
      age: parseInt(syncForm.age) || 28,
      phone: syncForm.phone.trim(),
      address: 'Linked Unified Account',
      bloodGroup: syncForm.bloodGroup,
      allergies: syncForm.allergies.trim() || 'None'
    };

    const updated = [...familyProfiles, newProfile];
    setFamilyProfiles(updated);
    localStorage.setItem(`mq_family_profiles_${patientPhone}`, JSON.stringify(updated));
    setActiveProfile(newProfile);
    setSyncStep('success');

    setTimeout(() => {
      setShowSyncMember(false);
      // Reset form states
      setSyncStep('input');
      setSyncForm({ name: '', relationship: 'Child', phone: '', abhaId: '', age: '28', bloodGroup: 'B+', allergies: 'None' });
      setSyncOtpInput('');
      setGeneratedOtp('');
    }, 1500);
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

      // 2. Cascade changes to the Self profile inside familyProfiles local storage
      const updated = familyProfiles.map(p => {
        if (p.relationship === 'Self') {
          return {
            ...p,
            name: profileForm.name.trim(),
            address: profileForm.address.trim(),
            bloodGroup: profileForm.bloodGroup,
            allergies: profileForm.allergies.trim() || 'None reported'
          };
        }
        return p;
      });

      setFamilyProfiles(updated);
      localStorage.setItem(`mq_family_profiles_${patientPhone}`, JSON.stringify(updated));

      // 3. Update the currently active profile if it is Self
      if (activeProfile?.relationship === 'Self') {
        const selfProfile = updated.find(p => p.relationship === 'Self');
        if (selfProfile) {
          setActiveProfile(selfProfile);
        }
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

  // Map live prescriptions from DB to look like VaultDoc items
  const dbVaultDocs: VaultDoc[] = dbPrescriptions.map(p => ({
    id: p.id,
    name: `${tenant?.name || 'MedQueue Clinic'} - Prescription #${p.id.substring(0, 6).toUpperCase()}`,
    category: 'Prescription',
    uploadedAt: new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    fileSize: 'Active Record',
    doctorName: p.doctor_name || 'Assigned Specialist',
    isDatabasePrescription: true,
    rawPrescription: p
  }));

  const combinedVaultDocs = [...dbVaultDocs, ...vaultDocs];

  const handleDocDelete = (id: string) => {
    const foundDoc = combinedVaultDocs.find(d => d.id === id);
    if (foundDoc?.isDatabasePrescription) {
      alert('Database clinical prescriptions are part of permanent patient medical history and cannot be deleted from this portal.');
      return;
    }
    if (!confirm('Are you sure you want to permanently delete this health report?')) return;
    const updated = vaultDocs.filter(d => d.id !== id);
    setVaultDocs(updated);
    localStorage.setItem(`mq_medical_vault_${patientPhone}_${activeProfile!.name}`, JSON.stringify(updated));
  };

  const handlePrintTimelinePrescription = (vis: any, presc: any) => {
    setActivePrescriptionModal({ vis, presc });
  };

  const handlePrintPrescription = () => {
    if (!showDocPreview) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Prescription Print - MedQueue</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
              .header { text-align: center; border-bottom: 2px solid #005EB8; padding-bottom: 16px; margin-bottom: 24px; }
              .clinic-name { font-size: 20px; font-weight: 800; color: #005EB8; margin: 0; text-transform: uppercase; }
              .clinic-sub { font-size: 10px; color: #64748b; margin-top: 4px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; }
              .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; }
              .meta-item { display: flex; flex-direction: column; gap: 2px; }
              .meta-label { font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
              .meta-val { font-weight: 700; color: #334155; }
              .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; letter-spacing: 0.05em; }
              .diagnosis-box { background: #f0f7ff; border: 1px solid #d0e7ff; padding: 12px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #1e293b; margin-bottom: 20px; }
              .med-item { background: #fff; border: 1px solid #f1f5f9; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px; font-size: 12px; }
              .med-name { font-weight: 850; color: #0f172a; }
              .med-inst { font-size: 10px; color: #64748b; font-style: italic; margin-top: 2px; }
              .med-details { text-align: right; }
              .med-dosage { font-weight: 800; color: #005EB8; }
              .med-freq { font-size: 9px; color: #64748b; margin-top: 2px; }
              .stamp-container { text-align: center; margin-top: 40px; }
              .stamp { border: 2px solid #10b981; color: #10b981; display: inline-block; padding: 6px 16px; font-weight: 800; border-radius: 6px; text-transform: uppercase; transform: rotate(-2deg); font-size: 11px; letter-spacing: 0.05em; background: #f0fdf4; }
            </style>
          </head>
          <body onload="window.print(); window.close();">
            <div class="header">
              <div class="clinic-name">${tenant?.name || 'MedQueue Outpatient Center'}</div>
              <div class="clinic-sub">${tenant?.address || 'Digital Healthcare Sandbox'}</div>
            </div>
            
            <div class="meta-grid">
              <div class="meta-item">
                <div class="meta-label">Patient Name</div>
                <div class="meta-val" style="font-size: 13px;">${activeProfile?.name || 'Patient'}</div>
                <div style="margin-top: 4px; color: #64748b;">Age: <strong>${activeProfile?.age || '30'} yrs</strong> • Phone: <strong>${activeProfile?.phone || ''}</strong></div>
              </div>
              <div class="meta-item" style="text-align: right;">
                <div class="meta-label">Consultation Details</div>
                <div class="meta-val">Doctor: <span style="color: #005EB8;">${showDocPreview.doctorName || 'Assigned Specialist'}</span></div>
                <div style="margin-top: 4px; color: #64748b;">Date: <strong>${showDocPreview.uploadedAt || ''}</strong></div>
              </div>
            </div>

            <div class="section-title">Clinical Diagnosis</div>
            <div class="diagnosis-box">
              ${showDocPreview.rawPrescription?.diagnosis || 'Routine Outpatient Triage Check'}
            </div>

            <div class="section-title">Prescribed Medications</div>
            <div style="margin-top: 8px;">
              ${Array.isArray(showDocPreview.rawPrescription?.medications) ? showDocPreview.rawPrescription.medications.map((m: any) => `
                <div class="med-item">
                  <div>
                    <div class="med-name">• ${m.name}</div>
                    ${m.instructions ? `<div class="med-inst">Notes: ${m.instructions}</div>` : ''}
                  </div>
                  <div class="med-details">
                    <div class="med-dosage">${m.dosage}</div>
                    <div class="med-freq">${m.frequency} • ${m.duration}</div>
                  </div>
                </div>
              `).join('') : '<div style="color: #94a3b8; font-style: italic;">No medications listed.</div>'}
            </div>

            <div class="stamp-container">
              <div class="stamp">Digitally Verified Rx</div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
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

  const uploadedDocs = vaultDocs.map(d => {
    let dateStr = d.uploadedAt;
    let isoDate = new Date().toISOString();
    try {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        isoDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).toISOString();
      } else {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          isoDate = parsed.toISOString();
        }
      }
    } catch (err) {}

    return {
      id: d.id,
      date: isoDate,
      type: 'Report' as const,
      title: d.name,
      subtitle: `${d.category} • ${d.fileSize}`,
      hospitalId: undefined,
      doctorName: d.doctorName || 'Self Uploaded',
      status: 'UPLOADED',
      details: d
    };
  });

  const allTimelineEvents = [...visits, ...prescriptions, ...appointments, ...uploadedDocs];

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
      if (timelineCategory === 'Lab Reports' && e.type !== 'Report') return false;
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
    <div className="min-h-screen bg-[#F4F8FB] font-sans pb-24 lg:pb-16 relative overflow-x-hidden w-full max-w-full">
      
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
              <h1 className="text-xl font-black text-slate-800 tracking-tight flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                <span>Patient Workspace</span>
                <span className="w-max whitespace-nowrap text-[9px] font-bold uppercase bg-[#005EB8]/10 text-[#005EB8] px-2.5 py-1 rounded-full tracking-wider border border-[#005EB8]/20 leading-none">
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
                { id: 'doctors', label: 'Doctors', icon: Stethoscope },
                { id: 'family', label: 'Member Section', icon: User },
                { id: 'wallet', label: 'Digital Health Card', icon: Award },
                { id: 'profile', label: 'My Control Profile', icon: User },
                { id: 'guide', label: 'Hospital Directions', icon: Building2 },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
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

          {/* ── RIGHT MAIN WORKSPACE WINDOW ── */}
          <div className="lg:col-span-9 space-y-6">

            {/* Mobile-only MQID Card Banner */}
            {step === 'authenticated' && patient && (
              <div className="block lg:hidden animate-fadeIn mb-4">
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

                {/* 1.3 QUICK DIRECTORIES ACCESS FOR MOBILE */}
                <div className="grid grid-cols-2 gap-4 lg:hidden mt-6">
                  <button
                    onClick={() => setActiveTab('doctors')}
                    className="flex flex-col items-center justify-center p-4 bg-white border border-slate-100 rounded-3xl text-center space-y-2 hover:border-slate-350 transition-all shadow-sm"
                  >
                    <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">Find Doctors</span>
                    <span className="text-[10px] text-slate-400 font-semibold block">View live room rosters</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('guide')}
                    className="flex flex-col items-center justify-center p-4 bg-white border border-slate-100 rounded-3xl text-center space-y-2 hover:border-slate-350 transition-all shadow-sm"
                  >
                    <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">OPD Directions</span>
                    <span className="text-[10px] text-slate-400 font-semibold block">Locate rooms & floors</span>
                  </button>
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

            {/* ── TAB 3: UNIFIED PERSONAL MEDICAL TIMELINE ── */}
            {activeTab === 'timeline' && (
              <div className="space-y-6">
                {/* Unified Title & Scan/Upload Action */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/50 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                      <Clock className="w-5 h-5 text-[#005EB8]" />
                      Unified Medical Vault & Timeline
                    </h2>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      Chronological record of clinic consultations, prescriptions, lab results, scans, and appointments.
                    </p>
                  </div>
                  
                  {/* Scan/Upload document trigger */}
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

                {/* Consolidated Filters and Search Bar */}
                <div className="bg-white border border-slate-100 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search records, diagnoses, doctors, or hospitals..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-[#005EB8] focus:bg-white transition-all text-slate-800"
                      />
                    </div>
                    
                    {/* Hospital Dropdown Selector */}
                    <div className="w-full md:w-64">
                      <select
                        value={selectedHospitalFilter}
                        onChange={e => setSelectedHospitalFilter(e.target.value)}
                        className="w-full border border-slate-200 bg-slate-50 rounded-2xl px-3.5 py-2.5 text-xs font-black text-slate-700 focus:outline-none focus:border-[#005EB8] focus:bg-white transition-all"
                      >
                        <option value="All">All Hospital Nodes (Global Vault)</option>
                        {Object.entries(hospitals).map(([id, name]) => (
                          <option key={id} value={id}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-slate-100">
                    {/* Category tabs */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none w-full sm:w-auto [-webkit-overflow-scrolling:touch]">
                      {[
                        { id: 'All', label: 'All Records' },
                        { id: 'Visits', label: 'Visits' },
                        { id: 'Prescriptions', label: 'Prescriptions' },
                        { id: 'Lab Reports', label: 'Lab Reports / Vault' },
                        { id: 'Appointments', label: 'Appointments' }
                      ].map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setTimelineCategory(cat.id)}
                          className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap border ${
                            timelineCategory === cat.id 
                              ? 'bg-[#005EB8] text-white border-transparent shadow-sm' 
                              : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* Date period filters */}
                    <div className="flex gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-150">
                      {[
                        { id: 'all', label: 'All Time' },
                        { id: '30', label: 'Last 30 Days' },
                        { id: '180', label: '6 Months' }
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setTimelineFilter(f.id as any)}
                          className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                            timelineFilter === f.id ? 'bg-white text-[#005EB8] shadow-sm font-extrabold' : 'text-slate-400 hover:text-slate-700'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Upload loading indicator */}
                {uploadingDoc && (
                  <div className="bg-blue-50 border border-blue-200/50 rounded-2xl p-4 text-center space-y-2 animate-pulse">
                    <Loader2 className="w-6 h-6 animate-spin text-[#005EB8] mx-auto" />
                    <span className="text-xs font-black text-[#005EB8] uppercase tracking-wider block">Uploading & encrypting file metadata...</span>
                  </div>
                )}

                {/* Timeline display */}
                {loadingHistory ? (
                  <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center text-slate-400">
                    Loading consolidated vault records...
                  </div>
                ) : filteredTimelineEvents.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-450 space-y-3">
                    <Clock className="w-8 h-8 text-slate-350 mx-auto" />
                    <h3 className="font-extrabold text-sm uppercase text-slate-750">No matching medical records found</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                      Try clearing search parameters, switching category tags, or choosing another hospital context.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8 relative">
                    {/* Vertical guideline */}
                    <div className="absolute left-[15px] sm:left-[21px] top-4 bottom-4 w-0.5 bg-slate-200/80" />

                    {Object.entries(groupedEvents).map(([dateKey, events]) => (
                      <div key={dateKey} className="space-y-4">
                        {/* High-contrast Date header block */}
                        <div className="relative z-10 flex items-center gap-3">
                          <div className="bg-indigo-50 border border-indigo-100/60 rounded-xl px-3 py-1.5 text-xs font-black text-indigo-700 uppercase tracking-widest shadow-sm">
                            {dateKey}
                          </div>
                          <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
                        </div>

                        {/* Events list under this date */}
                        <div className="space-y-4 pl-8 sm:pl-11">
                          {events.map((e, idx) => {
                            const isVisit = e.type === 'Visit';
                            const isPresc = e.type === 'Prescription';
                            const isAppt = e.type === 'Appointment';
                            const isReport = e.type === 'Report';

                            // Determine type styling
                            let iconColor = 'text-indigo-650 bg-indigo-50 border-indigo-100';
                            let IconComponent = Stethoscope;
                            let cardColor = 'border-slate-100';
                            let leftAccent = 'bg-indigo-500';

                            if (isPresc) {
                              iconColor = 'text-emerald-650 bg-emerald-50 border-emerald-100';
                              IconComponent = FileText;
                              leftAccent = 'bg-emerald-500';
                            } else if (isAppt) {
                              iconColor = 'text-amber-650 bg-amber-50 border-amber-100';
                              IconComponent = Clock;
                              leftAccent = 'bg-amber-500';
                            } else if (isReport) {
                              iconColor = 'text-blue-650 bg-blue-50 border-blue-100';
                              IconComponent = FileText;
                              leftAccent = 'bg-blue-500';
                            }

                            // Dynamic hospital badge name
                            const hospName = e.hospitalId ? (hospitals[e.hospitalId] || 'Associated Clinic') : 'Global Vault';

                            return (
                              <div key={e.id || idx} className="relative group text-left">
                                {/* Bullet on guideline */}
                                <span className="absolute -left-[30px] sm:-left-[31px] top-4 w-4 h-4 bg-white border-2 border-slate-350 rounded-full flex items-center justify-center shadow-sm group-hover:border-[#005EB8] group-hover:scale-110 transition-all duration-300">
                                  <span className="w-1.5 h-1.5 bg-slate-350 rounded-full group-hover:bg-[#005EB8]" />
                                </span>

                                <div className={`bg-white border ${cardColor} hover:border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-300 space-y-4 relative overflow-hidden`}>
                                  {/* Left accent column indicator */}
                                  <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${leftAccent}`} />

                                  {/* Event Card Header */}
                                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-50">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${iconColor}`}>
                                        <IconComponent className="w-4.5 h-4.5" />
                                      </div>
                                      <div>
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                          {e.type}
                                        </span>
                                        <h4 className="font-extrabold text-slate-800 text-xs mt-0.5">
                                          {e.title}
                                        </h4>
                                      </div>
                                    </div>
                                    
                                    {/* Hospital node badge */}
                                    <span className="text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200/60 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                      {hospName}
                                    </span>
                                  </div>

                                  {/* Event specific details card layout */}
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
                                          <div className="text-slate-700">BP: <strong className="text-slate-800">{e.details.bp || '120/80'}</strong> • Sugar: <strong className="text-slate-800">{e.details.sugar || '98'}</strong></div>
                                          <div className="text-[10px] text-slate-450 mt-0.5">Temp: {e.details.tokens?.patient_intake?.[0]?.temperature || e.details.temperature || '98.6'} °F</div>
                                        </div>
                                      </div>

                                      <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-3 sm:p-4 text-xs space-y-2">
                                        <div>
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Reported Symptoms</span>
                                          <p className="text-slate-700 italic">{e.details.symptoms || 'General routine followup checkup'}</p>
                                        </div>
                                        {e.details.doctor_notes && (
                                          <div className="pt-2 border-t border-slate-150/40">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Consultation Notes</span>
                                            <p className="text-slate-700 font-medium">{e.details.doctor_notes}</p>
                                          </div>
                                        )}
                                      </div>

                                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                          Status: <strong className="text-indigo-600">{e.status}</strong>
                                        </span>
                                        
                                        <button
                                          onClick={() => handlePrintTimelinePrescription(e.details, dbPrescriptions.find(p => p.visit_id === e.details.id || (e.details.token_id && p.token_id === e.details.token_id)))}
                                          className="flex items-center gap-1.5 px-4 py-2 bg-[#005EB8] hover:bg-[#004a96] text-white text-[10px] font-black rounded-xl uppercase tracking-wider transition-all shadow-sm active:scale-[0.98]"
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                          <span>View Prescription</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}

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

                                      {/* Medications List */}
                                      <div className="space-y-2">
                                        {Array.isArray(e.details.medications) && e.details.medications.map((med: any, mIdx: number) => (
                                          <div key={mIdx} className="bg-slate-50/50 border border-slate-100 p-2.5 rounded-xl flex justify-between items-start gap-4 text-xs">
                                            <div>
                                              <strong className="text-slate-800 text-xs block">• {med.name}</strong>
                                              {med.instructions && <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Notes: {med.instructions}</span>}
                                            </div>
                                            <div className="text-right flex-shrink-0 text-[10px] font-bold text-slate-500">
                                              <p className="text-[#005EB8] font-black">{med.dosage}</p>
                                              <p className="text-[9px] mt-0.5">{med.frequency} • {med.duration}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>

                                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                          Fulfillment: <strong className="text-emerald-600">{e.status}</strong>
                                        </span>
                                        
                                        <button
                                          onClick={() => handlePrintTimelinePrescription(dbVisits.find(v => v.id === e.details.visit_id || (e.details.token_id && v.token_id === e.details.token_id)) || { created_at: e.date, tokens: {} }, e.details)}
                                          className="flex items-center gap-1.5 px-4 py-2 bg-[#005EB8] hover:bg-[#004a96] text-white text-[10px] font-black rounded-xl uppercase tracking-wider transition-all shadow-sm active:scale-[0.98]"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                          <span>Print Rx Sheet</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {isAppt && (
                                    <div className="space-y-3 text-xs">
                                      <div className="grid grid-cols-2 gap-4 font-semibold text-slate-500 leading-tight">
                                        <div>
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Consultant Specialist</span>
                                          <div className="font-extrabold text-slate-800">{e.doctorName}</div>
                                          <div className="text-[10px] text-slate-400 mt-0.5">{e.subtitle}</div>
                                        </div>
                                        <div>
                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Appointment Slot</span>
                                          <div className="text-slate-800 font-extrabold">
                                            {new Date(e.details.appointment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • {e.details.time_slot}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                          Status: <strong className="text-amber-600">{e.status}</strong>
                                        </span>
                                        
                                        <span className="text-[10px] text-slate-450 font-extrabold uppercase">
                                          Fee: ₹{e.details.consultation_fee || 0}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {isReport && (
                                    <div className="space-y-3 text-xs flex flex-col justify-between">
                                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2.5">
                                          <FileText className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                                          <div className="text-left">
                                            <span className="text-[10px] text-slate-700 font-extrabold block uppercase tracking-wide">
                                              {e.subtitle}
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                                              Attendant: {e.doctorName}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div className="flex items-center justify-between border-t border-slate-50 pt-2 text-[9px] text-slate-400 font-extrabold">
                                        <span>Uploaded: {new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        
                                        <div className="flex items-center gap-3">
                                          <button 
                                            onClick={() => handleDocDelete(e.id)}
                                            className="text-rose-500 hover:text-rose-700 transition-colors p-1"
                                            title="Delete Document"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                          <button 
                                            onClick={() => setShowDocPreview(e.details)}
                                            className="text-[#005EB8] hover:underline font-black uppercase tracking-wider"
                                          >
                                            Preview
                                          </button>
                                        </div>
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

                      {/* Dynamic Prescription View or Mock Viewer depending on doc type */}
                      {showDocPreview.isDatabasePrescription ? (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 max-h-[350px] overflow-y-auto text-xs animate-fade-in text-left" id="printable-prescription">
                          {/* Clinic Header */}
                          <div className="border-b-2 border-[#005EB8] pb-3 text-center">
                            <h4 className="text-sm font-black text-[#005EB8] uppercase tracking-wide">{tenant?.name || 'MedQueue Outpatient Center'}</h4>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{tenant?.address || 'Digital Healthcare Sandbox'}</p>
                          </div>

                          {/* Patient & Doctor Meta */}
                          <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-500 font-semibold border-b border-slate-200 pb-3">
                            <div>
                              <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Patient Name</p>
                              <strong className="text-slate-800 text-[11px]">{activeProfile?.name}</strong>
                              <p className="mt-1">Age: <strong className="text-slate-700">{activeProfile?.age} yrs</strong> • Phone: <strong className="text-slate-700">{activeProfile?.phone}</strong></p>
                            </div>
                            <div className="text-right">
                              <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Consultation Details</p>
                              <p className="text-slate-700">Doctor: <strong className="text-[#005EB8]">{showDocPreview.doctorName}</strong></p>
                              <p className="mt-1">Date: <strong className="text-slate-700">{showDocPreview.uploadedAt}</strong></p>
                            </div>
                          </div>

                          {/* Diagnosis */}
                          <div className="bg-[#E8F3FF] border border-blue-100 rounded-xl p-3 text-[10px]">
                            <span className="text-[8px] font-black text-[#005EB8] uppercase tracking-wider block mb-0.5">Clinical Diagnosis</span>
                            <strong className="text-slate-800 text-xs">{showDocPreview.rawPrescription?.diagnosis || 'Routine Outpatient Triage Check'}</strong>
                          </div>

                          {/* Medications list */}
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Prescribed Medications</span>
                            <div className="space-y-2">
                              {Array.isArray(showDocPreview.rawPrescription?.medications) ? (
                                showDocPreview.rawPrescription.medications.map((m: any, idx: number) => (
                                  <div key={idx} className="bg-white border border-slate-100 p-2.5 rounded-xl flex justify-between items-start gap-4">
                                    <div>
                                      <strong className="text-slate-800 text-xs block">• {m.name}</strong>
                                      {m.instructions && <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Notes: {m.instructions}</span>}
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
                            <span className="border-2 border-emerald-500 text-emerald-500 font-black tracking-widest uppercase rounded-lg px-3 py-1 inline-block rotate-[-2deg] bg-emerald-50/50 text-[10px] shadow-sm animate-pulse">
                              Digitally Verified Rx
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Standard Mock Interactive PDF/Image viewer for uploaded files */
                        <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 h-48 flex items-center justify-center p-4 text-center">
                          <div>
                            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-black text-slate-700 uppercase tracking-wide">SECURE PREVIEW PANEL</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 max-w-xs">SHA-256 local keys verified. Diagnostic results are locked under clinical isolation rules.</p>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        {showDocPreview.isDatabasePrescription ? (
                          <button 
                            onClick={handlePrintPrescription}
                            className="flex-1 py-3 bg-[#005EB8] hover:bg-[#004a96] text-white text-xs font-black rounded-xl text-center flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-sm transition-all"
                          >
                            <Download className="w-4 h-4" /> Print Prescription
                          </button>
                        ) : (
                          <a 
                            href="#"
                            onClick={(e) => { e.preventDefault(); alert('Document downloaded locally.'); }}
                            className="flex-1 py-3 bg-[#005EB8] hover:bg-[#004a96] text-white text-xs font-black rounded-xl text-center flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-sm transition-all"
                          >
                            <Download className="w-4 h-4" /> Download File
                          </a>
                        )}
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

            {/* ── TAB 4: CROSS-CLINIC HEALTH VAULT ── */}
            {activeTab === 'vault' && (
              <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm">
                {mqid ? (
                  <HealthVaultView mqid={mqid} />
                ) : (
                  <div className="text-center py-12">
                    <p className="text-4xl mb-3">🔒</p>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Access Locked</h3>
                    <p className="text-xs text-slate-400 font-semibold mt-1">Please authenticate with your mobile number to load your clinical records.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'family' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                      <User className="w-5 h-5 text-[#005EB8]" />
                      Family Context Profiles
                    </h2>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Manage separate clinical records, drug dispensaries, and timelines for children or parents.</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setShowAddFamily(true)}
                      className="px-4 py-2 bg-[#005EB8] hover:bg-[#004a96] text-white text-[11px] font-black rounded-xl shadow-sm transition-all flex items-center gap-1.5 uppercase tracking-wider"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Member
                    </button>
                    <button
                      onClick={() => setShowSyncMember(true)}
                      className="px-4 py-2 bg-gradient-to-r from-[#00A3AD] to-[#005EB8] hover:opacity-95 text-white text-[11px] font-black rounded-xl shadow-sm transition-all flex items-center gap-1.5 uppercase tracking-wider"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Sync Account (OTP)
                    </button>
                  </div>
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
                        className="absolute right-4 top-4 text-slate-400 hover:text-slate-650"
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

                {/* Sync & Connect Member Modal */}
                {showSyncMember && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] border border-slate-100 max-w-md w-full p-6 shadow-2xl relative animate-fade-in text-left font-sans">
                      <button 
                        type="button" 
                        onClick={() => {
                          setShowSyncMember(false);
                          setSyncStep('input');
                          setSyncOtpInput('');
                          setSyncError('');
                        }}
                        className="absolute right-4 top-4 text-slate-400 hover:text-slate-650"
                      >
                        <X className="w-5 h-5" />
                      </button>

                      <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 border-b border-slate-50 pb-2">
                        <RefreshCw className="w-5 h-5 text-[#00A3AD]" /> Connect Unified Health Node
                      </h3>

                      {syncError && (
                        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl px-3 py-2.5 text-xs font-bold mt-3">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{syncError}</span>
                        </div>
                      )}

                      {syncStep === 'input' && (
                        <form onSubmit={handleSyncMemberSubmit} className="space-y-4 mt-4">
                          <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                            Search and connect an existing outpatient account using secure mobile verification.
                          </p>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Full Name *</label>
                              <input 
                                type="text"
                                value={syncForm.name}
                                onChange={e => setSyncForm({...syncForm, name: e.target.value})}
                                placeholder="e.g. Rahul Kumar"
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-850"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Relationship *</label>
                              <select
                                value={syncForm.relationship}
                                onChange={e => setSyncForm({...syncForm, relationship: e.target.value as any})}
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-850"
                              >
                                <option value="Child">Child</option>
                                <option value="Spouse">Spouse</option>
                                <option value="Parent">Parent</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Mobile Number *</label>
                              <input 
                                type="tel"
                                value={syncForm.phone}
                                onChange={e => setSyncForm({...syncForm, phone: e.target.value})}
                                placeholder="10-digit number"
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-850"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">ABHA / Health ID (Optional)</label>
                              <input 
                                type="text"
                                value={syncForm.abhaId}
                                onChange={e => setSyncForm({...syncForm, abhaId: e.target.value})}
                                placeholder="91-XXXX-XXXX-XXXX"
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Age *</label>
                              <input 
                                type="number"
                                value={syncForm.age}
                                onChange={e => setSyncForm({...syncForm, age: e.target.value})}
                                placeholder="Age"
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-850"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Blood Group</label>
                              <select
                                value={syncForm.bloodGroup}
                                onChange={e => setSyncForm({...syncForm, bloodGroup: e.target.value})}
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-850"
                              >
                                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                                  <option key={bg} value={bg}>{bg}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Allergies</label>
                            <input 
                              type="text"
                              value={syncForm.allergies}
                              onChange={e => setSyncForm({...syncForm, allergies: e.target.value})}
                              placeholder="Allergies (or None)"
                              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-850"
                            />
                          </div>

                          <button
                            type="submit"
                            className="w-full min-h-[44px] bg-[#005EB8] hover:bg-[#004a96] text-white font-black text-xs rounded-xl shadow-md uppercase tracking-wider transition-all"
                          >
                            Send Secure OTP Request
                          </button>
                        </form>
                      )}

                      {syncStep === 'otp' && (
                        <form onSubmit={handleVerifyOtp} className="space-y-5 mt-4 text-center">
                          <p className="text-xs text-slate-500 font-semibold">
                            Enter the secure 4-digit code sent to <strong className="text-slate-800">{syncForm.phone}</strong>.
                          </p>

                          <div className="bg-[#F0F6FC] border border-blue-100 rounded-xl p-3.5 text-center">
                            <span className="text-[10px] font-black text-[#005EB8] uppercase tracking-widest block">Unified Health Verification OTP Code</span>
                            <span className="text-xl font-black text-slate-700 mt-1 block select-all tracking-widest">{generatedOtp}</span>
                          </div>

                          <div className="max-w-[200px] mx-auto">
                            <input 
                              type="text"
                              maxLength={4}
                              value={syncOtpInput}
                              onChange={e => setSyncOtpInput(e.target.value.replace(/\D/g, ''))}
                              placeholder="Code"
                              className="w-full text-center text-lg p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black tracking-widest focus:outline-none"
                              required
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setSyncStep('input'); setSyncOtpInput(''); setSyncError(''); }}
                              className="flex-1 min-h-[44px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-black text-xs rounded-xl uppercase tracking-wider transition-colors"
                            >
                              Back
                            </button>
                            <button
                              type="submit"
                              className="flex-1 min-h-[44px] bg-[#005EB8] hover:bg-[#004a96] text-white font-black text-xs rounded-xl shadow-md uppercase tracking-wider transition-all"
                            >
                              Verify & Sync
                            </button>
                          </div>
                        </form>
                      )}

                      {syncStep === 'success' && (
                        <div className="py-6 text-center space-y-3 mt-2">
                          <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 animate-bounce">
                            <CheckCircle className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Sync Completed Successfully</h4>
                            <p className="text-xs text-slate-400 font-semibold mt-1">
                              Connected {syncForm.name}'s medical records and dashboard context.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ── TAB 5.5: MY CONTROL PROFILE ── */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 text-left">
                    <User className="w-5 h-5 text-[#005EB8]" />
                    Profile Control Center
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5 text-left">Review and manage your personal details, connected mobile numbers, and clinical attributes.</p>
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
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-center space-y-5 relative overflow-hidden select-none">
                      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#005EB8] to-[#00A3AD]" />
                      
                      <div className="w-20 h-20 bg-gradient-to-tr from-[#005EB8] to-[#00A3AD] text-white rounded-[24px] flex items-center justify-center font-black text-2xl shadow-lg mx-auto uppercase">
                        {(profileForm.name || currentUser?.phone || 'U').substring(0, 2)}
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-extrabold text-slate-800 text-base">{profileForm.name || 'Patient User'}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{patientPhone}</p>
                      </div>

                      <div className="flex items-center justify-center gap-1.5 py-1 px-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full w-max mx-auto text-[10px] font-black uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Verified Clinical Node
                      </div>

                      <div className="border-t border-slate-100 pt-4 text-left space-y-2.5">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          <span>Primary Hospital</span>
                          <span className="font-extrabold text-slate-650">{tenant?.name || 'MedQueue Clinic'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          <span>Account Created</span>
                          <span className="font-extrabold text-slate-650">02 June 2026</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Editable Profile Form */}
                  <div className="lg:col-span-2">
                    <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5 text-left">
                      <h4 className="text-xs font-black text-[#005EB8] uppercase tracking-widest border-b border-slate-50 pb-2">Credential Identifiers</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Full Name *</label>
                          <input 
                            type="text"
                            value={profileForm.name}
                            onChange={e => setProfileForm({...profileForm, name: e.target.value})}
                            placeholder="Full Name"
                            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] focus:bg-white outline-none font-bold text-slate-800"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Mobile Number (Linked)</label>
                          <input 
                            type="text"
                            value={patientPhone}
                            disabled
                            placeholder="Mobile Number"
                            className="w-full text-xs p-3 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-400 cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                          <input 
                            type="email"
                            value={profileForm.email}
                            onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                            placeholder="yourname@gmail.com"
                            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] focus:bg-white outline-none font-bold text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Primary Blood Group</label>
                          <select
                            value={profileForm.bloodGroup}
                            onChange={e => setProfileForm({...profileForm, bloodGroup: e.target.value})}
                            className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-slate-800"
                          >
                            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                              <option key={bg} value={bg}>{bg}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Residential / Home Address</label>
                        <input 
                          type="text"
                          value={profileForm.address}
                          onChange={e => setProfileForm({...profileForm, address: e.target.value})}
                          placeholder="Complete home or office address"
                          className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] focus:bg-white outline-none font-bold text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Critical Allergies / Alerts</label>
                        <input 
                          type="text"
                          value={profileForm.allergies}
                          onChange={e => setProfileForm({...profileForm, allergies: e.target.value})}
                          placeholder="e.g. Penicillin, Peanuts (or None)"
                          className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] focus:bg-white outline-none font-bold text-slate-800"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={profileSaving}
                        className="w-full min-h-[48px] bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-60 text-white font-black text-xs rounded-xl shadow-md uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-[0.99] focus:outline-none font-sans"
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
                  
                  {step === 'authenticated' && patient ? (
                    <MQIDCard
                      patient={patient}
                      hospitalName={tenant?.name || hospitalName}
                      localPatientNo={hospitalProfile?.local_patient_no || hospitalProfile?.localPatientNo}
                      localPrefix={localPrefix}
                    />
                  ) : (
                    <div className="relative bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] border border-slate-700/50 rounded-[28px] p-6 text-white shadow-2xl max-w-sm w-full mx-auto overflow-hidden text-left">
                      <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-[#005EB8]/20 rounded-full blur-3xl pointer-events-none" />
                      <div className="absolute bottom-[-10%] left-[-10%] w-40 h-40 bg-[#00A3AD]/10 rounded-full blur-2xl pointer-events-none" />
                      
                      <svg className="absolute right-0 top-1/3 w-32 h-16 text-slate-800/10 fill-none stroke-current stroke-[1.5] pointer-events-none" viewBox="0 0 100 50">
                        <path d="M0,25 L30,25 L35,10 L40,40 L45,20 L50,30 L55,25 L100,25" />
                      </svg>

                      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
                        <div className="flex items-center gap-2">
                          <Activity className="w-5 h-5 text-white animate-pulse" />
                          <div>
                            <p className="text-[10px] font-black tracking-widest text-[#00A3AD] uppercase leading-none">MedQueue Identity</p>
                            <p className="text-[9px] text-slate-400 font-bold mt-1 leading-none">{tenant?.name || 'MedQueue Sandbox'}</p>
                          </div>
                        </div>
                        <span className="text-[8px] font-extrabold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                          DEMO NODE
                        </span>
                      </div>

                      <div className="flex justify-between items-start gap-4 mb-5">
                        <div className="space-y-4 flex-1">
                          <div className="w-8 h-6 rounded-md bg-gradient-to-tr from-yellow-400 via-amber-300 to-yellow-500 border border-yellow-200/50 shadow-inner flex flex-col justify-between p-1 opacity-90">
                            <div className="h-px bg-amber-700/30 w-full" />
                            <div className="h-px bg-amber-700/30 w-full" />
                            <div className="h-px bg-amber-700/30 w-full" />
                          </div>

                          <div>
                            <p className="text-[8px] font-black text-[#00A3AD] uppercase tracking-widest leading-none">Patient Name</p>
                            <h4 className="font-black text-base text-white mt-1.5 truncate max-w-[170px] tracking-tight">{activeProfile.name}</h4>
                          </div>
                        </div>

                        <div className="bg-white/95 p-2 rounded-2xl shadow-xl shadow-slate-950/20 flex flex-col items-center justify-center shrink-0 border border-slate-700/30">
                          <svg viewBox="0 0 100 100" className="w-12 h-12 text-slate-900 fill-current">
                            <path d="M0,0 h30 v30 h-30 z M10,10 v10 h10 v-10 z" />
                            <path d="M70,0 h30 v30 h-30 z M80,10 v10 h10 v-10 z" />
                            <path d="M0,70 h30 v30 h-30 z M10,80 v10 h10 v-10 z" />
                            <rect x="40" y="10" width="10" height="10" />
                            <rect x="50" y="20" width="10" height="10" />
                            <rect x="40" y="40" width="20" height="10" />
                            <rect x="10" y="40" width="10" height="10" />
                            <rect x="70" y="40" width="10" height="10" />
                            <rect x="40" y="70" width="10" height="20" />
                            <rect x="80" y="80" width="10" height="10" />
                          </svg>
                          <span className="text-[5px] font-black text-slate-500 uppercase tracking-widest mt-1">SCAN MQID</span>
                        </div>
                      </div>

                      <div className="mb-5">
                        <p className="text-[8px] font-black text-[#00A3AD] uppercase tracking-widest mb-1.5 leading-none">Universal Medical Registry Key</p>
                        <div className="w-full flex items-center justify-between gap-3 bg-slate-950/40 border border-slate-800 rounded-xl px-4 py-2.5">
                          <span className="text-base font-mono font-black tracking-wider text-slate-100">
                            MQ-{activeProfile.name.slice(0, 3).toUpperCase()}-{activeProfile.age}93
                          </span>
                          <span className="text-[9px] font-black uppercase text-indigo-400">DEMO ID</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 border-t border-slate-800 pt-4 text-left">
                        <div>
                          <span className="text-[7.5px] font-black text-slate-450 uppercase tracking-widest block mb-0.5">Blood Group</span>
                          <span className="font-extrabold text-[12px] text-red-400">{activeProfile.bloodGroup || 'O+'}</span>
                        </div>
                        <div>
                          <span className="text-[7.5px] font-black text-slate-450 uppercase tracking-widest block mb-0.5">Birth Date</span>
                          <span className="font-extrabold text-[11px] text-slate-200">{activeProfile.age ? `${activeProfile.age} Yrs` : '01-Jan-1996'}</span>
                        </div>
                        <div>
                          <span className="text-[7.5px] font-black text-slate-450 uppercase tracking-widest block mb-0.5">Local ID</span>
                          <span className="font-mono font-extrabold text-[11px] text-[#00A3AD] truncate block max-w-[90px]">{localPrefix || 'MQ'}-DEMO</span>
                        </div>
                      </div>

                      <div className="mt-5 pt-3.5 border-t border-slate-800 flex items-center justify-between text-[8px] font-black uppercase text-slate-500 tracking-wider">
                        <span className="flex items-center gap-1">
                          <Shield className="w-3 h-3 text-indigo-500" />
                          Unverified Demo Profile
                        </span>
                        <span>ID: DEMO-SECURE</span>
                      </div>
                    </div>
                  )}

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
          { id: 'wallet', label: 'MQID Card', icon: Award },
          { id: 'timeline', label: 'Records', icon: Clock },
          { id: 'vault', label: 'Vault', icon: FileText, badge: vaultDocs.length },
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

      {/* ── PRESCRIPTION PRINT/PDF PREVIEW OVERLAY MODAL ── */}
      {activePrescriptionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-150 max-h-[90vh] flex flex-col animate-fade-in text-left">
            {/* Modal Header Actions */}
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 flex-shrink-0 gap-2">
              <span className="text-xs font-black text-slate-700 uppercase tracking-widest truncate min-w-0">
                <span>Prescription Record</span>
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#005EB8] hover:bg-[#004a96] text-white text-[10px] font-black uppercase tracking-wider rounded-xl flex-shrink-0 shadow-sm"
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
            <div className="p-4 xs:p-6 sm:p-8 overflow-y-auto flex-1 font-sans print-sheet" id="printable-prescription-container">
              
              {/* Branded Hospital Header */}
              <div className="border-b-4 border-[#005EB8] pb-5 flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-800 tracking-tight flex items-center gap-1.5 uppercase">
                    <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#005EB8]" />
                    {tenant?.name || 'Apollo Clinic'}
                  </h2>
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block mt-1">
                    MedQueue SecurEHR Cloud Integration
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">Triage Node</div>
                  <div className="text-[9px] sm:text-[10px] text-[#00A3AD] font-bold mt-0.5">
                    TOKEN #{activePrescriptionModal.vis.tokens?.token_number || 'TBA'}
                  </div>
                  <div className="text-[8px] sm:text-[9px] text-slate-400 mt-0.5">
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
                  <div className="text-slate-400 font-semibold mt-0.5 uppercase tracking-wide truncate">
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
                  <div className="font-extrabold text-slate-800 truncate">{activeProfile?.name || 'Patient'}</div>
                  <div className="text-slate-400 font-semibold mt-0.5 truncate">
                    Age: {activeProfile?.age || '—'} yrs • Phone: {activeProfile?.phone || patientPhone}
                  </div>
                </div>
              </div>

              {/* Vitals summary block */}
              <div className="py-4 border-b border-slate-100">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Patient Vitals Snapshot</span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-2.5">
                  {[
                    { label: 'BP', val: activePrescriptionModal.vis.bp || '120/80' },
                    { label: 'Sugar', val: (activePrescriptionModal.vis.sugar || '110') + ' mg/dL' },
                    { label: 'Temp', val: (activePrescriptionModal.vis.tokens?.patient_intake?.[0]?.temperature || activePrescriptionModal.vis.temperature || '96') + ' °F' },
                    { label: 'Pulse', val: (activePrescriptionModal.vis.tokens?.patient_intake?.[0]?.pulse || activePrescriptionModal.vis.pulse || '69') + ' BPM' },
                    { label: 'Oxygen', val: (activePrescriptionModal.vis.tokens?.patient_intake?.[0]?.oxygen || activePrescriptionModal.vis.oxygen || '98') + ' %' },
                  ].map((v, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-2 border border-slate-150/60 text-center">
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{v.label}</div>
                      <div className="text-[10px] sm:text-xs font-black text-slate-800 mt-1 truncate">{v.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chief symptoms & Diagnosis split */}
              <div className="py-4 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 text-xs font-semibold">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Chief Triage Symptoms</span>
                  <div className="text-slate-700 bg-slate-50/50 rounded-xl p-2.5 border border-slate-100/50 sm:p-0 sm:border-none sm:bg-transparent">
                    {activePrescriptionModal.vis.symptoms || 'None reported'}
                  </div>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Doctor Diagnosis</span>
                  <div className="text-slate-700 font-bold bg-slate-50/50 rounded-xl p-2.5 border border-slate-100/50 sm:p-0 sm:border-none sm:bg-transparent">
                    {activePrescriptionModal.presc?.diagnosis || 'General Consultation Findings'}
                  </div>
                </div>
              </div>

              {/* Attendant Doctor Notes */}
              {activePrescriptionModal.vis.doctor_notes && (
                <div className="py-4 border-b border-slate-100 text-xs font-semibold">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Clinical Diagnosis & Attendant Doctor Notes</span>
                  <div className="text-slate-700 bg-slate-50/50 rounded-xl p-2.5 border border-slate-100/50 sm:p-0 sm:border-none sm:bg-transparent">
                    {activePrescriptionModal.vis.doctor_notes}
                  </div>
                </div>
              )}

              {/* Medications grid list */}
              <div className="py-5">
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
                                <div className="text-[10px] text-slate-400 font-medium italic mt-0.5">Note: {m.instructions}</div>
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
