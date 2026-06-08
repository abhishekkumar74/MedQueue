import { useState } from 'react'
import type { PatientRegistrationForm } from '../../types/mqid'

interface Props {
  phone: string
  onSubmit: (form: PatientRegistrationForm) => void
  loading: boolean
  error: string | null
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'] as const
const GENDERS = [
  { value: 'male',             label: 'Male'              },
  { value: 'female',           label: 'Female'            },
  { value: 'other',            label: 'Other'             },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const

const COMMON_ALLERGIES = ['Penicillin', 'Sulfa drugs', 'Aspirin', 'Ibuprofen', 'Latex', 'None']

export function MQIDRegistrationForm({ phone, onSubmit, loading, error }: Props) {
  const [form, setForm] = useState<PatientRegistrationForm>({
    fullName: '',
    phone,
    dob: '',
    gender: null,
    bloodGroup: null,
    address: '',
    city: '',
    emergencyContact: '',
    allergies: [],
  })

  const [allergyInput, setAllergyInput] = useState('')

  const set = (field: keyof PatientRegistrationForm, value: any) =>
    setForm(f => ({ ...f, [field]: value }))

  const toggleAllergy = (allergy: string) => {
    setForm(f => ({
      ...f,
      allergies: f.allergies.includes(allergy)
        ? f.allergies.filter(a => a !== allergy)
        : [...f.allergies, allergy],
    }))
  }

  const handleSubmit = () => {
    if (!form.fullName.trim()) return
    onSubmit(form)
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white border border-slate-200/60 rounded-3xl shadow-sm my-6">

      {/* Header */}
      <div className="mb-6 text-center">
        <div className="text-4xl mb-2">🏥</div>
        <h2 className="text-xl font-bold text-gray-900">Create Your Health Profile</h2>
        <p className="text-sm text-gray-500 mt-1">
          You'll receive a permanent MedQueue ID (MQID) that works at all hospitals.
        </p>
      </div>

      {/* Phone (readonly) */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 block mb-1">Mobile Number (verified)</label>
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-green-600 text-sm">✓</span>
          <span className="text-sm font-medium text-gray-700">{phone}</span>
        </div>
      </div>

      {/* Full name */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 block mb-1 font-bold">Full Name *</label>
        <input
          type="text"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-blue-400 font-medium"
          placeholder="As on Aadhaar card"
          value={form.fullName}
          onChange={e => set('fullName', e.target.value)}
        />
      </div>

      {/* DOB */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 block mb-1 font-bold">Date of Birth</label>
        <input
          type="date"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-blue-400 bg-white font-medium text-slate-700"
          value={form.dob}
          onChange={e => set('dob', e.target.value)}
        />
      </div>

      {/* Gender */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 block mb-2 font-bold">Gender</label>
        <div className="grid grid-cols-2 gap-2">
          {GENDERS.map(g => (
            <button
              key={g.value}
              type="button"
              onClick={() => set('gender', g.value)}
              className={`py-2 px-3 text-sm rounded-xl border transition-colors font-bold ${
                form.gender === g.value
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-200 text-gray-650 hover:border-blue-300'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Blood group */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 block mb-2 font-bold">Blood Group</label>
        <div className="flex flex-wrap gap-2">
          {BLOOD_GROUPS.map(bg => (
            <button
              key={bg}
              type="button"
              onClick={() => set('bloodGroup', bg)}
              className={`px-3 py-1.5 text-xs rounded-xl border font-black transition-colors ${
                form.bloodGroup === bg
                  ? 'bg-red-500 border-red-500 text-white'
                  : 'border-gray-200 text-gray-650 hover:border-red-300'
              }`}
            >
              {bg}
            </button>
          ))}
        </div>
      </div>

      {/* Address */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 block mb-1 font-bold">Address</label>
        <input
          type="text"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-blue-400 font-medium"
          placeholder="House no, Street, Area"
          value={form.address}
          onChange={e => set('address', e.target.value)}
        />
      </div>

      {/* City */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 block mb-1 font-bold">City</label>
        <input
          type="text"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-blue-400 font-medium"
          placeholder="Delhi, Mumbai, Patna..."
          value={form.city}
          onChange={e => set('city', e.target.value)}
        />
      </div>

      {/* Emergency contact */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 block mb-1 font-bold">Emergency Contact</label>
        <input
          type="tel"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:border-blue-400 font-mono font-semibold"
          placeholder="Family member's phone number"
          value={form.emergencyContact}
          onChange={e => set('emergencyContact', e.target.value)}
        />
      </div>

      {/* Allergies */}
      <div className="mb-6">
        <label className="text-xs text-gray-500 block mb-2 font-bold">Known Allergies</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {COMMON_ALLERGIES.map(a => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAllergy(a)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors font-semibold ${
                form.allergies.includes(a)
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'border-gray-200 text-gray-500 hover:border-orange-300'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2.5 text-xs border border-gray-300 rounded-xl outline-none focus:border-blue-400 font-medium"
            placeholder="Type other allergy..."
            value={allergyInput}
            onChange={e => setAllergyInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (allergyInput.trim()) {
                  toggleAllergy(allergyInput.trim())
                  setAllergyInput('')
                }
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (allergyInput.trim()) {
                toggleAllergy(allergyInput.trim())
                setAllergyInput('')
              }
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-black transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-750 font-semibold leading-relaxed">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || !form.fullName.trim()}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-extrabold text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-100/60"
      >
        {loading ? '⏳ Creating your health ID...' : '✓ Create My MedQueue ID'}
      </button>

      <p className="text-[10px] text-gray-400 text-center mt-3.5 font-bold">
        Your MQID is permanent and works at all MedQueue hospitals.
      </p>
    </div>
  )
}
