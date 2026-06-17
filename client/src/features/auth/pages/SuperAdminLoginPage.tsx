import { useState } from 'react';
import { AuthUser, requestSuperAdminOtp, verifySuperAdminOtp } from '../../../lib/auth';
import { Shield, Eye, EyeOff, Loader2, AlertCircle, ArrowLeft, KeyRound, Mail, CheckCircle2, Lock } from 'lucide-react';
import { cookies } from '../../../lib/cookies';

interface Props {
  onLogin: (user: AuthUser) => void;
  onBack: () => void;
}

export default function SuperAdminLoginPage({ onLogin, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // 2-Step OTP Verification states
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState('');

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setError('Please enter your administrator email address');
    if (!password.trim()) return setError('Please enter your administrator password');
    setLoading(true); 
    setError('');
    setSuccessMsg('');
    try {
      const res = await requestSuperAdminOtp(email, password);
      setDevOtp(res.otp);
      setSuccessMsg('Security credentials approved. Verification code generated!');
      setTimeout(() => {
        setStep('otp');
        setSuccessMsg('');
      }, 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      if (msg.includes('Invalid credentials') || msg.includes('denied')) {
        setError('Access denied. Invalid credentials or unauthorized Super Admin user.');
      } else if (msg.includes('Incorrect password')) {
        setError('Incorrect administrator password.');
      } else {
        setError(msg);
      }
    } finally { 
      setLoading(false); 
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode.trim()) return setError('Please enter the 6-digit verification code');
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const user = await verifySuperAdminOtp(email, otpCode);
      cookies.setCookie('medqueue_remember_me', rememberMe ? 'true' : 'false', 30);
      cookies.setCookie('medqueue_last_role', 'SUPER_ADMIN', 365);
      setSuccessMsg('Email ID verified successfully! Granting global SaaS access...');
      setTimeout(() => {
        onLogin(user);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await requestSuperAdminOtp(email, password);
      setDevOtp(res.otp);
      setSuccessMsg('A new secure verification code has been sent to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resending OTP failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Security grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none opacity-50" />
      
      {/* Decorative ambient blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-slate-900 border-2 border-violet-500/30 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/10">
            {step === 'credentials' ? (
              <Shield className="w-8 h-8 text-violet-400 animate-pulse" />
            ) : (
              <Lock className="w-8 h-8 text-emerald-400 animate-bounce" />
            )}
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-black tracking-tight text-white">
          {step === 'credentials' ? 'Secure Administrator Portal' : 'Email ID Verification'}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400 px-4">
          {step === 'credentials' 
            ? 'Super Admin authorization required to access cross-tenant telemetry.'
            : `Enter the secure 6-digit authentication token sent to ${email}.`}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 py-8 px-6 shadow-2xl rounded-3xl sm:px-10">
          
          <button 
            onClick={() => {
              if (step === 'otp') {
                setStep('credentials');
                setOtpCode('');
                setError('');
                setSuccessMsg('');
              } else {
                onBack();
              }
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> 
            {step === 'credentials' ? 'Return to Patient Portal' : 'Back to Credentials Input'}
          </button>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 bg-red-950/50 border border-red-500/30 text-red-400 rounded-2xl px-4 py-3 text-sm animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 flex items-start gap-2.5 bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 rounded-2xl px-4 py-3 text-sm animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400 animate-pulse" />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 'credentials' ? (
            <form className="space-y-6" onSubmit={handleCredentialsSubmit}>
              <div>
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Verified Administrator Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4.5 w-4.5 text-slate-500" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@medqueue.com"
                    className="block w-full min-h-[44px] pl-10 pr-4 py-3 bg-slate-950 border-2 border-slate-800 rounded-xl text-white placeholder-slate-600 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Administrator Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="h-4.5 w-4.5 text-slate-500" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full min-h-[44px] pl-10 pr-12 py-3 bg-slate-950 border-2 border-slate-800 rounded-xl text-white placeholder-slate-600 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-left">
                <input
                  type="checkbox"
                  id="remember_me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-violet-500 focus:ring-violet-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="remember_me" className="text-xs text-slate-400 font-semibold cursor-pointer select-none">
                  Remember my login preference
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 border border-transparent rounded-xl shadow-sm text-sm font-extrabold text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-violet-500/20"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4 text-violet-100" />
                )}
                {loading ? 'Verifying Credentials...' : 'Authenticate'}
              </button>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleOtpSubmit}>
              <div>
                <label htmlFor="otp" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  6-Digit Email Verification Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4.5 w-4.5 text-slate-500" />
                  </div>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="block w-full min-h-[44px] pl-10 pr-4 py-3 bg-slate-950 border-2 border-slate-800 rounded-xl text-white placeholder-slate-600 text-center text-lg font-black tracking-widest focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {devOtp && (
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 text-center animate-fadeIn">
                  <p className="text-[10px] uppercase font-bold text-amber-500 tracking-wider mb-1">
                    🔧 Development Helper Banner
                  </p>
                  <p className="text-sm font-medium text-amber-200">
                    OTP Code sent to verified email:
                  </p>
                  <p className="text-2xl font-black text-white tracking-widest mt-1">
                    {devOtp}
                  </p>
                  <p className="text-[10px] text-amber-400/80 mt-1">
                    (Use this code to log in successfully without a real email inbox trigger)
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center min-h-[48px] px-3 py-2 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-900 focus:outline-none disabled:opacity-50 transition-colors"
                >
                  Resend Code
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-1.5 min-h-[48px] px-3 py-2 border border-transparent rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 transition-all shadow-emerald-500/20"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Verify & Access
                </button>
              </div>
            </form>
          )}

        </div>
        <p className="text-center text-slate-600 text-[10px] uppercase font-bold tracking-widest mt-6">
          Encrypted Session Protocol • MedQueue SaaS 2.0
        </p>
      </div>
    </div>
  );
}
