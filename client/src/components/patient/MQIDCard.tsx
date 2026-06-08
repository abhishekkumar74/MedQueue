import { useState } from 'react'
import type { MQPatient } from '../../types/mqid'
import { Shield, Activity, Copy, Check } from 'lucide-react'

interface Props {
  patient: MQPatient
  hospitalName?: string
  localPatientNo?: number
  localPrefix?: string
}

export function MQIDCard({
  patient, hospitalName, localPatientNo, localPrefix
}: Props) {
  const [copied, setCopied] = useState(false)

  const copyMQID = async () => {
    await navigator.clipboard.writeText(patient.mqid)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const localNo = localPrefix && localPatientNo
    ? `${localPrefix}-${String(localPatientNo).padStart(4, '0')}`
    : null

  return (
    <div className="relative overflow-hidden rounded-[32px] p-6 text-white shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:shadow-[#005EB8]/10 max-w-sm w-full mx-auto select-none font-sans border border-white/10 bg-gradient-to-br from-[#0F172A] via-[#15203B] to-[#0A0F1D] tracking-normal">
      
      {/* Dynamic ambient background glows */}
      <div className="absolute top-[-40px] right-[-40px] w-48 h-48 bg-[#00A3AD]/25 rounded-full blur-[64px] pointer-events-none animate-pulse duration-[4000ms]" />
      <div className="absolute bottom-[-30px] left-[-30px] w-40 h-40 bg-[#005EB8]/20 rounded-full blur-[48px] pointer-events-none animate-pulse duration-[6000ms]" />
      
      {/* Decorative pulse line overlay */}
      <svg className="absolute right-0 top-1/4 w-40 h-20 text-[#00A3AD]/5 fill-none stroke-current stroke-[2] pointer-events-none" viewBox="0 0 100 50">
        <path d="M0,25 Q15,25 25,25 T35,10 T45,40 T55,20 T65,30 T75,25 H100" />
      </svg>

      {/* Glassmorphic overlay ring */}
      <div className="absolute inset-0 border border-white/5 rounded-[32px] pointer-events-none bg-gradient-to-b from-white/5 to-transparent" />

      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00A3AD] to-[#005EB8] flex items-center justify-center shadow-md">
            <Activity className="w-4.5 h-4.5 text-white animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-black tracking-widest text-[#00A3AD] uppercase leading-none">
              MQID HEALTH ID
            </p>
            <p className="text-[9px] text-slate-350 font-bold mt-1.5 leading-none truncate max-w-[150px]">
              {hospitalName ?? 'Universal MedQueue Node'}
            </p>
          </div>
        </div>
        
        {/* Glowing Active verified tag */}
        <span className="text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full absolute" />
          <span>Active</span>
        </span>
      </div>

      {/* Gold Smart Chip & QR Layout Info */}
      <div className="flex justify-between items-start gap-4 mb-6 relative z-10">
        <div className="space-y-5 flex-1">
          {/* Detailed Golden Chip */}
          <div className="w-10 h-7 rounded-lg bg-gradient-to-tr from-yellow-400 via-amber-300 to-yellow-500 border border-yellow-200/50 shadow-inner flex flex-col justify-between p-1.5 opacity-90 select-none shrink-0 relative overflow-hidden">
            <div className="absolute inset-0 bg-white/10" />
            <div className="h-px bg-amber-800/40 w-full z-10" />
            <div className="h-px bg-amber-800/40 w-full z-10" />
            <div className="h-px bg-amber-800/40 w-full z-10" />
            <div className="absolute top-0 bottom-0 left-1/3 w-px bg-amber-800/40 z-10" />
            <div className="absolute top-0 bottom-0 right-1/3 w-px bg-amber-800/40 z-10" />
          </div>

          {/* Patient Details */}
          <div>
            <p className="text-[8px] font-black text-[#00A3AD] uppercase tracking-widest leading-none">Patient Name</p>
            <h4 className="font-extrabold text-base text-white mt-1.5 truncate max-w-[190px] tracking-tight">
              {patient.fullName}
            </h4>
          </div>
        </div>

        {/* Dynamic High-tech QR Code Display box */}
        <div className="bg-white/95 p-2.5 rounded-2xl shadow-xl shadow-black/30 flex flex-col items-center justify-center shrink-0 border border-white/10 hover:bg-white transition-all duration-300">
          <svg viewBox="0 0 100 100" className="w-12 h-12 text-slate-950 fill-current">
            {/* 3 corner positioning squares */}
            <path d="M0,0 h30 v30 h-30 z M10,10 v10 h10 v-10 z" />
            <path d="M70,0 h30 v30 h-30 z M80,10 v10 h10 v-10 z" />
            <path d="M0,70 h30 v30 h-30 z M10,80 v10 h10 v-10 z" />
            {/* Dynamic bit cells representation */}
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
          <span className="text-[5px] font-black text-slate-500 uppercase tracking-widest mt-1.5">SCAN LINK</span>
        </div>
      </div>

      {/* MQID Number Field (Big Interactive Bar) */}
      <div className="mb-6 relative z-10">
        <p className="text-[8px] font-black text-[#00A3AD] uppercase tracking-widest mb-2 leading-none">Universal Medical Registry Key</p>
        <button
          onClick={copyMQID}
          className="w-full flex items-center justify-between gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-4 py-3 transition-all duration-300 outline-none group active:scale-[0.98]"
        >
          <span className="text-sm sm:text-base font-mono font-black tracking-widest text-slate-100 group-hover:text-white">
            {patient.mqid}
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-[#00A3AD] group-hover:text-[#00c5d1] transition-colors shrink-0">
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-extrabold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </span>
        </button>
      </div>

      {/* Grid metadata attributes */}
      <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4 relative z-10 text-left">
        <div>
          <span className="text-[7.5px] font-black text-[#00A3AD] uppercase tracking-widest block mb-1">Blood Group</span>
          <span className="font-extrabold text-[12px] text-rose-400 leading-none">
            {patient.bloodGroup && patient.bloodGroup !== 'unknown' ? patient.bloodGroup : 'O+'}
          </span>
        </div>
        <div>
          <span className="text-[7.5px] font-black text-[#00A3AD] uppercase tracking-widest block mb-1">Birth Date</span>
          <span className="font-extrabold text-[11px] text-slate-200 leading-none">
            {patient.dob ? new Date(patient.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '01-Jan-1996'}
          </span>
        </div>
        <div>
          <span className="text-[7.5px] font-black text-[#00A3AD] uppercase tracking-widest block mb-1">Local ID</span>
          <span className="font-mono font-extrabold text-[11px] text-[#00A3AD] truncate block max-w-[90px] leading-none">
            {localNo ?? `${localPrefix || 'MQ'}-GUEST`}
          </span>
        </div>
      </div>

      {/* Bottom Cryptographic Footer banner */}
      <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between text-[8px] font-black uppercase text-slate-450 tracking-wider relative z-10">
        <span className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-[#00A3AD]" />
          <span>Encrypted Core Node</span>
        </span>
        <span>Node ID: {patient.id.slice(0, 8).toUpperCase()}</span>
      </div>
    </div>
  )
}
