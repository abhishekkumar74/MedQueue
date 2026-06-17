import { useState, useEffect } from 'react';
import { HeartPulse } from 'lucide-react';
import { cookies } from '../lib/cookies';
import CookiePreferencesModal from './CookiePreferencesModal';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Check if consent has already been chosen
    const consent = cookies.getCookie('medqueue_cookie_consent');
    if (!consent) {
      setVisible(true);
    }

    // Listen to global open event (e.g. from header settings)
    const handleOpenPreferences = () => {
      setIsModalOpen(true);
    };

    window.addEventListener('open-cookie-preferences', handleOpenPreferences);
    return () => {
      window.removeEventListener('open-cookie-preferences', handleOpenPreferences);
    };
  }, []);

  if (!visible && !isModalOpen) return null;

  const handleAcceptAll = () => {
    cookies.setCookie('medqueue_cookie_consent', 'accepted', 365);
    cookies.setCookie('medqueue_preferences_consent', 'true', 365);
    cookies.setCookie('medqueue_analytics_consent', 'true', 365);
    setVisible(false);
  };

  const handleRejectAll = () => {
    cookies.setCookie('medqueue_cookie_consent', 'rejected', 365);
    cookies.setCookie('medqueue_preferences_consent', 'false', 365);
    cookies.setCookie('medqueue_analytics_consent', 'false', 365);
    // Delete any active non-essential cookies
    cookies.deleteCookie('medqueue_theme');
    cookies.deleteCookie('medqueue_language');
    cookies.deleteCookie('medqueue_notifications');
    setVisible(false);
  };

  const handlePreferencesSaved = () => {
    setVisible(false);
  };

  return (
    <>
      {visible && (
        <div 
          role="dialog"
          aria-live="polite"
          aria-label="Cookie Consent Disclaimer"
          className="fixed bottom-0 md:bottom-6 left-0 md:left-auto right-0 md:right-6 bg-white text-slate-800 z-50 p-5 rounded-t-[20px] md:rounded-[20px] border-t md:border border-slate-150 shadow-[0_10px_30px_rgba(0,0,0,0.08)] w-full md:w-[360px] flex flex-col gap-4 font-sans text-left transition-all duration-300 animate-slide-in pb-[calc(1.2rem+env(safe-area-inset-bottom,0px))] md:pb-5"
        >
          {/* Warning Content */}
          <div className="flex items-start gap-3.5 flex-1 min-w-0">
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ 
                backgroundColor: 'color-mix(in srgb, var(--primary-color, #005EB8) 10%, transparent)',
                color: 'var(--primary-color, #005EB8)' 
              }}
            >
              <HeartPulse className="w-4 h-4 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cookie Security & Consent</h4>
              <p className="text-[11px] text-slate-550 leading-relaxed font-semibold">
                We use essential cookies to keep MedQueue secure. Optional cookies personalize your experience. Medical records are never stored in browser cookies.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full justify-end flex-shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 text-center py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-extrabold text-[10px] uppercase tracking-wider rounded-xl border border-slate-200 transition-all focus:outline-none"
            >
              Customize
            </button>
            <button
              onClick={handleRejectAll}
              className="flex-1 text-center py-2 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-600 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all focus:outline-none"
            >
              Reject
            </button>
            <button
              onClick={handleAcceptAll}
              className="flex-1 text-center py-2 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl shadow-md transition-all focus:outline-none active:scale-[0.99]"
              style={{ backgroundColor: 'var(--primary-color, #005EB8)' }}
            >
              Accept All
            </button>
          </div>
        </div>
      )}

      {/* Customize Preference Modal Integration */}
      <CookiePreferencesModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handlePreferencesSaved}
      />
    </>
  );
}
