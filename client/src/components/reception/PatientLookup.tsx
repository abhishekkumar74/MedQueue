import { useState } from 'react'
import {
  lookupPatientByMQID,
  lookupPatientByPhone,
  getOrCreateHospitalProfile,
  isValidMQID,
} from '../../lib/mqid'
import type { MQPatient, HospitalPatient } from '../../types/mqid'

interface Props {
  hospitalId: string
  hospitalName: string
  localPrefix: string
  onPatientFound?: (mqid: string) => void
}

interface LookupResult {
  global: MQPatient
  hospitalProfile: HospitalPatient | null
}

export function PatientLookup({
  hospitalId, hospitalName, localPrefix, onPatientFound
}: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<LookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLookup = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      let patient: MQPatient | null = null

      if (isValidMQID(query.trim().toUpperCase())) {
        // MQID lookup
        patient = await lookupPatientByMQID(query.trim().toUpperCase())
      } else {
        // Phone lookup
        const phone = query.replace(/\D/g, '')
        patient = await lookupPatientByPhone(`+91${phone}`)
          ?? await lookupPatientByPhone(phone)
      }

      if (!patient) {
        setError('No patient found. They may need to register first.')
        return
      }

      // Get or create hospital profile
      const hospitalProfile = await getOrCreateHospitalProfile(
        patient.mqid,
        hospitalId,
        hospitalName,
        localPrefix
      )

      setResult({ global: patient, hospitalProfile })
      onPatientFound?.(patient.mqid)
    } catch (err: any) {
      setError(err?.message ?? 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">

      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-blue-400"
          placeholder="Enter MQID (MQ-2024-XXXX-XXXX) or phone number"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLookup()}
        />
        <button
          onClick={handleLookup}
          disabled={loading || !query.trim()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {loading ? '...' : 'Look up'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

          {/* Global identity header */}
          <div className="bg-blue-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-200 text-xs uppercase tracking-wide mb-1">
                  MedQueue ID
                </p>
                <p className="font-mono font-bold text-xl tracking-wider">
                  {result.global.mqid}
                </p>
              </div>
              <div className="text-right">
                <p className="text-blue-200 text-xs">Verified patient</p>
                <p className="text-green-300 font-bold text-sm mt-0.5">✓ KNOWN</p>
              </div>
            </div>
          </div>

          {/* Patient details */}
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div>
                <p className="text-gray-400 text-xs">Full Name</p>
                <p className="font-medium text-gray-800">{result.global.fullName}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Phone</p>
                <p className="font-medium text-gray-800">{result.global.phone}</p>
              </div>
              {result.global.dob && (
                <div>
                  <p className="text-gray-400 text-xs">Date of Birth</p>
                  <p className="font-medium text-gray-800">
                    {new Date(result.global.dob).toLocaleDateString('en-IN')}
                  </p>
                </div>
              )}
              {result.global.bloodGroup && result.global.bloodGroup !== 'unknown' && (
                <div>
                  <p className="text-gray-400 text-xs">Blood Group</p>
                  <p className="font-bold text-red-600">{result.global.bloodGroup}</p>
                </div>
              )}
            </div>

            {/* Hospital-specific section */}
            {result.hospitalProfile && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
                  At {hospitalName}
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Local Patient No.</p>
                    <p className="font-mono font-bold text-gray-800">
                      {localPrefix}-{String(result.hospitalProfile.localPatientNo).padStart(4,'0')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Total Visits</p>
                    <p className="font-medium text-gray-800">
                      {result.hospitalProfile.totalVisits}
                    </p>
                  </div>
                  {result.hospitalProfile.allergies.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-gray-400 text-xs mb-1">Known Allergies</p>
                      <div className="flex flex-wrap gap-1">
                        {result.hospitalProfile.allergies.map(a => (
                          <span
                            key={a}
                            className="px-2 py-0.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs rounded-full"
                          >
                            ⚠ {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.hospitalProfile.chronicConditions.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-gray-400 text-xs mb-1">Chronic Conditions</p>
                      <div className="flex flex-wrap gap-1">
                        {result.hospitalProfile.chronicConditions.map(c => (
                          <span
                            key={c}
                            className="px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-700 text-xs rounded-full"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* First time at this hospital */}
            {!result.hospitalProfile && (
              <div className="border-t border-gray-100 pt-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  ℹ️ First visit to {hospitalName}. A local profile has been created automatically.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
