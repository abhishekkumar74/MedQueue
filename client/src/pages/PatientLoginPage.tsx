/**
 * Patient-only login — phone + OTP
 * Staff never sees this page
 */
import { useState } from 'react';
import { AuthUser, requestOtp, verifyOtp } from '../lib/auth';
import { supabase } from '../lib/supabase';
import PhoneInput, { isValidPhone } from '../components/PhoneInput';
import { Activity, Loader2, AlertCircle, ArrowLeft, User, MapPin, Hash } from 'lucide-react';

type Mode = 'phone' | 'otp' | 'register';

interface Props {
  onLogin: (user: AuthUser) => void;
  onBack: () => void;  // goes to landing page
}

export default function PatientLoginPage({ onLogin, onBack }: Props) {
  const [mode, setMode] = useState<Mode>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [newPatientId, setNewPatientId] = useState('');
  const [regForm, setRegForm] = useState({ name: '', age: '', address: '' });

  function reset() { setError(''); }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone(phone)) return setError('Please enter a valid 10-digit mobile number');
    setLoading(true); setError('');
    try {
      const res = await requestOtp(phone);
      if (res.otp) setDevOtp(res.otp);
      setMode('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally { setLoading(false); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) return setError('Enter the OTP');
    setLoading(true); setError('');
    try {
      const user = await verifyOtp(phone, otp.trim());
      if (!user.name || user.name === phone) {
        setNewPatientId(user.id);
        setMode('register');
        setLoading(false);
        return;
      }
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired OTP');
    } finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regForm.name.trim()) return setError('Full name is required');
    if (!regForm.age.trim()) return setError('Age is required');
    if (!regForm.address.trim()) return setError('Address is required');
    const age = parseInt(regForm.age);
    if (isNaN(age) || age < 1 || age > 120) return setError('Enter a valid age (1-120)');
    setLoading(true); setError('');
    try {
      const { error } = await supabase.from('patients').update({
        name: regForm.name.trim(), age, address: regForm.address.trim(),
      }).eq('id', newPatientId);
      if (error) throw new Error(error.message);
      onLogin({ id: newPatientId, name: regForm.name.trim(), type: 'patient', phone, age, address: regForm.address.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save details');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#005EB8] to-[#003d7a] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-center mb-8 w-full hover:opacity-80 transition-opacity">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Activity className="w-10 h-10 text-[#00A3AD]" />
            <span className="text-3xl font-extrabold text-white">MedQueue</span>
          </div>
          <p className="text-blue-200 text-sm">Patient Portal</p>
        </button>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <button onClick={mode === 'phone' ? onBack : () => { setMode('phone'); setOtp(''); reset(); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {error && (
            <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {mode === 'phone' && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Patient Login</h2>
                <p className="text-sm text-gray-500 mt-1">Enter your 10-digit mobile number</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mobile Number *</label>
                <PhoneInput value={phone} onChange={setPhone} focusColor="focus:border-emerald-500" />
              </div>
              <button type="submit" disabled={loading || !isValidPhone(phone)}
                className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          )}

          {mode === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Enter OTP</h2>
                <p className="text-sm text-gray-500 mt-1">OTP sent to <span className="font-semibold text-gray-700">{phone}</span></p>
              </div>
              {devOtp && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                  <span className="font-bold">Dev OTP:</span> {devOtp}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">6-digit OTP</label>
                <input type="text" inputMode="numeric" value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456" maxLength={6} autoFocus
                  className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl px-4 py-3 text-2xl font-bold tracking-[0.5em] text-center focus:border-emerald-500 focus:outline-none" />
              </div>
              <button type="submit" disabled={loading || otp.length !== 6}
                className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>
              <button type="button" onClick={() => { setMode('phone'); setOtp(''); reset(); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 underline">Resend OTP</button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="text-center pb-1">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <User className="w-7 h-7 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Welcome!</h2>
                <p className="text-sm text-gray-500 mt-1">First visit — please fill your details</p>
                <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs text-emerald-700 font-semibold">
                  {phone}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Enter your full name" autoFocus required
                    className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-emerald-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Age *</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="number" value={regForm.age} onChange={e => setRegForm(f => ({ ...f, age: e.target.value }))}
                    placeholder="e.g. 35" min="1" max="120" required
                    className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-emerald-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Address *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                  <textarea value={regForm.address} onChange={e => setRegForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="City / Village / Area" rows={2} required
                    className="w-full border-2 border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:border-emerald-500 focus:outline-none resize-none" />
                </div>
              </div>
              <button type="submit" disabled={loading || !regForm.name.trim() || !regForm.age.trim() || !regForm.address.trim()}
                className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {loading ? 'Saving...' : 'Save & Continue'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-blue-200 text-xs mt-6">MedQueue Hospital Management System</p>
      </div>
    </div>
  );
}
