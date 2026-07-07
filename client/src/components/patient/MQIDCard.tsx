import { useState } from 'react';
import type { MQPatient } from '../../types/mqid';
import { Shield, Activity, Copy, Check, Lock, Sparkles, Plus } from 'lucide-react';

interface Props {
  patient: MQPatient;
  hospitalName?: string;
  localPatientNo?: number;
  localPrefix?: string;
}

export function MQIDCard({
  patient,
  hospitalName,
  localPatientNo,
  localPrefix,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copyMQID = async () => {
    try {
      await navigator.clipboard.writeText(patient.mqid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy MQID:', err);
    }
  };

  const localNo = localPrefix && localPatientNo
    ? `${localPrefix}-${String(localPatientNo).padStart(4, '0')}`
    : null;

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm mx-auto font-sans select-none tracking-normal">
      {/* ── CARD 1: MEDQUEUE DIGITAL ID CARD ── */}
      <div className="relative overflow-hidden rounded-[28px] p-6 text-white shadow-xl transition-all duration-300 hover:shadow-[#005EB8]/10 border border-white/10 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950">
        {/* Dynamic ambient background glows */}
        <div className="absolute top-[-30px] right-[-30px] w-40 h-40 bg-[#00A3AD]/20 rounded-full blur-[50px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-[-30px] left-[-30px] w-40 h-40 bg-[#005EB8]/15 rounded-full blur-[50px] pointer-events-none animate-pulse" />
        
        {/* Pulse line decoration */}
        <svg className="absolute right-0 top-1/3 w-32 h-16 text-[#00A3AD]/5 fill-none stroke-current stroke-[2] pointer-events-none" viewBox="0 0 100 50">
          <path d="M0,25 Q15,25 25,25 T35,10 T45,40 T55,20 T65,30 T75,25 H100" />
        </svg>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-5 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00A3AD] to-[#005EB8] flex items-center justify-center shadow-md">
              <Activity className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black tracking-widest text-[#00A3AD] uppercase leading-none">
                MQID HEALTH ID
              </p>
              <p className="text-[9px] text-slate-400 font-bold mt-1 leading-none truncate max-w-[130px]">
                {hospitalName ?? 'Universal MedQueue Registry'}
              </p>
            </div>
          </div>
          
          {/* Active indicator */}
          <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full absolute" />
            <span>Verified</span>
          </span>
        </div>

        {/* Gold smart chip and QR */}
        <div className="flex justify-between items-start gap-4 mb-5 relative z-10">
          <div className="space-y-4 flex-1">
            {/* Smart chip representation */}
            <div className="w-9 h-6.5 rounded-md bg-gradient-to-tr from-yellow-400 via-amber-300 to-yellow-500 border border-yellow-200/50 shadow-inner flex flex-col justify-between p-1 opacity-90 relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10" />
              <div className="h-px bg-amber-800/30 w-full" />
              <div className="h-px bg-amber-800/30 w-full" />
              <div className="h-px bg-amber-800/30 w-full" />
              <div className="absolute top-0 bottom-0 left-1/3 w-px bg-amber-800/30" />
              <div className="absolute top-0 bottom-0 right-1/3 w-px bg-amber-800/30" />
            </div>

            {/* Patient profile name */}
            <div>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Patient Name</p>
              <h4 className="font-extrabold text-sm text-white mt-1 truncate max-w-[180px] tracking-tight">
                {patient.fullName}
              </h4>
            </div>
          </div>

          {/* QR scanner display */}
          <div className="bg-white p-2 rounded-xl shadow-lg flex flex-col items-center justify-center shrink-0 border border-white/10 hover:scale-105 transition-transform">
            <svg viewBox="0 0 100 100" className="w-11 h-11 text-slate-900 fill-current">
              <path d="M0,0 h30 v30 h-30 z M10,10 v10 h10 v-10 z" />
              <path d="M70,0 h30 v30 h-30 z M80,10 v10 h10 v-10 z" />
              <path d="M0,70 h30 v30 h-30 z M10,80 v10 h10 v-10 z" />
              <rect x="40" y="10" width="10" height="10" />
              <rect x="50" y="20" width="10" height="10" />
              <rect x="40" y="40" width="20" height="10" />
              <rect x="10" y="40" width="10" height="10" />
              <rect x="20" y="50" width="10" height="10" />
              <rect x="70" y="40" width="10" height="10" />
              <rect x="80" y="50" width="10" height="10" />
              <rect x="40" y="70" width="10" height="20" />
              <rect x="55" y="80" width="15" height="10" />
              <rect x="80" y="80" width="10" height="10" />
            </svg>
            <span className="text-[5px] font-black text-slate-500 uppercase tracking-widest mt-1">SECURE SCAN</span>
          </div>
        </div>

        {/* Registry Key Copy Input */}
        <div className="mb-5 relative z-10">
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Universal Medical Registry Key</p>
          <button
            onClick={copyMQID}
            className="w-full flex items-center justify-between gap-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-3.5 py-2.5 transition-all outline-none group active:scale-[0.99]"
          >
            <span className="text-xs font-mono font-black tracking-widest text-slate-200 group-hover:text-white">
              {patient.mqid}
            </span>
            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-[#00A3AD] transition-colors shrink-0">
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </span>
          </button>
        </div>

        {/* Attributes Footer Grid */}
        <div className="grid grid-cols-3 gap-3 border-t border-white/5 pt-3.5 relative z-10 text-left">
          <div>
            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Blood Type</span>
            <span className="font-extrabold text-xs text-rose-400">
              {patient.bloodGroup && patient.bloodGroup !== 'unknown' ? patient.bloodGroup : 'O+'}
            </span>
          </div>
          <div>
            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Birth Date</span>
            <span className="font-extrabold text-[10px] text-slate-300">
              {patient.dob ? new Date(patient.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '01 Jan 1996'}
            </span>
          </div>
          <div>
            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Local Patient ID</span>
            <span className="font-mono font-extrabold text-[10px] text-[#00A3AD] truncate block max-w-[80px]">
              {localNo ?? `${localPrefix || 'MQ'}-GUEST`}
            </span>
          </div>
        </div>

        {/* Card Encryption Footer */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[7px] font-black uppercase text-slate-500 tracking-wider relative z-10">
          <span className="flex items-center gap-1">
            <Shield className="w-2.5 h-2.5 text-[#00A3AD]" />
            <span>Secure Core Ledger</span>
          </span>
          <span>Node: {patient.id.slice(0, 8).toUpperCase()}</span>
        </div>
      </div>

      {/* ── CARD 2: PREMIUM INSURANCE CARD PLACEHOLDER ── */}
      <div className="relative overflow-hidden rounded-[28px] p-5 border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/50 transition-colors duration-200 text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md">
              <Sparkles className="w-2 h-2 text-slate-500" />
              Insurance Vault
            </span>
            <h4 className="font-extrabold text-sm text-slate-800 pt-1">Insurance not linked yet</h4>
            <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
              Link your healthcare plan to automatically sync copays, claims, and medical coverages at check-in.
            </p>
          </div>
          
          <div className="w-9 h-9 rounded-xl bg-slate-200/60 border border-slate-300/40 flex items-center justify-center text-slate-400 shrink-0">
            <Lock className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Dummy/Placeholder Fields for Future Integration */}
        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-3 text-[10px] font-semibold text-slate-400">
          <div>
            <span className="text-[7.5px] uppercase font-bold tracking-wider block">Coverage Status</span>
            <span className="font-extrabold text-slate-500 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
              Not Linked
            </span>
          </div>
          <div>
            <span className="text-[7.5px] uppercase font-bold tracking-wider block">Provider & Network</span>
            <span className="font-extrabold text-slate-500 block truncate mt-0.5">—</span>
          </div>
        </div>

        <button 
          onClick={() => alert('Insurance integration is coming soon!')}
          className="mt-4 w-full py-2 bg-slate-200 hover:bg-slate-300 border border-slate-350 text-slate-650 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          Link Insurance Provider
        </button>
      </div>
    </div>
  );
}
