import { useState, useEffect } from 'react';
import {
  Activity, Clock, Users, Shield, ChevronDown, ChevronUp,
  ArrowRight, CheckCircle, Smartphone, Bell, Stethoscope,
  Heart, Star, Menu, X, Play, Calendar, TrendingUp, Package
} from 'lucide-react';

interface Props {
  onGetStarted: () => void;   // patient login
  onStaffLogin: () => void;   // staff login
}

const SERVICES = [
  { icon: <Calendar className="w-6 h-6" />, title: 'Smart Scheduling', desc: 'Book appointments online and get real-time slot availability.' },
  { icon: <Bell className="w-6 h-6" />, title: 'Live Queue Alerts', desc: 'Get notified when your turn is approaching — wait from anywhere.' },
  { icon: <Stethoscope className="w-6 h-6" />, title: 'Digital Consultation', desc: 'Doctors get full patient history and vitals before the consultation.' },
  { icon: <Package className="w-6 h-6" />, title: 'Pharmacy Integration', desc: 'Prescriptions flow directly to pharmacy — no paper slips.' },
];

const STATS = [
  { value: '10K+', label: 'Patients Served' },
  { value: '45%', label: 'Less Wait Time' },
  { value: '50+', label: 'Departments' },
  { value: '99%', label: 'Satisfaction Rate' },
];

const STEPS = [
  { num: '01', title: 'Register Online', desc: 'Enter your phone number, verify with OTP, and fill your details once. We remember you for every future visit.', color: 'bg-violet-100 text-violet-600' },
  { num: '02', title: 'Get Your Token', desc: 'Receive a digital queue token instantly. Track your real-time position from your phone — no need to wait in line.', color: 'bg-blue-100 text-blue-600' },
  { num: '03', title: 'Walk In On Time', desc: 'Get notified when your turn is near. Walk in exactly when needed — doctor is ready with your vitals and history.', color: 'bg-emerald-100 text-emerald-600' },
];

const FAQS = [
  { q: 'How do I register as a new patient?', a: 'Click "Make Schedule" or "Get Started", enter your mobile number, verify with OTP, and fill your basic details. Next visit, just enter your number — we remember you.' },
  { q: 'Can I track my queue from home?', a: 'Yes! After getting your token, track your real-time position from any device. You\'ll get live updates as the queue moves.' },
  { q: 'Is my medical data secure?', a: 'Absolutely. All data is encrypted and stored securely in Supabase. Role-based access ensures only authorized staff can view patient information.' },
  { q: 'Do I need to install an app?', a: 'No! MedQueue is a Progressive Web App (PWA). It works in your browser and can be installed on your phone like a native app — no app store needed.' },
  { q: 'What if I miss my turn?', a: 'The doctor can mark you as "No Show". You can re-register at the counter if you\'re still present. Your patient data is always saved.' },
];

