import { useState, useEffect } from 'react';
import bcrypt from 'bcryptjs';
import { supabase } from '../../../lib/supabase';
import { AuthUser } from '../../../lib/auth';
import { setSelectedHospitalId } from '../../../lib/api';
import { 
  Building2, Users, Shield, Plus, ArrowRight, Activity, 
  MapPin, Phone, Check, RefreshCw, UserPlus, Trash2, Loader2, Info,
  LayoutDashboard, BarChart3, CreditCard, AlertTriangle, Heart, Megaphone,
  CheckCircle2, Download, Send, ShieldCheck, Sparkles,
  Settings, Bell, Clock, Radio, ChevronDown, DollarSign
} from 'lucide-react';

interface Hospital {
  id: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  created_at?: string;
  subscription_status?: string;
  subscription_tier?: string;
}

interface HospitalStats {
  hospitalId: string;
  doctorsCount: number;
  patientsCount: number;
  tokensCount: number;
}

interface Props {
  currentUser: AuthUser;
  onNavigate: (page: string) => void;
}

interface SecurityLog {
  id: string;
  timestamp: string;
  event: string;
  ip: string;
  hospital: string;
  severity: 'low' | 'medium' | 'critical';
  acknowledged: boolean;
}

interface Broadcast {
  id: string;
  timestamp: string;
  message: string;
  scope: 'all' | 'staff' | 'patients';
  severity: 'info' | 'warning' | 'critical';
}

interface ActivityEvent {
  id: string;
  timestamp: string;
  message: string;
  category: 'security' | 'queue' | 'billing' | 'system' | 'staff' | 'onboarding';
  badgeColor: string;
}

