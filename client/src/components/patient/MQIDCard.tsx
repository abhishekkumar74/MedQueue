import { useState } from 'react'
import type { MQPatient } from '../../types/mqid'

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
    <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white shadow-lg max-w-sm mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-blue-200 text-xs font-medium tracking-widest uppercase">
            MedQueue Health ID
          </p>
          <p className="text-xs text-blue-300 mt-0.5 font-bold">
            {hospitalName ?? 'Valid at all hospitals'}
          </p>
        </div>
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
          <span className="text-lg">🏥</span>
        </div>
      </div>

      {/* MQID — the big number */}
      <div className="mb-4">
        <button
          onClick={copyMQID}
          className="group flex items-center gap-3 bg-transparent border-0 p-0 text-left outline-none"
        >
          <span className="text-2xl font-mono font-bold tracking-wider group-hover:underline">
            {patient.mqid}
          </span>
          <span className="text-blue-200 group-hover:text-white transition-colors text-xs font-bold bg-white/10 px-2 py-0.5 rounded">
            {copied ? '✓ Copied' : '⎘ Copy'}
          </span>
        </button>
      </div>

      {/* Patient name */}
      <div className="mb-3">
        <p className="text-blue-200 text-[10px] font-black uppercase tracking-wider mb-0.5">Patient</p>
        <p className="font-extrabold text-base">{patient.fullName}</p>
      </div>

      {/* Details row */}
      <div className="flex gap-6">
        {patient.bloodGroup && patient.bloodGroup !== 'unknown' && (
          <div>
            <p className="text-blue-300 text-[10px] font-black uppercase tracking-wider mb-0.5">Blood Group</p>
            <p className="font-bold text-sm">{patient.bloodGroup}</p>
          </div>
        )}
        {patient.dob && (
          <div>
            <p className="text-blue-300 text-[10px] font-black uppercase tracking-wider mb-0.5">Date of Birth</p>
            <p className="font-bold text-sm">
              {new Date(patient.dob).toLocaleDateString('en-IN')}
            </p>
          </div>
        )}
        {localNo && (
          <div>
            <p className="text-blue-300 text-[10px] font-black uppercase tracking-wider mb-0.5">Local ID</p>
            <p className="font-bold text-sm font-mono">{localNo}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-white/20 text-xs text-blue-200/90 font-medium">
        Show this ID at any MedQueue hospital for instant recognition.
      </div>
    </div>
  )
}