export default function LandingPage({ onGetStarted, onStaffLogin }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans overflow-x-hidden">

      {/* ── NAVBAR ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 h-18 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl text-gray-900">MedQueue</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: 'Home', href: '#' },
              { label: 'Services', href: '#services' },
              { label: 'How It Works', href: '#how-it-works' },
              { label: 'FAQ', href: '#faq' },
            ].map(item => (
              <a key={item.label} href={item.href}
                className="text-sm font-medium text-gray-600 hover:text-violet-600 transition-colors">
                {item.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={onStaffLogin}
              className="text-sm font-semibold text-gray-700 hover:text-violet-600 px-4 py-2 transition-colors">
              Staff Login
            </button>
            <button onClick={onGetStarted}
              className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-full transition-all shadow-lg shadow-violet-200">
              Patient Login
              <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                <ArrowRight className="w-3 h-3" />
              </div>
            </button>
          </div>

          {/* Mobile */}
          <button onClick={() => setMenuOpen(m => !m)} className="md:hidden text-gray-700">
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3 shadow-lg">
            {['Home', 'Services', 'How It Works', 'FAQ'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                onClick={() => setMenuOpen(false)}
                className="block text-sm font-medium text-gray-700 py-2 border-b border-gray-50">
                {item}
              </a>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={onStaffLogin} className="flex-1 py-2.5 border-2 border-gray-200 text-gray-700 rounded-full text-sm font-semibold">Staff Login</button>
              <button onClick={onGetStarted} className="flex-1 py-2.5 bg-violet-600 text-white rounded-full text-sm font-bold">Patient Login</button>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen bg-[#F8F7FF] flex items-center overflow-hidden pt-16">
        {/* Background blobs */}
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-violet-100 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-100 rounded-full blur-3xl opacity-40" />

        {/* Decorative dots */}
        <div className="absolute top-32 right-[45%] text-violet-300 text-2xl">✦</div>
        <div className="absolute top-48 right-[30%] text-violet-200 text-lg">✦</div>
        <div className="absolute bottom-32 left-[20%] text-blue-200 text-xl">✦</div>

        <div className="relative max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-12 items-center w-full">
          {/* Left content */}
          <div className="order-2 lg:order-1">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 text-xs font-bold px-4 py-2 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-violet-500 rounded-full" />
              Welcome to Healthcare
            </div>

            <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
              Get Premium{' '}
              <span className="text-violet-600 italic">Medical Care</span>{' '}
              For Your Health
            </h1>

            <p className="text-gray-500 text-lg leading-relaxed mb-8 max-w-md">
              Experience compassionate and personalized care tailored to your needs. Skip the queue, track your token, and walk in on time.
            </p>

            {/* CTA row */}
            <div className="flex items-center gap-5 mb-10">
              <button onClick={onGetStarted}
                className="flex items-center gap-3 px-7 py-4 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-full transition-all shadow-xl shadow-violet-200 text-base">
                Get Your Token
                <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>

              {/* Avatar stack */}
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {['bg-violet-400', 'bg-blue-400', 'bg-emerald-400'].map((c, i) => (
                    <div key={i} className={`w-9 h-9 ${c} rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold`}>
                      {['A', 'B', 'C'][i]}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">10K+ patients</div>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-8">
              {STATS.slice(0, 3).map(s => (
                <div key={s.label}>
                  <div className="text-2xl font-extrabold text-gray-900">{s.value}</div>
                  <div className="text-xs text-gray-400 font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Hero visual */}
          <div className="order-1 lg:order-2 relative flex justify-center">
            {/* Main circle bg */}
            <div className="relative">
              <div className="w-80 h-80 lg:w-96 lg:h-96 bg-gradient-to-br from-violet-200 to-violet-100 rounded-full flex items-center justify-center">
                {/* Doctor illustration placeholder */}
                <div className="w-64 h-64 lg:w-80 lg:h-80 bg-gradient-to-br from-violet-300 to-violet-200 rounded-full flex items-center justify-center overflow-hidden">
                  <div className="text-center">
                    <div className="text-8xl mb-2">👨‍⚕️</div>
                    <div className="text-violet-700 font-bold text-sm">MedQueue</div>
                    <div className="text-violet-500 text-xs">Hospital System</div>
                  </div>
                </div>
              </div>

              {/* Floating card — Token */}
              <div className="absolute -left-6 top-8 bg-white rounded-2xl shadow-xl p-4 w-44 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Your Token</div>
                    <div className="font-extrabold text-gray-900 text-lg">#42</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-xs text-emerald-600 font-semibold">~12 min wait</span>
                </div>
              </div>

              {/* Floating card — Appointment */}
              <div className="absolute -right-6 bottom-12 bg-white rounded-2xl shadow-xl p-4 w-44 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Next Slot</div>
                    <div className="font-bold text-gray-900 text-sm">10:30 AM</div>
                  </div>
                </div>
                <div className="text-xs text-gray-400">General OPD</div>
              </div>

              {/* Watch video button */}
              <div className="absolute -right-4 top-4 flex items-center gap-2">
                <div className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-violet-100 cursor-pointer hover:scale-110 transition-transform">
                  <Play className="w-5 h-5 text-violet-600 ml-0.5" />
                </div>
                <div className="bg-white rounded-xl shadow px-3 py-1.5 text-xs font-bold text-gray-700">
                  Watch Demo
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="bg-white py-12 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-extrabold text-violet-600 mb-1">{s.value}</div>
              <div className="text-gray-500 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="services" className="py-20 bg-[#F8F7FF]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-4 py-2 rounded-full mb-4 uppercase tracking-widest">
              Our Services
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
              Precision Healthcare Management
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Leveraging the latest technology designed for modern medical institutions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map((s, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                <div className="w-12 h-12 bg-violet-100 group-hover:bg-violet-600 rounded-xl flex items-center justify-center mb-4 transition-colors">
                  <div className="text-violet-600 group-hover:text-white transition-colors">{s.icon}</div>
                </div>
                <h3 className="font-bold text-gray-900 text-base mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-4 py-2 rounded-full mb-4 uppercase tracking-widest">
              How It Works
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
              Three Steps to a Calmer Visit
            </h2>
            <p className="text-gray-500 text-lg">Simple, fast, and completely digital.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={i} className="relative text-center group">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[65%] w-[70%] h-0.5 bg-gradient-to-r from-violet-200 to-gray-100" />
                )}
                <div className={`inline-flex items-center justify-center w-16 h-16 ${s.color} rounded-2xl mb-5 text-2xl font-extrabold shadow-sm group-hover:scale-110 transition-transform`}>
                  {s.num}
                </div>
                <h3 className="font-extrabold text-gray-900 text-lg mb-3">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROLES ── */}
      <section className="py-20 bg-[#F8F7FF]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-4 py-2 rounded-full mb-4 uppercase tracking-widest">
              Built For Everyone
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900">Every Role, Perfectly Served</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { role: 'Doctor', emoji: '👨‍⚕️', color: 'border-violet-200 hover:border-violet-400', badge: 'bg-violet-100 text-violet-700', features: ['Department queue', 'Patient vitals', 'Digital prescription', 'Send to pharmacy'] },
              { role: 'Ward Boy', emoji: '🏥', color: 'border-blue-200 hover:border-blue-400', badge: 'bg-blue-100 text-blue-700', features: ['Patient intake', 'Record vitals', 'Dept filtering', 'Mark ready'] },
              { role: 'Pharmacy', emoji: '💊', color: 'border-emerald-200 hover:border-emerald-400', badge: 'bg-emerald-100 text-emerald-700', features: ['Prescription queue', 'Medication details', 'Dispense tracking', 'Live updates'] },
              { role: 'Admin', emoji: '🔐', color: 'border-amber-200 hover:border-amber-400', badge: 'bg-amber-100 text-amber-700', features: ['Full overview', 'Historical data', 'Analytics', 'Staff management'] },
            ].map(r => (
              <div key={r.role} className={`bg-white rounded-2xl p-5 border-2 ${r.color} transition-all hover:shadow-lg`}>
                <div className="text-4xl mb-3">{r.emoji}</div>
                <div className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 ${r.badge}`}>{r.role}</div>
                <ul className="space-y-2">
                  {r.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-gray-600 text-sm">
                      <CheckCircle className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-gradient-to-br from-violet-600 to-violet-800 rounded-3xl p-10 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <div className="text-5xl text-white/30 font-serif mb-4">"</div>
              <p className="text-white text-xl font-medium leading-relaxed mb-8 max-w-2xl mx-auto">
                MedQueue has fundamentally improved the mental health of our front-desk staff and the satisfaction levels of every person who walks through our doors.
              </p>
              <div className="flex items-center justify-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white font-extrabold text-lg">DR</div>
                <div className="text-left">
                  <div className="font-bold text-white">Dr. Diana Rodriguez</div>
                  <div className="text-violet-200 text-sm">Chief Medical Officer, City General Hospital</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 bg-[#F8F7FF]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-4 py-2 rounded-full mb-4 uppercase tracking-widest">FAQ</div>
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-500">Everything you need to know about MedQueue.</p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className={`bg-white rounded-2xl overflow-hidden border-2 transition-all ${openFaq === i ? 'border-violet-400 shadow-md shadow-violet-100' : 'border-gray-100'}`}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left">
                  <span className={`font-semibold text-base ${openFaq === i ? 'text-violet-700' : 'text-gray-800'}`}>{faq.q}</span>
                  {openFaq === i
                    ? <ChevronUp className="w-5 h-5 text-violet-500 flex-shrink-0" />
                    : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-gray-500 text-sm leading-relaxed border-t border-gray-50 pt-4">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-block bg-violet-100 text-violet-700 text-xs font-bold px-4 py-2 rounded-full mb-6 uppercase tracking-widest">
            Built for Modern Institutions
          </div>
          <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
            Ready to transform your hospital?
          </h2>
          <p className="text-gray-500 text-lg mb-10 max-w-2xl mx-auto">
            Join hospitals that have already reduced wait times by 45% and improved patient satisfaction dramatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onGetStarted}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-full transition-all shadow-xl shadow-violet-200 text-base">
              Get Your Token Now
              <ArrowRight className="w-5 h-5" />
            </button>
            <button onClick={onStaffLogin}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-full transition-all text-base">
              <Shield className="w-5 h-5" />
              Staff Login
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-gray-900 py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-white text-lg">MedQueue</span>
            </div>
            <div className="flex gap-8 text-gray-400 text-sm">
              {['Home', 'Services', 'How It Works', 'FAQ'].map(item => (
                <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                  className="hover:text-white transition-colors">{item}</a>
              ))}
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 font-semibold">System Online</span>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-gray-500 text-sm">
            <div className="flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-red-400" />
              <span>Built for better healthcare</span>
            </div>
            <div className="flex gap-6">
              <span className="hover:text-white cursor-pointer transition-colors">Privacy Policy</span>
              <span className="hover:text-white cursor-pointer transition-colors">Support</span>
              <span className="hover:text-white cursor-pointer transition-colors">Contact</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
