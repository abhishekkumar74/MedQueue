import { useState, useEffect } from 'react';
import { Shield, Eye, Settings, HeartPulse, X } from 'lucide-react';
import { cookies } from '../lib/cookies';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function CookiePreferencesModal({ isOpen, onClose, onSave }: Props) {
  const [prefs, setPrefs] = useState({
    preferences: true,
    analytics: false
  });

  useEffect(() => {
    if (isOpen) {
      setPrefs(cookies.loadPreferences());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    cookies.savePreferences(prefs);
    onSave();
    onClose();
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[99] transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white border border-slate-100 rounded-[32px] p-8 shadow-2xl z-[100] animate-scale-up font-sans text-left flex flex-col max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E8F3FF] flex items-center justify-center text-[#005EB8]">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none">Cookie Preferences</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">Customize Privacy Settings</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-150 text-slate-400 hover:text-slate-600 focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Categories List */}
        <div className="space-y-6 flex-1 pr-1">
          
          {/* Section 1: Essential */}
          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 text-[#005EB8]">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">1. Essential Cookies</span>
                <span className="text-[9px] font-black uppercase text-[#005EB8] bg-[#005EB8]/10 px-2.5 py-1 rounded-md">Always Enabled</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                Required for security verification, Super Admin session tracking, system diagnostics, and stable PWA cache states.
              </p>
            </div>
          </div>

          {/* Section 2: Preferences */}
          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 text-violet-500">
              <Settings className="w-4 h-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">2. Preference Cookies</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={prefs.preferences}
                    onChange={e => setPrefs(p => ({ ...p, preferences: e.target.checked }))}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                Used to remember your preferred UI color scheme (light/dark/system mode), language, and workspace appointment alerts toggles.
              </p>
            </div>
          </div>

          {/* Section 3: Analytics */}
          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 text-[#00A3AD]">
              <Eye className="w-4 h-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">3. Analytics Cookies</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={prefs.analytics}
                    onChange={e => setPrefs(p => ({ ...p, analytics: e.target.checked }))}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                Permits operational load testing analytics (Google Analytics, PostHog, Mixpanel) to optimize healthcare waitlist efficiency.
              </p>
            </div>
          </div>

          {/* Healthcare Disclaimer */}
          <div className="p-4 bg-blue-50/20 border border-blue-100/20 rounded-2xl flex items-start gap-3 mt-4">
            <HeartPulse className="w-5 h-5 text-[#005EB8] flex-shrink-0 mt-0.5" />
            <div className="text-left">
              <h4 className="text-[10px] font-black text-[#005EB8] uppercase tracking-wider">Healthcare Privacy Message</h4>
              <p className="text-[11px] text-slate-400 font-semibold leading-relaxed mt-1">
                We use essential cookies to keep MedQueue secure and operational. Optional cookies help personalize your experience and improve healthcare workflows. Medical records and patient health information are never stored in browser cookies.
              </p>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
          <button 
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-500 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="w-full sm:w-auto px-5 py-3 bg-[#005EB8] hover:bg-[#004a96] text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-blue-500/10 transition-all"
          >
            Save Preferences
          </button>
        </div>

      </div>
    </>
  );
}
