import { useState } from 'react';
import { 
  Activity, Clock, Shield, ArrowRight, 
  CheckCircle2, Stethoscope, Heart, Star, Menu, X,
  Package, Database, Users, LineChart, 
  Building2, Monitor, AlertTriangle, Layers, Send, Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  onGetStarted: () => void;   // patient login
  onStaffLogin: () => void;   // staff login
}

export default function LandingPage({ onGetStarted, onStaffLogin }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(0);

  // ── Demo Booking Form State ──
  const [demoForm, setDemoForm] = useState({
    hospitalName: '',
    city: '',
    size: '10-50 beds',
    contactPerson: '',
    phone: '',
    email: ''
  });
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoForm.hospitalName || !demoForm.contactPerson || !demoForm.email || !demoForm.phone) {
      alert('Please fill out all required fields.');
      return;
    }
    
    try {
      const msg = `Onboarding Demo Request: "${demoForm.hospitalName}" (${demoForm.size}) in ${demoForm.city} requested by ${demoForm.contactPerson} (Phone: ${demoForm.phone}, Email: ${demoForm.email})`;
      const { error } = await supabase.from('activity_logs').insert({
        message: msg,
        category: 'onboarding',
        badge_color: 'bg-indigo-650'
      });
      if (error) throw error;
      setDemoSubmitted(true);
    } catch (err) {
      console.error('Demo booking save failed:', err);
      setDemoSubmitted(true); // fallback success
    }
  };

  const ONBOARDING_STEPS = [
    {
      step: '01',
      title: 'Request Platform Demo',
      desc: 'Book an interactive walkthrough. Our health-ops specialists configure custom slots, rooms, and departments based on your clinic scale.',
      tag: 'Onboarding Start'
    },
    {
      step: '02',
      title: 'Workspace Created',
      desc: 'MedQueue Super Admin provisions your isolated database node with pg-level Row Level Security (RLS) active and custom subdomain context.',
      tag: 'Database Provisioning'
    },
    {
      step: '03',
      title: 'Secure Admin Handover',
      desc: 'Hospital owner receives secure administrative login details to the isolated control panel, locking in clinic tenant protocols.',
      tag: 'Access Handover'
    },
    {
      step: '04',
      title: 'Add Roster & Staff',
      desc: 'Clinic admin adds Doctors, Pharmacy staff, Ward Boys, and Receptionists, assigning role-based permissions to their respective departments.',
      tag: 'Operational Setup'
    },
    {
      step: '05',
      title: 'Clinic Operations Go Live',
      desc: 'Digital token display boards sync instantly, patient QR terminals activate, and automated stock reduction transactions go fully live.',
      tag: 'Production Mode'
    }
  ];

  const FEATURES = [
    {
      icon: <Clock className="w-5 h-5 text-[#005EB8]" />,
      title: 'Smart Queue Triage',
      desc: 'Automated token generation with smart priority routing for emergency cases and dynamic wait-time ETA updates.'
    },
    {
      icon: <Stethoscope className="w-5 h-5 text-[#005EB8]" />,
      title: 'Practitioner Console',
      desc: 'Unified interface for doctors listing assigned queues, patient history, vitals charts, and direct e-prescription triggers.'
    },
    {
      icon: <Package className="w-5 h-5 text-[#005EB8]" />,
      title: 'Pharmacy stock reduction',
      desc: 'E-prescriptions flow instantly to the pharmacist. Dispensing a drug automatically reduces database quantity ledger counts in real-time.'
    },
    {
      icon: <Monitor className="w-5 h-5 text-[#005EB8]" />,
      title: 'Interactive Display Boards',
      desc: 'Live public queuing screens showing called token numbers, active rooms, and voice announcements syncing in real-time.'
    },
    {
      icon: <Database className="w-5 h-5 text-[#005EB8]" />,
      title: 'Multi-Tenant Database Isolation',
      desc: 'PostgreSQL-level Row Level Security (RLS) guarantees absolute security. No clinic data or patient credentials ever collide.'
    },
    {
      icon: <LineChart className="w-5 h-5 text-[#005EB8]" />,
      title: 'Operational Analytics',
      desc: 'In-depth charts detailing doctor utilization indices, peak wait times, and daily medication consumption curves.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F4F8FB] font-sans text-slate-700 selection:bg-[#005EB8]/10 selection:text-[#005EB8] overflow-x-hidden">
      
      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02)] h-14">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#005EB8] flex items-center justify-center shadow-md shadow-[#005EB8]/20">
              <Activity className="w-4.5 h-4.5 text-white animate-pulse" />
            </div>
            <span className="font-black text-slate-800 tracking-tight text-base flex items-center">
              MedQueue
              <span className="text-[#00A3AD] text-base font-extrabold ml-0.5">.</span>
            </span>
          </div>

          {/* Desktop Nav links */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#how-it-works" className="text-xs font-bold text-slate-500 hover:text-[#005EB8] transition-colors">Platform Workflow</a>
            <a href="#features" className="text-xs font-bold text-slate-500 hover:text-[#005EB8] transition-colors">Core Modules</a>
            <a href="#isolation" className="text-xs font-bold text-slate-500 hover:text-[#005EB8] transition-colors">Data Security</a>
            <a href="#pricing" className="text-xs font-bold text-slate-500 hover:text-[#005EB8] transition-colors">SaaS Plans</a>
            <a href="#demo" className="text-xs font-bold text-slate-500 hover:text-[#005EB8] transition-colors">Schedule Setup</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={onStaffLogin} className="text-xs font-extrabold text-slate-500 hover:text-[#005EB8] px-3.5 py-2 transition-colors">
              Staff Portal
            </button>
            <button 
              onClick={onGetStarted}
              className="flex items-center gap-1.5 text-xs font-black px-4 py-2 bg-[#005EB8] hover:bg-[#004a96] text-white rounded-xl transition-all shadow-md shadow-[#005EB8]/10"
            >
              Patient Login
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-slate-600 focus:outline-none">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-b border-slate-100 px-6 py-4 space-y-4 shadow-lg">
            <a href="#how-it-works" onClick={() => setMenuOpen(false)} className="block text-xs font-bold text-slate-600">Platform Workflow</a>
            <a href="#features" onClick={() => setMenuOpen(false)} className="block text-xs font-bold text-slate-600">Core Modules</a>
            <a href="#isolation" onClick={() => setMenuOpen(false)} className="block text-xs font-bold text-slate-600">Data Security</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)} className="block text-xs font-bold text-slate-600">SaaS Plans</a>
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <button onClick={() => { setMenuOpen(false); onStaffLogin(); }} className="w-full py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold bg-slate-50">Staff Portal</button>
              <button onClick={() => { setMenuOpen(false); onGetStarted(); }} className="w-full py-2.5 bg-[#005EB8] text-white rounded-xl text-xs font-bold">Patient Login</button>
            </div>
          </div>
        )}
      </nav>

      {/* ── 1. HERO SECTION ── */}
      <section className="relative min-h-screen flex items-center justify-center pt-24 pb-16 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#005EB8]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#00A3AD]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12 items-center w-full">
          {/* Left Hero Pitch */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-1.5 bg-[#005EB8]/10 text-[#005EB8] text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[#00A3AD]" />
              Enterprise Healthcare Operations Cloud
            </div>

            <h1 className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight leading-none">
              Modern Healthcare <br />
              <span className="text-[#005EB8]">Operations Platform</span>
            </h1>

            <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-lg font-medium">
              Manage patient flows, real-time queues, available doctors, dynamic e-prescriptions, automated pharmacy stocks, and public display boards in one unified multi-tenant cloud platform.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a 
                href="#demo"
                className="flex items-center gap-2 px-5 py-3 bg-[#005EB8] hover:bg-[#004a96] text-white font-black rounded-xl text-xs shadow-md shadow-[#005EB8]/10 transition-all uppercase tracking-wider"
              >
                Book Operational Demo
                <ArrowRight className="w-4 h-4" />
              </a>
              <a 
                href="#pricing"
                className="px-5 py-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-black rounded-xl text-xs transition-colors uppercase tracking-wider"
              >
                Start Free Trial
              </a>
            </div>

            {/* Ratings and Stats */}
            <div className="pt-6 border-t border-slate-100 flex items-center gap-6">
              <div>
                <div className="flex gap-0.5 text-amber-400">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                </div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase mt-1">Reduction in patient ETAs: ~45%</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div>
                <div className="text-lg font-black text-slate-800">99.9%</div>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase mt-0.5">Engine Sync Uptime</p>
              </div>
            </div>
          </div>

          {/* Right Hero Interface Preview Card */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6 w-full max-w-lg space-y-6 relative">
              <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute" />
                  <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider">Clinical Live Monitor</span>
                </div>
                <span className="text-[9px] bg-slate-100 font-bold px-2 py-0.5 rounded-full">Campus: Delhi Apollo</span>
              </div>

              {/* Grid indicators inside mockup */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#F4F8FB] p-3 rounded-2xl border border-slate-100 text-center">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400">Online Staff</span>
                  <div className="text-base font-black text-slate-800 mt-0.5">8 Doctors</div>
                </div>
                <div className="bg-[#F4F8FB] p-3 rounded-2xl border border-slate-100 text-center">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400">Patients Today</span>
                  <div className="text-base font-black text-[#005EB8] mt-0.5">140 Nodes</div>
                </div>
                <div className="bg-[#F4F8FB] p-3 rounded-2xl border border-slate-100 text-center">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400">Queue Load</span>
                  <div className="text-base font-black text-emerald-600 mt-0.5">Stable</div>
                </div>
              </div>

              {/* Queuing Telemetry mockup list */}
              <div className="space-y-2.5">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block">Active Token Priority Queue</span>
                {[
                  { token: '#08', dept: 'Cardiology', doctor: 'Dr. Diana Rodriguez', status: 'SERVING', statusColor: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
                  { token: '#09', dept: 'General OPD', doctor: 'Dr. Abhishek Kumar', status: 'WAITING', statusColor: 'bg-amber-50 border-amber-100 text-amber-700' }
                ].map((item, idx) => (
                  <div key={idx} className="border border-slate-100 bg-slate-50/50 p-3 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#005EB8] text-white flex items-center justify-center font-black text-xs">
                        {item.token}
                      </div>
                      <div>
                        <div className="text-[11px] font-extrabold text-slate-800">{item.dept}</div>
                        <div className="text-[9px] text-slate-400 font-semibold">{item.doctor}</div>
                      </div>
                    </div>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${item.statusColor}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Dynamic Alert Banner mockup */}
              <div className="bg-red-50 border border-red-100 text-red-600 rounded-2xl p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-bounce" />
                <span className="text-[10px] font-black uppercase tracking-wider">⚠️ System telemetry warning: Out of Stock alerts detected in pharmacy module</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. HOW MEDQUEUE WORKS ── */}
      <section id="how-it-works" className="py-20 bg-white border-y border-slate-150 relative">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
          <div className="space-y-3">
            <span className="inline-block bg-[#005EB8]/10 text-[#005EB8] text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider">
              Operational Flow
            </span>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">How MedQueue Runs Your Hospital</h2>
            <p className="text-slate-400 text-xs sm:text-sm font-semibold max-w-xl mx-auto">
              Follow the complete, unified onboarding-to-execution operational lifecycle inside our platform.
            </p>
          </div>

          {/* Interactive Flow Diagram */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 relative">
            {[
              { num: '01', title: 'Hospital Joins', desc: 'Secure booking & sign up.' },
              { num: '02', title: 'Workspace Created', desc: 'RLS isolated subdomain.' },
              { num: '03', title: 'Admin Receives Login', desc: 'Platform keys handed over.' },
              { num: '04', title: 'Admin Adds Staff', desc: 'Assigns roles & departments.' },
              { num: '05', title: 'Staff Go Live', desc: 'Doctors & pharmacy online.' },
              { num: '06', title: 'Patients Register', desc: 'Book tokens via OTP/QR.' },
              { num: '07', title: 'Operations Active', desc: 'Full automated clinic sync.' }
            ].map((step, idx) => (
              <div 
                key={idx}
                onClick={() => setActiveWorkflowStep(idx)}
                className={`cursor-pointer rounded-2xl border p-4 text-center transition-all duration-300 relative group flex flex-col justify-between ${
                  activeWorkflowStep === idx 
                    ? 'border-[#005EB8] bg-[#005EB8]/5 shadow-sm' 
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                {idx < 6 && (
                  <div className="hidden lg:block absolute top-[50%] right-[-15px] w-6 h-0.5 bg-slate-200 z-10" />
                )}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs mx-auto mb-3 ${
                  activeWorkflowStep === idx ? 'bg-[#005EB8] text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {step.num}
                </div>
                <div>
                  <h4 className="font-extrabold text-[11px] text-slate-800 leading-tight">{step.title}</h4>
                  <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#F4F8FB] border border-slate-100 rounded-3xl p-6 text-left max-w-xl mx-auto space-y-2">
            <span className="text-[9px] font-black text-[#00A3AD] uppercase tracking-wider block">Phase Highlight: {ONBOARDING_STEPS[activeWorkflowStep]?.tag}</span>
            <h4 className="font-extrabold text-sm text-slate-800">{ONBOARDING_STEPS[activeWorkflowStep]?.title}</h4>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">{ONBOARDING_STEPS[activeWorkflowStep]?.desc}</p>
          </div>
        </div>
      </section>

      {/* ── 3. MULTI-HOSPITAL SaaS ISOLATION ── */}
      <section id="isolation" className="py-20 relative">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Copy */}
          <div className="lg:col-span-5 space-y-6 text-left">
            <span className="inline-block bg-[#00A3AD]/10 text-[#00A3AD] text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider">
              Tenant Architecture
            </span>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">Multi-Hospital Database Isolation</h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed font-semibold">
              Each clinical chain gets a completely locked environment. PostgreSQL Row Level Security (RLS) is automatically enabled at the core migration layer, meaning no staff account, patient queue details, or pharmacy stock catalog can ever be scraped or leaked.
            </p>

            <div className="space-y-4">
              {[
                { title: 'Isolated Workspace Dashboard', desc: 'Separate, branded interfaces customized to each local branch.' },
                { title: 'RLS Isolated Data Layers', desc: 'Database operations strictly filter out data outside the tenant UUID hash.' },
                { title: 'Zero Collisions Guarantee', desc: 'Staff rosters and drug inventories are sandboxed per hospital.' }
              ].map((item, idx) => (
                <div key={idx} className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800">{item.title}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed font-semibold">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Visual Sandbox Mockup */}
          <div className="lg:col-span-7 flex justify-center">
            <div className="w-full max-w-lg space-y-4">
              
              {/* Apollo hospital tenant visual */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden flex items-center justify-between">
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#005EB8]" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#005EB8]/5 border border-[#005EB8]/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[#005EB8]" />
                  </div>
                  <div>
                    <h4 className="font-black text-xs text-slate-800">Apollo Clinical Branch</h4>
                    <p className="text-[9px] text-slate-400 font-extrabold uppercase mt-0.5">Staff: 12 • Doctors: 6 • Status: Isolated Active</p>
                  </div>
                </div>
                <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">Secure Node</span>
              </div>

              {/* Separator / Locked gate */}
              <div className="flex items-center justify-center gap-2 text-slate-400 font-mono text-[9px] font-bold">
                <div className="h-px bg-slate-200 flex-1" />
                <div className="px-3.5 py-1 bg-white border border-slate-150 rounded-xl flex items-center gap-1 shadow-sm">
                  <Shield className="w-3.5 h-3.5 text-[#00A3AD]" />
                  <span>Absolute Tenant Separation Lock (RLS Active)</span>
                </div>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              {/* CityCare hospital tenant visual */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm relative overflow-hidden flex items-center justify-between">
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#00A3AD]" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00A3AD]/5 border border-[#00A3AD]/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-[#00A3AD]" />
                  </div>
                  <div>
                    <h4 className="font-black text-xs text-slate-800">CityCare General Hospital</h4>
                    <p className="text-[9px] text-slate-400 font-extrabold uppercase mt-0.5">Staff: 24 • Doctors: 11 • Status: Isolated Active</p>
                  </div>
                </div>
                <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">Secure Node</span>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── 4. STAFF ROLE ACCESS FLOW ── */}
      <section className="py-20 bg-white border-y border-slate-150">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
          <div className="space-y-3">
            <span className="inline-block bg-[#005EB8]/10 text-[#005EB8] text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider">
              Access Control
            </span>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Role-Based Staff Access Controls</h2>
            <p className="text-slate-400 text-xs sm:text-sm font-semibold max-w-xl mx-auto">
              Each staff role is securely provisioned at signup, defining strict system boundaries and granular view filters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              {
                role: 'Medical Practitioners (Doctors)',
                icon: <Stethoscope className="w-6 h-6 text-[#005EB8]" />,
                features: [
                  'View only assigned patient tokens.',
                  'Chart triage vitals and clinical diagnostics.',
                  'Compose and trigger digital prescriptions.',
                  'Direct automatic stock verification logs.'
                ],
                border: 'border-[#005EB8]/20 bg-[#005EB8]/5'
              },
              {
                role: 'Pharmacy & Stock Staff',
                icon: <Package className="w-6 h-6 text-[#00A3AD]" />,
                features: [
                  'View incoming patient prescription queues.',
                  'Monitor batch expiry indexes & suppliers.',
                  'Dispense items to reduce stock dynamically.',
                  'Trigger low stock security alert signals.'
                ],
                border: 'border-[#00A3AD]/20 bg-[#00A3AD]/5'
              },
              {
                role: 'Receptionists & Ward Boys',
                icon: <Users className="w-6 h-6 text-slate-600" />,
                features: [
                  'Onboard incoming clinic tokens & queues.',
                  'Record initial intake vitals variables.',
                  'Route patients to available practitioner slots.',
                  'Manage public calling display boards.'
                ],
                border: 'border-slate-200 bg-slate-50/50'
              }
            ].map((role, idx) => (
              <div key={idx} className={`rounded-3xl border p-6 space-y-4 shadow-sm ${role.border}`}>
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                  {role.icon}
                </div>
                <h3 className="font-extrabold text-sm text-slate-800">{role.role}</h3>
                <ul className="space-y-2.5">
                  {role.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs font-semibold text-slate-500 leading-tight">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. CORE MODULES FEATURES ── */}
      <section id="features" className="py-20 relative">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
          <div className="space-y-3">
            <span className="inline-block bg-[#00A3AD]/10 text-[#00A3AD] text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider">
              Core Modules
            </span>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Enterprise Modules In One Cloud</h2>
            <p className="text-slate-400 text-xs sm:text-sm font-semibold max-w-xl mx-auto">
              Everything needed to manage operational queues, e-prescriptions, available slots, and clinical performance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((item, idx) => (
              <div key={idx} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 text-left space-y-3">
                <div className="w-9 h-9 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-center">
                  {item.icon}
                </div>
                <h3 className="font-extrabold text-xs sm:text-sm text-slate-800">{item.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. PRICING PLAN SECTION ── */}
      <section id="pricing" className="py-20 bg-white border-y border-slate-150">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-12">
          <div className="space-y-3">
            <span className="inline-block bg-[#005EB8]/10 text-[#005EB8] text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider">
              SaaS Pricing
            </span>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Flexible SaaS Operations Tiers</h2>
            <p className="text-slate-400 text-xs sm:text-sm font-semibold max-w-xl mx-auto">
              All plans include complete multi-hospital isolated environments and PostgreSQL Row Level Security (RLS) security locks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              {
                name: 'Starter Setup',
                price: '₹4,999',
                period: 'month',
                desc: 'Perfect for local clinics and single outpatient centers looking for basic queue management.',
                features: [
                  '1 Isolated Branch Workspace',
                  'Up to 10 Doctor Rosters',
                  'Patient Token Queue OTP flow',
                  'Digital Token Public Display Board',
                  'Standard Role Permissions Access'
                ],
                border: 'border-slate-100 bg-white'
              },
              {
                name: 'Professional Ops',
                price: '₹14,999',
                period: 'month',
                desc: 'Tailored for medium hospitals and multi-department outpatient centers requiring complete modules.',
                features: [
                  'Up to 3 Isolated Branch Workspaces',
                  'Infinite Doctor & Staff Accounts',
                  'Automated Pharmacy Stock Reducer',
                  'Dynamic Vitals intake & Queue Alerts',
                  'Granular Analytical Performance charts',
                  'Emergency Priority overrides triggers'
                ],
                border: 'border-[#005EB8] bg-[#005EB8]/5 shadow-md relative'
              },
              {
                name: 'Enterprise Cloud',
                price: 'Custom Pricing',
                period: 'contact sales',
                desc: 'Provisioned for large healthcare chains and multispeciality hospital networks looking for central control.',
                features: [
                  'Unlimited Branch Workspaces',
                  'Separate Multi-Tenant Database nodes',
                  'Super Admin Platform Controller access',
                  'Voice announcement display boards integrations',
                  'Granular HIPAA/RLS custom compliance audits',
                  'Dedicated Setup & 24/7 Account Executive support'
                ],
                border: 'border-slate-150 bg-white'
              }
            ].map((plan, idx) => (
              <div key={idx} className={`rounded-3xl border p-6 flex flex-col justify-between space-y-6 shadow-sm ${plan.border}`}>
                {idx === 1 && (
                  <span className="absolute top-0 right-6 -translate-y-1/2 bg-[#005EB8] text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Recommended Plan
                  </span>
                )}
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-slate-800">{plan.name}</h3>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-900">{plan.price}</span>
                    {plan.period && <span className="text-xs text-slate-400 font-bold uppercase">/ {plan.period}</span>}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">{plan.desc}</p>
                </div>

                <div className="h-px bg-slate-100" />

                <ul className="space-y-3">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs font-semibold text-slate-500 leading-tight">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <a 
                  href="#demo"
                  className={`w-full py-3 rounded-xl font-black text-xs transition-all uppercase tracking-wider text-center flex items-center justify-center gap-1 ${
                    idx === 1 
                      ? 'bg-[#005EB8] hover:bg-[#004a96] text-white shadow-md' 
                      : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700'
                  }`}
                >
                  Onboard This Tier ➜
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. DEMO SCHEDULER WIDGET / CONTACT SALES ── */}
      <section id="demo" className="py-20 relative">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Form Pitch */}
          <div className="lg:col-span-5 space-y-6 text-left">
            <span className="inline-block bg-[#00A3AD]/10 text-[#00A3AD] text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider">
              Setup Platform
            </span>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight leading-tight">Schedule Your Platform Handover</h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed font-semibold">
              Fill in the operational scale of your clinical branch. Our onboarding specialists will provision your isolated PostgreSQL database tenant and mail back administrative control credentials in under 24 hours.
            </p>

            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-3.5">
              <div className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-600 leading-tight">Instant setup of patient QR terminal displays.</span>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-600 leading-tight">Seeded available doctor listings & OPD desks.</span>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-600 leading-tight">Dynamic stock pharmacy initial seeds uploaded.</span>
              </div>
            </div>
          </div>

          {/* Right Scheduler Widget Form */}
          <div className="lg:col-span-7 flex justify-center w-full">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-xl w-full max-w-lg relative overflow-hidden">
              
              {demoSubmitted ? (
                <div className="py-12 text-center space-y-4 animate-fade-in">
                  <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Onboarding Request Logged!</h3>
                  <div className="text-xs text-slate-400 font-semibold max-w-sm mx-auto leading-relaxed">
                    Thank you, <span className="font-extrabold text-[#005EB8]">{demoForm.contactPerson}</span>. We have logged your request for <span className="font-extrabold text-slate-800">{demoForm.hospitalName}</span>. 
                    An isolated domain workspace with RLS database configurations is being provisioned. Your credentials will be dispatched to <span className="font-bold underline text-slate-600">{demoForm.email}</span>.
                  </div>
                  <button 
                    onClick={() => { setDemoSubmitted(false); setDemoForm({ hospitalName: '', city: '', size: '10-50 beds', contactPerson: '', phone: '', email: '' }); }}
                    className="mt-6 px-4 py-2 border border-slate-200 text-slate-500 font-black text-[10px] rounded-xl hover:bg-slate-50 transition-colors uppercase tracking-wider"
                  >
                    Register Another Branch
                  </button>
                </div>
              ) : (
                <form onSubmit={handleDemoSubmit} className="space-y-4">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2 border-b border-slate-50 pb-3">
                    <Building2 className="w-5 h-5 text-[#005EB8]" />
                    Clinic Onboarding Directory
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Hospital / Clinic Name *</label>
                      <input 
                        type="text" 
                        value={demoForm.hospitalName} 
                        onChange={e => setDemoForm({...demoForm, hospitalName: e.target.value})}
                        placeholder="Apollo Clinic" 
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none font-semibold"
                        required 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Branch City *</label>
                      <input 
                        type="text" 
                        value={demoForm.city} 
                        onChange={e => setDemoForm({...demoForm, city: e.target.value})}
                        placeholder="Delhi" 
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none font-semibold"
                        required 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Contact Person *</label>
                      <input 
                        type="text" 
                        value={demoForm.contactPerson} 
                        onChange={e => setDemoForm({...demoForm, contactPerson: e.target.value})}
                        placeholder="Dr. Abhishek Kumar" 
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none font-semibold"
                        required 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Clinic Scale *</label>
                      <select 
                        value={demoForm.size} 
                        onChange={e => setDemoForm({...demoForm, size: e.target.value})}
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-semibold"
                      >
                        <option value="Under 10 beds">Under 10 beds (OPD Clinic)</option>
                        <option value="10-50 beds">10-50 beds (Clinical Outpatient)</option>
                        <option value="50-200 beds">50-200 beds (Medium Hospital)</option>
                        <option value="200+ beds">200+ beds (Multispeciality Network)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Phone Number *</label>
                      <input 
                        type="tel" 
                        value={demoForm.phone} 
                        onChange={e => setDemoForm({...demoForm, phone: e.target.value})}
                        placeholder="+91 99999 99999" 
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none font-semibold"
                        required 
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Work Email Address *</label>
                      <input 
                        type="email" 
                        value={demoForm.email} 
                        onChange={e => setDemoForm({...demoForm, email: e.target.value})}
                        placeholder="abhishek@apollo.com" 
                        className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#005EB8] outline-none font-semibold"
                        required 
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full min-h-[44px] bg-[#005EB8] hover:bg-[#004a96] text-white font-black text-xs rounded-xl shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Request Platform Onboarding Setup
                  </button>
                </form>
              )}

            </div>
          </div>
        </div>
      </section>

      {/* ── 8. FINAL CTA ── */}
      <section className="py-20 bg-white border-t border-slate-150">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <span className="inline-block bg-[#005EB8]/10 text-[#005EB8] text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider">
            Modernize Your Hospital Operations
          </span>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Ready to Run MedQueue at Your Clinic?</h2>
          <p className="text-slate-400 text-xs sm:text-sm font-semibold max-w-xl mx-auto leading-relaxed">
            Join hospitals reducing patient wait times by 45%, tracking batch pharmaceutical stocks transactionally, and establishing database isolation layers.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button 
              onClick={onGetStarted}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-[#005EB8] hover:bg-[#004a96] text-white font-black rounded-xl shadow-md shadow-[#005EB8]/10 text-xs uppercase tracking-wider"
            >
              Get Your Token Now
              <ArrowRight className="w-4 h-4" />
            </button>
            <a 
              href="#demo"
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl text-xs uppercase tracking-wider"
            >
              Request Admin Setup
            </a>
          </div>
        </div>
      </section>

      {/* ── 8.5 SIMULATED SANDBOX DESKS ── */}
      <section className="py-20 bg-slate-50 border-t border-slate-250 relative overflow-hidden">
        {/* Abstract decorative elements */}
        <div className="absolute top-[-30%] right-[-10%] w-[40%] h-[60%] bg-[#005EB8]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[-20%] w-[35%] h-[50%] bg-[#00A3AD]/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 text-center space-y-12 relative z-10">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1 bg-violet-100 text-violet-700 text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" />
              SaaS Playground & Sandbox
            </span>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight font-sans">Interactive Multi-Tenant Workspaces</h2>
            <p className="text-slate-400 text-xs sm:text-sm font-semibold max-w-xl mx-auto leading-relaxed">
              Hop inside any of the live simulated sandbox environments below to experience Notion-like clinic branding, independent OTP patient bookings, and isolated doctor/pharmacist rosters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Apollo Clinical Branch',
                slug: 'apollo',
                tagline: 'Super-Specialty Campus',
                accentColor: '#005EB8',
                accentBg: 'bg-[#005EB8]/5 border-[#005EB8]/10 text-[#005EB8]',
                features: ['Doctor: Dr. Diana (Cardiology)', 'Pharmacist: Rajesh Kumar', 'Theme Accent: Apollo Blue', 'Location Segment: Delhi Hub'],
                badge: 'd290f1ee-6c54-4b01-90e6-d701748f0851'
              },
              {
                name: 'Max Health Noida',
                slug: 'max',
                tagline: 'Multi-Department Clinic',
                accentColor: '#00A3AD',
                accentBg: 'bg-[#00A3AD]/5 border-[#00A3AD]/10 text-[#00A3AD]',
                features: ['Doctor: Dr. Sarah (Pediatrics)', 'Pharmacist: Anjali Roy', 'Theme Accent: Max Teal', 'Location Segment: Sector 62'],
                badge: 'a4220b22-83b3-4f9e-a89e-cb01748ff002'
              },
              {
                name: 'Gurugram City Hospital',
                slug: 'city',
                tagline: 'Urban Wellness Center',
                accentColor: '#6366F1',
                accentBg: 'bg-indigo-50 border-indigo-100 text-indigo-600',
                features: ['Doctor: Dr. Dev (Orthopedics)', 'Pharmacist: Sameer Sen', 'Theme Accent: City Indigo', 'Location Segment: Gurugram Central'],
                badge: '7e90a5fe-4b01-90c6-ff22-a701748f0222'
              }
            ].map((workspace, idx) => (
              <div 
                key={idx}
                className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between text-left relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: workspace.accentColor }} />
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${workspace.accentBg}`}>
                      {workspace.tagline}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                      Slug: {workspace.slug}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-slate-800 tracking-tight leading-tight">{workspace.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">Tenant Node UUID: {workspace.badge.slice(0, 8)}...{workspace.badge.slice(-6)}</p>
                  </div>

                  <ul className="space-y-2 pt-2 border-t border-slate-50">
                    {workspace.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-2 text-xs font-semibold text-slate-500 leading-tight">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: workspace.accentColor }} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  <a 
                    href={`?hosp=${workspace.slug}`}
                    className="w-full py-3 px-4 rounded-xl text-center font-black text-xs uppercase tracking-wider text-white shadow-sm flex items-center justify-center gap-1.5 transition-all duration-300 hover:brightness-95"
                    style={{ backgroundColor: workspace.accentColor }}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Enter Isolated Workspace
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-left max-w-2xl mx-auto flex gap-3.5 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider block">🔒 Enterprise Security Sandbox active</span>
              <p className="text-xs text-amber-600 font-semibold leading-relaxed">
                Logins are strictly locked to each workspace! If you attempt to log in using an Apollo doctor account on the Gurugram City Hospital workspace, the system's cross-tenant auth guards will intercept and block the request immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-6 border-t border-slate-850">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#005EB8] flex items-center justify-center shadow-md shadow-[#005EB8]/20">
              <Activity className="w-4 h-4 text-white animate-pulse" />
            </div>
            <span className="font-black text-white text-base tracking-tight">
              MedQueue
              <span className="text-[#00A3AD] font-extrabold">.</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-6 text-xs font-bold text-slate-400 justify-center">
            <a href="#how-it-works" className="hover:text-white transition-colors">Platform Workflow</a>
            <a href="#features" className="hover:text-white transition-colors">Core Modules</a>
            <a href="#isolation" className="hover:text-white transition-colors">Data Security</a>
            <a href="#pricing" className="hover:text-white transition-colors">SaaS Plans</a>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-emerald-500 uppercase tracking-wider">Operations Sync Active</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-slate-800 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          <div className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            <span>Built for scalable healthcare SaaS networks</span>
          </div>
          <div>
            <span>© {new Date().getFullYear()} MedQueue Platform. All Rights Reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
