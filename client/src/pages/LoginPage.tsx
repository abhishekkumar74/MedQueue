import { useState } from 'react';
import { AuthUser, loginStaff, requestOtp, verifyOtp } from '../lib/auth';
import { supabase } from '../lib/supabase';
import PhoneInput, { isValidPhone } from '../components/PhoneInput';
import { Activity, Eye, EyeOff, Loader2, AlertCircle, Shield, ArrowLeft, User, MapPin, Hash } from 'lucide-react';

type LoginMode = 'choose' | 'staff' | 'patient-phone' | 'patient-otp' | 'patient-register';

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<LoginMode>('choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Staff login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Patient OTP
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [newPatientId, setNewPatientId] = useState('');

  // New patient registration (all required)
  const [regForm, setRegForm] = useState({ name: '', age: '', address: '' });

  function reset() { setError(''); setLoading(false); }

  // ── Staff login ──────────────────────────────────────────
  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return setError('Email and password required');
    setLoading(true); setError('');
    try {
      const user = await loginStaff(email, password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally { setLoading(false); }
  }

  // ── Patient OTP request ──────────────────────────────────
  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) return setError('Please enter a valid 10-digit mobile number');
    setLoading(true); setError('');
    try {
      const res = await requestOtp(phone);
      if (res.otp) setDevOtp(res.otp);
      setMode('patient-otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally { setLoading(false); }
  }

  // ── OTP verify ───────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) return setError('Enter the OTP');
    setLoading(true); setError('');
    try {
      const user = await verifyOtp(phone, otp.trim());
      // New patient — name empty → show registration form
      if (!user.name || user.name === phone) {
        setNewPatientId(user.id);
        setMode('patient-register');
        setLoading(false);
        return;
      }
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP');
    } finally { setLoading(false); }
  }

  // ── New patient details save ─────────────────────────────
  async function handlePatientRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regForm.name.trim())    return setError('Full name is required');
    if (!regForm.age.trim())     return setError('Age is required');
    if (!regForm.address.trim()) return setError('Address is required');
    const age = parseInt(regForm.age);
    if (isNaN(age) || age < 1 || age > 120) return setError('Enter a valid age (1–120)');

    setLoading(true); setError('');
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          name: regForm.name.trim(),
          age,
          address: regForm.address.trim(),
        })
        .eq('id', newPatientId);
      if (error) throw new Error(error.message);

      const user: AuthUser = {
        id: newPatientId,
        name: regForm.name.trim(),
        type: 'patient',
        phone,
        age,
        address: regForm.address.trim(),
      };
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save details');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#005EB8] to-[#003d7a] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Activity className="w-10 h-10 text-[#00A3AD]" />
            <span className="text-3xl font-extrabold text-white">MedQueue</span>
          </div>
          <p className="text-blue-200 text-sm">Hospital Queue Management System</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Back button */}
          {mode !== 'choose' && (
            <button
              onClick={() => { setMode('choose'); reset(); }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* ── Choose mode ── */}
          {mode === 'choose' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Sign In</h2>

              <button
                onClick={() => { setMode('staff'); reset(); }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-200 hover:border-[#005EB8] hover:bg-[#E8F3FF] transition-all text-left group"
              >
                <div className="w-12 h-12 bg-[#005EB8] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-gray-800 group-hover:text-[#005EB8]">Staff Login</div>
                  <div className="text-sm text-gray-500">Doctor, Ward Boy, Pharmacy, Admin</div>
                </div>
              </button>

              <button
                onClick={() => { setMode('patient-phone'); reset(); }}
                className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
              >
                <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-gray-800 group-hover:text-emerald-700">Patient Login</div>
                  <div className="text-sm text-gray-500">Login with mobile number + OTP</div>
                </div>
              </button>
            </div>
          )}

          {/* ── Staff login ── */}
          {mode === 'staff' && (
            <form onSubmit={handleStaffLogin} className="space-y-5">
              <h2 className="text-xl font-bold text-gray-800">Staff Login</h2>
              <p className="text-sm text-gray-500">Enter your hospital credentials</p>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="doctor@hospital.com"
                  autoComplete="email"
                  className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-[#005EB8] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl px-4 pr-12 py-3 text-base focus:border-[#005EB8] focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* ── Patient phone ── */}
          {mode === 'patient-phone' && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <h2 className="text-xl font-bold text-gray-800">Patient Login</h2>
              <p className="text-sm text-gray-500">Enter your 10-digit mobile number</p>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  focusColor="focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !isValidPhone(phone)}
                className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {loading ? 'Sending OTP...' : 'Send OTP →'}
              </button>
            </form>
          )}

          {/* ── OTP verify ── */}
          {mode === 'patient-otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <h2 className="text-xl font-bold text-gray-800">Enter OTP</h2>
              <p className="text-sm text-gray-500">
                OTP sent to <span className="font-semibold text-gray-700">{phone}</span>
              </p>

              {devOtp && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                  <span className="font-bold">Dev OTP:</span> {devOtp}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">6-digit OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  autoFocus
                  className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl px-4 py-3 text-2xl font-bold tracking-[0.5em] text-center focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>

              <button
                type="button"
                onClick={() => { setMode('patient-phone'); setOtp(''); setDevOtp(''); reset(); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Resend OTP
              </button>
            </form>
          )}

          {/* ── New patient registration ── */}
          {mode === 'patient-register' && (
            <form onSubmit={handlePatientRegister} className="space-y-4">
              <div className="text-center pb-1">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User className="w-7 h-7 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Welcome!</h2>
                <p className="text-sm text-gray-500 mt-1">First visit — please fill your details</p>
                <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700 font-semibold">
                  📱 {phone}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={regForm.name}
                    onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Enter your full name"
                    autoFocus
                    required
                    className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Age */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Age <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={regForm.age}
                    onChange={e => setRegForm(f => ({ ...f, age: e.target.value }))}
                    placeholder="e.g. 35"
                    min="1" max="120"
                    required
                    className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-emerald-500 focus:outline-none transition-colors"
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
                    value={regForm.address}
                    onChange={e => setRegForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="City / Village / Area"
                    rows={2}
                    required
                    className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-emerald-500 focus:outline-none transition-colors resize-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !regForm.name.trim() || !regForm.age.trim() || !regForm.address.trim()}
                className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {loading ? 'Saving...' : 'Save & Continue →'}
              </button>

              <p className="text-center text-xs text-gray-400">
                Ye details next visit pe automatically fill ho jayengi ✓
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-blue-200 text-xs mt-6">MedQueue Hospital Management System</p>
      </div>
    </div>
  );
}
