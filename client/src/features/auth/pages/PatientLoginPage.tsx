import { useState, useEffect } from 'react';
import { AuthUser, requestOtp, verifyOtp } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';
import PhoneInput, { isValidPhone } from '../../../components/PhoneInput';
import HospitalSelector from '../../../components/HospitalSelector';
import { Activity, Loader2, AlertCircle, ArrowLeft, User, MapPin, Hash, Building2, HeartPulse, Calendar, FileText } from 'lucide-react';
import { getTenantSlug, resolveTenantConfig, TenantConfig } from '../../../lib/tenant';
import { cookies } from '../../../lib/cookies';

type Mode = 'phone' | 'otp' | 'register';

interface Props {
  onLogin: (user: AuthUser) => void;
  onLogoClick: () => void;
  onBack: () => void;  // goes to landing page
}

export default function PatientLoginPage({ onLogin, onLogoClick, onBack }: Props) {
  const [mode, setMode] = useState<Mode>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [newPatientId, setNewPatientId] = useState('');
  const [regForm, setRegForm] = useState({ name: '', age: '', address: '' });
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    async function loadTenant() {
      const slug = getTenantSlug();
      if (slug) {
        const config = await resolveTenantConfig(slug);
        setTenant(config);
      }
    }
    loadTenant();
  }, []);

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
      cookies.setCookie('medqueue_remember_me', rememberMe ? 'true' : 'false', 30);
      cookies.setCookie('medqueue_last_role', 'PATIENT', 365);
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
      const hospitalId = localStorage.getItem('mq_selected_hospital_id') || 'd290f1ee-6c54-4b01-90e6-d701748f0851';
      const { error } = await supabase.from('patients').update({
        name: regForm.name.trim(), age, address: regForm.address.trim(), hospital_id: hospitalId
      }).eq('id', newPatientId);
      if (error) throw new Error(error.message);
      cookies.setCookie('medqueue_remember_me', rememberMe ? 'true' : 'false', 30);
      cookies.setCookie('medqueue_last_role', 'PATIENT', 365);
      onLogin({ id: newPatientId, name: regForm.name.trim(), type: 'patient', phone, age, address: regForm.address.trim(), hospital_id: hospitalId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save details');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#ECF5FC] via-[#F3F8FC] to-[#F7FAFC] flex items-center justify-center px-4 py-8 font-sans">
      <div className="w-full max-w-md">
        <button onClick={onLogoClick} className="text-center mb-6 w-full hover:opacity-90 transition-opacity focus:outline-none">
          <div className="flex items-center justify-center gap-2.5 mb-1.5">
            <div className="w-10 h-10 rounded-2xl bg-[#005EB8] flex items-center justify-center shadow-md shadow-[#005EB8]/20 relative overflow-hidden group"
              style={{ backgroundColor: tenant?.theme_color || '#005EB8' }}>
              <div className="absolute inset-0 bg-gradient-to-tr from-[#005EB8] to-[#00A3AD] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Activity className="w-5 h-5 text-white relative z-10 animate-pulse" />
            </div>
            <span className="text-2xl font-black text-slate-800 tracking-tight flex items-center">
              MedQueue
              <span className="text-[#00A3AD] text-3xl font-extrabold ml-0.5" style={{ color: tenant?.theme_color || '#00A3AD' }}>.</span>
            </span>
          </div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Patient Portal</p>
        </button>

        <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-100/50 p-8 relative overflow-hidden">
          {/* Subtle background heartbeat curve shape */}
          <div className="absolute -top-12 -right-12 w-32 h-32 text-slate-50 pointer-events-none">
            <HeartPulse className="w-full h-full stroke-[0.7]" />
          </div>

          <button onClick={mode === 'phone' ? onBack : () => { setMode('phone'); setOtp(''); reset(); }}
            className="flex items-center gap-1.5 text-xs font-black text-slate-400 hover:text-slate-650 mb-6 transition-colors focus:outline-none relative z-10">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          {error && (
            <div className="mb-5 flex items-start gap-2 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl px-4 py-3.5 text-xs font-semibold leading-relaxed relative z-10">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 animate-pulse" />
              <span className="text-left">{error}</span>
            </div>
          )}

          {mode === 'phone' && (
            <form onSubmit={handleRequestOtp} className="space-y-6 relative z-10">
              <div className="text-left space-y-2">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Patient Portal</h2>
                <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                  Access appointments, token tracking, and medical records.
                </p>
              </div>

              {/* Quick info badges of patient operations */}
              <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-slate-50/70 border border-slate-100 rounded-2xl text-center">
                <div className="flex flex-col items-center gap-1">
                  <Calendar className="w-4.5 h-4.5 text-[#005EB8]" style={{ color: tenant?.theme_color }} />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Bookings</span>
                </div>
                <div className="flex flex-col items-center gap-1 border-x border-slate-150">
                  <Activity className="w-4.5 h-4.5 text-emerald-500" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Live Queue</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <FileText className="w-4.5 h-4.5 text-violet-500" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">History</span>
                </div>
              </div>

              <div>
                {tenant ? (
                  <div className="p-4 bg-blue-50/20 border border-blue-100/30 rounded-2xl flex items-center gap-3">
                    {tenant?.logo_url ? (
                      <img src={tenant?.logo_url} alt={tenant?.name} className="w-11 h-11 rounded-xl object-cover shadow-sm border border-slate-200 bg-white" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-[#E8F3FF] flex items-center justify-center text-[#005EB8] border border-blue-100">
                        <Building2 className="w-5 h-5" />
                      </div>
                    )}
                    <div className="text-left">
                      <h3 className="text-sm font-black text-slate-800 leading-none">{tenant?.name}</h3>
                      <p className="text-[9px] text-[#00A3AD] font-black uppercase tracking-widest mt-1.5 flex items-center gap-1.5" style={{ color: tenant?.theme_color || '#00A3AD' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active Workspace
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-left">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 font-sans">Select Clinic / Hospital *</label>
                    <HospitalSelector className="w-full animate-fade-in" />
                  </div>
                )}
              </div>

              <div className="text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mobile Number *</label>
                <PhoneInput value={phone} onChange={setPhone} focusColor="focus:border-[#005EB8]" />
              </div>

              <div className="flex items-center gap-2 text-left">
                <input
                  type="checkbox"
                  id="remember_me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-200 text-[#005EB8] focus:ring-[#005EB8] w-4 h-4 cursor-pointer"
                />
                <label htmlFor="remember_me" className="text-xs text-slate-500 font-semibold cursor-pointer select-none">
                  Remember my login preference
                </label>
              </div>

              <button type="submit" disabled={loading || !isValidPhone(phone)}
                className="w-full min-h-[48px] bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-60 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 focus:outline-none active:scale-[0.99]"
                style={{ 
                  backgroundColor: tenant?.theme_color || '#005EB8',
                  boxShadow: `0 4px 14px ${tenant?.theme_color ? tenant.theme_color + '25' : 'rgba(0,94,184,0.15)'}`
                }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          )}

          {mode === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6 relative z-10">
              <div className="text-left">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Enter OTP</h2>
                <p className="text-xs text-slate-400 font-semibold mt-1.5 leading-relaxed">
                  OTP verification code sent to <span className="font-extrabold text-slate-700">{phone}</span>
                </p>
              </div>

              {devOtp && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3.5 text-xs text-amber-700 text-left font-semibold">
                  <span className="font-extrabold">Sandbox Mock OTP:</span> {devOtp}
                </div>
              )}

              <div className="text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">6-digit OTP</label>
                <input type="text" inputMode="numeric" value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456" maxLength={6} autoFocus
                  className="w-full min-h-[48px] border border-slate-200 hover:border-slate-300 rounded-2xl px-4 py-3 text-2xl font-black tracking-[0.5em] text-center focus:border-[#005EB8] focus:outline-none transition-colors" />
              </div>

              <button type="submit" disabled={loading || otp.length !== 6}
                className="w-full min-h-[48px] bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-60 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 focus:outline-none active:scale-[0.99]"
                style={{ 
                  backgroundColor: tenant?.theme_color || '#005EB8',
                  boxShadow: `0 4px 14px ${tenant?.theme_color ? tenant.theme_color + '25' : 'rgba(0,94,184,0.15)'}`
                }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>

              <button type="button" onClick={() => { setMode('phone'); setOtp(''); reset(); }}
                className="w-full text-xs font-extrabold text-[#005EB8] hover:text-[#004a96] underline focus:outline-none"
                style={{ color: tenant?.theme_color || '#005EB8' }}>Resend OTP</button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5 relative z-10">
              <div className="text-center pb-2">
                <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <User className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Welcome!</h2>
                <p className="text-xs text-slate-400 font-semibold mt-1">First visit — please fill your details</p>
                <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5 text-xs text-emerald-700 font-extrabold inline-block">
                  {phone}
                </div>
              </div>

              <div className="text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Enter your full name" autoFocus required
                    className="w-full min-h-[44px] border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-base md:text-xs font-semibold focus:border-[#005EB8] focus:outline-none transition-colors text-slate-800" />
                </div>
              </div>

              <div className="text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Age *</label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="number" value={regForm.age} onChange={e => setRegForm(f => ({ ...f, age: e.target.value }))}
                    placeholder="e.g. 35" min="1" max="120" required
                    className="w-full min-h-[44px] border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-base md:text-xs font-semibold focus:border-[#005EB8] focus:outline-none transition-colors text-slate-800" />
                </div>
              </div>

              <div className="text-left">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Address *</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                  <textarea value={regForm.address} onChange={e => setRegForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="City / Village / Area" rows={2} required
                    className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-base md:text-xs font-semibold focus:border-[#005EB8] focus:outline-none resize-none transition-colors text-slate-800" />
                </div>
              </div>

              <button type="submit" disabled={loading || !regForm.name.trim() || !regForm.age.trim() || !regForm.address.trim()}
                className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 focus:outline-none active:scale-[0.99]"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? 'Saving...' : 'Save & Continue'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-slate-400 text-[10px] font-black uppercase tracking-widest mt-6">MedQueue Operations Node</p>
      </div>
    </div>
  );
}
