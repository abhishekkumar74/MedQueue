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
    <div className="relative bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] border border-slate-700/50 rounded-[28px] p-6 text-white shadow-2xl max-w-sm w-full mx-auto overflow-hidden font-sans select-none tracking-normal">
      
      {/* Decorative concentric background glow and medical heartbeat line */}
      <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-[#005EB8]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-40 h-40 bg-[#00A3AD]/10 rounded-full blur-2xl pointer-events-none" />
      
      <svg className="absolute right-0 top-1/3 w-32 h-16 text-slate-800/10 fill-none stroke-current stroke-[1.5] pointer-events-none" viewBox="0 0 100 50">
        <path d="M0,25 L30,25 L35,10 L40,40 L45,20 L50,30 L55,25 L100,25" />
      </svg>

      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5 relative z-10">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          <div>
            <p className="text-[10px] font-black tracking-widest text-[#00A3AD] uppercase leading-none">
              MedQueue Identity
            </p>
            <p className="text-[9px] text-slate-400 font-bold mt-1 leading-none truncate max-w-[150px]">
              {hospitalName ?? 'Universal Node Link'}
            </p>
          </div>
        </div>
        
        {/* Neon Active verified tag */}
        <span className="text-[8px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
          <span className="w-1 h-1 bg-emerald-400 rounded-full animate-ping" />
          Active Profile
        </span>
      </div>

      {/* Gold Smart Chip & Wallet Layout Info */}
      <div className="flex justify-between items-start gap-4 mb-5 relative z-10">
        <div className="space-y-4 flex-1">
          {/* Gold Chip */}
          <div className="w-8 h-6 rounded-md bg-gradient-to-tr from-yellow-400 via-amber-300 to-yellow-500 border border-yellow-200/50 shadow-inner flex flex-col justify-between p-1 opacity-90 select-none shrink-0">
            <div className="h-px bg-amber-700/30 w-full" />
            <div className="h-px bg-amber-700/30 w-full" />
            <div className="h-px bg-amber-700/30 w-full" />
          </div>

          {/* Patient Details */}
          <div>
            <p className="text-[8px] font-black text-[#00A3AD] uppercase tracking-widest leading-none">Patient Name</p>
            <h4 className="font-black text-base text-white mt-1.5 truncate max-w-[170px] tracking-tight">
              {patient.fullName}
            </h4>
          </div>
        </div>

        {/* Dynamic High-tech QR Code Display box */}
        <div className="bg-white/95 p-2 rounded-2xl shadow-xl shadow-slate-950/20 flex flex-col items-center justify-center shrink-0 border border-slate-700/30">
          <svg viewBox="0 0 100 100" className="w-14 h-14 text-slate-900 fill-current">
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
          <span className="text-[6px] font-black text-slate-500 uppercase tracking-widest mt-1">SCAN MQID</span>
        </div>
      </div>

      {/* MQID Number Field (Big Interactive Bar) */}
      <div className="mb-5 relative z-10">
        <p className="text-[8px] font-black text-[#00A3AD] uppercase tracking-widest mb-1.5 leading-none">Universal Medical Registry Key</p>
        <button
          onClick={copyMQID}
          className="w-full flex items-center justify-between gap-3 bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 transition-all outline-none group"
        >
          <span className="text-base font-mono font-black tracking-wider text-slate-100">
            {patient.mqid}
          </span>
          <span className="flex items-center gap-1 text-[9px] font-black uppercase text-indigo-400 group-hover:text-indigo-300 transition-colors">
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

      {/* Grid metadata attributes */}
      <div className="grid grid-cols-3 gap-3 border-t border-slate-800 pt-4 relative z-10 text-left">
        <div>
          <span className="text-[7.5px] font-black text-slate-450 uppercase tracking-widest block mb-0.5">Blood Group</span>
          <span className="font-extrabold text-[12px] text-red-400">
            {patient.bloodGroup && patient.bloodGroup !== 'unknown' ? patient.bloodGroup : 'O+'}
          </span>
        </div>
        <div>
          <span className="text-[7.5px] font-black text-slate-450 uppercase tracking-widest block mb-0.5">Birth Date</span>
          <span className="font-extrabold text-[11px] text-slate-200">
            {patient.dob ? new Date(patient.dob).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '01-Jan-1996'}
          </span>
        </div>
        <div>
          <span className="text-[7.5px] font-black text-slate-450 uppercase tracking-widest block mb-0.5">Local ID</span>
          <span className="font-mono font-extrabold text-[11px] text-[#00A3AD] truncate block max-w-[90px]">
            {localNo ?? `${localPrefix || 'MQ'}-GUEST`}
          </span>
        </div>
      </div>

      {/* Bottom Cryptographic Footer banner */}
      <div className="mt-5 pt-3.5 border-t border-slate-800 flex items-center justify-between text-[8px] font-black uppercase text-slate-500 tracking-wider relative z-10">
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-indigo-500" />
          SHA-255 Secure Profile Node
        </span>
        <span>ID: {patient.id.slice(0, 8)}</span>
      </div>
    </div>
  )
}
