import { useState, useEffect } from 'react';
import { registerToken } from '../lib/api';
import { Token, Priority, Department, DEPARTMENT_LABEL } from '../types';
import { AuthUser } from '../lib/auth';
import PhoneInput, { isValidPhone } from '../components/PhoneInput';
import { User, Building2, Ticket, ChevronDown, ChevronUp, Bell, CheckCircle, Loader2, AlertCircle, MapPin, Hash } from 'lucide-react';

const DEPARTMENTS: Department[] = [
  'general', 'cardiology', 'orthopedics', 'pediatrics',
  'gynecology', 'neurology', 'dermatology', 'ent', 'ophthalmology', 'pharmacy'
];

const PRIORITY_OPTIONS: { value: Priority; label: string; desc: string; color: string; dot: string }[] = [
  { value: 0, label: 'Emergency', desc: 'Life-threatening condition', color: 'border-red-400 bg-red-50 text-red-700', dot: 'bg-red-500' },
  { value: 1, label: 'Senior / Special', desc: 'Age 60+ or disability', color: 'border-amber-400 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { value: 2, label: 'Normal', desc: 'Regular consultation', color: 'border-emerald-400 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
];

const HOW_IT_WORKS = [
  { icon: <Ticket className="w-5 h-5" />, title: '1. Register', desc: 'Fill in your basic details and select the required department.' },
  { icon: <Ticket className="w-5 h-5" />, title: '2. Get Token', desc: 'Receive a unique queue number to track your status in real-time.' },
  { icon: <Bell className="w-5 h-5" />, title: '3. Real-time Alerts', desc: "Wait comfortably — we'll notify you when it's your turn." },
];

export default function RegisterPage({ onNavigate, currentUser }: {
  onNavigate: (p: string, state?: Record<string, unknown>) => void;
  currentUser?: AuthUser | null;
}) {
  // Check if this is a returning patient (has name + phone already)
  const isReturning = !!(
    currentUser?.type === 'patient' &&
    currentUser.phone &&
    currentUser.name &&
    currentUser.name !== currentUser.phone
  );

  // ── Returning patient form (only dept + priority) ──────────
  const [quickDept, setQuickDept] = useState<Department | ''>('');
  const [quickPriority, setQuickPriority] = useState<Priority>(2);

  // ── New patient / guest form ───────────────────────────────
  const [form, setForm] = useState({
    fullName: '',
    age: '',
    address: '',
    phone: '+91',
    department: '' as Department | '',
    priority: 2 as Priority,
  });

  // Pre-fill new patient form from logged-in user
  useEffect(() => {
    if (currentUser?.type === 'patient' && !isReturning) {
      setForm(f => ({
        ...f,
        fullName: (currentUser.name && currentUser.name !== currentUser.phone) ? currentUser.name : '',
        phone: currentUser.phone ?? f.phone,
        age: currentUser.age ? String(currentUser.age) : f.age,
        address: currentUser.address ?? f.address,
      }));
    }
  }, [currentUser, isReturning]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState<Token | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  // ── Returning patient quick submit ─────────────────────────
  async function handleQuickSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quickDept) return setError('Please select a department');
    setLoading(true); setError('');
    try {
      const data = await registerToken({
        phone: currentUser!.phone!,
        name: currentUser!.name,
        age: currentUser!.age,
        address: currentUser!.address,
        priority: quickPriority,
        department: quickDept,
      });
      setToken(data.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── New patient full submit ────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) return setError('Full name is required');
    if (!form.age.trim()) return setError('Age is required');
    if (!form.address.trim()) return setError('Address is required');
    if (!isValidPhone(form.phone)) return setError('Please enter a valid 10-digit mobile number');
    if (!form.department) return setError('Please select a department');
    setLoading(true); setError('');
    try {
      const data = await registerToken({
        phone: form.phone,
        name: form.fullName.trim(),
        age: parseInt(form.age),
        address: form.address.trim(),
        priority: form.priority,
        department: form.department,
      });
      setToken(data.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Success screen ─────────────────────────────────────────
  if (token) {
    return (
      <div className="min-h-screen bg-[#E8F3FF] flex items-center justify-center px-4 py-8">
        <div className="bg-white rounded-3xl shadow-lg p-8 max-w-sm w-full text-center">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#005EB8] mb-1">Token Booked!</h2>
          <p className="text-gray-500 mb-6 text-sm">Your queue token has been generated successfully.</p>

          <div className="bg-[#E8F3FF] rounded-2xl p-6 mb-6">
            <div className="text-xs font-bold text-[#005EB8] uppercase tracking-widest mb-1">Your Token Number</div>
            <div className="text-7xl font-extrabold text-[#005EB8]">#{token.token_number}</div>
          </div>

          <div className="text-sm text-gray-600 mb-6 space-y-1 text-left bg-gray-50 rounded-xl p-4">
            <p><span className="font-semibold">Phone:</span> {token.phone}</p>
            {token.patients?.name && <p><span className="font-semibold">Name:</span> {token.patients.name}</p>}
            {token.patients?.age ? <p><span className="font-semibold">Age:</span> {token.patients.age} yrs</p> : null}
            {token.department && <p><span className="font-semibold">Department:</span> {DEPARTMENT_LABEL[token.department]}</p>}
            <p><span className="font-semibold">Booked at:</span> {new Date(token.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setToken(null); setQuickDept(''); setQuickPriority(2); }}
              className="flex-1 min-h-[44px] py-3 border-2 border-[#005EB8] text-[#005EB8] rounded-xl font-semibold hover:bg-[#E8F3FF] transition-colors"
            >
              Book Another
            </button>
            <button
              onClick={() => onNavigate('tracker', { tokenNumber: token.token_number, phone: token.phone })}
              className="flex-1 min-h-[44px] py-3 bg-[#005EB8] text-white rounded-xl font-semibold hover:bg-[#004a96] transition-colors"
            >
              Track Token
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8F3FF]">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* ── RETURNING PATIENT — Quick booking ── */}
        {isReturning ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[#005EB8]">Welcome back!</h1>
              <p className="text-gray-600 mt-1 text-sm">Select department and get your token instantly.</p>
            </div>

            {/* Patient info card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-[#E8F3FF] rounded-xl flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-[#005EB8]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800 truncate">{currentUser!.name}</div>
                <div className="text-sm text-gray-500">
                  {currentUser!.phone}
                  {currentUser!.age ? ` • ${currentUser!.age} yrs` : ''}
                  {currentUser!.address ? ` • ${currentUser!.address}` : ''}
                </div>
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-full flex-shrink-0">
                Returning
              </span>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
              <form onSubmit={handleQuickSubmit} className="space-y-5">
                {/* Department */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Medical Department <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <select
                      value={quickDept}
                      onChange={e => setQuickDept(e.target.value as Department)}
                      className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-[#005EB8] focus:outline-none transition-colors appearance-none bg-white"
                    >
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Priority</label>
                  <div className="grid grid-cols-1 gap-2">
                    {PRIORITY_OPTIONS.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setQuickPriority(p.value)}
                        className={`flex items-center gap-3 min-h-[44px] px-4 py-3 rounded-xl border-2 text-left transition-all ${
                          quickPriority === p.value ? p.color : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${quickPriority === p.value ? p.dot : 'bg-gray-300'}`} />
                        <div>
                          <div className="font-semibold text-sm">{p.label}</div>
                          <div className="text-xs opacity-75">{p.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !quickDept}
                  className="w-full min-h-[52px] bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-60 text-white font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ticket className="w-5 h-5" />}
                  {loading ? 'Booking...' : 'Get Token Instantly →'}
                </button>
              </form>
            </div>
          </>
        ) : (
          /* ── NEW PATIENT — Full form ── */
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-[#005EB8]">Patient Registration</h1>
              <p className="text-gray-600 mt-1 text-sm">
                Register to get your place in the queue. You'll receive a digital token to track your status.
              </p>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                      placeholder="Enter patient's full name"
                      required
                      className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-[#005EB8] focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Age + Phone */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Age <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        value={form.age}
                        onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                        placeholder="e.g. 35"
                        min="1" max="120"
                        required
                        className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-[#005EB8] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Mobile <span className="text-red-500">*</span>
                    </label>
                    <PhoneInput
                      value={form.phone}
                      onChange={v => setForm(f => ({ ...f, phone: v }))}
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                    <textarea
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="City / Village / Area"
                      rows={2}
                      required
                      className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-[#005EB8] focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Medical Department <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <select
                      value={form.department}
                      onChange={e => setForm(f => ({ ...f, department: e.target.value as Department }))}
                      className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-[#005EB8] focus:outline-none transition-colors appearance-none bg-white"
                    >
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{DEPARTMENT_LABEL[d]}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Priority</label>
                  <div className="grid grid-cols-1 gap-2">
                    {PRIORITY_OPTIONS.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                        className={`flex items-center gap-3 min-h-[44px] px-4 py-3 rounded-xl border-2 text-left transition-all ${
                          form.priority === p.value ? p.color : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${form.priority === p.value ? p.dot : 'bg-gray-300'}`} />
                        <div>
                          <div className="font-semibold text-sm">{p.label}</div>
                          <div className="text-xs opacity-75">{p.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[52px] bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-60 text-white font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ticket className="w-5 h-5" />}
                  {loading ? 'Registering...' : 'Get Digital Token'}
                </button>

                <p className="text-center text-xs text-gray-400">
                  By clicking, you agree to our patient data privacy policy.
                </p>
              </form>
            </div>

            {/* How it works */}
            <div className="bg-[#dbeafe] rounded-2xl border border-blue-200 overflow-hidden">
              <button
                onClick={() => setHowOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="font-bold text-[#005EB8]">How it works</span>
                {howOpen ? <ChevronUp className="w-5 h-5 text-[#005EB8]" /> : <ChevronDown className="w-5 h-5 text-[#005EB8]" />}
              </button>
              {howOpen && (
                <div className="px-5 pb-5 space-y-4">
                  {HOW_IT_WORKS.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#005EB8] text-white flex items-center justify-center flex-shrink-0">
                        {step.icon}
                      </div>
                      <div>
                        <div className="font-semibold text-[#005EB8] text-sm">{step.title}</div>
                        <div className="text-xs text-gray-600 mt-0.5">{step.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
