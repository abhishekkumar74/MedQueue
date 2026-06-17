/**
 * Staff-only login — email + password
 * Patients never see this page
 */
import { useState } from 'react';
import { AuthUser, loginStaff } from '../../../lib/auth';
import { Activity, Eye, EyeOff, Loader2, AlertCircle, Shield, ArrowLeft } from 'lucide-react';
import { cookies } from '../../../lib/cookies';

interface Props {
  onLogin: (user: AuthUser) => void;
  onLogoClick: () => void;
  onBack: () => void;
}

export default function StaffLoginPage({ onLogin, onLogoClick, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setError('Please enter your email address');
    if (!password.trim()) return setError('Please enter your password');
    setLoading(true); setError('');
    try {
      const user = await loginStaff(email, password);
      cookies.setCookie('medqueue_remember_me', rememberMe ? 'true' : 'false', 30);
      if (user.role) {
        cookies.setCookie('medqueue_last_role', user.role, 365);
      }
      onLogin(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('No account') || msg.includes('not found')) {
        setError('No account found with this email. Please check and try again.');
      } else if (msg.includes('Incorrect password') || msg.includes('password')) {
        setError('Incorrect password. Please try again.');
      } else if (msg.includes('Too many')) {
        setError(msg);
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('connect')) {
        setError('Connection error. Please check your internet and try again.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center px-4 py-8 font-sans relative overflow-hidden">
      {/* Background abstract security graphics */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#005EB8]/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#00A3AD]/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <button onClick={onLogoClick} className="text-center mb-6 w-full hover:opacity-90 transition-opacity focus:outline-none">
          <div className="flex items-center justify-center gap-2.5 mb-1.5">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg relative overflow-hidden">
              <Activity className="w-5 h-5 text-[#00A3AD]" />
            </div>
            <span className="text-2xl font-black text-white tracking-tight flex items-center">
              MedQueue
              <span className="text-[#00A3AD] text-3xl font-extrabold ml-0.5">.</span>
            </span>
          </div>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Staff Portal</p>
        </button>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 shadow-2xl rounded-[32px] p-8 relative overflow-hidden">
          {/* Subtle shield watermark shape in background */}
          <div className="absolute -top-10 -right-10 w-28 h-28 text-slate-800/20 pointer-events-none">
            <Shield className="w-full h-full stroke-[0.5]" />
          </div>

          <button onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-slate-400 mb-6 transition-colors focus:outline-none">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          {error && (
            <div className={`mb-5 flex items-start gap-2 rounded-2xl px-4 py-3.5 text-xs font-semibold leading-relaxed border ${
              error.includes('password') ? 'bg-orange-950/30 border-orange-900/50 text-orange-400' :
              error.includes('Connection') ? 'bg-blue-950/30 border-blue-900/50 text-blue-400' :
              error.includes('many') ? 'bg-amber-950/30 border-amber-900/50 text-amber-400' :
              'bg-rose-950/30 border-rose-900/50 text-rose-400'
            }`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 animate-pulse" />
              <span className="text-left">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-left space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#00A3AD]/10 text-[#00A3AD] rounded-full text-[9px] font-black uppercase tracking-widest">
                <Shield className="w-3 h-3" />
                <span>Secure Workspace Badge</span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight leading-none pt-1">Staff Secure Access</h2>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed animate-fade-in">
                Authorized doctors, ward staff and hospital teams only.
              </p>
            </div>

            <div className="text-left">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="doctor@hospital.com" autoComplete="email"
                className="w-full min-h-[48px] bg-slate-950/50 hover:bg-slate-950/80 border border-slate-800 focus:border-[#005EB8] focus:bg-slate-950 rounded-2xl px-4 py-3 text-base md:text-xs font-semibold text-white placeholder-slate-650 focus:outline-none transition-all" />
            </div>

            <div className="text-left">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full min-h-[48px] bg-slate-950/50 hover:bg-slate-950/80 border border-slate-800 focus:border-[#005EB8] focus:bg-slate-950 rounded-2xl px-4 pr-12 py-3 text-base md:text-xs font-semibold text-white placeholder-slate-655 focus:outline-none transition-all" />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 focus:outline-none">
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-left">
              <input
                type="checkbox"
                id="remember_me"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-slate-800 bg-slate-950 text-[#005EB8] focus:ring-[#005EB8] w-4 h-4 cursor-pointer"
              />
              <label htmlFor="remember_me" className="text-xs text-slate-400 font-semibold cursor-pointer select-none">
                Remember my login preference
              </label>
            </div>

            <button type="submit" disabled={loading}
              className="w-full min-h-[48px] bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-60 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-[#005EB8]/10 flex items-center justify-center gap-2 focus:outline-none active:scale-[0.99]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              {loading ? 'Authenticating Staff...' : 'Verify Credentials'}
            </button>
          </form>
        </div>
        <p className="text-center text-slate-600 text-[10px] font-black uppercase tracking-widest mt-6 font-mono">Secure Terminal Operations Center</p>
      </div>
    </div>
  );
}