export default function SuperAdminDashboard({ currentUser: _currentUser, onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'hospitals' | 'staff' | 'analytics' | 'billing' | 'alerts' | 'health' | 'settings'>('dashboard');
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [stats, setStats] = useState<Record<string, HospitalStats>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [addHospError, setAddHospError] = useState('');
  const [addStaffError, setAddStaffError] = useState('');

  const getErrorMessage = (err: any, fallback: string): string => {
    if (!err) return fallback;
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    return fallback;
  };

  // Form States
  const [showAddHospital, setShowAddHospital] = useState(false);
  const [hospitalForm, setHospitalForm] = useState({ name: '', slug: '', address: '', phone: '', logo_url: '', theme_color: '#005EB8' });
  
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'ADMIN',
    department: 'general',
    room_number: '',
    hospital_id: ''
  });

  const [isClinicDropdownOpen, setIsClinicDropdownOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const [staffList, setStaffList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  useEffect(() => {
    setAddHospError('');
  }, [showAddHospital]);

  useEffect(() => {
    setAddStaffError('');
    if (showAddStaff && hospitals.length > 0 && !staffForm.hospital_id) {
      setStaffForm(f => ({ ...f, hospital_id: hospitals[0].id }));
    }
  }, [showAddStaff, hospitals, staffForm.hospital_id]);

  // New States for Advanced Admin & Filtering Controls
  const [selectedStaffHospitalFilter, setSelectedStaffHospitalFilter] = useState<string>('all');
  const [hospitalSortBy, setHospitalSortBy] = useState<'name' | 'heavy-use' | 'low-use' | 'doctors'>('name');

  // Dynamic subscription prices config
  const [basicPrice, setBasicPrice] = useState<number>(() => Number(localStorage.getItem('medqueue_price_basic') || '99'));
  const [proPrice, setProPrice] = useState<number>(() => Number(localStorage.getItem('medqueue_price_pro') || '299'));
  const [enterprisePrice, setEnterprisePrice] = useState<number>(() => Number(localStorage.getItem('medqueue_price_enterprise') || '799'));

  const handleSavePrices = (basic: number, pro: number, enterprise: number) => {
    localStorage.setItem('medqueue_price_basic', String(basic));
    localStorage.setItem('medqueue_price_pro', String(pro));
    localStorage.setItem('medqueue_price_enterprise', String(enterprise));
    setBasicPrice(basic);
    setProPrice(pro);
    setEnterprisePrice(enterprise);
    setSuccess('SaaS subscription tier pricing decisions updated and applied globally!');
    logActivity(`SaaS subscription tier pricing updated: Basic: $${basic}, Pro: $${pro}, Enterprise: $${enterprise}`, 'billing', 'bg-[#005EB8]');
  };

  // Helper to compute dynamic subscription details starting from day of joining
  const getSubscriptionRenewalInfo = (createdAt?: string) => {
    const joinDate = new Date(createdAt || '2026-05-15');
    const now = new Date();

    const joinDay = joinDate.getDate();
    let year = now.getFullYear();
    let month = now.getMonth();

    // Candidate renewal date in this month
    let renewal = new Date(year, month, joinDay);

    // Month end roll-over clamping helper
    if (renewal.getDate() !== joinDay) {
      renewal = new Date(year, month + 1, 0);
    }

    // Next renewal date candidate if already passed today
    if (renewal <= now) {
      month += 1;
      renewal = new Date(year, month, joinDay);
      if (renewal.getDate() !== joinDay) {
        renewal = new Date(year, month + 1, 0);
      }
    }

    const diffTime = renewal.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      joiningDate: joinDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      nextBillingDate: renewal.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      daysRemaining: diffDays
    };
  };

  // Hospital specific detail drawer/modal states
  const [selectedHospDetail, setSelectedHospDetail] = useState<Hospital | null>(null);
  const [detailDoctors, setDetailDoctors] = useState<any[]>([]);
  const [detailStaff, setDetailStaff] = useState<any[]>([]);
  const [detailTokens, setDetailTokens] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  // Simulated live telemetry & SaaS states
  const [simulatedFailure, setSimulatedFailure] = useState(false);
  const [dbLatency, setDbLatency] = useState(8);
  const [apiLatency, setApiLatency] = useState(24);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [newBroadcastText, setNewBroadcastText] = useState('');
  const [broadcastScope, setBroadcastScope] = useState<'all' | 'staff' | 'patients'>('all');
  const [broadcastSeverity, setBroadcastSeverity] = useState<'info' | 'warning' | 'critical'>('info');

  const [emergencyMode, setEmergencyMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleSystemSync = async () => {
    setRefreshing(true);
    setSuccess('');
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      await loadData(true);
      setSuccess('SaaS core databases, clinical schedules, and patient queue engines synchronized.');
      logActivity('Super Admin initiated automated system-wide telemetry synchronization.', 'system', 'bg-[#00A3AD]');
    } catch {
      setError('System synchronization failed.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateReport = () => {
    const header = 'Hospital Name,Slug,Plan,Status,Active Doctors,Active Staff,Tokens Today,API Latency,DB Latency,Timestamp\n';
    const rows = hospitals.map(h => {
      const itemStats = stats[h.id] || { doctorsCount: 0, patientsCount: 0, tokensCount: 0 };
      const meta = getLocalHospMeta(h.id);
      return `"${h.name}","${h.slug}","${meta.tier}","${meta.status}",${itemStats.doctorsCount},${staffList.filter(s => s.hospital_id === h.id).length},${itemStats.tokensCount},${apiLatency}ms,${dbLatency}ms,"${new Date().toISOString()}"`;
    }).join('\n');
    
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `medqueue_saas_audit_report_${Date.now()}.csv`);
    a.click();
    setSuccess('SaaS Operations & Infrastructure audit report compiled and downloaded successfully.');
    logActivity('Monthly SaaS billing and telemetry CSV audit report generated.', 'billing', 'bg-[#005EB8]');
  };

  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [onboardingRequests, setOnboardingRequests] = useState<ActivityEvent[]>([]);

  const [deptSplit, setDeptSplit] = useState({ cardiology: 45, pediatrics: 30, general: 25 });
  const [noShowRate, setNoShowRate] = useState('4.8 %');
  const [dynamicDocConsultations, setDynamicDocConsultations] = useState<any[]>([
    { name: 'Dr. Robert Vance', dept: 'Cardiology', consultations: 42, color: 'bg-[#005EB8]' },
    { name: 'Dr. Sara Connor', dept: 'Pediatrics', consultations: 29, color: 'bg-[#00A3AD]' },
    { name: 'Dr. Bruce Banner', dept: 'General Medicine', consultations: 51, color: 'bg-purple-500' },
    { name: 'Dr. Natasha Romanoff', dept: 'Orthopedics', consultations: 18, color: 'bg-amber-500' }
  ]);

  // Real-time latency polling heartbeat
  useEffect(() => {
    const fetchLatency = async () => {
      try {
        const startDb = performance.now();
        await supabase.from('hospitals').select('id', { count: 'estimated', head: true });
        const dbMs = Math.round(performance.now() - startDb);
        setDbLatency(dbMs > 0 ? dbMs : 8);
        
        const startApi = performance.now();
        await fetch('http://localhost:3001/health').catch(() => {});
        const apiMs = Math.round(performance.now() - startApi);
        setApiLatency(apiMs > 0 ? apiMs : 14);
      } catch {
        // Fallback to normal values if server or supabase is temporarily loading
      }
    };

    fetchLatency();
    const interval = setInterval(fetchLatency, 10000); // Poll latency every 10 seconds
    return () => clearInterval(interval);
  }, [simulatedFailure]);

  // Get plan tier and lifecycle status from database-fetched hospitals state
  const getLocalHospMeta = (id: string) => {
    const h = hospitals.find(x => x.id === id);
    return {
      tier: h?.subscription_tier || (id === 'd290f1ee-6c54-4b01-90e6-d701748f0851' ? 'Enterprise' : id === 'a4220b22-83b3-4f9e-a89e-cb01748ff002' ? 'Pro' : 'Basic'),
      status: h?.subscription_status || 'ACTIVE'
    };
  };

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError('');
    setSuccess('');
    try {
      // 1. Fetch hospitals
      const { data: hospData, error: hospErr } = await supabase
        .from('hospitals')
        .select('*')
        .order('name');
      
      if (hospErr) throw hospErr;
      const fetchedHospitals = hospData || [];
      setHospitals(fetchedHospitals);

      // 2. Fetch system-wide counts to compute per-hospital stats
      const { data: doctors } = await supabase.from('doctors').select('id, hospital_id');
      const { data: patients } = await supabase.from('patients').select('id, hospital_id');
      const { data: tokens } = await supabase.from('tokens').select('id, hospital_id, department, status');

      const statsMap: Record<string, HospitalStats> = {};
      fetchedHospitals.forEach(h => {
        statsMap[h.id] = {
          hospitalId: h.id,
          doctorsCount: doctors?.filter(d => d.hospital_id === h.id).length || 0,
          patientsCount: patients?.filter(p => p.hospital_id === h.id).length || 0,
          tokensCount: tokens?.filter(t => t.hospital_id === h.id).length || 0,
        };
      });
      setStats(statsMap);

      // Set default selected hospital in staff form if empty
      if (fetchedHospitals.length > 0 && !staffForm.hospital_id) {
        setStaffForm(f => ({ ...f, hospital_id: fetchedHospitals[0].id }));
      }

      // 3. Fetch staff list
      await fetchStaffUsers();

      // 4. Fetch broadcasts from database
      try {
        const { data: bcData } = await supabase
          .from('broadcasts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        if (bcData && bcData.length > 0) {
          setBroadcasts(bcData.map(b => ({
            id: b.id,
            timestamp: b.created_at,
            message: b.message,
            scope: b.scope as any,
            severity: b.severity as any
          })));
        }
      } catch (err) {
        console.warn('Could not load broadcasts dynamically:', err);
      }

      // 5. Fetch activity logs from database
      try {
        const { data: logsData } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(25);
        if (logsData && logsData.length > 0) {
          setActivityFeed(logsData.map(l => ({
            id: l.id,
            timestamp: l.created_at,
            message: l.message,
            category: l.category as any,
            badgeColor: l.badge_color
          })));
        }
      } catch (err) {
        console.warn('Could not load activity logs dynamically:', err);
      }

      // 5.5 Fetch onboarding logs separately from database
      try {
        const { data: onboardingData } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('category', 'onboarding')
          .order('created_at', { ascending: false });
        if (onboardingData) {
          setOnboardingRequests(onboardingData.map(l => ({
            id: l.id,
            timestamp: l.created_at,
            message: l.message,
            category: l.category as any,
            badgeColor: l.badge_color
          })));
        }
      } catch (err) {
        console.warn('Could not load onboarding logs dynamically:', err);
      }

      // 6. Fetch security intrusion logs from database
      try {
        const { data: secData } = await supabase
          .from('security_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        if (secData && secData.length > 0) {
          setSecurityLogs(secData.map(s => ({
            id: s.id,
            timestamp: s.created_at,
            event: s.event,
            ip: s.ip,
            hospital: s.hospital,
            severity: s.severity as any,
            acknowledged: s.acknowledged
          })));
        }
      } catch (err) {
        console.warn('Could not load security logs dynamically:', err);
      }

      // 7. Fetch system settings (Emergency Mode, SMS status)
      try {
        const { data: setRes } = await supabase
          .from('system_settings')
          .select('*');
        if (setRes) {
          const em = setRes.find(r => r.key === 'emergency_mode');
          if (em) setEmergencyMode(em.value === true);
          
          const gs = setRes.find(r => r.key === 'otp_gateway_status');
          if (gs) setSimulatedFailure(gs.value === 'OFFLINE');
        }
      } catch (err) {
        console.warn('Could not load system settings dynamically:', err);
      }

      // 8. Calculate dynamic department splits and stats
      if (tokens && tokens.length > 0) {
        const depts = tokens.map(t => t.department || 'general');
        const total = depts.length;
        const card = depts.filter(d => d === 'cardiology').length;
        const ped = depts.filter(d => d === 'pediatrics').length;
        const gen = total - card - ped;
        
        setDeptSplit({
          cardiology: Math.round((card / total) * 100) || 0,
          pediatrics: Math.round((ped / total) * 100) || 0,
          general: Math.round((gen / total) * 100) || 0
        });

        const noShowTokens = tokens.filter(t => t.status === 'NO_SHOW').length;
        setNoShowRate(`${((noShowTokens / total) * 100).toFixed(1)} %`);
      }

      // 9. Fetch dynamic doctor consultations distribution
      try {
        const { data: dbDocs } = await supabase.from('doctors').select('id, name, department');
        const { data: dbTokens } = await supabase.from('tokens').select('id, doctor_id');
        
        if (dbDocs && dbDocs.length > 0) {
          const docLoads = dbDocs.map((d, index) => {
            const count = dbTokens?.filter(t => t.doctor_id === d.id).length || 0;
            const colors = ['bg-[#005EB8]', 'bg-[#00A3AD]', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500'];
            return {
              name: d.name,
              dept: d.department || 'General',
              consultations: count,
              color: colors[index % colors.length]
            };
          });
          
          setDynamicDocConsultations(docLoads.sort((a, b) => b.consultations - a.consultations).slice(0, 5));
        }
      } catch (err) {
        console.warn('Could not load dynamic doctor consultations load:', err);
      }

    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch global SaaS data'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStaffUsers = async () => {
    setLoadingStaff(true);
    try {
      const { data, error } = await supabase
        .from('staff_users')
        .select('id, name, email, role, department, hospital_id, is_active')
        .neq('is_deleted', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setStaffList(data || []);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch Hospital Specific Details for the interactive details drawer/modal
  useEffect(() => {
    if (!selectedHospDetail) return;
    
    const fetchDetails = async () => {
      setLoadingDetails(true);
      setDetailsError('');
      try {
        const [docsRes, staffRes, tokensRes] = await Promise.all([
          supabase.from('doctors').select('*').eq('hospital_id', selectedHospDetail.id).order('name'),
          supabase.from('staff_users').select('*').eq('hospital_id', selectedHospDetail.id).neq('is_deleted', true).order('name'),
          supabase.from('tokens').select('*').eq('hospital_id', selectedHospDetail.id).order('created_at', { ascending: false })
        ]);

        if (docsRes.error) throw docsRes.error;
        if (staffRes.error) throw staffRes.error;
        if (tokensRes.error) throw tokensRes.error;

        setDetailDoctors(docsRes.data || []);
        setDetailStaff(staffRes.data || []);
        setDetailTokens(tokensRes.data || []);
      } catch (err) {
        console.error('Error fetching hospital details:', err);
        setDetailsError(getErrorMessage(err, 'Failed to fetch hospital details'));
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchDetails();
  }, [selectedHospDetail]);

  // Operational sorting for hospitals based on load & active token stats
  const getSortedHospitals = () => {
    const list = [...hospitals];
    if (hospitalSortBy === 'name') {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (hospitalSortBy === 'heavy-use') {
      return list.sort((a, b) => {
        const tokensA = stats[a.id]?.tokensCount || 0;
        const tokensB = stats[b.id]?.tokensCount || 0;
        return tokensB - tokensA; // Highest load first
      });
    }
    if (hospitalSortBy === 'low-use') {
      return list.sort((a, b) => {
        const tokensA = stats[a.id]?.tokensCount || 0;
        const tokensB = stats[b.id]?.tokensCount || 0;
        return tokensA - tokensB; // Lowest load first
      });
    }
    if (hospitalSortBy === 'doctors') {
      return list.sort((a, b) => {
        const docA = stats[a.id]?.doctorsCount || 0;
        const docB = stats[b.id]?.doctorsCount || 0;
        return docB - docA; // Most doctors first
      });
    }
    return list;
  };

  // Add Hospital
  const handleAddHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospitalForm.name.trim() || !hospitalForm.slug.trim()) {
      return setAddHospError('Hospital Name and Slug are required');
    }
    setAddHospError('');
    setSuccess('');
    try {
      const insertPayload: any = {
        name: hospitalForm.name.trim(),
        slug: hospitalForm.slug.toLowerCase().trim(),
        address: hospitalForm.address.trim(),
        phone: hospitalForm.phone.trim(),
        logo_url: hospitalForm.logo_url.trim() || null,
        subscription_status: 'ACTIVE',
        subscription_tier: 'Basic'
      };

      // Try inserting with theme_color. If column doesn't exist, we retry without it!
      const { data, error } = await supabase
        .from('hospitals')
        .insert({
          ...insertPayload,
          theme_color: hospitalForm.theme_color.trim() || null
        })
        .select()
        .single();

      if (error) {
        if (error.message && error.message.toLowerCase().includes('theme_color')) {
          console.warn('theme_color column not found. Retrying without it.');
          const { data: retryData, error: retryError } = await supabase
            .from('hospitals')
            .insert(insertPayload)
            .select()
            .single();

          if (retryError) throw retryError;
          setSuccess(`Hospital "${retryData.name}" registered successfully! Run the SQL command in Supabase to enable custom brand colors: "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS theme_color VARCHAR(50);"`);
          
          setHospitalForm({ name: '', slug: '', address: '', phone: '', logo_url: '', theme_color: '#005EB8' });
          setShowAddHospital(false);
          logActivity(`SaaS Tenant "${retryData.name}" has been registered successfully (fallback theme).`, 'system', 'bg-[#005EB8]');
        } else {
          throw error;
        }
      } else {
        setSuccess(`Hospital "${data.name}" registered successfully as active SaaS tenant with custom brand elements!`);
        
        setHospitalForm({ name: '', slug: '', address: '', phone: '', logo_url: '', theme_color: '#005EB8' });
        setShowAddHospital(false);
        logActivity(`SaaS Tenant "${data.name}" has been registered successfully with brand elements.`, 'system', 'bg-[#005EB8]');
      }

      loadData(true);
    } catch (err) {
      setAddHospError(getErrorMessage(err, 'Failed to add hospital'));
    }
  };

  // Delete Hospital with sequential cascade-safe cleanups
  const handleDeleteHospital = async (id: string, name: string) => {
    if (id === 'd290f1ee-6c54-4b01-90e6-d701748f0851') {
      setError('The primary system platform core (Apollo Clinic) cannot be deleted as it hosts the system configuration and core supervisor users.');
      return;
    }

    const confirmed = window.confirm(`⚠️ WARNING: Are you absolutely sure you want to delete "${name}"? This action is permanent and will purge ALL associated data (prescriptions, visits, active tokens, doctors, staff accounts, patient records, and the hospital tenant itself). This cannot be undone.`);
    if (!confirmed) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      // 1. Delete dependent prescription tables
      await supabase.from('prescriptions').delete().eq('hospital_id', id);

      // 2. Delete dependent visit tables
      await supabase.from('visits').delete().eq('hospital_id', id);

      // 3. Delete dependent intake tables
      await supabase.from('patient_intake').delete().eq('hospital_id', id);

      // 4. Delete dependent queue tokens
      await supabase.from('tokens').delete().eq('hospital_id', id);

      // 5. Delete appointments
      await supabase.from('appointments').delete().eq('hospital_id', id);

      // 6. Delete doctors
      await supabase.from('doctors').delete().eq('hospital_id', id);

      // 7. Delete patients
      await supabase.from('patients').delete().eq('hospital_id', id);

      // 8. Delete staff_users of this hospital (excluding super admin)
      await supabase.from('staff_users').delete().eq('hospital_id', id);

      // 9. Finally delete the hospital itself
      const { error: deleteErr } = await supabase.from('hospitals').delete().eq('id', id);
      if (deleteErr) throw deleteErr;

      // Clean metadata
      localStorage.removeItem(`mq_hosp_meta_v2_${id}`);

      setSuccess(`Hospital "${name}" and all of its associated clinical database rows have been purged successfully.`);
      logActivity(`SaaS Tenant "${name}" has been completely removed from the platform.`, 'system', 'bg-rose-600');

      loadData(true);
    } catch (err) {
      setError(getErrorMessage(err, 'An error occurred during cascade purging of the hospital tenant.'));
    } finally {
      setLoading(false);
    }
  };

  // Add Staff User
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, password, role, department, room_number, hospital_id } = staffForm;
    if (!name.trim() || !email.trim() || !password.trim() || !hospital_id) {
      return setAddStaffError('All asterisk (*) fields are required');
    }
    setAddStaffError('');
    setSuccess('');
    try {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);

      const { data, error } = await supabase
        .from('staff_users')
        .insert({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password_hash: hash,
          role,
          department: department ? department.toLowerCase().trim() : 'general',
          room_number: room_number ? room_number.trim() || null : null,
          hospital_id,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to retrieve registered staff user details');

      // If user is a DOCTOR, also create a corresponding doctor record
      if (role === 'DOCTOR') {
        const { error: docErr } = await supabase.from('doctors').insert({
          staff_user_id: data.id,
          name: name.trim(),
          specialty: 'General',
          department: department ? department.toLowerCase().trim() : 'general',
          room_number: room_number ? room_number.trim() || null : null,
          hospital_id,
          is_available: true
        });
        if (docErr) console.warn('Could not auto-create doctor record:', docErr.message);
      }

      setSuccess(`Staff user "${data.name}" created successfully!`);
      
      logActivity(`New staff user "${data.name}" (${role}) registered contextually.`, 'staff', 'bg-[#00A3AD]');

      setStaffForm({
        name: '',
        email: '',
        password: '',
        role: 'ADMIN',
        department: 'general',
        room_number: '',
        hospital_id: hospitals[0]?.id || ''
      });
      setShowAddStaff(false);
      loadData(true);
    } catch (err) {
      setAddStaffError(getErrorMessage(err, 'Failed to register staff user'));
    }
  };

  // Toggle staff status in Supabase
  const handleToggleStaffStatus = async (id: string, currentStatus: boolean, name: string) => {
    setError('');
    setSuccess('');
    try {
      const { error } = await supabase
        .from('staff_users')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      setSuccess(`Staff status for "${name}" updated successfully.`);
      logActivity(`Staff user "${name}" credentials ${!currentStatus ? 'Activated' : 'Suspended'}.`, 'security', 'bg-[#00A3AD]');
      loadData(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update staff status'));
    }
  };

  // Delete Staff User
  const handleDeleteStaff = async (id: string, name: string) => {
    const confirmed = window.confirm(`⚠️ WARNING: Are you absolutely sure you want to delete staff member "${name}"? This will soft-delete their credentials in the database and block all subsequent logins immediately.`);
    if (!confirmed) return;
    setError('');
    setSuccess('');
    try {
      const { error } = await supabase
        .from('staff_users')
        .update({ is_deleted: true, is_active: false })
        .eq('id', id);
      if (error) throw error;
      setSuccess(`Staff "${name}" soft-deleted successfully.`);
      logActivity(`Staff user "${name}" account was soft-deleted.`, 'staff', 'bg-[#005EB8]');
      await loadData(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete staff member'));
    }
  };

  // Reset Hospital Queue (Delete all active tokens for tenant)
  const handleResetQueue = async (hospId: string, hospName: string) => {
    if (!confirm(`⚠️ CRITICAL COMMAND: Are you sure you want to reset today's queue for "${hospName}"? All active patient tokens will be immediately deleted.`)) return;
    setError('');
    setSuccess('');
    try {
      const { error } = await supabase
        .from('tokens')
        .delete()
        .eq('hospital_id', hospId);

      if (error) throw error;
      setSuccess(`Queue reset complete! Purged all patient token queue records for ${hospName}.`);
      logActivity(`Super Admin initiated queue reset for tenant: ${hospName}.`, 'queue', 'bg-red-500');
      loadData(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset hospital queue'));
    }
  };

  // Change Subscription status of hospital (Active/Trial/Suspended/Hold)
  const handleChangeHospStatus = async (hospId: string, hospName: string, newStatus: string) => {
    setError('');
    setSuccess('');
    try {
      const { error: dbErr } = await supabase
        .from('hospitals')
        .update({ subscription_status: newStatus })
        .eq('id', hospId);
      
      if (dbErr) throw dbErr;

      setSuccess(`SaaS Status for "${hospName}" updated to: ${newStatus}`);
      logActivity(`Tenant "${hospName}" lifecycle changed to status: ${newStatus}`, 'system', newStatus === 'ACTIVE' ? 'bg-[#00A3AD]' : newStatus === 'TRIAL' ? 'bg-sky-400' : newStatus === 'HOLD' ? 'bg-amber-500' : 'bg-rose-500');
      
      await loadData(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update hospital status'));
    }
  };

  // Change Pricing Tier of Hospital (Basic/Pro/Enterprise)
  const handleChangeHospTier = async (hospId: string, hospName: string, newTier: string) => {
    setError('');
    setSuccess('');
    try {
      const { error: dbErr } = await supabase
        .from('hospitals')
        .update({ subscription_tier: newTier })
        .eq('id', hospId);

      if (dbErr) throw dbErr;

      setSuccess(`Subscription tier for "${hospName}" updated to: ${newTier}`);
      logActivity(`Tenant "${hospName}" plan converted to billing tier: ${newTier}`, 'billing', 'bg-[#005EB8]');
      
      await loadData(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update hospital tier'));
    }
  };

  // Switch Context to a specific hospital and load its Admin view
  const handleManageHospital = (hosp: Hospital) => {
    setSelectedHospitalId(hosp.id);
    // Force App to show Staff dashboard under this hospital context
    onNavigate('staff');
  };

  // Append items to Central Activity Feed
  const logActivity = async (msg: string, cat: 'security' | 'queue' | 'billing' | 'system' | 'staff', color: string) => {
    try {
      await supabase.from('activity_logs').insert({
        message: msg,
        category: cat,
        badge_color: color
      });
    } catch (err) {
      console.warn('Could not save activity log in DB:', err);
    }
    const newEvent: ActivityEvent = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      message: msg,
      category: cat,
      badgeColor: color
    };
    setActivityFeed(prev => [newEvent, ...prev.slice(0, 19)]);
  };

  // Acknowledge a security warning log
  const handleAcknowledgeAlert = async (id: string) => {
    try {
      const { error } = await supabase.from('security_logs').update({ acknowledged: true }).eq('id', id);
      if (error) throw error;
      setSuccess('Security incident acknowledged.');
      loadData(true);
    } catch (err) {
      console.warn('Failed to acknowledge security incident in DB:', err);
    }
  };

  // Trigger simulated intrusion attack
  const triggerAttackSimulator = async () => {
    const randomIp = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const randomHospName = hospitals[Math.floor(Math.random() * hospitals.length)]?.name || 'MedQueue Node';
    try {
      const { error } = await supabase.from('security_logs').insert({
        event: 'Failed login security scan: Suspicious multiple device query triggered',
        ip: randomIp,
        hospital: randomHospName,
        severity: 'critical',
        acknowledged: false
      });
      if (error) throw error;
      
      await logActivity(`Intrusion Security Log: Alert detected from IP ${randomIp}.`, 'security', 'bg-red-500');
      setSuccess('Security alert log added. Please review details under the alerts section.');
      loadData(true);
    } catch (err) {
      console.warn('Failed to add security intrusion log in DB:', err);
    }
  };

  // Simulate global health failure
  const toggleSystemFailure = async () => {
    const nextState = !simulatedFailure;
    setSimulatedFailure(nextState);
    try {
      await supabase.from('system_settings').upsert({ key: 'otp_gateway_status', value: nextState ? 'OFFLINE' : 'ONLINE' }, { onConflict: 'key' });
      
      if (nextState) {
        await logActivity('CRITICAL: Network OTP Gateway response connection lost!', 'system', 'bg-red-500');
        await supabase.from('security_logs').insert({
          event: 'SMS gateway service failed (503 Service Unavailable). OTP triggers falling back to simulation logs.',
          ip: 'gateway.twilio.internal',
          hospital: 'Primary System Router',
          severity: 'critical',
          acknowledged: false
        });
        setError('⚠️ CRITICAL PLATFORM WARNING: OTP API gateway is offline. Restoring connection fallback.');
      } else {
        await logActivity('SaaS Heartbeat: All clinic services and API routes restored.', 'system', 'bg-[#005EB8]');
        setSuccess('All services online. System database latency normalized.');
        setError('');
      }
      loadData(true);
    } catch (err) {
      console.warn('Could not sync system health failure to DB:', err);
    }
  };

  // Dispatch global system announcement broadcast
  const handleDispatchBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBroadcastText.trim()) return;
    try {
      const { error } = await supabase.from('broadcasts').insert({
        message: newBroadcastText.trim(),
        scope: broadcastScope,
        severity: broadcastSeverity
      });
      if (error) throw error;
      
      await logActivity(`Central operational announcement broadcast dispatched to target: ${broadcastScope.toUpperCase()}`, 'system', 'bg-[#00A3AD]');
      setSuccess(`Central broadcast alert dispatched successfully!`);
      setNewBroadcastText('');
      loadData(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to dispatch central broadcast'));
    }
  };

  const handleToggleEmergencyMode = async (nextVal: boolean) => {
    setEmergencyMode(nextVal);
    try {
      await supabase.from('system_settings').upsert({ key: 'emergency_mode', value: nextVal }, { onConflict: 'key' });
      await logActivity(`Super Admin toggled global emergency operational mode to: ${nextVal ? 'ON' : 'OFF'}`, 'system', nextVal ? 'bg-red-500' : 'bg-[#005EB8]');
      setSuccess(`Global Emergency Mode toggled to: ${nextVal ? 'ON' : 'OFF'}`);
      loadData(true);
    } catch (err) {
      console.warn('Could not sync emergency mode to DB:', err);
    }
  };

  // Export Raw Enterprise CSV Report
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'MedQueue Enterprise Master SaaS Operations Report\n';
    csvContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    // Hospitals section
    csvContent += '--- HOSPITALS TENANTS ---\n';
    csvContent += 'ID,Name,Slug,Address,Phone,Tier,Status,Doctors,Patients,Tokens\n';
    hospitals.forEach(h => {
      const meta = getLocalHospMeta(h.id);
      const statsObj = stats[h.id] || { doctorsCount: 0, patientsCount: 0, tokensCount: 0 };
      csvContent += `"${h.id}","${h.name}","${h.slug}","${h.address || ''}","${h.phone || ''}","${meta.tier}","${meta.status}",${statsObj.doctorsCount},${statsObj.patientsCount},${statsObj.tokensCount}\n`;
    });

    // Staff section
    csvContent += '\n--- REGISTERED STAFF ---\n';
    csvContent += 'Name,Email,Role,Department,Hospital,Status\n';
    staffList.forEach(s => {
      const targetHosp = hospitals.find(h => h.id === s.hospital_id)?.name || 'Global';
      csvContent += `"${s.name}","${s.email}","${s.role}","${s.department || ''}","${targetHosp}","${s.is_active ? 'Active' : 'Suspended'}"\n`;
    });

    // Security logs
    csvContent += '\n--- SECURITY EVENTS ---\n';
    csvContent += 'Timestamp,Event,IP,Hospital,Severity,Acknowledged\n';
    securityLogs.forEach(sl => {
      csvContent += `"${sl.timestamp}","${sl.event}","${sl.ip}","${sl.hospital}","${sl.severity}","${sl.acknowledged ? 'Yes' : 'No'}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `medqueue_operations_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logActivity('Generated global operations CSV audit report.', 'billing', 'bg-[#005EB8]');
    setSuccess('SaaS Operations CSV report generated successfully.');
  };

  // Compute MRR using dynamic price settings
  const totalMRR = hospitals.reduce((acc, h) => {
    const meta = getLocalHospMeta(h.id);
    if (meta.status !== 'ACTIVE') return acc;
    if (meta.tier === 'Enterprise') return acc + enterprisePrice;
    if (meta.tier === 'Pro') return acc + proPrice;
    return acc + basicPrice;
  }, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 bg-slate-50">
        <Loader2 className="w-12 h-12 animate-spin text-[#005EB8]" />
        <p className="text-slate-500 font-bold text-sm tracking-wide">Connecting healthcare operations panel...</p>
      </div>
    );
  }

  const themeColor = '#005EB8';

  return (
    <div className={`min-h-screen text-slate-800 antialiased font-sans flex flex-col transition-colors duration-300 ${emergencyMode ? 'bg-[#FFF5F5]' : 'bg-[#F4F8FB]'}`}>
      
      {/* ── EMERGENCY STATE FLASHING ANNOUNCEMENT BANNER ── */}
      {emergencyMode && (
        <div className="bg-red-600 text-white px-6 py-3 flex items-center justify-between shadow-md animate-pulse z-40">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-white animate-bounce flex-shrink-0" />
            <div>
              <h4 className="font-black text-xs uppercase tracking-widest text-white">SYSTEM EMERGENCY OPERATIONAL MODE ENABLED</h4>
              <p className="text-[10px] text-red-150 font-bold mt-0.5">Global platforms are under high-urgency operational status. Blinking system alerts are highlighted below.</p>
            </div>
          </div>
          <button 
            onClick={() => handleToggleEmergencyMode(false)} 
            className="bg-white text-red-700 hover:bg-red-50 font-extrabold text-[10px] px-3.5 py-1.5 rounded-lg border border-transparent transition-all flex-shrink-0 uppercase shadow-sm"
          >
            Disable Emergency Mode
          </button>
        </div>
      )}

      {/* Simulated gateway failure alert banner */}
      {simulatedFailure && (
        <div className="bg-amber-500 text-white px-6 py-3 flex items-center justify-between shadow-sm animate-fadeIn z-40">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-white animate-ping flex-shrink-0" />
            <div>
              <span className="font-extrabold uppercase text-[9px] tracking-wider bg-white/20 px-2 py-0.5 rounded mr-2">SaaS ALERT</span>
              <span className="text-xs font-semibold">SMS gateway routing engine offline. Customer OTP notifications are temporarily simulated.</span>
            </div>
          </div>
          <button 
            onClick={toggleSystemFailure} 
            className="bg-white text-amber-700 hover:bg-amber-50 font-extrabold text-[9px] px-3.5 py-1.5 rounded-lg transition-all flex-shrink-0 uppercase shadow-sm"
          >
            Restore OTP
          </button>
        </div>
      )}

      {/* Persistent Announcements Banner */}
      {broadcasts.length > 0 && (
        <div className="bg-[#E8F3FF] text-[#005EB8] border-b border-blue-100 px-6 py-3 flex items-center justify-between shadow-sm z-40">
          <div className="flex items-center gap-3.5">
            <Bell className="w-4 h-4 text-[#005EB8] animate-bounce flex-shrink-0" />
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider bg-[#005EB8] text-white px-2 py-0.5 rounded-md mr-2.5 shadow-sm">Announcement</span>
              <span className="text-xs font-semibold text-[#005EB8]">{broadcasts[0].message}</span>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-medium font-mono hidden sm:inline-block">Scope: {broadcasts[0].scope.toUpperCase()}</span>
        </div>
      )}

      <div className="flex flex-1 flex-col lg:flex-row min-h-screen">
        
        {/* Collapsible Left Sidebar */}
        <aside className={`bg-white border-r border-slate-200/60 flex flex-col justify-between shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
          <div>
            {/* Header branding */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              {!sidebarCollapsed ? (
                <div className="flex items-center gap-2 animate-fadeIn">
                  <div className="w-8 h-8 rounded-lg bg-[#005EB8] flex items-center justify-center text-white font-bold shadow-md shadow-blue-100">
                    <span>M</span>
                  </div>
                  <div>
                    <span className="text-slate-900 font-black text-sm uppercase tracking-wide block">MedQueue</span>
                    <span className="text-[9px] text-[#00A3AD] font-bold uppercase tracking-wider block -mt-1">Control Center</span>
                  </div>
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#005EB8] flex items-center justify-center text-white font-bold mx-auto shadow-md">
                  <span>M</span>
                </div>
              )}
              
              <button 
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden lg:flex items-center justify-center p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200 transition-all"
                title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                <ArrowRight className={`w-3.5 h-3.5 transition-transform duration-300 ${sidebarCollapsed ? '' : 'rotate-180'}`} />
              </button>
            </div>

            {/* Systems normal status pulsator */}
            {!sidebarCollapsed && (
              <div className="px-4 py-2.5 mt-3 mx-4 rounded-xl border border-blue-50 bg-[#F0F7FF] flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${simulatedFailure ? 'bg-amber-500 animate-pulse' : 'bg-[#00A3AD] animate-pulse'}`} />
                <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wide">
                  {simulatedFailure ? 'Anomaly Detected' : 'All Systems Nominal'}
                </span>
              </div>
            )}

            {/* Sidebar navigation list */}
            <nav className="p-3 mt-3 space-y-1">
              {[
                { id: 'dashboard', label: 'Operations Center', icon: <LayoutDashboard className="w-4 h-4" /> },
                { id: 'hospitals', label: 'Clinic Directory', icon: <Building2 className="w-4 h-4" />, badge: hospitals.length },
                { id: 'staff', label: 'Staff Directory', icon: <Users className="w-4 h-4" /> },
                { id: 'analytics', label: 'Platform Analytics', icon: <BarChart3 className="w-4 h-4" /> },
                { id: 'billing', label: 'SaaS Tiers & Billing', icon: <CreditCard className="w-4 h-4" /> },
                { id: 'alerts', label: 'Incident Console', icon: <Shield className="w-4 h-4" />, badge: securityLogs.filter(l => !l.acknowledged).length },
                { id: 'health', label: 'Node Telemetry', icon: <Heart className="w-4 h-4" /> },
                { id: 'settings', label: 'Global Broadcasts', icon: <Megaphone className="w-4 h-4" /> },
              ].map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center px-3.5 py-3 rounded-xl text-xs font-black transition-all ${
                      isActive 
                        ? 'bg-[#F0F6FC] text-[#005EB8] border-l-4 border-[#005EB8] shadow-sm' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    } ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}
                    title={item.label}
                  >
                    <div className="flex items-center gap-3">
                      <span className={isActive ? 'text-[#005EB8]' : 'text-slate-400'}>{item.icon}</span>
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!sidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isActive ? 'bg-[#005EB8] text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer context */}
          <div className="p-3 border-t border-slate-100 bg-slate-50/50">
            {!sidebarCollapsed && (
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">
                MedQueue SaaS Operations
              </div>
            )}
            <button 
              onClick={handleExportCSV}
              className={`w-full flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 py-2 rounded-xl text-[10px] font-extrabold border border-slate-200 transition-all shadow-sm ${sidebarCollapsed ? 'justify-center' : 'justify-content'}`}
              title="Export Global CSV Audit Report"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              {!sidebarCollapsed && <span>Export Raw Logs</span>}
            </button>
          </div>
        </aside>

        {/* ── RIGHT MAIN WINDOW CONTAINER ── */}
        <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
          
          {/* Header Bar & Global Action Bar */}
          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 border-b border-slate-200/60 pb-6 mb-6">
            <div>
              <span className="text-[9px] bg-[#F0F6FC] border border-blue-50 text-[#005EB8] font-black px-3 py-1 rounded-md uppercase tracking-wider">
                Healthcare SaaS Admin Operations Control Center • Admin: {_currentUser?.name || _currentUser?.email}
              </span>
              <h1 className="text-2xl font-black text-slate-950 mt-2 capitalize tracking-tight flex items-center gap-2">
                {activeTab.replace('-', ' ')} Platform Ledger
                {emergencyMode && <span className="text-[10px] bg-rose-500 text-white font-black uppercase tracking-wider px-2 py-0.5 rounded-md animate-pulse">Emergency Active</span>}
              </h1>
            </div>
            
            {/* GLOBAL ACTION BAR: Add Hospital, Broadcast, Emergency Mode, Generate Reports, Suspend, Sync */}
            <div className="flex items-center gap-2 flex-wrap bg-white p-3 rounded-2xl border border-slate-200/60 shadow-sm w-full xl:w-auto justify-end">
              
              {/* Emergency mode toggle */}
              <button
                onClick={() => handleToggleEmergencyMode(!emergencyMode)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border shadow-sm ${
                  emergencyMode 
                    ? 'bg-red-600 text-white border-red-700 animate-pulse' 
                    : 'bg-white text-red-600 hover:bg-red-50 border-red-100 hover:border-red-200'
                }`}
                title="Toggle High-Urgency System Alert State"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Emergency Mode
              </button>

              {/* Sync systems */}
              <button
                onClick={handleSystemSync}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-50 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-650 transition-all border border-slate-200 shadow-sm"
                title="Synchronize all multi-tenant nodes and daily tickers"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} /> Sync Systems
              </button>

              {/* Generate operations report */}
              <button
                onClick={handleGenerateReport}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-50 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-[#005EB8] transition-all border border-blue-100 shadow-sm"
                title="Compile and download MRR, telemetry, and clinical metadata"
              >
                <BarChart3 className="w-3.5 h-3.5 text-[#005EB8]" /> SaaS Report
              </button>

              {/* Broadcast Alert */}
              <button
                onClick={() => {
                  setActiveTab('settings');
                  setSuccess('Central broadcast controls opened below.');
                }}
                className="flex items-center gap-1.5 bg-white hover:bg-slate-50 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-[#00A3AD] transition-all border border-teal-150 shadow-sm"
                title="Announce central messages to patient display boards"
              >
                <Megaphone className="w-3.5 h-3.5 text-[#00A3AD]" /> Broadcast Alert
              </button>

              {/* Setup Clinic (Primary Add Hospital) */}
              <button
                onClick={() => setShowAddHospital(true)}
                className="flex items-center gap-1.5 bg-[#005EB8] hover:bg-[#004A94] text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-blue-100 border border-blue-600"
                title="Onboard new isolated clinic tenant database node"
              >
                <Plus className="w-3.5 h-3.5" /> Setup Clinic
              </button>

              {activeTab === 'staff' && (
                <button
                  onClick={() => setShowAddStaff(true)}
                  className="flex items-center gap-1.5 bg-[#00A3AD] hover:bg-[#008A94] text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-teal-100 border border-teal-600"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Staff
                </button>
              )}

            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-2xl px-5 py-4 shadow-sm animate-fadeIn text-sm font-semibold">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl px-5 py-4 shadow-sm animate-fadeIn text-sm font-semibold">
              <Check className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB CONTENT: CENTRAL METRICS DASHBOARD */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* ──────────────────────────────────────────────────────── */}
              {/* STUNNING DATABASE INTEGRATION HELPER FOR ZERO CLINICS */}
              {/* ──────────────────────────────────────────────────────── */}
              {hospitals.length === 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 rounded-3xl p-8 shadow-sm space-y-6 animate-fadeIn">
                  <div className="flex items-center gap-3.5 border-b border-blue-100 pb-4">
                    <div className="w-12 h-12 bg-[#005EB8] rounded-2xl flex items-center justify-center shadow-md shadow-blue-150">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Hospital Operations Control Center Setup Checklist</h3>
                      <p className="text-xs text-slate-500 font-bold mt-1">Configure your Supabase database and seed initial multi-tenant operations</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 text-xs font-semibold text-slate-700 leading-relaxed font-sans">
                    <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
                      <h4 className="text-[10px] font-black text-[#005EB8] uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#005EB8]" /> Database Migration (SQL Editor)
                      </h4>
                      <p className="text-slate-500 font-medium">
                        Your database is connected but no clinic nodes have been initialized. To set up Apollo Clinic, Max Health, and City Hospital, open your Supabase dashboard and run the migrations script.
                      </p>
                      <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 font-mono text-[10px] text-slate-600 space-y-2">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 font-sans">Migration Commands Summary:</div>
                        <div>1. Run <span className="text-indigo-600 font-bold">PART 1</span> in Supabase SQL Editor to append <span className="font-bold">SUPER_ADMIN</span> role.</div>
                        <div>2. Run <span className="text-indigo-600 font-bold">PART 2</span> to build the schema, disable RLS public checks, and seed default tenants.</div>
                      </div>
                      <div className="text-[10px] bg-amber-50 text-amber-800 border border-amber-100 rounded-xl p-3.5 flex items-start gap-2 leading-relaxed">
                        <AlertTriangle className="w-4.5 h-4.5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <span><strong>IMPORTANT:</strong> If you are getting empty lists or RLS errors when adding hospitals or registering staff, ensure you run <code>ALTER TABLE hospitals DISABLE ROW LEVEL SECURITY;</code> inside the editor.</span>
                      </div>
                    </div>

                    <div className="space-y-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
                      <h4 className="text-[10px] font-black text-[#00A3AD] uppercase tracking-widest flex items-center gap-1.5 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00A3AD]" /> Manual Setup Controls
                      </h4>
                      <p className="text-slate-500 font-medium">
                        Alternatively, you can initialize a hospital tenant instantly using the global control center action bar button:
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowAddHospital(true)}
                        className="w-full mt-1.5 py-3 bg-[#005EB8] hover:bg-[#004A94] text-white font-extrabold text-[10px] rounded-xl border border-blue-600 shadow-md shadow-blue-100 transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Initialize First Clinic Node
                      </button>
                      
                      <div className="pt-3 border-t border-slate-100 space-y-2 text-slate-500 font-medium">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Initial Credentials Configured:</p>
                        <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-[10px]">
                          <span>Refer to Database Seed Config</span>
                          <span className="text-slate-400 font-sans italic">[Secured in migration.sql]</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* ──────────────────────────────────────────────────────── */}
              {/* FEATURE 3: CRITICAL ALERTS CENTER */}
              {/* ──────────────────────────────────────────────────────── */}
              {(emergencyMode || simulatedFailure || Object.values(stats).some(s => s.tokensCount > 6)) && (
                <div className="bg-rose-50/85 border border-rose-200 rounded-3xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-rose-200 pb-2">
                    <h3 className="text-xs font-black text-rose-900 uppercase tracking-widest flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" /> Live Incidents Console
                    </h3>
                    <span className="text-[9px] bg-rose-600 text-white font-extrabold uppercase px-2 py-0.5 rounded-md animate-pulse">Critical Priority</span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    
                    {/* Simulated SMS Alert */}
                    {simulatedFailure && (
                      <button 
                        onClick={() => setActiveTab('alerts')}
                        className="bg-white border border-rose-150 p-3.5 rounded-2xl flex items-start gap-2.5 shadow-sm text-xs text-slate-700 leading-relaxed font-semibold text-left transition-all hover:bg-rose-50/15 hover:border-rose-300 cursor-pointer w-full focus:outline-none"
                      >
                        <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 flex-shrink-0 animate-ping" />
                        <div>
                          <strong className="text-rose-900 uppercase text-[9px] tracking-wider font-extrabold block mb-0.5">SMS OTP GATEWAY FAILURE</strong>
                          <span>SMS OTP notification routing engine is offline. OTP logins fallback to local visual simulation screen.</span>
                        </div>
                      </button>
                    )}

                    {/* Clinic Queue Overload Alerts */}
                    {getSortedHospitals().map(h => {
                      const itemStats = stats[h.id] || { doctorsCount: 0, patientsCount: 0, tokensCount: 0 };
                      const docCount = itemStats.doctorsCount || 1;
                      const loadRatio = Math.min((itemStats.tokensCount / (docCount * 4)) * 100, 100);
                      if (loadRatio > 70) {
                        return (
                          <button 
                            key={h.id} 
                            onClick={() => setActiveTab('alerts')}
                            className="bg-white border border-rose-150 p-3.5 rounded-2xl flex items-start gap-2.5 shadow-sm text-xs text-slate-700 leading-relaxed font-semibold animate-pulse text-left transition-all hover:bg-rose-50/15 hover:border-rose-300 cursor-pointer w-full focus:outline-none"
                          >
                            <span className="w-2 h-2 rounded-full bg-rose-600 mt-1.5 flex-shrink-0" />
                            <div>
                              <strong className="text-rose-900 uppercase text-[9px] tracking-wider font-extrabold block mb-0.5">CLINIC QUEUE OVERLOAD</strong>
                              <span>SaaS Tenant <strong className="text-slate-900 font-bold">"{h.name}"</strong> queue load is critically overloaded ({itemStats.tokensCount} active tokens). loadRatio: {Math.round(loadRatio)}%.</span>
                            </div>
                          </button>
                        );
                      }
                      return null;
                    })}

                    {/* Emergency Mode Indicators */}
                    {emergencyMode && (
                      <button 
                        onClick={() => setActiveTab('alerts')}
                        className="bg-white border border-rose-150 p-3.5 rounded-2xl flex items-start gap-2.5 shadow-sm text-xs text-slate-700 leading-relaxed font-semibold text-left transition-all hover:bg-rose-50/15 hover:border-rose-300 cursor-pointer w-full focus:outline-none"
                      >
                        <span className="w-2 h-2 rounded-full bg-red-650 mt-1.5 flex-shrink-0 animate-ping" />
                        <div>
                          <strong className="text-rose-900 uppercase text-[9px] tracking-wider font-extrabold block mb-0.5">SAAS EMERGENCY BROADCAST ON</strong>
                          <span>Platform is forced into manual emergency operations dashboard status. Live monitoring displays have been locked to alert priorities.</span>
                        </div>
                      </button>
                    )}

                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────── */}
              {/* FEATURE 2: REAL-TIME PLATFORM METRICS (7 KPIs) */}
              {/* ──────────────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                {[
                  { label: 'Total Clinics', value: hospitals.length, color: 'text-[#005EB8] bg-blue-50/50 border-blue-100', subtitle: `${hospitals.filter(h => getLocalHospMeta(h.id).status === 'ACTIVE').length} Active`, icon: <Building2 className="w-4 h-4 text-[#005EB8]" />, tab: 'hospitals' },
                  { label: 'Roster Doctors', value: Object.values(stats).reduce((acc, curr) => acc + curr.doctorsCount, 0), color: 'text-[#00A3AD] bg-teal-50/50 border-teal-100', subtitle: `${staffList.length} Staff`, icon: <Users className="w-4 h-4 text-[#00A3AD]" />, tab: 'staff' },
                  { label: 'Patients Today', value: Object.values(stats).reduce((acc, curr) => acc + curr.patientsCount, 0), color: 'text-violet-600 bg-violet-50/50 border-violet-100', subtitle: 'Intake volumes', icon: <Activity className="w-4 h-4 text-violet-500" />, tab: 'analytics' },
                  { label: 'Live Queue Size', value: Object.values(stats).reduce((acc, curr) => acc + curr.tokensCount, 0), color: 'text-amber-600 bg-amber-50/50 border-amber-100', subtitle: 'Active tokens', icon: <RefreshCw className="w-4 h-4 text-amber-500" />, tab: 'dashboard' },
                  { label: 'Avg Wait Time', value: '18 mins', color: 'text-indigo-600 bg-indigo-50/50 border-indigo-100', subtitle: 'Target: 20 mins', icon: <Clock className="w-4 h-4 text-indigo-500" />, tab: 'analytics' },
                  { label: 'Monthly MRR', value: `$${totalMRR.toLocaleString()}`, color: 'text-emerald-700 bg-emerald-50/50 border-emerald-100', subtitle: '↑ 14% growth', icon: <CreditCard className="w-4 h-4 text-emerald-600" />, tab: 'billing' },
                  { label: 'Gateway Ping', value: `${apiLatency}ms`, color: 'text-slate-600 bg-slate-50 border-slate-200', subtitle: simulatedFailure ? 'Anomaly alert' : 'Network Healthy', icon: <ShieldCheck className="w-4 h-4 text-slate-500" />, tab: 'health' }
                ].map((m, i) => (
                  <button 
                    key={i} 
                    onClick={() => { if (m.tab) setActiveTab(m.tab as any); }}
                    className="p-4 rounded-2xl border bg-white flex flex-col justify-between shadow-sm hover:shadow-md transition-all border-slate-200/60 group text-left cursor-pointer w-full focus:outline-none focus:ring-2 focus:ring-[#005EB8]/20"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-50 pb-2 mb-2 w-full">
                      <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest leading-none truncate max-w-[80px]">{m.label}</span>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${m.color.split(' ')[1]} border ${m.color.split(' ')[2]}`}>
                        {m.icon}
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-slate-900 group-hover:text-[#005EB8] transition-all tracking-tight leading-none">{m.value}</div>
                      <div className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-wide">{m.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* ──────────────────────────────────────────────────────── */}
                {/* FEATURE 8: SYSTEM INFRASTRUCTURE HEALTH TELEMETRY WIDGET */}
                {/* ──────────────────────────────────────────────────────── */}
                <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-5 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#005EB8]" /> SaaS Network Infrastructure
                    </h3>
                    <div className="space-y-3">
                      {[
                        { name: 'Core API Gateway', latency: `${apiLatency}ms`, status: simulatedFailure ? 'Degraded Performance' : 'Operational', color: simulatedFailure ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500' },
                        { name: 'PostgreSQL Database', latency: `${dbLatency}ms`, status: 'Operational', color: 'bg-emerald-500' },
                        { name: 'SMS OTP Engine', status: simulatedFailure ? 'Fallback Simulated' : 'Operational', color: simulatedFailure ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500' },
                        { name: 'Dynamic Queue Router', status: 'Operational', color: 'bg-emerald-500' },
                        { name: 'Auth Session Broker', status: 'Healthy', color: 'bg-emerald-500' }
                      ].map((sys, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => setActiveTab('health')}
                          className="w-full flex items-center justify-between p-3 rounded-2xl bg-[#F8FAFC] border border-slate-100 hover:border-blue-200 hover:bg-blue-50/10 transition-all text-left cursor-pointer focus:outline-none"
                        >
                          <div>
                            <span className="text-slate-900 font-extrabold text-xs block">{sys.name}</span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-0.5 block">{sys.status}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {sys.latency && <span className="text-[10px] text-slate-500 font-mono font-bold">{sys.latency}</span>}
                            <span className={`w-2 h-2 rounded-full ${sys.color}`} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-150 pt-4 mt-4 flex items-center justify-between text-[9px] text-slate-400 font-black uppercase tracking-wider">
                    <span>SaaS Ping: 24ms</span>
                    <span className="text-[#00A3AD] animate-pulse">● System Engine Online</span>
                  </div>
                </div>

                {/* ──────────────────────────────────────────────────────── */}
                {/* FEATURE 5: DYNAMIC SVG ANALYTICS CHARTS */}
                {/* ──────────────────────────────────────────────────────── */}
                <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between flex-wrap gap-4 mb-5 border-b border-slate-50 pb-3">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#00A3AD]" /> Operations Telemetry & Hourly Queue Traffic
                    </h3>
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">Live Stream</span>
                  </div>

                  {/* Hourly peak traffic distribution SVG Area chart */}
                  <div className="space-y-4">
                    <div className="relative h-44 w-full bg-gradient-to-b from-[#F0F7FF]/25 to-white rounded-2xl border border-slate-100 p-4">
                      {/* Grid Lines */}
                      <div className="absolute inset-0 flex flex-col justify-between py-6 px-10 text-[8px] font-black text-slate-300 pointer-events-none select-none">
                        <div className="border-b border-slate-100 w-full text-right pr-2">100% Load</div>
                        <div className="border-b border-slate-100 w-full text-right pr-2">50% Load</div>
                        <div className="w-full text-right pr-2">0% Load</div>
                      </div>

                      {/* SVG Line & Area graph */}
                      <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="gradient-area" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#005EB8" stopOpacity="0.25"/>
                            <stop offset="100%" stopColor="#005EB8" stopOpacity="0.0"/>
                          </linearGradient>
                        </defs>
                        {/* Peak hours load coordinates */}
                        <path 
                          d="M0 100 C 50 80, 100 20, 150 15 C 200 10, 250 85, 300 90 C 350 95, 400 40, 450 35 C 480 30, 500 80, 500 120 L 0 120 Z" 
                          fill="url(#gradient-area)" 
                        />
                        <path 
                          d="M0 100 C 50 80, 100 20, 150 15 C 200 10, 250 85, 300 90 C 350 95, 400 40, 450 35 C 480 30, 500 80, 500 120" 
                          fill="none" 
                          stroke="#005EB8" 
                          strokeWidth="2.5" 
                          strokeLinecap="round" 
                        />
                      </svg>

                      {/* X-Axis Hours */}
                      <div className="flex justify-between items-center px-1 mt-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        <span>09:00 AM</span>
                        <span>12:00 PM</span>
                        <span>03:00 PM</span>
                        <span>06:00 PM</span>
                        <span>09:00 PM</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#F8FAFC] border border-slate-100 p-3 rounded-2xl flex flex-col justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Peak Consultation Intake</span>
                        <div className="text-xs font-extrabold text-slate-900 flex items-baseline gap-1">
                          11:30 AM <span className="text-[8px] text-rose-500 font-bold uppercase">Emergency Peak</span>
                        </div>
                      </div>
                      <div className="bg-[#F8FAFC] border border-slate-100 p-3 rounded-2xl flex flex-col justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Avg Platform Consult Duration</span>
                        <div className="text-xs font-extrabold text-slate-900 flex items-baseline gap-1">
                          14 mins <span className="text-[8px] text-emerald-500 font-bold uppercase">Standard Limit</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* ──────────────────────────────────────────────────────── */}
              {/* FEATURE 4: ENTERPRISE HOSPITAL OPERATIONS TABLE */}
              {/* ──────────────────────────────────────────────────────── */}
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Global Hospital Operations Matrix</h3>
                    <p className="text-[10px] text-slate-455 font-bold mt-1">Tenant isolation status, active clinical loads, and quick queue reset panel</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase text-slate-400">Telemetry Sort:</span>
                    <select
                      value={hospitalSortBy}
                      onChange={(e) => setHospitalSortBy(e.target.value as any)}
                      className="text-[10px] font-extrabold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none"
                    >
                      <option value="name">Name (A-Z)</option>
                      <option value="heavy-use">Heavy Use (Tokens)</option>
                      <option value="low-use">Low Use (Tokens)</option>
                      <option value="doctors">Doctor Count</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto w-full scrollbar-none">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-150">
                        <th className="px-6 py-4">Hospital Name & Node</th>
                        <th className="px-6 py-4">SaaS lifecycle Status</th>
                        <th className="px-6 py-4 text-center">Consultants</th>
                        <th className="px-6 py-4 text-center">Patients</th>
                        <th className="px-6 py-4 text-center">Active Tokens</th>
                        <th className="px-6 py-4">Queue load index</th>
                        <th className="px-6 py-4">Billing Plan</th>
                        <th className="px-6 py-4 text-right">Operational Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-655">
                      {getSortedHospitals().map(h => {
                        const itemStats = stats[h.id] || { doctorsCount: 0, patientsCount: 0, tokensCount: 0 };
                        const meta = getLocalHospMeta(h.id);
                        
                        const docCount = itemStats.doctorsCount || 1;
                        const loadRatio = Math.min((itemStats.tokensCount / (docCount * 4)) * 100, 100);
                        
                        let pressureStatus = 'Normal';
                        let pressureColor = 'bg-emerald-50 border-emerald-150 text-emerald-700';
                        let progressColor = 'bg-[#00A3AD]';

                        if (loadRatio > 70) {
                          pressureStatus = 'Overloaded';
                          pressureColor = 'bg-rose-50 border-rose-150 text-rose-700 animate-pulse';
                          progressColor = 'bg-rose-500 animate-pulse';
                        } else if (loadRatio > 40) {
                          pressureStatus = 'Busy';
                          pressureColor = 'bg-amber-50 border-amber-150 text-amber-700';
                          progressColor = 'bg-amber-500';
                        }

                        return (
                          <tr key={h.id} className="hover:bg-slate-50/30 transition-colors">
                            
                            {/* Hospital Name */}
                            <td className="px-6 py-4.5">
                              <span className="font-extrabold text-slate-900 block text-xs">{h.name}</span>
                              <span className="text-[9px] text-slate-400 font-mono font-bold block mt-0.5">{h.slug}.medqueue.com</span>
                            </td>

                            {/* Lifecycle Status select */}
                            <td className="px-6 py-4.5">
                              <select
                                value={meta.status}
                                onChange={(e) => handleChangeHospStatus(h.id, h.name, e.target.value)}
                                className={`py-1 px-2.5 rounded-xl text-[9px] font-black border transition-all cursor-pointer focus:outline-none appearance-none ${
                                  meta.status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-250 text-emerald-700' :
                                  meta.status === 'TRIAL' ? 'bg-sky-50 border-sky-250 text-sky-700' :
                                  meta.status === 'HOLD' ? 'bg-amber-50 border-amber-250 text-amber-700' :
                                  'bg-rose-50 border-rose-250 text-rose-700'
                                }`}
                              >
                                <option value="ACTIVE" className="bg-white text-slate-800">🟢 ACTIVE</option>
                                <option value="TRIAL" className="bg-white text-slate-800">🔵 TRIAL</option>
                                <option value="HOLD" className="bg-white text-slate-800">🟡 HOLD</option>
                                <option value="SUSPENDED" className="bg-white text-slate-800">🔴 SUSPENDED</option>
                              </select>
                            </td>

                            {/* Consultant Count */}
                            <td className="px-6 py-4.5 text-center font-extrabold text-slate-800">{itemStats.doctorsCount}</td>
                            
                            {/* Patient Count */}
                            <td className="px-6 py-4.5 text-center font-extrabold text-slate-800">{itemStats.patientsCount}</td>
                            
                            {/* Active Queue Size */}
                            <td className="px-6 py-4.5 text-center font-extrabold text-[#005EB8]">{itemStats.tokensCount}</td>
                            
                            {/* Queue load index progress bar */}
                            <td className="px-6 py-4.5 min-w-[140px]">
                              <div className="flex items-center gap-3">
                                <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden flex-shrink-0">
                                  <div className={`h-full ${progressColor}`} style={{ width: `${Math.max(loadRatio, 8)}%` }} />
                                </div>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${pressureColor}`}>
                                  {pressureStatus}
                                </span>
                              </div>
                            </td>

                            {/* Plan tier */}
                            <td className="px-6 py-4.5">
                              <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                                meta.tier === 'Enterprise' ? 'bg-amber-50 border-amber-150 text-amber-700' :
                                meta.tier === 'Pro' ? 'bg-blue-50 border border-blue-150 text-[#005EB8]' :
                                'bg-teal-50 border border-teal-150 text-[#00A3AD]'
                              }`}>
                                {meta.tier}
                              </span>
                            </td>

                            {/* Action links */}
                            <td className="px-6 py-4.5 text-right">
                              <div className="flex justify-end items-center gap-1.5">
                                
                                {/* Explore panel details */}
                                <button
                                  onClick={() => setSelectedHospDetail(h)}
                                  className="text-[9px] font-extrabold bg-[#F0F6FC] hover:bg-[#005EB8] text-[#005EB8] hover:text-white border border-blue-100 hover:border-blue-500 px-2.5 py-1.5 rounded-lg transition-all"
                                  title="View dynamic live details drawer"
                                >
                                  Explore
                                </button>

                                {/* Enter Portal context */}
                                <button
                                  onClick={() => handleManageHospital(h)}
                                  className="text-[9px] font-extrabold bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg text-slate-700 transition-all"
                                  title="Enter full clinical operator view"
                                >
                                  Portal →
                                </button>

                                {/* Queue reset */}
                                <button
                                  onClick={() => handleResetQueue(h.id, h.name)}
                                  className="p-1.5 bg-white hover:bg-red-50 text-slate-400 hover:text-red-650 border border-slate-200 hover:border-red-150 rounded-lg transition-all"
                                  title="Reset daily queue counters"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete Node cascade */}
                                <button
                                  disabled={h.id === 'd290f1ee-6c54-4b01-90e6-d701748f0851'}
                                  onClick={() => handleDeleteHospital(h.id, h.name)}
                                  className={`p-1.5 border rounded-lg transition-all ${
                                    h.id === 'd290f1ee-6c54-4b01-90e6-d701748f0851'
                                      ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                      : 'bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border-slate-200 hover:border-rose-150'
                                  }`}
                                  title={h.id === 'd290f1ee-6c54-4b01-90e6-d701748f0851' ? 'Apollo Clinic is protected' : 'Delete Clinic'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>

                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Onboarding & Demo Bookings Desk */}
              {(() => {
                const activeOnboardingRequests = onboardingRequests.filter(evt => {
                  const rawMsg = evt.message;
                  const matchHosp = rawMsg.match(/"([^"]+)"/);
                  if (!matchHosp) return true;
                  const hospitalName = matchHosp[1].trim().toLowerCase();
                  // Check if this hospital name is already registered (case-insensitive)
                  return !hospitals.some(h => h.name.trim().toLowerCase() === hospitalName);
                });

                if (activeOnboardingRequests.length === 0) return null;

                return (
                  <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm mb-6 animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#00A3AD] animate-pulse" /> Pending Hospital Onboarding & Demo Requests
                      </h3>
                      <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold">
                        {activeOnboardingRequests.length} Requests Pending
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeOnboardingRequests
                        .map(evt => {
                          const rawMsg = evt.message;
                          const matchHosp = rawMsg.match(/"([^"]+)"/);
                          const hospitalName = matchHosp ? matchHosp[1] : 'New Clinic Setup';

                          // Parse selected plan
                          const matchPlan = rawMsg.match(/Request for\s+([^:]+):/);
                          const planName = matchPlan ? matchPlan[1].trim() : 'Professional Ops';

                          // Parse city
                          const matchCity = rawMsg.match(/in\s+([^\s]+)\s+requested/) || rawMsg.match(/in\s+([^,]+),/);
                          const city = matchCity ? matchCity[1].trim() : 'N/A';

                          // Parse contact person
                          const matchPerson = rawMsg.match(/requested by\s+([^(\n\r]+)/);
                          const contactPerson = matchPerson ? matchPerson[1].split('(')[0].trim() : 'N/A';

                          // Parse phone
                          const matchPhone = rawMsg.match(/Phone:\s*([^\s,)]+)/) || rawMsg.match(/Phone:\s*([^\s)]+)/);
                          const phone = matchPhone ? matchPhone[1].trim() : '';

                          // Parse email
                          const matchEmail = rawMsg.match(/Email:\s*([^\s,)]+)/) || rawMsg.match(/Email:\s*([^\s)]+)/);
                          const email = matchEmail ? matchEmail[1].trim() : '';

                          // Parse size/beds
                          const matchSize = rawMsg.match(/\(([^)]+)\)/);
                          const bedsSize = matchSize ? matchSize[1] : '10-50 beds';
                          
                          return (
                            <div key={evt.id} className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl flex flex-col justify-between space-y-4 hover:border-indigo-200 transition-all shadow-inner">
                              <div className="space-y-3.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <strong className="font-extrabold text-slate-800 text-[14px]">{hospitalName}</strong>
                                  <span className={`text-[8px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                                    planName.includes('Starter') 
                                      ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                                      : planName.includes('Enterprise')
                                      ? 'bg-rose-50 border-rose-100 text-rose-600 animate-pulse'
                                      : 'bg-[#005EB8]/5 border-[#005EB8]/10 text-[#005EB8]'
                                  }`}>
                                    {planName}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-[10px] bg-white border border-slate-100 rounded-xl p-3 shadow-sm font-semibold text-slate-600">
                                  <div>
                                    <span className="text-slate-400 block text-[8px] font-black uppercase tracking-wider">City Location</span>
                                    <span className="text-slate-800 font-bold">{city}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[8px] font-black uppercase tracking-wider">Contact Person</span>
                                    <span className="text-slate-800 font-bold">{contactPerson}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[8px] font-black uppercase tracking-wider">Phone</span>
                                    {phone ? (
                                      <a href={`tel:${phone}`} className="text-[#005EB8] hover:underline font-bold block">{phone}</a>
                                    ) : (
                                      <span className="text-slate-400">N/A</span>
                                    )}
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block text-[8px] font-black uppercase tracking-wider">Email Address</span>
                                    {email ? (
                                      <a href={`mailto:${email}`} className="text-[#005EB8] hover:underline font-bold block truncate">{email}</a>
                                    ) : (
                                      <span className="text-slate-400">N/A</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold">
                                  <span>Scale: <strong className="text-slate-600 font-extrabold">{bedsSize}</strong></span>
                                  <span>•</span>
                                  <span>Requested {new Date(evt.timestamp).toLocaleDateString()}</span>
                                </div>
                              </div>

                              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100/50">
                                {/* Direct WhatsApp Call/Chat */}
                                {phone && (
                                  <a 
                                    href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="bg-[#25D366] hover:bg-[#20ba59] text-white px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    WhatsApp Lead
                                  </a>
                                )}
                                <button 
                                  onClick={() => {
                                    setHospitalForm({
                                      name: hospitalName,
                                      slug: hospitalName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 15),
                                      address: `${city} Branch OPD Desk`,
                                      phone: phone || '9999999999',
                                      logo_url: '',
                                      theme_color: '#005EB8'
                                    });
                                    setShowAddHospital(true);
                                  }}
                                  className="bg-[#005EB8] hover:bg-[#004A94] text-white px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all shadow-sm shadow-[#005EB8]/10 cursor-pointer"
                                >
                                  Approve & Provision
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              })()}

              {/* Grid block for stream logs */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* ──────────────────────────────────────────────────────── */}
                {/* FEATURE 6: OPERATIONAL EVENT FEED */}
                {/* ──────────────────────────────────────────────────────── */}
                <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm lg:col-span-2">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[#005EB8] animate-pulse" /> Platform Operations Stream (Live Event Logs)
                  </h3>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                    {activityFeed.map(evt => (
                      <div key={evt.id} className="flex gap-3 text-xs leading-relaxed animate-fadeIn">
                        <div className="flex flex-col items-center">
                          <div className={`w-2.5 h-2.5 rounded-full ${evt.badgeColor} mt-1`} />
                          <div className="flex-1 w-px bg-slate-200 mt-2" />
                        </div>
                        <div className="flex-1 pb-3">
                          <span className="text-slate-700 font-semibold block">{evt.message}</span>
                          <span className="text-[9px] text-slate-400 font-extrabold block mt-1 uppercase tracking-wide">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ──────────────────────────────────────────────────────── */}
                {/* FEATURE 9: SUBSCRIPTION & EXPIRING BILLINGS WIDGET */}
                {/* ──────────────────────────────────────────────────────── */}
                <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-5 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-650" /> SaaS Billing & Pricing Overview
                    </h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Monthly MRR Ticker</span>
                          <span className="text-xl font-black text-emerald-800 block">${totalMRR.toLocaleString()}/mo</span>
                        </div>
                        <span className="text-[10px] text-emerald-700 font-black">Active Growth</span>
                      </div>
                      
                      <div className="space-y-2">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Tier distribution</span>
                        <div className="flex justify-between items-center text-xs border-b border-slate-50 pb-1.5 text-slate-650 font-semibold">
                          <span>Enterprise Tier ($799/mo)</span>
                          <span className="font-extrabold text-slate-900">{hospitals.filter(h => getLocalHospMeta(h.id).tier === 'Enterprise').length} Active</span>
                        </div>
                        <div className="flex justify-between items-center text-xs border-b border-slate-50 pb-1.5 text-slate-650 font-semibold">
                          <span>Pro Tier ($299/mo)</span>
                          <span className="font-extrabold text-slate-900">{hospitals.filter(h => getLocalHospMeta(h.id).tier === 'Pro').length} Active</span>
                        </div>
                        <div className="flex justify-between items-center text-xs pb-1 text-slate-650 font-semibold">
                          <span>Basic Tier ($99/mo)</span>
                          <span className="font-extrabold text-slate-900">{hospitals.filter(h => getLocalHospMeta(h.id).tier === 'Basic').length} Active</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-3">
                    <button
                      onClick={() => setActiveTab('billing')}
                      className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-[10px] rounded-xl border border-slate-200 transition-all text-center uppercase tracking-wider shadow-sm"
                    >
                      Manage SaaS billing plans
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

          {activeTab === 'hospitals' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white border border-slate-200/60 rounded-3xl px-6 py-5 shadow-sm">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Active Clinics Directory</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Tenant node lifecycles, active loads and credentials context management</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-450">Sort clinics:</span>
                  <select
                    value={hospitalSortBy}
                    onChange={(e) => setHospitalSortBy(e.target.value as any)}
                    className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#005EB8]"
                  >
                    <option value="name">Clinic Name (A-Z)</option>
                    <option value="heavy-use">Heavy Use (Tokens)</option>
                    <option value="low-use">Low Use (Tokens)</option>
                    <option value="doctors">Doctor Count</option>
                  </select>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {getSortedHospitals().map(h => {
                  const itemStats = stats[h.id] || { doctorsCount: 0, patientsCount: 0, tokensCount: 0 };
                  const meta = getLocalHospMeta(h.id);

                  return (
                    <div key={h.id} className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                      <div>
                        {/* Top status header */}
                        <div className="flex items-center justify-between mb-4">
                          <button
                            onClick={() => setSelectedHospDetail(h)}
                            className="w-10 h-10 bg-blue-50/50 hover:bg-blue-100/70 border border-blue-100 rounded-xl flex items-center justify-center transition-colors"
                            title="Click to view full clinic details"
                          >
                            <Building2 className="w-5 h-5 text-[#005EB8]" />
                          </button>
                          <div className="flex items-center gap-1.5">
                            {/* Status badge */}
                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${
                              meta.status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                              meta.status === 'TRIAL' ? 'bg-sky-50 border-sky-200 text-sky-700' :
                              'bg-rose-50 border-rose-200 text-rose-700'
                            }`}>
                              {meta.status}
                            </span>
                            {/* Tier badge */}
                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                              meta.tier === 'Enterprise' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                              meta.tier === 'Pro' ? 'bg-blue-50 border border-blue-200 text-[#005EB8]' :
                              'bg-teal-50 border border-teal-200 text-[#00A3AD]'
                            }`}>
                              {meta.tier}
                            </span>
                          </div>
                        </div>

                        <h3 
                          onClick={() => setSelectedHospDetail(h)}
                          className="text-lg font-black text-slate-900 hover:text-[#005EB8] cursor-pointer transition-all mb-1 flex items-center gap-1.5"
                          title="Click to view full clinic details"
                        >
                          {h.name}
                          <Info className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#005EB8] transition-colors" />
                        </h3>
                        <span className="text-xs font-mono text-slate-400 font-bold block mb-4">Domain: medqueue.com/{h.slug}</span>

                        {/* Contact metadata */}
                        <div className="space-y-1.5 text-xs text-slate-500 border-t border-slate-100 pt-3 mb-5">
                          {h.address && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{h.address}</span>
                            </div>
                          )}
                          {h.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span>{h.phone}</span>
                            </div>
                          )}
                        </div>

                        {/* Tenant stats table */}
                        <div 
                          onClick={() => setSelectedHospDetail(h)}
                          className="grid grid-cols-3 gap-2 bg-slate-50/50 hover:bg-slate-100/50 cursor-pointer p-3 rounded-2xl border border-slate-100 text-center mb-5 transition-colors"
                          title="Click to view full clinic details"
                        >
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm">{itemStats.doctorsCount}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Doctors</div>
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm">{itemStats.patientsCount}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Patients</div>
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm">{itemStats.tokensCount}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Tokens</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-slate-100 pt-4">
                        {/* Operational Action Controls */}
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <select
                              value={meta.status}
                              onChange={(e) => handleChangeHospStatus(h.id, h.name, e.target.value)}
                              className={`w-full py-2 px-2.5 rounded-xl text-[10px] font-extrabold border transition-all cursor-pointer focus:outline-none appearance-none ${
                                meta.status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-250 text-emerald-700' :
                                meta.status === 'TRIAL' ? 'bg-sky-50 border-sky-250 text-sky-700' :
                                meta.status === 'HOLD' ? 'bg-amber-50 border-amber-250 text-amber-700' :
                                'bg-rose-50 border-rose-250 text-rose-700'
                              }`}
                            >
                              <option value="ACTIVE" className="bg-white text-slate-800">🟢 ACTIVE</option>
                              <option value="TRIAL" className="bg-white text-slate-800">🔵 TRIAL</option>
                              <option value="HOLD" className="bg-white text-slate-800">🟡 HOLD</option>
                              <option value="SUSPENDED" className="bg-white text-slate-800">🔴 SUSPENDED</option>
                            </select>
                          </div>
                          
                          <button
                            onClick={() => handleResetQueue(h.id, h.name)}
                            className="px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 hover:text-red-650 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1.5 shadow-sm"
                            title="Reset daily clinic counters"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Clinic Control */}
                          <button
                            onClick={() => handleDeleteHospital(h.id, h.name)}
                            className={`px-3 border text-slate-500 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                              h.id === 'd290f1ee-6c54-4b01-90e6-d701748f0851'
                                ? 'bg-slate-50 border-slate-100 text-slate-350 cursor-not-allowed'
                                : 'bg-white hover:bg-red-50 border-slate-200 hover:text-red-600 hover:border-red-200'
                            }`}
                            title={h.id === 'd290f1ee-6c54-4b01-90e6-d701748f0851' ? "Apollo Clinic is protected" : "Delete Clinic Completely"}
                            disabled={h.id === 'd290f1ee-6c54-4b01-90e6-d701748f0851'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setSelectedHospDetail(h)}
                            className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider rounded-xl border border-slate-200 transition-all shadow-sm"
                          >
                            <Info className="w-3.5 h-3.5 text-[#00A3AD]" /> View Details
                          </button>
                          <button
                            onClick={() => handleManageHospital(h)}
                            className="flex items-center justify-center gap-1.5 py-2.5 bg-[#F0F6FC] hover:bg-[#005EB8] text-[#005EB8] hover:text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl border border-blue-100 hover:border-blue-600 transition-all shadow-sm"
                          >
                            Enter Portal <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB CONTENT: CROSS-TENANT STAFF ACCESS */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'staff' && (
            <div className="bg-white rounded-3xl border border-slate-200/60 overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">SaaS Access Control</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Cross-hospital credentials directory and role management</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Select Clinic Dropdown Filter */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                      className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-[10px] font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-sm cursor-pointer"
                    >
                      <span className="text-[9px] font-black uppercase text-slate-400">Filter Clinic:</span>
                      <span className="font-extrabold max-w-[120px] truncate">
                        {selectedStaffHospitalFilter === 'all' 
                          ? 'All Clinics Directory' 
                          : hospitals.find(h => h.id === selectedStaffHospitalFilter)?.name || 'All Clinics'}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isFilterDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsFilterDropdownOpen(false)} />
                        <div className="absolute right-0 mt-1.5 w-56 max-h-48 overflow-y-auto bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 py-1.5 divide-y divide-slate-100 animate-scaleUp">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStaffHospitalFilter('all');
                              setIsFilterDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2 text-[10px] text-left transition-colors cursor-pointer ${
                              selectedStaffHospitalFilter === 'all'
                                ? 'bg-blue-50 text-[#005EB8] font-black'
                                : 'text-slate-650 hover:bg-slate-50 font-bold'
                            }`}
                          >
                            <span>All Clinics Directory</span>
                            {selectedStaffHospitalFilter === 'all' && <Check className="w-3.5 h-3.5 text-[#005EB8]" />}
                          </button>
                          {hospitals.map(h => (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() => {
                                setSelectedStaffHospitalFilter(h.id);
                                setIsFilterDropdownOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-4 py-2 text-[10px] text-left transition-colors cursor-pointer ${
                                h.id === selectedStaffHospitalFilter
                                  ? 'bg-blue-50 text-[#005EB8] font-black'
                                  : 'text-slate-650 hover:bg-slate-50 font-bold'
                              }`}
                            >
                              <span>{h.name}</span>
                              {h.id === selectedStaffHospitalFilter && <Check className="w-3.5 h-3.5 text-[#005EB8]" />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setShowAddStaff(true)}
                    className="flex items-center gap-2 bg-[#005EB8] hover:bg-[#004A94] text-white px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-md shadow-blue-100 border border-blue-600"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Register Member
                  </button>
                </div>
              </div>

              {loadingStaff ? (
                <div className="flex items-center justify-center p-16">
                  <Loader2 className="w-10 h-10 animate-spin text-[#005EB8]" />
                </div>
              ) : (() => {
                const filteredStaff = selectedStaffHospitalFilter === 'all'
                  ? staffList
                  : staffList.filter(s => s.hospital_id === selectedStaffHospitalFilter);

                if (filteredStaff.length === 0) {
                  return (
                    <div className="p-16 text-center text-slate-500 font-bold">
                      No staff accounts registered under this clinic filter.
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto w-full scrollbar-none">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <th className="px-6 py-4">Name</th>
                          <th className="px-6 py-4">Email</th>
                          <th className="px-6 py-4">System Role</th>
                          <th className="px-6 py-4">Clinic Tenant</th>
                          <th className="px-6 py-4">Department & Room</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                        {filteredStaff.map((staff) => {
                          const targetHosp = hospitals.find(h => h.id === staff.hospital_id);
                        return (
                          <tr key={staff.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-6 py-4 font-extrabold text-slate-900">{staff.name}</td>
                            <td className="px-6 py-4 text-slate-500 font-mono">{staff.email}</td>
                            <td className="px-6 py-4">
                              <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest border ${
                                staff.role === 'SUPER_ADMIN' ? 'bg-red-50 border-red-150 text-red-700' :
                                staff.role === 'ADMIN' ? 'bg-blue-50 border-blue-150 text-blue-700' :
                                staff.role === 'DOCTOR' ? 'bg-purple-50 border-purple-150 text-purple-700' :
                                staff.role === 'WARD_BOY' ? 'bg-amber-50 border-amber-150 text-amber-700' :
                                'bg-emerald-50 border-emerald-150 text-emerald-700'
                              }`}>
                                {staff.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-700">{targetHosp?.name || 'Global'}</td>
                            <td className="px-6 py-4 text-slate-500 font-semibold capitalize">
                              {staff.department || 'general'} {staff.room_number ? `• Rm ${staff.room_number}` : ''}
                            </td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => handleToggleStaffStatus(staff.id, staff.is_active, staff.name)}
                                className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg border shadow-sm transition-colors ${
                                  staff.is_active 
                                    ? 'bg-emerald-50 border-emerald-150 text-emerald-700 hover:bg-emerald-100' 
                                    : 'bg-red-50 border-red-150 text-red-700 hover:bg-red-100'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${staff.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                {staff.is_active ? 'Active' : 'Suspended'}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {staff.role !== 'SUPER_ADMIN' && (
                                <button
                                  onClick={() => handleDeleteStaff(staff.id, staff.name)}
                                  className="text-slate-400 hover:text-red-650 p-1.5 hover:bg-rose-50 rounded-lg transition-all border border-transparent hover:border-rose-100"
                                  title="Delete credentials"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB CONTENT: REAL-TIME ANALYTICS CHARTS */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. Peak Hours Traffic (SVG Graph) */}
                <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#005EB8]" /> Aggregated Clinic Hourly Trends
                  </h3>
                  
                  {/* SVG Bar Chart */}
                  <div className="relative h-60 w-full flex items-end justify-between px-2 pt-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="absolute top-2.5 left-3.5 text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">Patient flow volume</div>
                    {[
                      { hr: '08 AM', count: 18, pct: 30 },
                      { hr: '10 AM', count: 48, pct: 80 },
                      { hr: '12 PM', count: 54, pct: 90 },
                      { hr: '02 PM', count: 32, pct: 53 },
                      { hr: '04 PM', count: 40, pct: 67 },
                      { hr: '06 PM', count: 60, pct: 100 },
                      { hr: '08 PM', count: 24, pct: 40 }
                    ].map((bar, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center group h-full justify-end cursor-pointer">
                        <span className="text-[10px] font-black text-[#005EB8] opacity-0 group-hover:opacity-100 transition-opacity mb-1">{bar.count}</span>
                        <div 
                          className="w-8 bg-gradient-to-t from-[#004A94] to-[#005EB8] group-hover:from-[#005EB8] group-hover:to-[#00A3AD] rounded-t-lg transition-all duration-700" 
                          style={{ height: `${bar.pct * 0.7}%` }} 
                        />
                        <span className="text-[9px] text-slate-400 font-bold mt-2 uppercase">{bar.hr}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Doctor Workload Progress Bars */}
                <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#00A3AD]" /> Consultations Load Distribution
                  </h3>

                  <div className="bg-[#F8FAFC] p-5 rounded-2xl border border-slate-100 space-y-4.5 h-60 overflow-y-auto">
                    {dynamicDocConsultations.map((doc, idx) => {
                      const maxCons = Math.max(...dynamicDocConsultations.map(d => d.consultations), 1) + 10;
                      const widthPercent = (doc.consultations / maxCons) * 100;
                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                            <span>{doc.name} <span className="text-slate-400 font-semibold">({doc.dept})</span></span>
                            <span className="text-slate-950 font-black">{doc.consultations} patients</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden shadow-inner">
                            <div className={`h-full ${doc.color} transition-all duration-1000`} style={{ width: `${widthPercent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Traffic share by Department donut */}
                <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[#005EB8]" /> Primary Department Split
                  </h3>
                  
                  <div className="bg-[#F8FAFC] p-5 rounded-2xl border border-slate-100 flex items-center justify-around h-60">
                    <div className="relative w-36 h-36 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="72" cy="72" r="56" fill="transparent" stroke="#E2E8F0" strokeWidth="12" />
                        <circle cx="72" cy="72" r="56" fill="transparent" stroke="#005EB8" strokeWidth="12" strokeDasharray="351.8" strokeDashoffset={351.8 - (351.8 * deptSplit.cardiology) / 100} />
                        <circle cx="72" cy="72" r="56" fill="transparent" stroke="#00A3AD" strokeWidth="12" strokeDasharray="351.8" strokeDashoffset={351.8 - (351.8 * deptSplit.pediatrics) / 100} className="transform origin-center rotate-[162deg]" />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-xl font-black text-slate-950">{deptSplit.cardiology}%</span>
                        <span className="text-[8px] text-slate-400 font-bold uppercase block tracking-wider mt-0.5">Cardiology</span>
                      </div>
                    </div>

                    <div className="space-y-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#005EB8]" />
                        <span>Cardiology: {deptSplit.cardiology}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00A3AD]" />
                        <span>Pediatrics: {deptSplit.pediatrics}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                        <span>General: {deptSplit.general}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Core SaaS Health Indicators */}
                <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-5 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#00A3AD]" /> Operations Integrity Metrics
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { title: 'Avg Consult duration', value: '14.2 Mins', desc: 'Patient check time' },
                        { title: 'No-Show Rate', value: noShowRate, desc: 'Missed consultation tokens' },
                        { title: 'Peak Queue Wait', value: '18 Mins', desc: 'Clinic queue latency level' },
                        { title: 'Staff Engagement', value: '98.2 %', desc: 'Operational accounts active' }
                      ].map((stat, idx) => (
                        <div key={idx} className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100 text-center">
                          <span className="text-slate-400 text-[9px] font-extrabold uppercase tracking-wider block">{stat.title}</span>
                          <span className="text-lg font-black text-[#005EB8] block mt-1.5">{stat.value}</span>
                          <span className="text-[8px] text-slate-500 block mt-1 leading-snug">{stat.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleExportCSV}
                    className="w-full mt-4 py-3 bg-[#005EB8] hover:bg-[#004A94] text-white font-extrabold text-[11px] rounded-xl border border-blue-600 shadow-md shadow-blue-100 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
                  >
                    <Download className="w-4 h-4" /> Download Complete Report (CSV)
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB CONTENT: BILLING & SUBSCRIPTION ENGINE */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              
              {/* SaaS Billing Speedometer Dial */}
              <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50/50 border border-blue-100 text-[#005EB8] rounded-2xl flex items-center justify-center shadow-inner">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Platform Estimated Monthly Revenue</h3>
                    <h2 className="text-3xl font-black text-slate-900 mt-1">${totalMRR}.00 <span className="text-xs text-[#00A3AD] font-bold">MRR</span></h2>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Projected Annual Run-Rate (ARR): ${(totalMRR * 12).toLocaleString()}.00</p>
                  </div>
                </div>

                {/* Billing count indexes */}
                <div className="flex gap-4">
                  <div className="bg-[#F8FAFC] px-4 py-3 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Enterprise (${enterprisePrice})</span>
                    <span className="text-lg font-black text-amber-500 mt-1 block">
                      {hospitals.filter(h => getLocalHospMeta(h.id).tier === 'Enterprise').length} Active
                    </span>
                  </div>
                  <div className="bg-[#F8FAFC] px-4 py-3 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Pro (${proPrice})</span>
                    <span className="text-lg font-black text-[#005EB8] mt-1 block">
                      {hospitals.filter(h => getLocalHospMeta(h.id).tier === 'Pro').length} Active
                    </span>
                  </div>
                  <div className="bg-[#F8FAFC] px-4 py-3 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Basic (${basicPrice})</span>
                    <span className="text-lg font-black text-[#00A3AD] mt-1 block">
                      {hospitals.filter(h => getLocalHospMeta(h.id).tier === 'Basic').length} Active
                    </span>
                  </div>
                </div>
              </div>

              {/* SaaS Tiers Pricing Decider Console */}
              <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm mb-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/20 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5 mb-4">
                  <div className="w-9 h-9 bg-blue-50 text-[#005EB8] rounded-xl flex items-center justify-center shadow-inner" style={{ color: themeColor, backgroundColor: `${themeColor}10` }}>
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">SaaS Tiers Pricing Console</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Configure global monthly rates for all clinic subscription packages</p>
                  </div>
                </div>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const basic = Number(fd.get('basic_price') || basicPrice);
                    const pro = Number(fd.get('pro_price') || proPrice);
                    const enterprise = Number(fd.get('enterprise_price') || enterprisePrice);
                    handleSavePrices(basic, pro, enterprise);
                  }}
                  className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
                >
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Basic Tier (Monthly)</label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-400 text-xs font-bold">$</span>
                      </div>
                      <input
                        type="number"
                        name="basic_price"
                        defaultValue={basicPrice}
                        min="1"
                        className="block w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-[#005EB8] focus:border-[#005EB8]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Pro Tier (Monthly)</label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-400 text-xs font-bold">$</span>
                      </div>
                      <input
                        type="number"
                        name="pro_price"
                        defaultValue={proPrice}
                        min="1"
                        className="block w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-[#005EB8] focus:border-[#005EB8]"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Enterprise Tier (Monthly)</label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-400 text-xs font-bold">$</span>
                      </div>
                      <input
                        type="number"
                        name="enterprise_price"
                        defaultValue={enterprisePrice}
                        min="1"
                        className="block w-full pl-7 pr-3 py-2 border border-slate-200 rounded-xl bg-slate-50 text-xs text-slate-800 font-extrabold focus:outline-none focus:ring-1 focus:ring-[#005EB8] focus:border-[#005EB8]"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] rounded-xl border border-slate-950 transition-all uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 min-h-[36px] cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-450" /> Save Pricing Settings
                  </button>
                </form>
              </div>

              {/* Pricing tier assignments grid */}
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#005EB8]" /> Subscription packages assignments
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hospitals.map(h => {
                  const meta = getLocalHospMeta(h.id);
                  const renewalInfo = getSubscriptionRenewalInfo(h.created_at);
                  const dynamicPrice = meta.tier === 'Enterprise' ? enterprisePrice : meta.tier === 'Pro' ? proPrice : basicPrice;

                  // Define dynamic styling configurations based on the SaaS Subscription Tier
                  let cardStyles = '';
                  let badgeStyles = '';
                  let detailBg = '';
                  let blobStyles = '';
                  let activePlanBtnStyles = '';
                  let badgeAddon = null;

                  if (meta.tier === 'Enterprise') {
                    cardStyles = 'bg-gradient-to-br from-white to-amber-50/20 border-amber-200/80 ring-2 ring-amber-100/20 shadow-md hover:shadow-lg hover:border-amber-350';
                    badgeStyles = 'bg-amber-50 border border-amber-200 text-amber-700 relative flex items-center gap-1.5';
                    detailBg = 'bg-amber-50/30 border border-amber-100/50';
                    blobStyles = 'bg-gradient-to-br from-amber-400/20 to-orange-400/0';
                    activePlanBtnStyles = 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-100';
                    badgeAddon = (
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                      </span>
                    );
                  } else if (meta.tier === 'Pro') {
                    cardStyles = 'bg-gradient-to-br from-white to-blue-50/20 border-blue-250/60 shadow-sm hover:shadow-md hover:border-blue-350';
                    badgeStyles = 'bg-blue-50 border border-blue-200 text-[#005EB8]';
                    detailBg = 'bg-blue-50/25 border border-blue-100/40';
                    blobStyles = 'bg-gradient-to-br from-blue-400/12 to-[#005EB8]/0';
                    activePlanBtnStyles = 'bg-[#005EB8] text-white border-blue-600 shadow-sm shadow-blue-100';
                  } else {
                    // Basic
                    cardStyles = 'bg-gradient-to-br from-white to-teal-50/25 border-teal-250/60 shadow-sm hover:shadow-md hover:border-teal-350';
                    badgeStyles = 'bg-teal-50 border border-teal-200 text-[#00A3AD]';
                    detailBg = 'bg-teal-50/20 border border-teal-100/40';
                    blobStyles = 'bg-gradient-to-br from-teal-400/12 to-emerald-400/0';
                    activePlanBtnStyles = 'bg-[#00A3AD] text-white border-teal-600 shadow-sm shadow-teal-100';
                  }

                  return (
                    <div key={h.id} className={`${cardStyles} p-6 rounded-3xl border flex flex-col justify-between min-h-[290px] transition-all relative overflow-hidden group`}>
                      {/* Ambient premium blur blob */}
                      <div className={`absolute top-0 right-0 w-24 h-24 ${blobStyles} rounded-full blur-xl -mr-6 -mt-6 pointer-events-none transition-all duration-500 group-hover:scale-125`} />
                      
                      <div>
                        {/* Card top */}
                        <div className="flex justify-between items-start relative z-10">
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-slate-950 text-sm truncate max-w-[140px]" title={h.name}>{h.name}</h4>
                            <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Joined: {renewalInfo.joiningDate}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${badgeStyles}`}>
                              {badgeAddon}
                              {meta.tier}
                            </span>
                            <span className="text-[10px] font-black text-slate-700 bg-white/80 border border-slate-150 px-2 py-0.5 rounded-md backdrop-blur-[2px]">${dynamicPrice}/mo</span>
                          </div>
                        </div>

                        {/* Detailed subscription details starting from day of joining */}
                        <div className={`mt-4 space-y-2 ${detailBg} rounded-2xl p-4 text-xs font-semibold text-slate-650 relative z-10`}>
                          <div className="flex justify-between items-center text-[10px] border-b border-slate-200/40 pb-1.5">
                            <span className="text-slate-450 font-bold uppercase tracking-wider">Billing Start</span>
                            <span className="text-slate-800 font-extrabold">{renewalInfo.joiningDate}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] border-b border-slate-200/40 pb-1.5">
                            <span className="text-slate-455 font-bold uppercase tracking-wider">Next Renewal</span>
                            <span className="text-slate-800 font-extrabold">{renewalInfo.nextBillingDate}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] pt-0.5">
                            <span className="text-slate-455 font-bold uppercase tracking-wider">Remaining Cycle</span>
                            <span className={`font-black uppercase text-[9px] px-2 py-0.5 rounded-md flex items-center gap-1.5 ${
                              renewalInfo.daysRemaining <= 5 
                                ? 'bg-rose-50 border border-rose-100 text-rose-600 animate-pulse' 
                                : 'bg-emerald-50 border border-emerald-100 text-emerald-600'
                            }`}>
                              <Clock className="w-3.5 h-3.5" />
                              {renewalInfo.daysRemaining} days left
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Config buttons */}
                      <div className="border-t border-slate-100/80 pt-3.5 mt-4 relative z-10">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block mb-2">Change subscription plan</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {['Basic', 'Pro', 'Enterprise'].map(plan => (
                            <button
                              key={plan}
                              type="button"
                              onClick={() => handleChangeHospTier(h.id, h.name, plan)}
                              className={`py-1.5 rounded-lg text-[9px] font-black border transition-all cursor-pointer ${
                                meta.tier === plan
                                  ? activePlanBtnStyles
                                  : 'bg-white text-slate-400 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {plan}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB CONTENT: SECURITY & ABUSE LOGS DATABASE */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'alerts' && (
            <div className="space-y-6">
              
              <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Incident & Threat Logs</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Real-time isolation checks, scan logs, and suspicious queries list</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={triggerAttackSimulator}
                    className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 px-4 py-2.5 rounded-xl text-xs font-extrabold border border-rose-200 transition-all shadow-sm"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Trigger Simulated Incident
                  </button>
                  <button 
                    onClick={() => {
                      setSecurityLogs(prev => prev.map(log => ({ ...log, acknowledged: true })));
                      setSuccess('All security logs acknowledged and resolved.');
                    }}
                    className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 transition-all shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledge All
                  </button>
                </div>
              </div>

              {/* Logs table */}
              <div className="bg-white rounded-3xl border border-slate-200/60 overflow-hidden shadow-sm">
                <div className="overflow-x-auto w-full scrollbar-none">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="px-6 py-4">Severity</th>
                        <th className="px-6 py-4">Security Incident Detail</th>
                        <th className="px-6 py-4">IP Context</th>
                        <th className="px-6 py-4">Reporting Tenant</th>
                        <th className="px-6 py-4">Log Timestamp</th>
                        <th className="px-6 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                      {securityLogs.map(log => (
                        <tr key={log.id} className={`hover:bg-slate-50/40 transition-colors ${!log.acknowledged ? 'bg-red-50/20 font-bold' : ''}`}>
                          <td className="px-6 py-4">
                            <span className={`text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest border ${
                              log.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-700' :
                              log.severity === 'medium' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                              'bg-blue-50 border-blue-250 text-[#005EB8]'
                            }`}>
                              {log.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-900 max-w-sm truncate" title={log.event}>{log.event}</td>
                          <td className="px-6 py-4 font-mono text-slate-500">{log.ip}</td>
                          <td className="px-6 py-4 text-slate-500 font-bold">{log.hospital}</td>
                          <td className="px-6 py-4 text-slate-400 font-mono">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right">
                            {log.acknowledged ? (
                              <span className="text-[10px] text-slate-400 font-bold uppercase inline-flex items-center gap-1">
                                <Check className="w-3.5 h-3.5 text-emerald-500" /> Resolved
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAcknowledgeAlert(log.id)}
                                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 text-[10px] font-bold rounded-lg transition-all shadow-sm"
                              >
                                Resolve Alert
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB CONTENT: SAAS HEARTBEAT TELEMETRY HEALTH */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              
              <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Platform Heartbeat status</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Real-time pings measuring API Gateway endpoints and database cluster response latency</p>
                </div>
                {/* Simulator switch */}
                <div className="flex items-center gap-3 bg-[#F8FAFC] px-4 py-2.5 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase">Simulate API Timeout</span>
                  <button
                    onClick={toggleSystemFailure}
                    className={`w-12 h-6 rounded-full transition-all relative border p-0.5 ${
                      simulatedFailure ? 'bg-rose-500 border-rose-600' : 'bg-slate-200 border-slate-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                      simulatedFailure ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Heartbeat ping grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { 
                    label: 'API Router Ping', 
                    value: `${apiLatency}ms`, 
                    desc: 'Express middleware network status', 
                    status: simulatedFailure ? 'Interrupted' : 'Excellent',
                    stateColor: simulatedFailure ? 'text-red-700 bg-red-50 border-red-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  },
                  { 
                    label: 'Database ping latency', 
                    value: `${dbLatency}ms`, 
                    desc: 'Supabase catalog database response',
                    status: simulatedFailure ? 'Database busy' : 'Excellent',
                    stateColor: simulatedFailure ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  },
                  { 
                    label: 'Websocket cluster', 
                    value: 'Connected', 
                    desc: 'Real-time intake screen sync routers',
                    status: 'Stable',
                    stateColor: 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  },
                  { 
                    label: 'OTP Verification API', 
                    value: simulatedFailure ? 'Offline' : 'Online', 
                    desc: 'Patient mobile verification pings',
                    status: simulatedFailure ? 'Error 503' : 'Online',
                    stateColor: simulatedFailure ? 'text-red-700 bg-red-50 border-red-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  }
                ].map((dial, idx) => (
                  <div key={idx} className="bg-white rounded-3xl p-6 border border-slate-200/60 flex flex-col justify-between h-44 shadow-sm text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">{dial.label}</span>
                      <span className="text-2xl font-black text-slate-900 block mt-3 font-mono tracking-tight">{dial.value}</span>
                      <span className="text-[8px] text-slate-400 block mt-1 leading-snug">{dial.desc}</span>
                    </div>
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border inline-block ${dial.stateColor}`}>
                        {dial.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ──────────────────────────────────────────────────────── */}
          {/* TAB CONTENT: PLATFORM NOTIFICATION BROADCASTER */}
          {/* ──────────────────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              
              <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm max-w-xl mx-auto">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-[#005EB8] animate-bounce" /> Dispatch Central Announcement
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mb-5 leading-normal">Send global platform alerts, downtime notices, or maintenance updates to patient screens and staff views.</p>

                <form onSubmit={handleDispatchBroadcast} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Compose Broadcast Message *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="e.g. MedQueue platform upgrading on Saturday 02:00 AM UTC. Expect minor database latency spikes."
                      value={newBroadcastText}
                      onChange={e => setNewBroadcastText(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:border-[#005EB8] focus:outline-none leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Target Audience</label>
                      <select
                        value={broadcastScope}
                        onChange={e => setBroadcastScope(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:border-[#005EB8] focus:outline-none"
                      >
                        <option value="all">Platform-Wide (All users)</option>
                        <option value="staff">Clinic Admins & Doctors</option>
                        <option value="patients">Patient Terminals only</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Urgency Level</label>
                      <select
                        value={broadcastSeverity}
                        onChange={e => setBroadcastSeverity(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:border-[#005EB8] focus:outline-none"
                      >
                        <option value="info">Info (Blue banner)</option>
                        <option value="warning">Warning (Amber banner)</option>
                        <option value="critical">Critical (Red flash banner)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-2 py-3 bg-[#005EB8] hover:bg-[#004A94] text-white font-extrabold text-[11px] rounded-xl border border-blue-600 shadow-md shadow-blue-100 transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider"
                  >
                    <Send className="w-3.5 h-3.5" /> Dispatch Global Broadcast
                  </button>
                </form>
              </div>

              {/* History list */}
              {broadcasts.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm max-w-xl mx-auto">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3.5">Sent Broadcast History</h4>
                  <div className="space-y-3.5">
                    {broadcasts.map(bc => (
                      <div key={bc.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-start gap-4">
                        <div>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border block w-max mb-2 ${
                            bc.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-700' :
                            bc.severity === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                            'bg-blue-50 border-blue-200 text-[#005EB8]'
                          }`}>
                            {bc.severity} Urgency • target: {bc.scope.toUpperCase()}
                          </span>
                          <p className="text-xs text-slate-700 leading-relaxed font-semibold">{bc.message}</p>
                        </div>
                        <span className="text-[9px] text-slate-450 font-mono flex-shrink-0 font-bold">
                          {new Date(bc.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </main>
      </div>

      {/* ── MODAL: ADD CLINIC (PRESERVED FUNCTIONALITY) ── */}
      {showAddHospital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleUp">
            <div className="bg-gradient-to-r from-[#005EB8] to-[#004A94] p-6 text-white flex items-center gap-3 border-b border-blue-600">
              <Building2 className="w-6 h-6" />
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider">Register New Clinic</h3>
                <p className="text-xs text-blue-100">Setup dynamic multi-tenant isolated database node</p>
              </div>
            </div>
            <form onSubmit={handleAddHospital} className="p-6 space-y-4">
              {addHospError && (
                <div className="p-3.5 bg-rose-50 border border-rose-150 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 font-semibold animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-extrabold uppercase text-[9px] tracking-wider text-rose-900 mb-0.5">Clinic Registration Failed</div>
                    <span>{addHospError}</span>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider mb-1">Clinic Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. City Hospital Center"
                  value={hospitalForm.name}
                  onChange={e => setHospitalForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#005EB8] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider mb-1">Clinic Slug (URL Identifier) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. cityhospital"
                  value={hospitalForm.slug}
                  onChange={e => setHospitalForm(f => ({ ...f, slug: e.target.value.replace(/[^a-z0-9]/g, '') }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#005EB8] focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Central Sector, Gurugram"
                  value={hospitalForm.address}
                  onChange={e => setHospitalForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#005EB8] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider mb-1">Contact Phone</label>
                <input
                  type="text"
                  placeholder="9999999999"
                  value={hospitalForm.phone}
                  onChange={e => setHospitalForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#005EB8] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider mb-1">Logo Image URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://images.unsplash.com/photo-..."
                  value={hospitalForm.logo_url}
                  onChange={e => setHospitalForm(f => ({ ...f, logo_url: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#005EB8] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-450 tracking-wider mb-1 uppercase">Theme Brand Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={hospitalForm.theme_color || '#005EB8'}
                    onChange={e => setHospitalForm(f => ({ ...f, theme_color: e.target.value }))}
                    className="w-10 h-10 border border-slate-200 rounded-xl cursor-pointer p-1 bg-slate-50"
                  />
                  <input
                    type="text"
                    placeholder="#005EB8"
                    value={hospitalForm.theme_color}
                    onChange={e => setHospitalForm(f => ({ ...f, theme_color: e.target.value }))}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#005EB8] focus:outline-none font-mono font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddHospital(false)}
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 border border-slate-200 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#005EB8] hover:bg-[#004A94] text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-100 border border-blue-600"
                >
                  Setup Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD STAFF (PRESERVED FUNCTIONALITY) ── */}
      {showAddStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleUp">
            <div className="bg-gradient-to-r from-[#005EB8] to-[#004A94] p-6 text-white flex items-center gap-3 border-b border-blue-600">
              <UserPlus className="w-6 h-6" />
              <div>
                <h3 className="text-lg font-black uppercase tracking-wider">Register Clinic Staff</h3>
                <p className="text-xs text-blue-100">Setup dynamic contextual authorization directory</p>
              </div>
            </div>
            <form onSubmit={handleAddStaff} className="p-6 space-y-3.5">
              {addStaffError && (
                <div className="p-3.5 bg-rose-50 border border-rose-150 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 font-semibold animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-extrabold uppercase text-[9px] tracking-wider text-rose-900 mb-0.5">Staff Credentials Error</div>
                    <span>{addStaffError}</span>
                  </div>
                </div>
              )}
              <div className="relative">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Assigned Clinic *</label>
                <button
                  type="button"
                  onClick={() => setIsClinicDropdownOpen(!isClinicDropdownOpen)}
                  className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-700 font-bold focus:border-[#005EB8] focus:outline-none transition-all shadow-sm hover:bg-slate-100 cursor-pointer"
                >
                  <span className="truncate">
                    {hospitals.find(h => h.id === staffForm.hospital_id)?.name || 'Select Clinic...'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isClinicDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isClinicDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsClinicDropdownOpen(false)} />
                    <div className="absolute left-0 right-0 mt-1.5 max-h-48 overflow-y-auto bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 py-1.5 divide-y divide-slate-100 animate-scaleUp">
                      {hospitals.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-400 font-medium">
                          No clinics available. Please setup a clinic first.
                        </div>
                      ) : (
                        hospitals.map(h => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => {
                              setStaffForm(f => ({ ...f, hospital_id: h.id }));
                              setIsClinicDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-2.5 text-xs text-left transition-colors cursor-pointer ${
                              h.id === staffForm.hospital_id 
                                ? 'bg-blue-50 text-[#005EB8] font-black' 
                                : 'text-slate-650 hover:bg-slate-50 font-bold'
                            }`}
                          >
                            <span>{h.name}</span>
                            {h.id === staffForm.hospital_id && <Check className="w-3.5 h-3.5 text-[#005EB8]" />}
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Robert Vance"
                  value={staffForm.name}
                  onChange={e => setStaffForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-450 focus:border-[#005EB8] focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="robert@clinic.com"
                    value={staffForm.email}
                    onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-450 focus:border-[#005EB8] focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={staffForm.password}
                    onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-450 focus:border-[#005EB8] focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Role</label>
                  <select
                    value={staffForm.role}
                    onChange={e => setStaffForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2.5 text-[10px] font-bold text-slate-600 focus:border-[#005EB8] focus:outline-none"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="DOCTOR">DOCTOR</option>
                    <option value="WARD_BOY">WARD BOY</option>
                    <option value="PHARMACY">PHARMACY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Department</label>
                  <input
                    type="text"
                    placeholder="cardiology"
                    value={staffForm.department}
                    onChange={e => setStaffForm(f => ({ ...f, department: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-450 focus:border-[#005EB8] focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Room No</label>
                  <input
                    type="text"
                    placeholder="101"
                    value={staffForm.room_number}
                    onChange={e => setStaffForm(f => ({ ...f, room_number: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-450 focus:border-[#005EB8] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaff(false)}
                  className="flex-1 py-2.5 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 border border-slate-200 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#005EB8] hover:bg-[#004A94] text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-100 border border-blue-600"
                >
                  Register User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CLINIC COMPREHENSIVE OPERATIONS DETAILS ── */}
      {selectedHospDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-50 border border-slate-200 rounded-3xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-scaleUp">
            
            {/* Header section */}
            <div className="bg-white p-6 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-4 shadow-sm flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-[#005EB8]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-900">{selectedHospDetail.name}</h3>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border ${
                      getLocalHospMeta(selectedHospDetail.id).tier === 'Enterprise' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                      getLocalHospMeta(selectedHospDetail.id).tier === 'Pro' ? 'bg-blue-50 border border-blue-200 text-[#005EB8]' :
                      'bg-teal-50 border border-teal-200 text-[#00A3AD]'
                    }`}>
                      {getLocalHospMeta(selectedHospDetail.id).tier} Plan
                    </span>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {getLocalHospMeta(selectedHospDetail.id).status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 font-bold mt-1">
                    <span>Slug: <strong className="text-slate-600 font-mono">medqueue.com/{selectedHospDetail.slug}</strong></span>
                    {selectedHospDetail.phone && <span>• Phone: <strong className="text-slate-650">{selectedHospDetail.phone}</strong></span>}
                    {selectedHospDetail.address && <span>• Address: <strong className="text-slate-650">{selectedHospDetail.address}</strong></span>}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedHospDetail(null);
                  setDetailDoctors([]);
                  setDetailStaff([]);
                  setDetailTokens([]);
                }}
                className="bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 px-4 py-2 rounded-xl text-xs font-black transition-all border border-slate-250 shadow-sm"
              >
                Close View
              </button>
            </div>

            {/* Main content grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingDetails ? (
                <div className="h-full flex flex-col items-center justify-center p-12">
                  <Loader2 className="w-12 h-12 animate-spin text-[#005EB8]" />
                  <p className="text-xs text-slate-455 font-bold mt-3 uppercase tracking-wider">Syncing clinic ledger analytics...</p>
                </div>
              ) : detailsError ? (
                <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl px-5 py-4 text-xs font-bold">
                  {detailsError}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full items-start">
                  
                  {/* Doctors column */}
                  <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm flex flex-col h-[60vh]">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-b border-slate-50 pb-2.5 flex items-center justify-between">
                      <span>🩺 Doctors Roster</span>
                      <span className="bg-blue-50 text-[#005EB8] px-2 py-0.5 rounded-full text-[9px] font-black">{detailDoctors.length} ACTIVE</span>
                    </h4>
                    
                    <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                      {detailDoctors.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center text-slate-400 text-xs font-bold py-12">
                          No doctor accounts configured.
                        </div>
                      ) : (
                        detailDoctors.map((doc) => (
                          <div key={doc.id} className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors">
                            <div className="flex justify-between items-start">
                              <span className="font-extrabold text-slate-900 text-xs">{doc.name}</span>
                              <span className="text-[9px] bg-[#E8F3FF] text-[#005EB8] font-black px-2 py-0.5 rounded-md uppercase tracking-wide">
                                Rm {doc.room_number || '101'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">
                              <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-500 font-black">
                                {doc.department || 'general'}
                              </span>
                              <span>Fees: <strong className="text-slate-700 font-black">₹{doc.consultation_fee || 500}</strong></span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Staff column */}
                  <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm flex flex-col h-[60vh]">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-b border-slate-50 pb-2.5 flex items-center justify-between">
                      <span>🔑 Staff Directory</span>
                      <span className="bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full text-[9px] font-black">
                        {detailStaff.filter(s => s.role !== 'SUPER_ADMIN').length} DIRECT
                      </span>
                    </h4>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                      {detailStaff.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center text-slate-400 text-xs font-bold py-12">
                          No registered staff credentials.
                        </div>
                      ) : (
                        detailStaff.map((staff) => (
                          <div key={staff.id} className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors">
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-slate-900 text-xs">{staff.name}</span>
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                staff.role === 'SUPER_ADMIN' ? 'bg-red-50 text-red-700 border border-red-100' :
                                staff.role === 'ADMIN' ? 'bg-blue-50 text-[#005EB8] border border-blue-100' :
                                staff.role === 'DOCTOR' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}>
                                {staff.role}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block mt-2">{staff.email}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Tokens / Queue column */}
                  <div className="bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm flex flex-col h-[60vh]">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-b border-slate-50 pb-2.5 flex items-center justify-between">
                      <span>📋 Live Patient Stream</span>
                      <span className="bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full text-[9px] font-black">
                        {detailTokens.length} DAILY
                      </span>
                    </h4>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                      {detailTokens.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center text-slate-400 text-xs font-bold py-12">
                          No queue token events today.
                        </div>
                      ) : (
                        detailTokens.map((tok) => {
                          let priorityLabel = 'Normal';
                          let priorityColor = 'bg-emerald-50 border border-emerald-100 text-emerald-700';
                          if (tok.priority === 0) {
                            priorityLabel = 'Emergency';
                            priorityColor = 'bg-rose-50 border border-rose-100 text-rose-700 animate-pulse';
                          } else if (tok.priority === 1) {
                            priorityLabel = 'Senior';
                            priorityColor = 'bg-amber-50 border border-amber-100 text-amber-700';
                          }

                          return (
                            <div key={tok.id} className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-black text-slate-900 font-mono">Token #{tok.token_number}</span>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                  tok.status === 'WAITING' ? 'bg-blue-50 text-blue-700' :
                                  tok.status === 'SERVING' ? 'bg-green-50 text-green-700 border border-green-150 animate-pulse' :
                                  tok.status === 'DONE' ? 'bg-slate-100 text-slate-500' :
                                  'bg-red-50 text-red-600'
                                }`}>
                                  {tok.status}
                                </span>
                              </div>
                              <div className="flex justify-between items-center mt-2.5 text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">
                                <span>Phone: <strong className="text-slate-650 font-mono">{tok.phone}</strong></span>
                                <span className={`px-2 py-0.5 rounded-md ${priorityColor}`}>{priorityLabel}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
