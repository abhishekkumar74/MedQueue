/**
 * Staff-only login — email + password
 * Patients never see this page
 */
import { useState } from 'react';
import { AuthUser, loginStaff } from '../lib/auth';
import { Activity, Eye, EyeOff, Loader2, AlertCircle, Shield, ArrowLeft } from 'lucide-react';

interface Props {
  onLogin: (user: AuthUser) => void;
  onBack: () => void;
}

export default function StaffLoginPage({ onLogin, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return setError('Please enter your email address');
    if (!password.trim()) return setError('Please enter your password');
    setLoading(true); setError('');
    try {
      const user = await loginStaff(email, password);
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
    <div className="min-h-screen bg-gradient-to-br from-[#005EB8] to-[#003d7a] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Activity className="w-10 h-10 text-[#00A3AD]" />
            <span className="text-3xl font-extrabold text-white">MedQueue</span>
          </div>
          <p className="text-blue-200 text-sm">Staff Portal</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          {error && (
            <div className={`mb-4 flex items-start gap-2 rounded-xl px-4 py-3 border ${
              error.includes('password') ? 'bg-orange-50 border-orange-200 text-orange-700' :
              error.includes('Connection') ? 'bg-blue-50 border-blue-200 text-blue-700' :
              error.includes('many') ? 'bg-amber-50 border-amber-200 text-amber-700' :
              'bg-red-50 border-red-200 text-red-700'
            }`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Staff Login</h2>
              <p className="text-sm text-gray-500 mt-1">Enter your hospital credentials</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="doctor@hospital.com" autoComplete="email"
                className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:border-[#005EB8] focus:outline-none transition-colors" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full min-h-[44px] border-2 border-gray-200 rounded-xl px-4 pr-12 py-3 text-base focus:border-[#005EB8] focus:outline-none transition-colors" />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full min-h-[48px] bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-60 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-blue-200 text-xs mt-6">MedQueue Hospital Management System</p>
      </div>
    </div>
  );
}
