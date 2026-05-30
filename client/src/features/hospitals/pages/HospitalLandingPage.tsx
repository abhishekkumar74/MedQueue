import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { TenantConfig } from '../../../lib/tenant';
import {
  Building2, Calendar, Clock, AlertTriangle, Users,
  ArrowRight, MapPin, Activity, HeartPulse, Stethoscope,
  ShieldAlert, Mail, Map, Sparkles
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

  return (
    <div className="min-h-screen bg-[#F4F8FB] font-sans pb-12 select-none relative overflow-hidden">

      {/* Background soft color patterns */}
      <div
        className="absolute top-[-250px] left-[-250px] w-[500px] h-[500px] rounded-full blur-[140px] opacity-20 pointer-events-none"
        style={{ backgroundColor: tenant?.theme_color || '#005EB8' }}
      />
      <div className="absolute bottom-[-150px] right-[-150px] w-[400px] h-[400px] bg-sky-300 rounded-full blur-[120px] opacity-15 pointer-events-none" />

      {/* ── HERO BANNER SECTION ───────────────────────────────── */}
      <section className="bg-white border-b border-slate-150 py-10 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-center gap-10">

          {/* Hero Left Content */}
          <div className="flex-1 text-left space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#E8F3FF] text-[#005EB8] rounded-full text-[10px] font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Clinic Workspace Node</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight leading-none">
                Welcome to <br />
                <span className="text-[#005EB8]" style={{ color: tenant?.theme_color }}>
                  {tenant?.name}
                </span>
              </h1>
              <p className="text-slate-400 font-semibold text-sm sm:text-base leading-relaxed max-w-xl">
                {meta.description}
              </p>
            </div>

            {/* Quick Contact Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4.5 pt-2">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-slate-700 leading-none">Location</h4>
                  <p className="text-xs text-slate-400 font-semibold mt-1">{tenant?.address || 'Main Campus Address'}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-slate-700 leading-none">Operating Hours</h4>
                  <p className="text-xs text-slate-400 font-semibold mt-1">{meta.timings}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Right Graphic */}
          <div className="flex-1 w-full max-w-md lg:max-w-none animate-fade-in">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#005EB8] to-[#00A3AD] rounded-[32px] opacity-10 group-hover:opacity-15 transition-opacity blur-2xl" />
              <img
                src={meta.heroImage}
                alt={tenant?.name}
                className="w-full h-64 sm:h-80 object-cover rounded-[32px] shadow-lg border border-white/50 relative z-10 transition-transform duration-500 group-hover:scale-[1.01]"
              />
            </div>
          </div>

        </div>
      </section>

      {/* ── OPERATIONAL QUEUE TELEMETRY METRICS ─────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-8 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          {/* Metric Waiting Patients */}
          <div className="bg-white border border-slate-150 p-6 rounded-3xl shadow-sm flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Patients Waiting</span>
              <h3 className="text-3xl font-black text-slate-800 mt-2">{waitingCount}</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Operational live check-in queue</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 border border-blue-100 text-[#005EB8] rounded-2xl flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          {/* Metric Active Doctors */}
          <div className="bg-white border border-slate-150 p-6 rounded-3xl shadow-sm flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Practitioners Active</span>
              <h3 className="text-3xl font-black text-slate-800 mt-2">{activeDoctorsCount}</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Available in consulting booths</p>
            </div>
            <div className="w-12 h-12 bg-teal-50 border border-teal-100 text-teal-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-6 h-6" />
            </div>
          </div>

          {/* Metric Queue Wait Time */}
          <div className="bg-white border border-slate-150 p-6 rounded-3xl shadow-sm flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Estimated Wait Time</span>
              <h3 className="text-3xl font-black text-slate-800 mt-2">{waitingCount > 0 ? `${waitingCount * 8}m` : '0m'}</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Dynamic queue load pacing</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Clock className="w-6 h-6" />
            </div>
          </div>

        </div>
      </section>

      {/* ── MAIN ACTION CARDS (Kiosk & phone optimized grid) ──────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 space-y-6 text-left">
        <h2 className="text-xl font-black text-slate-800 tracking-tight leading-none">Workspace Quick Actions</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Card 1: Patient Portal */}
          <button
            onClick={() => navigate('patient-login')}
            className="bg-white hover:bg-slate-50 border border-slate-150 p-6 rounded-3xl shadow-sm group text-left flex flex-col justify-between min-h-[170px] transition-all hover:border-[#005EB8]/30 hover:shadow-md focus:outline-none"
          >
            <div className="w-11 h-11 bg-[#E8F3FF] text-[#005EB8] rounded-xl flex items-center justify-center">
              <HeartPulse className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Patient Portal</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1.5 leading-relaxed">
                Check-in, request OTP and check-in to dynamic clinical queue nodes.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-[#005EB8] uppercase tracking-wider mt-4">
              <span>Access Portal</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* Card 2: Book Appointment */}
          <button
            onClick={() => navigate('appointment')}
            className="bg-white hover:bg-slate-50 border border-slate-150 p-6 rounded-3xl shadow-sm group text-left flex flex-col justify-between min-h-[170px] transition-all hover:border-[#00A3AD]/30 hover:shadow-md focus:outline-none"
          >
            <div className="w-11 h-11 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
              <Calendar className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Book Appointment</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1.5 leading-relaxed">
                Schedule consultations and save appointment time slots today.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-teal-600 uppercase tracking-wider mt-4">
              <span>Book Doctor</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* Card 3: Track Token */}
          <button
            onClick={() => navigate('tracker')}
            className="bg-white hover:bg-slate-50 border border-slate-150 p-6 rounded-3xl shadow-sm group text-left flex flex-col justify-between min-h-[170px] transition-all hover:border-indigo-500/30 hover:shadow-md focus:outline-none"
          >
            <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Activity className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Live Token Status</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1.5 leading-relaxed">
                Track active token numbers and check position ahead in real-time.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-indigo-600 uppercase tracking-wider mt-4">
              <span>Track Queue</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* Card 4: Staff Access */}
          <button
            onClick={() => navigate('staff-login')}
            className="bg-white hover:bg-slate-50 border border-slate-150 p-6 rounded-3xl shadow-sm group text-left flex flex-col justify-between min-h-[170px] transition-all hover:border-violet-500/30 hover:shadow-md focus:outline-none"
          >
            <div className="w-11 h-11 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Staff Secure Portal</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1.5 leading-relaxed">
                Secure entry node for doctor panels, ward boys, and clinic pharmacy logs.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-violet-600 uppercase tracking-wider mt-4">
              <span>Secure Login</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

        </div>
      </section>

      {/* ── CLINIC DEPARTMENTS & REAL-TIME DOCTOR ROSTER ───────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8 text-left animate-fade-in">

        {/* Left Side: Department list card */}
        <div className="lg:col-span-1 bg-white border border-slate-150 p-6 rounded-3xl shadow-sm space-y-5">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Clinical Departments</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Active specialized consultations units</p>
          </div>

          <div className="space-y-2">
            {meta.departments.map((dept, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-[#F4F8FB] hover:bg-[#E8F3FF]/50 border border-slate-100 rounded-2xl font-bold text-xs text-[#005EB8] transition-colors"
                style={{ color: tenant?.theme_color }}
              >
                <div className="w-2 h-2 rounded-full bg-[#005EB8]" style={{ backgroundColor: tenant?.theme_color }} />
                <span>{dept}</span>
              </div>
            ))}
          </div>

          {/* Emergency Hotline Button */}
          <button
            onClick={() => setShowEmergencyDialog(true)}
            className="w-full mt-4 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 font-black text-xs uppercase py-3.5 rounded-2xl tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 focus:outline-none"
          >
            <AlertTriangle className="w-4 h-4" />
            Emergency Hotline
          </button>
        </div>

        {/* Right Side: Available Doctors Grid */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Today's Available Doctors</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Live active practitioner consultation preview</p>
          </div>

          {doctors.length === 0 ? (
            <div className="bg-white border border-slate-150 p-8 rounded-3xl shadow-sm text-center flex flex-col items-center justify-center min-h-[220px]">
              <div className="w-12 h-12 bg-slate-50 border border-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
                <Stethoscope className="w-6 h-6 animate-pulse" />
              </div>
              <h4 className="text-sm font-black text-slate-700">All Doctors Currently offline</h4>
              <p className="text-xs text-slate-400 font-semibold mt-1.5 max-w-sm">
                No active doctors are currently clocked into consultation rooms. Waiting queues remain open for intake forms.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {doctors.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white border border-slate-150 p-4.5 rounded-3xl shadow-sm flex items-center gap-3.5 hover:shadow-md transition-all hover:border-[#005EB8]/10"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center flex-shrink-0 font-black text-xs uppercase tracking-wider">
                    {doc.name.substring(4, 6).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-black text-slate-800 truncate">{doc.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{doc.specialty}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-wider leading-none">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        Available
                      </span>
                      {doc.room_number && (
                        <span className="text-[9px] text-slate-400 font-semibold font-mono">Room {doc.room_number}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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

    </div>
  );
}
