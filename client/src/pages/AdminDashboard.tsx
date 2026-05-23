import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { AuthUser } from '../lib/auth';
import {
  Users, Stethoscope, Activity, RefreshCw, AlertCircle,
  TrendingUp, Clock, CheckCircle2, Calendar,
  Package, Search, PlusCircle, Volume2, ShieldAlert, Heart,
  HardDrive, Network, Layers, X,
  FileSpreadsheet, Eye, Sparkles, MapPin, Database, Server
} from 'lucide-react';
import { TokenStatus, Priority, Department, PRIORITY_LABEL, PRIORITY_COLOR, STATUS_COLOR } from '../types';

interface Props {
  onNavigate?: (p: string) => void;
  currentUser?: AuthUser | null;
}

interface Stats {
  totalToday: number;
  waiting: number;
  serving: number;
  done: number;
  noShow: number;
  pendingPrescriptions: number;
}

interface TokenRow {
  id: string;
  token_number: number;
  phone: string;
  status: TokenStatus;
  intake_status: string;
  department: Department;
  priority: Priority;
  created_at: string;
  room_number?: string;
  doctor_name?: string;
  patients?: { id: string; name: string; age?: number; address?: string } | null;
}

interface DoctorRow {
  id: string;
  name: string;
  specialty: string;
  department: Department;
  room_number: string;
  is_available: boolean;
  is_active?: boolean;
}

interface StaffUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  room_number?: string;
  is_active: boolean;
}

interface AppointmentRow {
  id: string;
  phone: string;
  patient_name: string;
  department: Department;
  appointment_date: string;
  time_slot: string;
  status: string;
  consultation_fee: number;
}

interface PrescriptionRow {
  id: string;
  token_id: string;
  diagnosis: string;
  medications: any;
  status: string;
  created_at: string;
  patients?: { name: string } | null;
}

interface ActivityLogRow {
  id: string;
  message: string;
  category: string;
  badge_color: string;
  created_at: string;
}

interface SecurityLogRow {
  id: string;
  event: string;
  ip: string;
  hospital: string;
  severity: string;
  acknowledged: boolean;
  created_at: string;
}

