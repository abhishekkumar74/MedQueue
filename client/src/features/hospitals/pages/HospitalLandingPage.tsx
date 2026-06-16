import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { TenantConfig } from '../../../lib/tenant';
import {
  Building2, Calendar, Clock, AlertTriangle, Users,
  ArrowRight, MapPin, Activity, HeartPulse, Stethoscope,
  ShieldAlert, Mail, Map, Sparkles, Facebook, Instagram,
  Twitter, Linkedin, Youtube, CheckCircle2
} from 'lucide-react';
import { todayStartUTC } from '../../../lib/dateUtils';

interface Props {
  tenant: TenantConfig;
  navigate: (p: any, state?: any) => void;
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  department: string;
  room_number: string;
  is_available: boolean;
}

export default function HospitalLandingPage({ tenant, navigate }: Props) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const [activeDoctorsCount, setActiveDoctorsCount] = useState<number>(0);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const [selectedDept, setSelectedDept] = useState<string>('All');

  const [socialLinks, setSocialLinks] = useState({
    instagram: 'https://instagram.com',
    facebook: 'https://facebook.com',
    twitter: 'https://twitter.com',
    linkedin: 'https://linkedin.com',
    youtube: 'https://youtube.com',
  });

  const [contactForm, setContactForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: ''
  });
  const [submittingContact, setSubmittingContact] = useState(false);
  const [showContactSuccess, setShowContactSuccess] = useState(false);

  useEffect(() => {
    async function loadSocialLinks() {
      if (!tenant?.id) return;
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', `social_${tenant.id}`)
          .maybeSingle();

        if (data?.value) {
          setSocialLinks(prev => ({
            ...prev,
            ...(data.value as any)
          }));
        }
      } catch (err) {
        console.warn('Failed to load social links setting', err);
      }
    }
    loadSocialLinks();
  }, [tenant?.id]);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.phone) return;
    setSubmittingContact(true);
    try {
      const message = `CONTACT FORM: Message from ${contactForm.firstName} ${contactForm.lastName} (${contactForm.phone}): "${contactForm.message.substring(0, 40)}${contactForm.message.length > 40 ? '...' : ''}"`;
      await supabase.from('activity_logs').insert({
        message,
        category: 'queue',
        badge_color: 'bg-[#005EB8]'
      });

      setShowContactSuccess(true);
      setContactForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        message: ''
      });
    } catch (err) {
      console.error('Failed to submit contact query', err);
    } finally {
      setSubmittingContact(false);
    }
  };

  // Dynamic branch configurations
  const branchMeta: Record<string, {
    timings: string;
    emergencyPhone: string;
    departments: string[];
    description: string;
    heroImage: string;
  }> = {
    apollo: {
      timings: '24/7 Emergency & Outpatient Care',
      emergencyPhone: '+91 99999 99991',
      departments: ['General Medicine', 'Pediatrics', 'Cardiology', 'Emergency Care', 'Dermatology'],
      description: 'Serving Delhi with state-of-the-art diagnostic imaging, round-the-clock cardiac care, and intelligent queuing technologies.',
      heroImage: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=600'
    },
    max: {
      timings: '08:00 AM - 10:00 PM Daily',
      emergencyPhone: '+91 99999 99992',
      departments: ['General Medicine', 'Orthopedics', 'Neurology', 'Pediatrics', 'ENT'],
      description: 'Noida flagship super-specialty health hub incorporating modern surgery facilities, custom diagnostics, and digital patient services.',
      heroImage: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&q=80&w=600'
    },
    citycare: {
      timings: '24/7 Operational trauma center',
      emergencyPhone: '+91 99999 99993',
      departments: ['General Medicine', 'Emergency Care', 'Gynecology', 'Pediatrics', 'Ophthalmology'],
      description: 'Premium healthcare node in Central Gurugram specializing in pediatric wellness, urgent care procedures, and immediate support.',
      heroImage: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=600'
    }
  };

  const tenantSlug = tenant?.slug || 'apollo';
  const meta = branchMeta[tenantSlug] || {
    timings: '09:00 AM - 09:00 PM Outpatient Care',
    emergencyPhone: tenant?.phone || '+91 99999 99999',
    departments: ['General Medicine', 'Pediatrics', 'Outpatient Consultations'],
    description: 'Providing smart, digital queue management and clinical excellence to protect patient time and elevate standard clinic procedures.',
    heroImage: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&q=80&w=600'
  };

  useEffect(() => {
    async function loadLiveData() {
      if (!tenant?.id) return;
      try {
        // 1. Fetch available doctors
        const { data: docs } = await supabase
          .from('doctors')
          .select('*')
          .eq('hospital_id', tenant?.id)
          .eq('is_available', true);

        if (docs) {
          setDoctors(docs);
          setActiveDoctorsCount(docs.length);
        }

        // 2. Fetch today's waiting tokens count
        const todayStart = todayStartUTC();
        const { count } = await supabase
          .from('tokens')
          .select('id', { count: 'exact', head: true })
          .eq('hospital_id', tenant?.id)
          .eq('status', 'WAITING')
          .gte('created_at', todayStart);

        setWaitingCount(count ?? 0);
      } catch (err) {
        console.warn('Failed to load landing page dynamic queue statistics', err);
      }
    }

    loadLiveData();
    const interval = setInterval(loadLiveData, 10000); // Poll every 10s for real-time dashboard feel
    return () => clearInterval(interval);
  }, [tenant?.id]);

  const getInitials = (name: string) => {
    const cleanName = name.replace(/^(dr\.|dr)\s+/i, '').trim();
    const parts = cleanName.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return cleanName.substring(0, 2).toUpperCase();
  };

  const themeColor = tenant?.theme_color || '#005EB8';

  // Dynamic filter lists for available doctors
  const filteredDoctors = selectedDept === 'All'
    ? doctors
    : doctors.filter(doc =>
      (doc.department || '').toLowerCase().trim() === selectedDept.toLowerCase().trim() ||
      (doc.specialty || '').toLowerCase().trim() === selectedDept.toLowerCase().trim()
    );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans pb-16 select-none relative overflow-hidden">

      {/* Decorative ambient background glows */}
      <div
        className="absolute top-[-300px] left-[-300px] w-[600px] h-[600px] rounded-full blur-[160px] opacity-[0.12] pointer-events-none transition-all duration-700"
        style={{ backgroundColor: themeColor }}
      />
      <div className="absolute bottom-[-150px] right-[-150px] w-[500px] h-[500px] bg-cyan-300 rounded-full blur-[140px] opacity-[0.1] pointer-events-none" />

      {/* ── HERO BANNER SECTION ───────────────────────────────── */}
      <section className="bg-white border-b border-slate-100 py-12 relative overflow-hidden">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-35 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-center gap-12 relative z-10">

          {/* Hero Left Content */}
          <div className="flex-1 text-left space-y-7 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm transition-all duration-300"
              style={{ color: themeColor, backgroundColor: `${themeColor}12`, borderColor: `${themeColor}20` }}>
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Smart Clinic Workspace Node</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight leading-[1.08] lg:max-w-xl">
                Welcome to <br />
                <span className="animate-pulse"
                  style={{ color: themeColor }}>
                  {tenant?.name}
                </span>
              </h1>
              <p className="text-slate-400 font-semibold text-sm sm:text-base leading-relaxed max-w-xl">
                {meta.description}
              </p>
            </div>

            {/* Quick Contact Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100/80">
              <div className="flex items-center gap-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/50 p-3 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <MapPin className="w-5 h-5 text-[#005EB8]" style={{ color: themeColor }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">Location</h4>
                  <p className="text-xs text-slate-700 font-bold mt-1.5 truncate" title={tenant?.address || 'Main Campus Address'}>
                    {tenant?.address || 'Main Campus Address'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-100/50 p-3 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md">
                <div className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Clock className="w-5 h-5 text-[#00A3AD]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">Operating Hours</h4>
                  <p className="text-xs text-slate-700 font-bold mt-1.5 truncate" title={meta.timings}>
                    {meta.timings}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Right Graphic */}
          <div className="flex-1 w-full max-w-md lg:max-w-none animate-fade-in relative">
            <div className="relative group">
              {/* Backglow blur matching dynamic brand theme */}
              <div className="absolute inset-0 rounded-[32px] opacity-15 group-hover:opacity-20 transition-all duration-500 blur-3xl pointer-events-none"
                style={{ backgroundImage: `linear-gradient(to top right, ${themeColor}, #06b6d4)` }} />

              {/* Floating Overlay Roster Tag */}
              <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-md border border-slate-100 px-4 py-2 rounded-2xl shadow-lg flex items-center gap-2 group-hover:scale-105 transition-transform duration-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">Operational Live Status</span>
              </div>

              <img
                src={tenant?.logo_url || meta.heroImage}
                alt={tenant?.name}
                className="w-full h-64 sm:h-80 object-cover rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 relative z-10 transition-all duration-500 group-hover:scale-[1.005] group-hover:shadow-[0_25px_60px_rgba(0,0,0,0.08)]"
              />
            </div>
          </div>

        </div>
      </section>

      {/* ── OPERATIONAL QUEUE TELEMETRY METRICS ─────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

          {/* Metric 1: Patients Waiting */}
          <div className="bg-white border border-slate-100 hover:border-slate-200 p-6 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.04)] hover:scale-[1.01] transition-all duration-300 flex items-center justify-between gap-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition-transform duration-500"
              style={{ backgroundColor: `${themeColor}08` }} />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none">Patients Waiting</span>
              <h3 className="text-3xl font-black text-slate-800 mt-2.5 flex items-baseline gap-1" style={{ color: themeColor }}>
                {waitingCount} <span className="text-xs font-bold text-slate-400">Tokens</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Live active clinic queue waitlist</p>
            </div>
            <div className="w-12 h-12 bg-blue-50/50 border border-blue-100/50 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ color: themeColor, borderColor: `${themeColor}20`, backgroundColor: `${themeColor}08` }}>
              <Users className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          {/* Metric 2: Active Doctors */}
          <div className="bg-white border border-slate-100 hover:border-slate-200 p-6 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.04)] hover:scale-[1.01] transition-all duration-300 flex items-center justify-between gap-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50/20 rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition-transform duration-500" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none">Practitioners Active</span>
              <h3 className="text-3xl font-black text-slate-800 mt-2.5 flex items-baseline gap-1 text-teal-650">
                {activeDoctorsCount} <span className="text-xs font-bold text-slate-400">Online</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Available in consulting booths</p>
            </div>
            <div className="w-12 h-12 bg-teal-50/50 border border-teal-100/50 text-teal-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Stethoscope className="w-6 h-6" />
            </div>
          </div>

          {/* Metric 3: Est Wait Time */}
          <div className="bg-white border border-slate-100 hover:border-slate-200 p-6 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.04)] hover:scale-[1.01] transition-all duration-300 flex items-center justify-between gap-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/20 rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition-transform duration-500" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block leading-none">Estimated Wait Time</span>
              <h3 className="text-3xl font-black text-slate-800 mt-2.5 flex items-baseline gap-1 text-indigo-650">
                {waitingCount > 0 ? `${waitingCount * 8}` : '0'}<span className="text-xs font-bold text-slate-400">mins</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Dynamic queue load pacing</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50/50 border border-indigo-100/50 text-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Clock className="w-6 h-6" />
            </div>
          </div>

        </div>
      </section>

      {/* ── MAIN ACTION CARDS (Highly-polished application cards) ─────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16 space-y-6 text-left">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Workspace Quick Actions</h2>
          <p className="text-xs text-slate-400 font-semibold mt-1.5">Direct entry points to patient, practitioner and queue tracking channels</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Card 1: Patient Portal */}
          <button
            onClick={() => navigate('patient-login')}
            className="bg-white hover:bg-slate-50/40 border border-slate-100 p-6 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.015)] group text-left flex flex-col justify-between min-h-[190px] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.04)] focus:outline-none"
            style={{ hoverBorderColor: themeColor } as any}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[#005EB8] group-hover:scale-105 transition-transform duration-300 shadow-sm"
              style={{ color: themeColor, borderColor: `${themeColor}20`, backgroundColor: `${themeColor}08`, borderWidth: '1px' }}>
              <HeartPulse className="w-6 h-6" />
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-black text-slate-800 group-hover:text-slate-900 transition-colors"
                style={{ color: themeColor }}>Patient Portal</h3>
              <p className="text-xs text-slate-400 font-semibold mt-2 leading-relaxed">
                Check-in dynamically, request secure OTP access and log patient files.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider mt-4 text-[#005EB8] group-hover:gap-2 transition-all" style={{ color: themeColor }}>
              <span>Access Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Card 2: Book Appointment */}
          <button
            onClick={() => navigate('appointment')}
            className="bg-white hover:bg-slate-50/40 border border-slate-100 p-6 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.015)] group text-left flex flex-col justify-between min-h-[190px] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.04)] focus:outline-none hover:border-teal-200"
          >
            <div className="w-11 h-11 bg-teal-50 border border-teal-100 text-teal-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shadow-sm">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-black text-teal-700">Book Appointment</h3>
              <p className="text-xs text-slate-400 font-semibold mt-2 leading-relaxed">
                Schedule dynamic priority visits and pre-book token numbers.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-teal-600 uppercase tracking-wider mt-4 group-hover:gap-2 transition-all">
              <span>Book Doctor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Card 3: Track Token */}
          <button
            onClick={() => navigate('tracker')}
            className="bg-white hover:bg-slate-50/40 border border-slate-100 p-6 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.015)] group text-left flex flex-col justify-between min-h-[190px] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.04)] focus:outline-none hover:border-indigo-200"
          >
            <div className="w-11 h-11 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shadow-sm">
              <Activity className="w-6 h-6" />
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-black text-indigo-700">Live Token Status</h3>
              <p className="text-xs text-slate-400 font-semibold mt-2 leading-relaxed">
                Track waiting positions, real-time board updates and ticket statuses.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-indigo-600 uppercase tracking-wider mt-4 group-hover:gap-2 transition-all">
              <span>Track Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Card 4: Staff Access */}
          <button
            onClick={() => navigate('staff-login')}
            className="bg-white hover:bg-slate-50/40 border border-slate-100 p-6 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.015)] group text-left flex flex-col justify-between min-h-[190px] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.04)] focus:outline-none hover:border-violet-200"
          >
            <div className="w-11 h-11 bg-violet-50 border border-violet-100 text-violet-600 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-black text-violet-700">Staff Secure Portal</h3>
              <p className="text-xs text-slate-400 font-semibold mt-2 leading-relaxed">
                Management entry for clinical leads, ward assistants, and pharmacists.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-violet-600 uppercase tracking-wider mt-4 group-hover:gap-2 transition-all">
              <span>Secure Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

        </div>
      </section>

      {/* ── CLINIC DEPARTMENTS & REAL-TIME DOCTOR ROSTER ───────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8 text-left animate-fade-in">

        {/* Left Side: Department Filter desk */}
        <div className="lg:col-span-1 bg-white border border-slate-100 p-6 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.015)] space-y-6">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Clinical Departments</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Select a branch specialty to filter dynamic doctor lists</p>
          </div>

          <div className="space-y-2">
            {/* 'All' category button */}
            <button
              onClick={() => setSelectedDept('All')}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl font-bold text-xs transition-all duration-300 text-left border"
              style={selectedDept === 'All'
                ? { color: themeColor, backgroundColor: `${themeColor}12`, borderColor: `${themeColor}25`, boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }
                : { color: '#475569', backgroundColor: '#F8FAFC50', borderColor: '#F1F5F9' }
              }
            >
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedDept === 'All' ? themeColor : '#cbd5e1' }} />
                <span>All Departments</span>
              </div>
              <span className="text-[9px] bg-white px-2 py-0.5 rounded-md font-black border border-slate-100 shadow-sm text-slate-400">{doctors.length}</span>
            </button>

            {meta.departments.map((dept, i) => {
              const count = doctors.filter(doc =>
                (doc.department || '').toLowerCase().trim() === dept.toLowerCase().trim() ||
                (doc.specialty || '').toLowerCase().trim() === dept.toLowerCase().trim()
              ).length;
              const isSelected = selectedDept.toLowerCase() === dept.toLowerCase();

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDept(dept)}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl font-bold text-xs transition-all duration-300 text-left border"
                  style={isSelected
                    ? { color: themeColor, backgroundColor: `${themeColor}12`, borderColor: `${themeColor}25`, boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }
                    : { color: '#475569', backgroundColor: '#F8FAFC50', borderColor: '#F1F5F9' }
                  }
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: isSelected ? themeColor : '#cbd5e1' }} />
                    <span className="truncate max-w-[150px]">{dept}</span>
                  </div>
                  <span className="text-[9px] bg-white px-2 py-0.5 rounded-md font-black border border-slate-100 shadow-sm text-slate-400">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Emergency Hotline Button */}
          <button
            onClick={() => setShowEmergencyDialog(true)}
            className="w-full mt-4 bg-rose-50/50 border border-rose-100 hover:bg-rose-50 text-rose-600 font-black text-xs uppercase py-3.5 rounded-2xl tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 focus:outline-none shadow-sm hover:shadow"
          >
            <AlertTriangle className="w-4 h-4 animate-bounce" />
            Emergency Hotline
          </button>
        </div>

        {/* Right Side: Available Doctors Interactive Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Today's Available Doctors</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Live active practitioner consultation preview</p>
            </div>
            {selectedDept !== 'All' && (
              <button
                onClick={() => setSelectedDept('All')}
                className="text-[9px] font-black text-slate-400 hover:text-slate-700 uppercase tracking-wider bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all"
              >
                Clear Filter
              </button>
            )}
          </div>

          {filteredDoctors.length === 0 ? (
            <div className="bg-white border border-slate-100 p-12 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.015)] text-center flex flex-col items-center justify-center min-h-[300px] animate-fadeIn">
              <div className="w-14 h-14 bg-slate-50 border border-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                <Stethoscope className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-black text-slate-700">No practitioners available in "{selectedDept}"</h4>
              <p className="text-xs text-slate-400 font-semibold mt-2.5 max-w-sm leading-relaxed">
                There are currently no consulting doctors active in this specialty category. Please check other departments or search the dynamic workspace directory.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredDoctors.map((doc) => {
                const initials = getInitials(doc.name);

                // Clean duplicate 'Room' strings
                const rawRoom = doc.room_number || '';
                const displayRoom = rawRoom.toLowerCase().startsWith('room')
                  ? rawRoom.replace(/^room\s+/i, 'Room ')
                  : `Room ${rawRoom}`;

                return (
                  <div
                    key={doc.id}
                    className="bg-white border border-slate-100 p-5 rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.015)] flex items-center gap-4 hover:shadow-[0_12px_40px_rgba(0,0,0,0.04)] hover:border-slate-200 hover:scale-[1.01] transition-all duration-300 group"
                  >
                    {/* Avatar Badge */}
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-50 to-[#E8F3FF] border border-teal-100 text-[#005EB8] flex items-center justify-center flex-shrink-0 font-black text-sm uppercase tracking-wider group-hover:scale-105 transition-transform duration-300 shadow-inner"
                      style={{ color: themeColor }}>
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-black text-slate-800 truncate tracking-tight">{doc.name}</h4>
                      <span className="inline-block text-[9px] bg-slate-50 border border-slate-150 text-slate-500 font-bold uppercase px-2 py-0.5 rounded-md tracking-wider mt-1.5">
                        {doc.specialty || 'General Practitioner'}
                      </span>
                      <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-50">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-wider leading-none border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Available
                        </span>
                        {doc.room_number && (
                          <span className="text-[9px] font-black uppercase tracking-wider bg-blue-50/50 border border-blue-100/50 px-2 py-0.5 rounded-md font-mono"
                            style={{ color: themeColor, borderColor: `${themeColor}20`, backgroundColor: `${themeColor}08` }}>
                            {displayRoom}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </section>

      {/* ── EMERGENCY CONTACT DIALOG MODAL ───────────────────────── */}
      {showEmergencyDialog && (
        <>
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 transition-opacity duration-300 animate-fade-in"
            onClick={() => setShowEmergencyDialog(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white border border-slate-150 rounded-[32px] p-8 shadow-2xl z-50 animate-scale-up font-sans text-center flex flex-col items-center">

            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mb-6">
              <ShieldAlert className="w-8 h-8 animate-bounce" />
            </div>

            <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-2">Emergency Hotline</h3>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed mb-6 px-4">
              If you require immediate ambulance transfer or trauma assistance, dial the {tenant?.name} emergency hub.
            </p>

            {/* Glowing Emergency hotline banner */}
            <div className="w-full bg-rose-50 border border-rose-100 rounded-2xl p-5 mb-6 text-center select-all">
              <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Emergency Call-desk</p>
              <h2 className="text-2xl font-black text-rose-600 mt-1">{meta.emergencyPhone}</h2>
            </div>

            {/* Quick Contacts details */}
            <div className="w-full space-y-3 mb-8 text-left text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <Map className="w-4.5 h-4.5 text-slate-400" />
                <span>Ambulance Tracking dispatch active</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <Mail className="w-4.5 h-4.5 text-slate-400" />
                <span>emergency@{tenantSlug}.medqueue.com</span>
              </div>
            </div>

            <button
              onClick={() => setShowEmergencyDialog(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase py-4 rounded-2xl tracking-wider transition-all focus:outline-none"
            >
              Close Hub Dialog
            </button>

          </div>
        </>
      )}

      {/* ── FOOTER SECTION ───────────────────────────────────── */}
      <section className="bg-white border-t border-slate-100 py-16 relative overflow-hidden mt-16 text-left">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-25 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 flex flex-col lg:flex-row gap-12">
          {/* Left card: Need help booking an appointment? */}
          <div className="flex-1 bg-white border border-slate-100/80 rounded-[32px] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.02)] relative overflow-hidden group">
            {/* dynamic theme subtle background glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-700"
              style={{ backgroundColor: themeColor }}
            />

            <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-2">
              Need help booking an appointment?
            </h3>
            <p className="text-xs text-slate-400 font-semibold mb-6">
              We can help! Fill out the form below.
            </p>

            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={contactForm.firstName}
                  onChange={e => setContactForm({ ...contactForm, firstName: e.target.value })}
                  placeholder="First Name"
                  className="w-full text-xs p-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-slate-200 outline-none transition-all font-semibold"
                  required
                />
                <input
                  type="text"
                  value={contactForm.lastName}
                  onChange={e => setContactForm({ ...contactForm, lastName: e.target.value })}
                  placeholder="Last Name"
                  className="w-full text-xs p-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-slate-200 outline-none transition-all font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="Email"
                  className="w-full text-xs p-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-slate-200 outline-none transition-all font-semibold"
                  required
                />
                <input
                  type="tel"
                  value={contactForm.phone}
                  onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                  placeholder="Phone"
                  className="w-full text-xs p-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-slate-200 outline-none transition-all font-semibold"
                  required
                />
              </div>

              <textarea
                value={contactForm.message}
                onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                placeholder="Type your message here..."
                rows={3}
                className="w-full text-xs p-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:border-slate-200 outline-none transition-all font-semibold resize-none"
                required
              />

              <button
                type="submit"
                disabled={submittingContact}
                className="w-full text-xs font-black uppercase tracking-wider text-white py-4 rounded-2xl shadow-lg transition-all focus:outline-none flex items-center justify-center gap-2"
                style={{
                  backgroundColor: themeColor
                }}
              >
                {submittingContact ? 'Submitting...' : 'Submit'}
              </button>
            </form>
          </div>

          {/* Right column: Clinic Hours and Our Location */}
          <div className="lg:w-[45%] flex flex-col justify-between py-2">
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-wider mb-4" style={{ color: themeColor }}>
                Clinic Hours
              </h4>

              <div className="space-y-3 font-semibold text-xs text-slate-700">
                {[
                  { day: 'Monday', hours: '9:30am - 1:30pm  /  3:30pm - 7:00pm' },
                  { day: 'Tuesday', hours: '9:30am - 1:30pm' },
                  { day: 'Wednesday', hours: '9:30am - 1:30pm  /  3:30pm - 7:00pm' },
                  { day: 'Thursday', hours: '9:30am - 1:30pm' },
                  { day: 'Friday', hours: '9:30am - 1:30pm  /  3:30pm - 7:00pm' },
                  { day: 'Saturday', hours: '9:30am - 1:30pm' },
                  { day: 'Sunday', hours: '9:30am - 1:30pm' },
                ].map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-slate-50 pb-2.5">
                    <span className="text-slate-800">{item.day}:</span>
                    <span className="text-slate-500 text-right">{item.hours}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: themeColor }}>
                  Our Location
                </h4>
                <p className="text-xs text-slate-800 font-extrabold leading-relaxed">
                  {tenant?.address || 'Unit 102 - 317 Renfrew Dr,\nMarkham, Ontario L3R 9S8'}
                </p>
                <p className="text-[10px] text-slate-400 font-bold mt-1">(Entrance at the back)</p>
              </div>

              <button
                onClick={() => navigate('appointment')}
                className="inline-flex items-center justify-center px-6 py-3 border rounded-full text-xs font-black uppercase tracking-wider transition-all focus:outline-none hover:shadow-md"
                style={{
                  color: themeColor,
                  borderColor: `${themeColor}30`,
                  backgroundColor: `${themeColor}05`
                }}
              >
                Book Your Appointment
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom copyright & socials bar */}
      <div className="bg-[#F8FAFC] border-t border-slate-150 py-8 relative z-10 w-full text-left">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-xs font-bold text-slate-500">
          <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
            {/* Email Address */}
            <span className="text-slate-600 block">{tenant?.phone ? `info@${tenantSlug}.com` : 'info@modernhealthclinic.ca'}</span>
            
            {/* Divider (Hidden on mobile) */}
            <span className="hidden md:inline text-slate-300 font-normal">•</span>
            
            {/* Follow Us and Social Icons */}
            <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
              <span className="uppercase tracking-widest text-[10px] text-slate-400 block md:inline">Follow Us</span>
              <div className="flex items-center gap-4">
                {socialLinks.instagram && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 text-slate-500 transition-colors">
                    <Instagram className="w-4.5 h-4.5" />
                  </a>
                )}
                {socialLinks.facebook && (
                  <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 text-slate-500 transition-colors">
                    <Facebook className="w-4.5 h-4.5" />
                  </a>
                )}
                {socialLinks.twitter && (
                  <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 text-slate-500 transition-colors">
                    <Twitter className="w-4.5 h-4.5" />
                  </a>
                )}
                {socialLinks.linkedin && (
                  <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 text-slate-500 transition-colors">
                    <Linkedin className="w-4.5 h-4.5" />
                  </a>
                )}
                {socialLinks.youtube && (
                  <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 text-slate-500 transition-colors">
                    <Youtube className="w-4.5 h-4.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="text-slate-400 text-[11px] pt-4 md:pt-0 border-t border-slate-200/50 md:border-none w-full md:w-auto text-left">
            © 2026 by {tenant?.name || 'Modern Health Clinic'}
          </div>
        </div>
      </div>

      {/* ── CONTACT FORM SUCCESS DIALOG MODAL ────────────────────── */}
      {showContactSuccess && (
        <>
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 transition-opacity duration-300 animate-fade-in"
            onClick={() => setShowContactSuccess(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white border border-slate-150 rounded-[32px] p-8 shadow-2xl z-50 animate-scale-up font-sans text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-6"
              style={{ color: themeColor, backgroundColor: `${themeColor}10`, borderColor: `${themeColor}20` }}>
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-2">Message Submitted</h3>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed mb-6 px-4">
              Thank you for contacting us. Our outpatient support node has registered your inquiry and will contact you shortly.
            </p>

            <button
              onClick={() => setShowContactSuccess(false)}
              className="w-full text-white font-black text-xs uppercase py-4 rounded-2xl tracking-wider transition-all focus:outline-none"
              style={{ backgroundColor: themeColor }}
            >
              Close
            </button>
          </div>
        </>
      )}

    </div>
  );
}
