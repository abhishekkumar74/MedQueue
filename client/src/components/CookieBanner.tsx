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
          className="fixed bottom-0 md:bottom-6 left-0 md:left-6 right-0 md:right-6 bg-slate-900 text-white z-50 p-6 md:p-8 rounded-t-[28px] md:rounded-[28px] border-t md:border border-slate-800 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 font-sans text-left transition-all duration-300 animate-slide-in pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] md:pb-8"
        >
          {/* Backdrop ambient blur inside the card */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#00A3AD]/5 rounded-full blur-2xl pointer-events-none" />

          {/* Warning Content */}
          <div className="flex items-start gap-4 flex-1">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-[#00A3AD] flex-shrink-0">
              <HeartPulse className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1 max-w-3xl">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Cookie Security & Consent</h4>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold">
                We use essential cookies to keep MedQueue secure and operational. Optional cookies help personalize your experience and improve healthcare workflows. Medical records and patient health information are never stored in browser cookies.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl border border-slate-700 transition-all focus:outline-none"
            >
              Customize Preferences
            </button>
            <button
              onClick={handleRejectAll}
              className="w-full sm:w-auto px-5 py-3 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-300 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all focus:outline-none"
            >
              Reject Non-Essential
            </button>
            <button
              onClick={handleAcceptAll}
              className="w-full sm:w-auto px-5 py-3 bg-[#00A3AD] hover:bg-[#008d95] text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-[#00A3AD]/10 transition-all focus:outline-none active:scale-[0.99]"
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