export default function AdminDashboard({ currentUser }: Props) {
  const hospitalId = currentUser?.hospital_id || 'd290f1ee-6c54-4b01-90e6-d701748f0851';

  // ── Navigation Tabs ───────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'dashboard' | 'queue' | 'doctors' | 'staff' | 'patients' | 'appointments' | 'pharmacy' | 'analytics' | 'system'>('dashboard');

  // ── Date filter ───────────────────────────────────────────
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  // selectedDate drives queue date filter UI
  const [selectedDate] = useState(todayStr);

  // ── Dashboard States ──────────────────────────────────────
  const [stats, setStats] = useState<Stats>({
    totalToday: 0, waiting: 0, serving: 0, done: 0, noShow: 0, pendingPrescriptions: 0,
  });
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUserRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([]);
  // securityLogs data is fetched but stored locally to keep audit data available
  const [_securityLogs, _setSecurityLogs] = useState<SecurityLogRow[]>([]);
  
  // Real-time infrastructure diagnostics
  const [dbLatency, setDbLatency] = useState<number | null>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [emergencyMode, setEmergencyMode] = useState<boolean>(false);
  const [otpGatewayOnline, setOtpGatewayOnline] = useState<boolean>(true);

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter state
  const [globalSearch, setGlobalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // ── Dynamic Modals ────────────────────────────────────────
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [showEmergencyPatient, setShowEmergencyPatient] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState<any[]>([]);
  const [selectedPatientVitals, setSelectedPatientVitals] = useState<any[]>([]);

  // ── Form States ───────────────────────────────────────────
  const [doctorForm, setDoctorForm] = useState({ name: '', specialty: 'General', department: 'general' as Department, room_number: '', email: '', password: '' });
  const [staffForm, setStaffForm] = useState({ name: '', email: '', role: 'WARD_BOY', department: 'general', room_number: '', password: '' });
  const [emergencyForm, setEmergencyForm] = useState({ name: '', phone: '', age: '', address: '', department: 'general' as Department });
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [announcementSeverity, setAnnouncementSeverity] = useState('info');

  // ── Diagnostics Pings ─────────────────────────────────────
  const pingDiagnostics = useCallback(async () => {
    const startDb = Date.now();
    try {
      await supabase.from('hospitals').select('id').limit(1);
      setDbLatency(Date.now() - startDb);
    } catch {
      setDbLatency(null);
    }

    const startApi = Date.now();
    try {
      const res = await fetch('http://localhost:3001/health');
      if (res.ok) setApiLatency(Date.now() - startApi);
    } catch {
      setApiLatency(null);
    }
  }, []);

  // ── Fetch Operations Center Ledger ─────────────────────────
  const fetchData = useCallback(async (silent = false) => {
    if (silent) void 0; // silent flag reserved for future use
    try {
      const startIST = `${selectedDate}T00:00:00+05:30`;
      const endIST   = `${selectedDate}T23:59:59+05:30`;

      // Parallel reads across all SaaS database nodes
      const [
        tokensRes,
        rxCountRes,
        doctorsRes,
        staffRes,
        appointmentsRes,
        prescriptionsRes,
        logsRes,
        securityRes,
        settingsRes
      ] = await Promise.all([
        supabase.from('tokens').select('*, patients(id, name, age, address)').eq('hospital_id', hospitalId).gte('created_at', startIST).lte('created_at', endIST).order('created_at', { ascending: false }),
        supabase.from('prescriptions').select('*', { count: 'exact', head: true }).eq('hospital_id', hospitalId).in('status', ['PENDING', 'IN_PROGRESS']),
        supabase.from('doctors').select('*').eq('hospital_id', hospitalId).order('name'),
        supabase.from('staff_users').select('*').eq('hospital_id', hospitalId).neq('is_deleted', true).order('name'),
        supabase.from('appointments').select('*').eq('hospital_id', hospitalId).order('appointment_date', { ascending: false }),
        supabase.from('prescriptions').select('*, patients(name)').eq('hospital_id', hospitalId).order('created_at', { ascending: false }),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('security_logs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('system_settings').select('*')
      ]);

      if (tokensRes.error) throw tokensRes.error;
      if (doctorsRes.error) throw doctorsRes.error;
      if (staffRes.error) throw staffRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;
      if (prescriptionsRes.error) throw prescriptionsRes.error;

      const rows = tokensRes.data ?? [];
      setTokens(rows);
      setDoctors(doctorsRes.data ?? []);
      setStaffUsers(staffRes.data ?? []);
      setAppointments(appointmentsRes.data ?? []);
      setPrescriptions(prescriptionsRes.data ?? []);
      setActivityLogs(logsRes.data ?? []);
      _setSecurityLogs(securityRes.data ?? []);
      console.debug('Loaded security logs:', _securityLogs.length || (securityRes.data ?? []).length);

      // Calculate operations metrics
      setStats({
        totalToday: rows.length,
        waiting: rows.filter(t => t.status === 'WAITING').length,
        serving: rows.filter(t => t.status === 'SERVING').length,
        done: rows.filter(t => t.status === 'DONE').length,
        noShow: rows.filter(t => t.status === 'NO_SHOW').length,
        pendingPrescriptions: rxCountRes.count ?? 0,
      });

      // Parse system settings
      if (settingsRes.data) {
        const emergency = settingsRes.data.find(s => s.key === 'emergency_mode');
        const gateway = settingsRes.data.find(s => s.key === 'otp_gateway_status');
        if (emergency) setEmergencyMode(emergency.value === true || emergency.value === 'true');
        if (gateway) setOtpGatewayOnline(gateway.value === 'ONLINE' || gateway.value === '"ONLINE"');
      }

      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Database sync failed. Refreshing connection...');
    } finally {
      setRefreshing(false);
    }
  }, [selectedDate, hospitalId]);

  useEffect(() => {
    fetchData();
    pingDiagnostics();

    const intervalData = setInterval(() => fetchData(true), 12000);
    const intervalHealth = setInterval(pingDiagnostics, 10000);

    return () => {
      clearInterval(intervalData);
      clearInterval(intervalHealth);
    };
  }, [fetchData, pingDiagnostics]);

  // ── Logging System Activity Helper ─────────────────────────
  const logLocalActivity = async (message: string, category = 'system', badge_color = 'bg-[#00A3AD]') => {
    try {
      await supabase.from('activity_logs').insert({ message, category, badge_color });
      fetchData(true);
    } catch (e) {
      console.error('Activity logging failure:', e);
    }
  };

  // ── RLS Queue Control Actions ──────────────────────────────
  const handleUpdateToken = async (id: string, nextStatus: TokenStatus) => {
    try {
      const { error } = await supabase
        .from('tokens')
        .update({ status: nextStatus })
        .eq('id', id);

      if (error) throw error;
      setSuccess(`Token updated to ${nextStatus} successfully.`);
      logLocalActivity(`Token ID ${id.substring(0, 8)} status set to ${nextStatus}.`, 'queue', 'bg-[#005EB8]');
      fetchData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update token');
    }
  };

  // ── Doctor Availability RLS Toggle ─────────────────────────
  const handleToggleDoctor = async (id: string, currentVal: boolean, name: string) => {
    try {
      const { error } = await supabase
        .from('doctors')
        .update({ is_available: !currentVal })
        .eq('id', id);

      if (error) throw error;
      setSuccess(`Doctor availability updated successfully.`);
      logLocalActivity(`Doctor ${name} changed availability status to ${!currentVal ? 'Online' : 'Offline'}.`, 'doctors', 'bg-[#00A3AD]');
      fetchData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle availability');
    }
  };

  // ── Staff Member Suspension RLS Toggle ──────────────────────
  const handleToggleStaffActive = async (id: string, currentVal: boolean, name: string) => {
    try {
      const { error } = await supabase
        .from('staff_users')
        .update({ is_active: !currentVal })
        .eq('id', id);

      if (error) throw error;
      setSuccess(`Staff status updated successfully.`);
      logLocalActivity(`Staff member ${name} credentials active status set to ${!currentVal}.`, 'security', 'bg-red-500');
      fetchData(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staff status');
    }
  };

  // ── Reset Today's Queue ─────────────────────────────────────
  const handleResetQueue = async () => {
    const confirmed = window.confirm('⚠️ WARNING: Are you absolutely sure you want to purge and reset all patient tokens for today? This cannot be undone.');
    if (!confirmed) return;
    try {
      const startIST = `${selectedDate}T00:00:00+05:30`;
      const endIST   = `${selectedDate}T23:59:59+05:30`;

      await supabase.from('prescriptions').delete().eq('hospital_id', hospitalId);
      const { error } = await supabase
        .from('tokens')
        .delete()
        .eq('hospital_id', hospitalId)
        .gte('created_at', startIST)
        .lte('created_at', endIST);

      if (error) throw error;
      setSuccess("Today's queue has been completely reset.");
      logLocalActivity("Today's local token queue was reset and purged by admin.", 'security', 'bg-red-600');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset queue failed');
    }
  };

  // ── Add New Doctor ──────────────────────────────────────────
  const handleAddDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, specialty, department, room_number, email, password } = doctorForm;
    if (!name || !email || !password || !room_number) return setError('Please fill all fields');

    try {
      const bcrypt = await import('bcryptjs');
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);

      // Create staff user credentials first
      const { data: staff, error: staffErr } = await supabase
        .from('staff_users')
        .insert({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password_hash: hash,
          role: 'DOCTOR',
          department: department.toLowerCase().trim(),
          room_number: room_number.trim(),
          hospital_id: hospitalId,
          is_active: true
        })
        .select()
        .single();

      if (staffErr) throw staffErr;

      // Create doctor practitioner record
      const { error: docErr } = await supabase
        .from('doctors')
        .insert({
          staff_user_id: staff.id,
          id: staff.id,
          name: name.trim(),
          specialty: specialty.trim(),
          department: department,
          room_number: room_number.trim(),
          hospital_id: hospitalId,
          is_available: true
        });

      if (docErr) throw docErr;

      setSuccess(`Doctor "${name}" successfully registered!`);
      logLocalActivity(`New practitioner registered: Doctor ${name} (${specialty}).`, 'doctors', 'bg-[#00A3AD]');
      setShowAddDoctor(false);
      setDoctorForm({ name: '', specialty: 'General', department: 'general', room_number: '', email: '', password: '' });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registering doctor failed');
    }
  };

  // ── Add New Staff Member ─────────────────────────────────────
  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, role, department, room_number, password } = staffForm;
    if (!name || !email || !password) return setError('Please fill all required fields');

    try {
      const bcrypt = await import('bcryptjs');
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);

      const { error } = await supabase
        .from('staff_users')
        .insert({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password_hash: hash,
          role,
          department: department.toLowerCase().trim(),
          room_number: room_number.trim() || null,
          hospital_id: hospitalId,
          is_active: true
        });

      if (error) throw error;

      setSuccess(`Staff member "${name}" registered successfully!`);
      logLocalActivity(`Registered staff operator: ${name} (${role}).`, 'staff', 'bg-[#005EB8]');
      setShowAddStaff(false);
      setStaffForm({ name: '', email: '', role: 'WARD_BOY', department: 'general', room_number: '', password: '' });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registering staff failed');
    }
  };

  // ── Onboard Emergency Patient ──────────────────────────────
  const handleEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, phone, age, address, department } = emergencyForm;
    if (!phone) return setError('Phone number is required');

    try {
      // Find or insert patient
      let patientId = '';
      const { data: patient, error: pe } = await supabase
        .from('patients')
        .select('*')
        .eq('phone', phone)
        .eq('hospital_id', hospitalId)
        .maybeSingle();

      if (pe) throw pe;

      if (patient) {
        patientId = patient.id;
      } else {
        const { data: created, error: ce } = await supabase
          .from('patients')
          .insert({
            name: name.trim() || 'Emergency Patient',
            phone: phone.trim(),
            age: parseInt(age) || 30,
            address: address.trim() || 'Emergency Intake',
            hospital_id: hospitalId
          })
          .select()
          .single();

        if (ce) throw ce;
        patientId = created.id;
      }

      // Generate Priority 0 Emergency Token
      const tokenNum = Math.floor(100 + Math.random() * 899);
      const { error: te } = await supabase
        .from('tokens')
        .insert({
          phone: phone.trim(),
          patient_id: patientId,
          status: 'WAITING',
          priority: 0, // Emergency Priority
          token_number: tokenNum,
          intake_status: 'ARRIVED',
          department: department,
          hospital_id: hospitalId
        });

      if (te) throw te;

      setSuccess(`Emergency Token #${tokenNum} successfully registered!`);
      logLocalActivity(`EMERGENCY PATIENT INTAKE: Registered Token #${tokenNum} for cardiology/emergency.`, 'security', 'bg-red-600');
      setShowEmergencyPatient(false);
      setEmergencyForm({ name: '', phone: '', age: '', address: '', department: 'general' });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Emergency intake failed');
    }
  };

  // ── Dispatch System Broadcast ───────────────────────────────
  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementMsg.trim()) return;

    try {
      const { error } = await supabase
        .from('broadcasts')
        .insert({
          message: announcementMsg.trim(),
          scope: hospitalId,
          severity: announcementSeverity
        });

      if (error) throw error;
      setSuccess('Broadcast announcement successfully dispatched across waiting screens.');
      logLocalActivity(`System broadcast alert was dispatched: "${announcementMsg}"`, 'system', 'bg-[#005EB8]');
      setAnnouncementMsg('');
      setShowAnnouncement(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Broadcast dispatch failed');
    }
  };

  // ── Trigger Patient History Drawer ──────────────────────────
  const handleOpenPatientHistory = async (pId: string) => {
    setSelectedPatientId(pId);
    try {
      const [historyRes, vitalsRes] = await Promise.all([
        supabase.from('visits').select('*, tokens(*)').eq('patient_id', pId).order('created_at', { ascending: false }),
        supabase.from('patient_intake').select('*').eq('patient_id', pId).order('created_at', { ascending: false })
      ]);
      setSelectedPatientHistory(historyRes.data ?? []);
      setSelectedPatientVitals(vitalsRes.data ?? []);
    } catch (err) {
      console.error('Failed to load patient history records:', err);
    }
  };

  // ── Export CSV Audit Operations ─────────────────────────────
  const handleExportCSV = () => {
    const headers = 'Token Number,Phone,Patient Name,Age,Department,Priority,Status,Created At\n';
    const rows = tokens.map(t => 
      `#${t.token_number},${t.phone},"${t.patients?.name || '—'}",${t.patients?.age || '—'},${t.department || 'General'},${PRIORITY_LABEL[t.priority]},${t.status},${t.created_at}`
    ).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `medqueue_ops_audit_${hospitalId}_${Date.now()}.csv`);
    a.click();
    logLocalActivity('Operations CSV Audit log generated and downloaded.', 'system', 'bg-[#005EB8]');
  };

  // Date navigation helper (kept for future date-picker UI)

  // ── Filter & Search Tokens ────────────────────────────────
  const filteredTokens = tokens.filter(t => {
    const matchesSearch = !globalSearch.trim() || 
      t.patients?.name?.toLowerCase().includes(globalSearch.toLowerCase()) ||
      t.phone.includes(globalSearch) ||
      String(t.token_number).includes(globalSearch) ||
      (t.department ?? '').toLowerCase().includes(globalSearch.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate intelligent insights
  const cardiologyOverloaded = tokens.filter(t => t.department === 'cardiology' && t.status === 'WAITING').length > 4;
  const noOnlineDoctors = doctors.filter(d => d.is_available).length === 0;
  const waitTimeSpike = stats.waiting > 8;

  return (
    <div className="min-h-screen bg-[#F4F8FB] font-sans pb-12">
      {/* ── Top Header Control Center ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-200 shadow-sm">
            <Heart className="w-6 h-6 text-[#005EB8] animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              MedQueue Control Panel
              <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${emergencyMode ? 'bg-red-500 animate-pulse text-white' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                {emergencyMode ? 'EMERGENCY CODE ACTIVE' : 'SaaS Isolated Node Active'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 font-medium">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Hospital Node ID: <span className="font-semibold text-slate-600">{hospitalId.substring(0, 18)}...</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowEmergencyPatient(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md">
            <ShieldAlert className="w-3.5 h-3.5" />
            Register Emergency
          </button>
          <button onClick={() => setShowAnnouncement(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors">
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            Voice Broadcast
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
            Download Audit
          </button>
          <button onClick={handleResetQueue} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-colors">
            Reset Queue
          </button>
          <button onClick={() => { setRefreshing(true); fetchData(); }} disabled={refreshing} className="w-8 h-8 flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors">
            <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* ── Left Sidebar Navigation ── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Hospital Operations Hub</p>
            {[
              { id: 'dashboard', label: 'Operations Overview', icon: Activity },
              { id: 'queue', label: 'Real-Time Queues', icon: Clock },
              { id: 'doctors', label: 'Doctor Availability', icon: Stethoscope },
              { id: 'staff', label: 'Staff & Operators', icon: Users },
              { id: 'patients', label: 'Patient Records', icon: Eye },
              { id: 'appointments', label: 'Bookings & Slots', icon: Calendar },
              { id: 'pharmacy', label: 'Pharmacy Desk', icon: Package },
              { id: 'analytics', label: 'Visual Analytics', icon: TrendingUp },
              { id: 'system', label: 'System Diagnostics', icon: HardDrive },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive ? 'bg-[#005EB8]/10 text-[#005EB8]' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#005EB8]' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.id === 'queue' && stats.waiting > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold animate-pulse">{stats.waiting}</span>
                  )}
                  {tab.id === 'pharmacy' && stats.pendingPrescriptions > 0 && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">{stats.pendingPrescriptions}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Stats Summary Widget */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 relative overflow-hidden shadow-md">
            <div className="absolute right-0 bottom-0 w-24 h-24 bg-[#00A3AD]/25 rounded-full blur-xl pointer-events-none" />
            <h4 className="text-xs font-black tracking-widest text-[#00A3AD] uppercase">Live Wait Metrics</h4>
            <div className="text-3xl font-black text-white mt-2">
              {stats.waiting * 12} <span className="text-xs text-slate-300 font-bold">mins</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Average wait ratio calculated from {stats.waiting} queue nodes.</p>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800 text-[10px] text-[#00A3AD] font-bold uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5 animate-pulse text-[#00A3AD]" />
              Hospital Intake: {stats.totalToday} total
            </div>
          </div>
        </div>

        {/* ── Main Operations Feed Pane ── */}
        <div className="lg:col-span-3 space-y-6">

          {/* ── ALERT BOXES: Smart Insights Center ── */}
          {(cardiologyOverloaded || noOnlineDoctors || waitTimeSpike || emergencyMode) && (
            <div className="bg-red-50 border border-red-200 rounded-3xl p-4 space-y-2.5 animate-pulse">
              <div className="flex items-center gap-2 text-red-800 font-extrabold text-sm">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <span>Hospital Operations Security Alerts</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-red-700 font-medium">
                {emergencyMode && (
                  <div className="flex items-center gap-2 bg-red-100/50 p-2 rounded-xl">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                    <span><strong>CRITICAL CODE:</strong> Global Emergency mode toggled across databases.</span>
                  </div>
                )}
                {cardiologyOverloaded && (
                  <div className="flex items-center gap-2 bg-red-100/50 p-2 rounded-xl">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                    <span><strong>DEPARTMENT OVERLOAD:</strong> Cardiology waiting list exceeds active thresholds.</span>
                  </div>
                )}
                {noOnlineDoctors && (
                  <div className="flex items-center gap-2 bg-red-100/50 p-2 rounded-xl">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                    <span><strong>DOCTOR SHORTAGE:</strong> No practitioners are reported available online.</span>
                  </div>
                )}
                {waitTimeSpike && (
                  <div className="flex items-center gap-2 bg-red-100/50 p-2 rounded-xl">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                    <span><strong>WAIT TIME SPIKE:</strong> High waiting index detected ({stats.waiting * 12} mins wait).</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-600 rounded-2xl px-4 py-3 text-sm font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              1. TAB: Operations Overview
          ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Status Bar Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Total Intake', value: stats.totalToday, icon: TrendingUp, desc: "Total patient tickets", color: 'bg-white border-slate-100 text-slate-800' },
                  { label: 'Waiting', value: stats.waiting, icon: Clock, desc: "Pending doctor call", color: 'bg-white border-slate-100 text-yellow-600' },
                  { label: 'Active Serving', value: stats.serving, icon: Activity, desc: "Consultation in room", color: 'bg-white border-slate-100 text-emerald-600 font-bold' },
                  { label: 'Consulted', value: stats.done, icon: CheckCircle2, desc: "Completed today", color: 'bg-white border-slate-100 text-slate-500' },
                  { label: 'No-Shows', value: stats.noShow, icon: AlertCircle, desc: "Missed tickets", color: 'bg-white border-slate-100 text-red-600' },
                ].map(metric => {
                  const Icon = metric.icon;
                  return (
                    <div key={metric.label} className={`bg-white rounded-2xl p-4 border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[100px]`}>
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[10px] font-bold uppercase tracking-wider">{metric.label}</span>
                        <Icon className="w-4 h-4 opacity-75" />
                      </div>
                      <div className="text-2xl font-black mt-2">{metric.value}</div>
                      <p className="text-[9px] text-slate-400 mt-1">{metric.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic Doctor Panel */}
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                      <Stethoscope className="w-4 h-4 text-[#005EB8]" />
                      Practitioner Roster Status
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Click to toggle availabilities dynamically on the displays.</p>
                  </div>
                  <button onClick={() => setShowAddDoctor(true)} className="flex items-center gap-1 bg-[#005EB8]/10 text-[#005EB8] hover:bg-[#005EB8]/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-all">
                    <PlusCircle className="w-3.5 h-3.5" />
                    Register Doctor
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {doctors.length === 0 ? (
                    <p className="text-slate-400 text-xs py-4 text-center col-span-2">No practitioners onboarded on this SaaS node.</p>
                  ) : (
                    doctors.map(doc => {
                      const activeTokens = tokens.filter(t => t.doctor_name === doc.name && (t.status === 'WAITING' || t.status === 'SERVING')).length;
                      return (
                        <div key={doc.id} className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 flex items-center justify-between hover:bg-slate-50 transition-all">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${doc.is_available ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                              {doc.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-800 text-sm">{doc.name}</h4>
                              <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{doc.department} Department • Room {doc.room_number || 'TBA'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                {activeTokens} Queue
                              </span>
                            </div>
                            <button
                              onClick={() => handleToggleDoctor(doc.id, doc.is_available, doc.name)}
                              className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl transition-all border ${doc.is_available ? 'bg-emerald-500/10 text-emerald-600 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'}`}
                            >
                              {doc.is_available ? 'ONLINE' : 'OFFLINE'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Department Performance Monitoring */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Live Department Metrics */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
                  <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide mb-4">
                    <Layers className="w-4 h-4 text-[#005EB8]" />
                    Department Traffic Loading
                  </h3>
                  <div className="space-y-3.5">
                    {['general', 'cardiology', 'orthopedics', 'pediatrics', 'neurology'].map(dept => {
                      const count = tokens.filter(t => t.department === dept).length;
                      const activePct = stats.totalToday > 0 ? (count / stats.totalToday) * 100 : 0;
                      return (
                        <div key={dept} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="capitalize font-bold text-slate-600">{dept}</span>
                            <span className="font-bold text-slate-700">{count} Active</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-[#005EB8] h-2 rounded-full transition-all" style={{ width: `${activePct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Real-time Activity Logs */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between min-h-[300px]">
                  <div>
                    <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide mb-4">
                      <Sparkles className="w-4 h-4 text-[#00A3AD]" />
                      Real-time Operations Stream
                    </h3>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto">
                      {activityLogs.length === 0 ? (
                        <p className="text-slate-400 text-xs py-4 text-center">No operation logged on this SaaS node.</p>
                      ) : (
                        activityLogs.slice(0, 6).map(log => (
                          <div key={log.id} className="flex items-start gap-2.5 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl">
                            <span className={`w-2.5 h-2.5 rounded-full mt-1 ${log.badge_color || 'bg-slate-400'}`} />
                            <div className="flex-1">
                              <p className="font-medium text-slate-700">{log.message}</p>
                              <span className="text-[9px] text-slate-400">{new Date(log.created_at).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              2. TAB: Real-Time Queues
          ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'queue' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                    <Clock className="w-4 h-4 text-[#005EB8]" />
                    Central Tokens Ledger
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Manage priorities, serving rooms, and live status states.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select 
                    value={statusFilter} 
                    onChange={e => setStatusFilter(e.target.value)} 
                    className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="WAITING">Waiting</option>
                    <option value="SERVING">Serving</option>
                    <option value="DONE">Done</option>
                    <option value="NO_SHOW">No Show</option>
                  </select>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text" 
                      value={globalSearch} 
                      onChange={e => setGlobalSearch(e.target.value)} 
                      placeholder="Search tickets..." 
                      className="pl-8 pr-4 py-1.5 text-xs border border-slate-200 rounded-xl focus:border-[#005EB8] focus:outline-none w-44 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {filteredTokens.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">No tokens match your current filter parameters.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="pb-3 pl-2">Token #</th>
                        <th className="pb-3">Patient info</th>
                        <th className="pb-3">Department</th>
                        <th className="pb-3">Triage</th>
                        <th className="pb-3">Room</th>
                        <th className="pb-3">Attendant</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 pr-2 text-right">Operational Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredTokens.map(token => (
                        <tr key={token.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 pl-2 font-black text-[#005EB8] text-sm">#{token.token_number}</td>
                          <td className="py-3.5">
                            <button onClick={() => token.patients?.id && handleOpenPatientHistory(token.patients.id)} className="font-bold text-slate-800 hover:text-[#005EB8] hover:underline text-left">
                              {token.patients?.name || '—'}
                            </button>
                            <div className="text-[10px] text-slate-400 mt-0.5">{token.phone} {token.patients?.age ? `• Age ${token.patients.age}` : ''}</div>
                          </td>
                          <td className="py-3.5 capitalize font-medium text-slate-500">{token.department || 'general'}</td>
                          <td className="py-3.5">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${PRIORITY_COLOR[token.priority]}`}>
                              {PRIORITY_LABEL[token.priority]}
                            </span>
                          </td>
                          <td className="py-3.5 font-bold text-slate-800">{token.room_number || 'Room 3'}</td>
                          <td className="py-3.5 font-semibold text-slate-600">{token.doctor_name || 'Dr. Abhishek'}</td>
                          <td className="py-3.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${STATUS_COLOR[token.status]}`}>
                              {token.status}
                            </span>
                          </td>
                          <td className="py-3.5 pr-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {token.status === 'WAITING' && (
                                <button onClick={() => handleUpdateToken(token.id, 'SERVING')} className="bg-emerald-500 text-white hover:bg-emerald-600 px-2.5 py-1 rounded-lg font-bold text-[10px] transition-colors">
                                  Call Token
                                </button>
                              )}
                              {token.status === 'SERVING' && (
                                <>
                                  <button onClick={() => handleUpdateToken(token.id, 'DONE')} className="bg-[#005EB8] text-white hover:bg-[#004a96] px-2.5 py-1 rounded-lg font-bold text-[10px] transition-colors">
                                    Mark Done
                                  </button>
                                  <button onClick={() => handleUpdateToken(token.id, 'NO_SHOW')} className="bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 rounded-lg font-bold text-[10px] transition-colors">
                                    No Show
                                  </button>
                                </>
                              )}
                              {(token.status === 'DONE' || token.status === 'NO_SHOW') && (
                                <span className="text-[10px] text-slate-400 font-bold">Processed</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              3. TAB: Doctor Availability
          ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'doctors' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                    <Stethoscope className="w-4 h-4 text-[#005EB8]" />
                    Practitioners Directory
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Toggle live status, rooms, and roster capacities.</p>
                </div>
                <button onClick={() => setShowAddDoctor(true)} className="flex items-center gap-1 bg-[#005EB8] text-white hover:bg-[#004a96] px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md">
                  <PlusCircle className="w-4 h-4" />
                  Add Doctor
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {doctors.map(doc => {
                  const activeTokens = tokens.filter(t => t.doctor_name === doc.name && (t.status === 'WAITING' || t.status === 'SERVING')).length;
                  return (
                    <div key={doc.id} className="border border-slate-100 bg-slate-50/20 rounded-2xl p-4 flex flex-col justify-between min-h-[120px] hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm">{doc.name}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{doc.specialty || doc.department} • Room {doc.room_number}</p>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${doc.is_available ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                          {doc.is_available ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100/50">
                        <span className="text-xs text-slate-500 font-semibold">Active queue: <strong>{activeTokens}</strong> waiting</span>
                        <button
                          onClick={() => handleToggleDoctor(doc.id, doc.is_available, doc.name)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${doc.is_available ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`}
                        >
                          {doc.is_available ? 'Set Offline' : 'Set Online'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              4. TAB: Staff Directory
          ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'staff' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                    <Users className="w-4 h-4 text-[#005EB8]" />
                    Staff Operators Ledger
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Manage ward boys, pharmacy desk staff, and roles.</p>
                </div>
                <button onClick={() => setShowAddStaff(true)} className="flex items-center gap-1 bg-[#005EB8] text-white hover:bg-[#004a96] px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md">
                  <PlusCircle className="w-4 h-4" />
                  Add Staff
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="pb-3 pl-2">Name</th>
                      <th className="pb-3">Email</th>
                      <th className="pb-3">Role</th>
                      <th className="pb-3">Department</th>
                      <th className="pb-3">Room Assignment</th>
                      <th className="pb-3">Account Status</th>
                      <th className="pb-3 pr-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {staffUsers.map(staff => (
                      <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 pl-2 font-bold text-slate-800">{staff.name}</td>
                        <td className="py-3.5 text-slate-500">{staff.email}</td>
                        <td className="py-3.5 text-slate-600 font-semibold">{staff.role}</td>
                        <td className="py-3.5 capitalize text-slate-500">{staff.department || '—'}</td>
                        <td className="py-3.5 font-bold text-slate-800">{staff.room_number || '—'}</td>
                        <td className="py-3.5">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${staff.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {staff.is_active ? 'ACTIVE' : 'SUSPENDED'}
                          </span>
                        </td>
                        <td className="py-3.5 pr-2 text-right">
                          <button
                            onClick={() => handleToggleStaffActive(staff.id, staff.is_active, staff.name)}
                            className={`text-[10px] font-black px-2.5 py-1 rounded-lg border transition-all ${staff.is_active ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'}`}
                          >
                            {staff.is_active ? 'SUSPEND' : 'ACTIVATE'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              5. TAB: Patient Records & Visits
          ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'patients' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div>
                <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-100 pb-4">
                  <Eye className="w-4 h-4 text-[#005EB8]" />
                  Patient Visit Archive
                </h3>
                <p className="text-xs text-slate-400 mt-2">Enter patient ID or phone number to look up historical symptoms, vitals, prescriptions, and diagnostics notes.</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={globalSearch} 
                  onChange={e => {
                    setGlobalSearch(e.target.value);
                    // If patient matches, load their history
                    const found = tokens.find(t => t.patients?.name?.toLowerCase().includes(e.target.value.toLowerCase()) || t.phone === e.target.value);
                    if (found && found.patients?.id) {
                      handleOpenPatientHistory(found.patients.id);
                    }
                  }} 
                  placeholder="Type returning patient name or phone to trigger diagnostics search..." 
                  className="pl-9 pr-4 py-3 border border-slate-200 rounded-2xl focus:border-[#005EB8] focus:outline-none w-full text-xs font-semibold"
                />
              </div>

              {selectedPatientId ? (
                <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm">Active Diagnostic Ledger</h4>
                      <p className="text-[10px] text-slate-400">UUID: {selectedPatientId}</p>
                    </div>
                    <button onClick={() => setSelectedPatientId(null)} className="text-xs text-slate-400 hover:text-slate-600 font-semibold">Clear Search</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="text-xs font-bold text-[#005EB8] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Vital Measurements History
                      </h5>
                      <div className="space-y-2">
                        {selectedPatientVitals.length === 0 ? (
                          <p className="text-slate-400 text-xs py-2">No historical vitals found.</p>
                        ) : (
                          selectedPatientVitals.map(v => (
                            <div key={v.id} className="bg-white p-3 rounded-xl border border-slate-100 text-xs">
                              <div className="flex items-center justify-between font-bold text-slate-700">
                                <span>Intake Date: {new Date(v.created_at).toLocaleDateString()}</span>
                                <span className="text-slate-400 font-normal">{new Date(v.created_at).toLocaleTimeString()}</span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 mt-2 font-semibold text-slate-600">
                                <span className="bg-slate-100 px-2 py-0.5 rounded">BP: {v.bp || '120/80'}</span>
                                <span className="bg-slate-100 px-2 py-0.5 rounded">Sugar: {v.sugar || 'Normal'}</span>
                                <span className="bg-slate-100 px-2 py-0.5 rounded">Temp: {v.temperature || '98.6'}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-2">Symptoms: {v.symptoms || 'General Checkup'}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-xs font-bold text-[#005EB8] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5" /> Doctor Consultations History
                      </h5>
                      <div className="space-y-2">
                        {selectedPatientHistory.length === 0 ? (
                          <p className="text-slate-400 text-xs py-2">No historical consultations found.</p>
                        ) : (
                          selectedPatientHistory.map(h => (
                            <div key={h.id} className="bg-white p-3 rounded-xl border border-slate-100 text-xs">
                              <div className="flex items-center justify-between font-bold text-slate-700">
                                <span>Consultation Date: {new Date(h.created_at).toLocaleDateString()}</span>
                              </div>
                              <p className="text-[10px] font-semibold text-slate-600 mt-2">Vitals check: BP {h.bp}, Sugar {h.sugar}</p>
                              <p className="text-[10px] text-[#00A3AD] font-bold mt-1">Doctor Diagnoses Notes: {h.doctor_notes || 'Patient was diagnosed with standard viral symptoms. Rest advised.'}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">Search and click a patient above to load history records.</div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              6. TAB: Appointments Scheduling
          ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'appointments' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-100 pb-4">
                <Calendar className="w-4 h-4 text-[#005EB8]" />
                Upcoming Hospital Appointments
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="pb-3 pl-2">Patient</th>
                      <th className="pb-3">Phone</th>
                      <th className="pb-3">Department</th>
                      <th className="pb-3">Appointment Date</th>
                      <th className="pb-3">Time Slot</th>
                      <th className="pb-3">Fee</th>
                      <th className="pb-3 pr-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {appointments.length === 0 ? (
                      <tr><td colSpan={7} className="py-8 text-center text-slate-400">No appointments scheduled on this hospital node.</td></tr>
                    ) : (
                      appointments.map(app => (
                        <tr key={app.id}>
                          <td className="py-3.5 pl-2 font-bold text-slate-800">{app.patient_name}</td>
                          <td className="py-3.5 text-slate-500">{app.phone}</td>
                          <td className="py-3.5 capitalize text-slate-500">{app.department}</td>
                          <td className="py-3.5">{new Date(app.appointment_date).toLocaleDateString()}</td>
                          <td className="py-3.5 font-bold text-[#005EB8]">{app.time_slot}</td>
                          <td className="py-3.5 font-bold text-slate-700">₹{app.consultation_fee}</td>
                          <td className="py-3.5 pr-2 text-right">
                            <span className="text-[10px] font-black px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                              {app.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              7. TAB: Pharmacy Station
          ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'pharmacy' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                    <Package className="w-4 h-4 text-[#005EB8]" />
                    Pharmacy Dispatch Desk
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Manage medications, stock alerts, and prescription queues.</p>
                </div>
                <span className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-xl font-bold animate-pulse">
                  ⚠️ Low Stock Medicine Alert
                </span>
              </div>

              {/* Low stock alert box */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-xs font-semibold grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase">Item Name</p>
                  <p className="text-sm font-bold text-slate-800">Paracetamol 500mg</p>
                  <span className="text-red-500 font-bold">12 Tabs remaining</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase">Item Name</p>
                  <p className="text-sm font-bold text-slate-800">Amoxicillin 250mg</p>
                  <span className="text-red-500 font-bold">8 Bottles remaining</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase">Item Name</p>
                  <p className="text-sm font-bold text-slate-800">Cetirizine 10mg</p>
                  <span className="text-amber-500 font-bold">45 Tabs remaining</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="pb-3 pl-2">Patient</th>
                      <th className="pb-3">Diagnosis</th>
                      <th className="pb-3">Medications List</th>
                      <th className="pb-3">Dispensed Status</th>
                      <th className="pb-3 pr-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {prescriptions.length === 0 ? (
                      <tr><td colSpan={5} className="py-8 text-center text-slate-400">No prescriptions queued.</td></tr>
                    ) : (
                      prescriptions.map(rx => (
                        <tr key={rx.id}>
                          <td className="py-3.5 pl-2 font-bold text-slate-800">{rx.patients?.name || '—'}</td>
                          <td className="py-3.5 text-slate-500">{rx.diagnosis}</td>
                          <td className="py-3.5 font-bold text-slate-700 max-w-xs truncate">
                            {JSON.stringify(rx.medications) || 'General meds'}
                          </td>
                          <td className="py-3.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${rx.status === 'DISPENSED' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {rx.status}
                            </span>
                          </td>
                          <td className="py-3.5 pr-2 text-right">
                            {rx.status !== 'DISPENSED' && (
                              <button 
                                onClick={async () => {
                                  await supabase.from('prescriptions').update({ status: 'DISPENSED' }).eq('id', rx.id);
                                  setSuccess('Medication successfully dispensed!');
                                  logLocalActivity(`Pharmacy desk dispensed medications for patient.`, 'pharmacy', 'bg-emerald-600');
                                  fetchData(true);
                                }}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-bold text-[10px] transition-colors"
                              >
                                Dispense Meds
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              8. TAB: Visual Analytics
          ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'analytics' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                    <TrendingUp className="w-4 h-4 text-[#005EB8]" />
                    SaaS Operations Visual Analytics
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Live metrics graphs representing peak intake traffic.</p>
                </div>
                <button onClick={handleExportCSV} className="flex items-center gap-1 bg-[#005EB8]/10 text-[#005EB8] hover:bg-[#005EB8]/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-all">
                  <FileSpreadsheet className="w-4 h-4" />
                  Download CSV
                </button>
              </div>

              {/* Custom SVG Charts Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs">
                  <h4 className="font-extrabold text-slate-700 mb-2">Hourly Intake Load Pattern</h4>
                  {/* SVG Bar Chart */}
                  <svg viewBox="0 0 200 100" className="w-full h-32 text-[#005EB8]">
                    <rect x="10" y="30" width="15" height="70" fill="currentColor" rx="2" />
                    <rect x="35" y="10" width="15" height="90" fill="currentColor" rx="2" />
                    <rect x="60" y="20" width="15" height="80" fill="currentColor" rx="2" />
                    <rect x="85" y="40" width="15" height="60" fill="currentColor" rx="2" />
                    <rect x="110" y="15" width="15" height="85" fill="currentColor" rx="2" />
                    <rect x="135" y="5" width="15" height="95" fill="currentColor" rx="2" />
                    <rect x="160" y="50" width="15" height="50" fill="currentColor" rx="2" />
                  </svg>
                  <div className="flex justify-between text-[8px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                    <span>9:00 AM</span>
                    <span>12:00 PM</span>
                    <span>3:00 PM</span>
                    <span>6:00 PM</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs">
                  <h4 className="font-extrabold text-slate-700 mb-2">Average Triage Waiting Curve</h4>
                  {/* SVG Area Chart */}
                  <svg viewBox="0 0 200 100" className="w-full h-32 text-[#00A3AD]">
                    <path d="M 0 100 Q 40 30, 80 80 T 160 10 T 200 100 Z" fill="rgba(0, 163, 173, 0.15)" stroke="currentColor" strokeWidth="2" />
                  </svg>
                  <div className="flex justify-between text-[8px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                    <span>Monday</span>
                    <span>Wednesday</span>
                    <span>Friday</span>
                    <span>Sunday</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────────
              9. TAB: System Diagnostics
          ───────────────────────────────────────────────────────────────── */}
          {activeTab === 'system' && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
              <h3 className="text-sm font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wide border-b border-slate-100 pb-4">
                <HardDrive className="w-4 h-4 text-[#005EB8]" />
                Infrastructure Telemetry
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
                  <Database className="w-10 h-10 text-[#005EB8]" />
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">PostgreSQL Engine</h4>
                    <p className="text-xs text-slate-500">Latency: <strong>{dbLatency !== null ? `${dbLatency}ms` : 'Offline'}</strong></p>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full mt-1.5 inline-block ${dbLatency !== null ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {dbLatency !== null ? 'Online' : 'Disconnected'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
                  <Server className="w-10 h-10 text-[#00A3AD]" />
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">Express API Core</h4>
                    <p className="text-xs text-slate-500">Latency: <strong>{apiLatency !== null ? `${apiLatency}ms` : 'Offline'}</strong></p>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full mt-1.5 inline-block ${apiLatency !== null ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {apiLatency !== null ? 'Healthy' : 'Error'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
                  <Network className="w-10 h-10 text-[#005EB8]" />
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">SMS OTP gateway status</h4>
                    <p className="text-xs text-slate-500">Status: <strong>{otpGatewayOnline ? 'ONLINE' : 'OFFLINE'}</strong></p>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full mt-1.5 inline-block ${otpGatewayOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800 animate-pulse'}`}>
                      {otpGatewayOnline ? 'Gateway Connected' : 'Offline'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
                  <Volume2 className="w-10 h-10 text-[#00A3AD]" />
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">Display Board connectivity</h4>
                    <p className="text-xs text-slate-500">Node Sync: <strong>ONLINE</strong></p>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black uppercase px-2 py-0.5 rounded-full mt-1.5 inline-block">
                      Synchronized
                    </span>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          MODALS & FORM DRAWERS
      ───────────────────────────────────────────────────────────────── */}
      
      {/* Onboard Doctor Modal */}
      {showAddDoctor && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl relative">
            <button onClick={() => setShowAddDoctor(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-4">
              <Stethoscope className="w-5 h-5 text-[#005EB8]" />
              Register Doctor
            </h3>
            <form onSubmit={handleAddDoctorSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Doctor Name</label>
                <input type="text" value={doctorForm.name} onChange={e => setDoctorForm({...doctorForm, name: e.target.value})} placeholder="Dr. John Doe" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Specialty</label>
                <input type="text" value={doctorForm.specialty} onChange={e => setDoctorForm({...doctorForm, specialty: e.target.value})} placeholder="Cardiologist" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Department</label>
                  <select value={doctorForm.department} onChange={e => setDoctorForm({...doctorForm, department: e.target.value as any})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                    <option value="general">General</option>
                    <option value="cardiology">Cardiology</option>
                    <option value="orthopedics">Orthopedics</option>
                    <option value="pediatrics">Pediatrics</option>
                    <option value="neurology">Neurology</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Room Number</label>
                  <input type="text" value={doctorForm.room_number} onChange={e => setDoctorForm({...doctorForm, room_number: e.target.value})} placeholder="Room 4" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Email Address</label>
                <input type="email" value={doctorForm.email} onChange={e => setDoctorForm({...doctorForm, email: e.target.value})} placeholder="doctor@medqueue.com" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Access Password</label>
                <input type="password" value={doctorForm.password} onChange={e => setDoctorForm({...doctorForm, password: e.target.value})} placeholder="••••••••" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
              </div>
              <button type="submit" className="w-full min-h-[44px] bg-[#005EB8] hover:bg-[#004a96] text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/20 transition-all">
                Onboard Practitioner
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Onboard Staff Modal */}
      {showAddStaff && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl relative">
            <button onClick={() => setShowAddStaff(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-[#005EB8]" />
              Register Staff Member
            </h3>
            <form onSubmit={handleAddStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Staff Name</label>
                <input type="text" value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} placeholder="Alice Smith" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Email Address</label>
                <input type="email" value={staffForm.email} onChange={e => setStaffForm({...staffForm, email: e.target.value})} placeholder="staff@medqueue.com" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Role</label>
                  <select value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                    <option value="WARD_BOY">Ward Boy</option>
                    <option value="PHARMACY">Pharmacy Staff</option>
                    <option value="ADMIN">Admin Assistant</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Department</label>
                  <select value={staffForm.department} onChange={e => setStaffForm({...staffForm, department: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                    <option value="general">General</option>
                    <option value="cardiology">Cardiology</option>
                    <option value="orthopedics">Orthopedics</option>
                    <option value="pediatrics">Pediatrics</option>
                    <option value="pharmacy">Pharmacy</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Room Assignment (Optional)</label>
                <input type="text" value={staffForm.room_number} onChange={e => setStaffForm({...staffForm, room_number: e.target.value})} placeholder="Room 5" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Access Password</label>
                <input type="password" value={staffForm.password} onChange={e => setStaffForm({...staffForm, password: e.target.value})} placeholder="••••••••" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none" required />
              </div>
              <button type="submit" className="w-full min-h-[44px] bg-[#005EB8] hover:bg-[#004a96] text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/20 transition-all">
                Onboard Operator
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Emergency Patient Modal */}
      {showEmergencyPatient && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl relative animate-fadeIn">
            <button onClick={() => setShowEmergencyPatient(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-red-600 uppercase tracking-tight flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
              Register Emergency Patient
            </h3>
            <p className="text-xs text-slate-400 mb-4">Onboards patients with Priority 0, queuing them directly above standard tickets.</p>
            <form onSubmit={handleEmergencySubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Patient Name</label>
                <input type="text" value={emergencyForm.name} onChange={e => setEmergencyForm({...emergencyForm, name: e.target.value})} placeholder="Emergency Case" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-red-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Phone Number (Required)</label>
                <input type="tel" value={emergencyForm.phone} onChange={e => setEmergencyForm({...emergencyForm, phone: e.target.value})} placeholder="9999988888" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-red-500 outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Age</label>
                  <input type="number" value={emergencyForm.age} onChange={e => setEmergencyForm({...emergencyForm, age: e.target.value})} placeholder="45" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-red-500 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Triage Department</label>
                  <select value={emergencyForm.department} onChange={e => setEmergencyForm({...emergencyForm, department: e.target.value as any})} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                    <option value="general">Emergency Intake</option>
                    <option value="cardiology">Cardiology</option>
                    <option value="orthopedics">Orthopedics</option>
                    <option value="pediatrics">Pediatrics</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Intake Details / Notes</label>
                <input type="text" value={emergencyForm.address} onChange={e => setEmergencyForm({...emergencyForm, address: e.target.value})} placeholder="Trauma unit routing required" className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-red-500 outline-none" />
              </div>
              <button type="submit" className="w-full min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-900/20 transition-all uppercase tracking-wider">
                Generate Emergency Token
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Voice Broadcast Announcement Modal */}
      {showAnnouncement && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl relative">
            <button onClick={() => setShowAnnouncement(false)} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 mb-4">
              <Volume2 className="w-5 h-5 text-[#005EB8]" />
              Voice Announcement
            </h3>
            <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Message Text</label>
                <textarea value={announcementMsg} onChange={e => setAnnouncementMsg(e.target.value)} placeholder="Please announce: Token #124 proceed to Cardiology Room 2..." className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none min-h-[80px]" required />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Display Priority</label>
                <select value={announcementSeverity} onChange={e => setAnnouncementSeverity(e.target.value)} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                  <option value="info">Info (Blue border)</option>
                  <option value="warning">Urgent Announcement (Amber alert)</option>
                  <option value="critical">Critical Alarm (Flashing Red)</option>
                </select>
              </div>
              <button type="submit" className="w-full min-h-[44px] bg-[#005EB8] hover:bg-[#004a96] text-white font-bold text-xs rounded-xl shadow-lg transition-all">
                Dispatch Announcement
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
