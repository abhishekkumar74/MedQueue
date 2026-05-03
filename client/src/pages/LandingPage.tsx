import { useState, useEffect } from 'react';
import {
  Activity, Clock, Users, Shield, ChevronDown, ChevronUp,
  ArrowRight, CheckCircle, Smartphone, Bell, Stethoscope,
  Heart, Package, Star, Menu, X
} from 'lucide-react';

interface Props {
  onGetStarted: () => void;
  onStaffLogin: () => void;
}

const FEATURES = [
  {
    icon: <Smartphone className="w-6 h-6" />,
    title: 'Mobile Registration',
    desc: 'Register from your phone in seconds. No paperwork, no waiting in line to get a token.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: <Bell className="w-6 h-6" />,
    title: 'Live Queue Updates',
    desc: 'Real-time notifications when your turn is approaching. Wait comfortably anywhere.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    icon: <Clock className="w-6 h-6" />,
    title: 'Estimated Wait Time',
    desc: 'Smart AI estimates your wait time based on current queue speed and priority.',
    color: 'bg-violet-50 text-violet-600',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Role-Based Access',
    desc: 'Doctors, Ward Boys, Pharmacy — each sees only what they need. Secure by design.',
    color: 'bg-amber-50 text-amber-600',
  },
  {
    icon: <Stethoscope className="w-6 h-6" />,
    title: 'Doctor Panel',
    desc: 'Structured consultation with vitals, diagnosis, and digital prescription in one place.',
    color: 'bg-rose-50 text-rose-600',
  },
  {
    icon: <Package className="w-6 h-6" />,
    title: 'Pharmacy Integration',
    desc: 'Prescriptions flow directly to pharmacy. No paper slips, no lost prescriptions.',
    color: 'bg-cyan-50 text-cyan-600',
  },
];

const STEPS = [
  { num: '01', title: 'Register', desc: 'Enter your phone number and get an OTP. Fill basic details once — we remember you next time.', icon: <Smartphone className="w-7 h-7" /> },
  { num: '02', title: 'Get Token', desc: 'Receive your digital queue token instantly. Track your position in real-time from anywhere.', icon: <Bell className="w-7 h-7" /> },
  { num: '03', title: 'Consult', desc: 'Walk in when it\'s your turn. Doctor sees your vitals and history — consultation starts immediately.', icon: <Stethoscope className="w-7 h-7" /> },
];

const STATS = [
  { value: '45%', label: 'Reduction in wait time', icon: <Clock className="w-5 h-5" /> },
  { value: '3x', label: 'Faster patient flow', icon: <Activity className="w-5 h-5" /> },
  { value: '99%', label: 'Patient satisfaction', icon: <Star className="w-5 h-5" /> },
  { value: '0', label: 'Paper forms needed', icon: <CheckCircle className="w-5 h-5" /> },
];

const FAQS = [
  { q: 'How do I register as a patient?', a: 'Click "Get Your Token Now", enter your mobile number, verify with OTP, and fill your basic details. Next time, just enter your number — we remember you.' },
  { q: 'Can I track my queue position from home?', a: 'Yes! After getting your token, you can track your real-time position from any device. You\'ll get live updates as the queue moves.' },
  { q: 'What if I miss my turn?', a: 'The doctor can mark you as "No Show" and move to the next patient. You can re-register at the counter if you\'re still present.' },
  { q: 'Is my medical data secure?', a: 'Yes. All data is encrypted and stored securely. Role-based access ensures only authorized staff can view patient information.' },
  { q: 'Do I need to install an app?', a: 'No! MedQueue is a Progressive Web App (PWA). It works in your browser and can be installed on your phone like an app — no app store needed.' },
];

export default function LandingPage({ onGetStarted, onStaffLogin }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── NAVBAR ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#005EB8] rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className={`font-extrabold text-xl ${scrolled ? 'text-gray-900' : 'text-white'}`}>MedQueue</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {['Features', 'How It Works', 'FAQ'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                className={`text-sm font-medium transition-colors ${scrolled ? 'text-gray-600 hover:text-[#005EB8]' : 'text-white/80 hover:text-white'}`}>
                {item}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={onStaffLogin}
              className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white/80 hover:text-white'}`}>
              Staff Login
            </button>
            <button onClick={onGetStarted}
              className="text-sm font-bold px-5 py-2.5 bg-[#005EB8] hover:bg-[#004a96] text-white rounded-xl transition-colors shadow-lg shadow-blue-500/20">
              Get Started
            </button>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setMenuOpen(m => !m)} className={`md:hidden ${scrolled ? 'text-gray-700' : 'text-white'}`}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
            {['Features', 'How It Works', 'FAQ'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/ /g, '-')}`}
                onClick={() => setMenuOpen(false)}
                className="block text-sm font-medium text-gray-700 py-2">
                {item}
              </a>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={onStaffLogin} className="flex-1 py-2.5 border-2 border-gray-200 text-gray-700 rounded-xl text-sm font-semibold">Staff Login</button>
              <button onClick={onGetStarted} className="flex-1 py-2.5 bg-[#005EB8] text-white rounded-xl text-sm font-bold">Get Started</button>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen bg-gradient-to-br from-[#003d7a] via-[#005EB8] to-[#0077cc] flex items-center overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#00A3AD] rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-300 rounded-full blur-3xl" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        <div className="relative max-w-6xl mx-auto px-4 py-24 grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-bold px-4 py-2 rounded-full mb-6">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              Live Queue Management System
            </div>
            <h1 className="text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
              Your Health,<br />
              <span className="text-[#00A3AD]">On Time.</span>
            </h1>
            <p className="text-blue-100 text-lg leading-relaxed mb-8 max-w-lg">
              Skip the waiting room chaos. Register digitally, track your queue in real-time, and walk in exactly when it's your turn.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={onGetStarted}
                className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-[#005EB8] font-extrabold rounded-2xl hover:bg-blue-50 transition-all shadow-xl shadow-black/20 text-base">
                Get Your Token Now
                <ArrowRight className="w-5 h-5" />
              </button>
              <button onClick={onStaffLogin}
                className="flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/30 text-white font-bold rounded-2xl hover:bg-white/20 transition-all text-base">
                <Shield className="w-5 h-5" />
                Staff Portal
              </button>
            </div>

            {/* Mini stats */}
            <div className="flex gap-6 mt-10">
              {[
                { val: '45%', label: 'Less wait time' },
                { val: '3x', label: 'Faster flow' },
                { val: '100%', label: 'Digital' },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-2xl font-extrabold text-white">{s.val}</div>
                  <div className="text-blue-200 text-xs">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Token card mockup */}
          <div className="hidden lg:flex justify-center">
            <div className="relative">
              {/* Main card */}
              <div className="bg-white rounded-3xl shadow-2xl p-6 w-80">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Main OPD Branch</div>
                    <div className="text-sm font-semibold text-gray-700">General Practitioner</div>
                  </div>
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">OPEN</span>
                </div>

                <div className="bg-[#E8F3FF] rounded-2xl p-5 mb-4 text-center">
                  <div className="text-xs font-bold text-[#005EB8] uppercase tracking-widest mb-1">Your Token</div>
                  <div className="text-7xl font-extrabold text-[#005EB8]">#42</div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-1">Queue Time</div>
                    <div className="text-xl font-extrabold text-gray-800">~8:42</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-1">Estimated Wait</div>
                    <div className="text-xl font-extrabold text-gray-800">12 min</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-semibold text-emerald-700">Live updates active</span>
                </div>
              </div>

              {/* Floating notification */}
              <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl p-3 flex items-center gap-2 border border-gray-100">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Bell className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-800">Your turn soon!</div>
                  <div className="text-xs text-gray-400">2 patients ahead</div>
                </div>
              </div>

              {/* Floating dept badge */}
              <div className="absolute -bottom-4 -left-4 bg-[#005EB8] rounded-2xl shadow-xl p-3 text-white">
                <div className="text-xs font-bold opacity-70">Department</div>
                <div className="text-sm font-extrabold">General OPD</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 animate-bounce">
          <ChevronDown className="w-6 h-6" />
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="bg-[#005EB8] py-10">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map(s => (
            <div key={s.label} className="text-center">
              <div className="flex justify-center mb-2 text-[#00A3AD]">{s.icon}</div>
              <div className="text-3xl font-extrabold text-white">{s.value}</div>
              <div className="text-blue-200 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-block bg-blue-50 text-[#005EB8] text-xs font-bold px-4 py-2 rounded-full mb-4 uppercase tracking-widest">
              Precision Management Tools
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
              Everything your hospital needs
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Leveraging the latest in healthcare technology, designed for modern medical institutions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-block bg-emerald-50 text-emerald-700 text-xs font-bold px-4 py-2 rounded-full mb-4 uppercase tracking-widest">
              Three Steps to a Calmer Visit
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900">Simple. Fast. Digital.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={i} className="relative text-center">
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-[#005EB8] to-gray-200" />
                )}
                <div className="relative inline-flex items-center justify-center w-20 h-20 bg-[#005EB8] rounded-2xl text-white mb-5 shadow-lg shadow-blue-500/30">
                  {s.icon}
                  <span className="absolute -top-2 -right-2 w-6 h-6 bg-[#00A3AD] rounded-full text-xs font-extrabold flex items-center justify-center">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-extrabold text-gray-900 text-xl mb-3">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROLES SECTION ── */}
      <section className="py-20 bg-gradient-to-br from-[#003d7a] to-[#005EB8]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-extrabold text-white mb-4">Built for Every Role</h2>
            <p className="text-blue-200 text-lg">Each team member gets exactly what they need — nothing more, nothing less.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { role: 'Doctor', icon: '👨‍⚕️', color: 'from-blue-500 to-blue-600', features: ['Department queue view', 'Patient vitals & history', 'Digital prescription', 'Send to pharmacy'] },
              { role: 'Ward Boy', icon: '🏥', color: 'from-emerald-500 to-emerald-600', features: ['Patient intake form', 'Record BP, Sugar, Temp', 'Department filtering', 'Mark ready for doctor'] },
              { role: 'Pharmacy', icon: '💊', color: 'from-violet-500 to-violet-600', features: ['Prescription queue', 'Medication details', 'Dispense tracking', 'Real-time updates'] },
              { role: 'Admin', icon: '🔐', color: 'from-amber-500 to-amber-600', features: ['Full hospital overview', 'Historical data', 'Department analytics', 'Staff management'] },
            ].map(r => (
              <div key={r.role} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-5 hover:bg-white/20 transition-all">
                <div className="text-4xl mb-3">{r.icon}</div>
                <h3 className="font-extrabold text-white text-lg mb-3">{r.role}</h3>
                <ul className="space-y-2">
                  {r.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-blue-100 text-sm">
                      <CheckCircle className="w-3.5 h-3.5 text-[#00A3AD] flex-shrink-0" />
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
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="text-6xl text-[#005EB8] font-serif mb-6 opacity-30">"</div>
          <blockquote className="text-2xl font-semibold text-gray-800 leading-relaxed mb-8">
            MedQueue hasn't just changed how we manage our patients, it has fundamentally improved the mental health of our front-desk staff and the satisfaction levels of every person who walks through our doors.
          </blockquote>
          <div className="flex items-center justify-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-[#005EB8] to-[#00A3AD] rounded-full flex items-center justify-center text-white font-extrabold text-xl">
              DR
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-900">Dr. Diana Rodriguez</div>
              <div className="text-gray-500 text-sm">Chief Medical Officer, City General Hospital</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-500">Everything you need to know about MedQueue.</p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className={`border-2 rounded-2xl overflow-hidden transition-all ${openFaq === i ? 'border-[#005EB8]' : 'border-gray-100'}`}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                >
                  <span className={`font-semibold text-base ${openFaq === i ? 'text-[#005EB8]' : 'text-gray-800'}`}>
                    {faq.q}
                  </span>
                  {openFaq === i
                    ? <ChevronUp className="w-5 h-5 text-[#005EB8] flex-shrink-0" />
                    : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  }
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-gradient-to-br from-[#003d7a] to-[#005EB8]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-block bg-white/10 text-white text-xs font-bold px-4 py-2 rounded-full mb-6 uppercase tracking-widest">
            Built for Modern Institutions
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-4">
            Ready to transform your hospital?
          </h2>
          <p className="text-blue-200 text-lg mb-10 max-w-2xl mx-auto">
            Join hospitals that have already reduced wait times by 45% and improved patient satisfaction scores dramatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onGetStarted}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-[#005EB8] font-extrabold rounded-2xl hover:bg-blue-50 transition-all shadow-xl text-base">
              Schedule a Demo
              <ArrowRight className="w-5 h-5" />
            </button>
            <button onClick={onStaffLogin}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-white/10 border border-white/30 text-white font-bold rounded-2xl hover:bg-white/20 transition-all text-base">
              <Shield className="w-5 h-5" />
              Staff Login
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-gray-900 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#005EB8] rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-extrabold text-white">MedQueue</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Heart className="w-4 h-4 text-red-400" />
            <span>Built for better healthcare</span>
          </div>
          <div className="flex gap-6 text-gray-400 text-sm">
            <span>Privacy Policy</span>
            <span>Support</span>
            <span className="text-emerald-400 font-semibold">● System Online</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
