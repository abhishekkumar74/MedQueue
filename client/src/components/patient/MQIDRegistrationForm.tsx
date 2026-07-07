import { useState } from 'react';
import type { PatientRegistrationForm } from '../../types/mqid';

interface Props {
  phone: string;
  onSubmit: (form: PatientRegistrationForm) => void;
  loading: boolean;
  error: string | null;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'] as const;
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Not Disclosed' },
] as const;

const COMMON_ALLERGIES = ['Penicillin', 'Sulfa drugs', 'Aspirin', 'Ibuprofen', 'Latex', 'None'];

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
  });

  const [allergyInput, setAllergyInput] = useState('');

  const set = (field: keyof PatientRegistrationForm, value: any) =>
    setForm(f => ({ ...f, [field]: value }));

  const toggleAllergy = (allergy: string) => {
    setForm(f => ({
      ...f,
      allergies: f.allergies.includes(allergy)
        ? f.allergies.filter(a => a !== allergy)
        : [...f.allergies, allergy],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) return;
    onSubmit(form);
  };

  return (
    <div className="max-w-md w-full mx-auto p-6 sm:p-8 bg-white border border-slate-200/80 rounded-[32px] shadow-sm my-4 font-sans text-left">
      {/* Branded Header */}
      <div className="mb-6 text-center">
        <div className="w-14 h-14 bg-gradient-to-tr from-[#005EB8] to-[#00A3AD] rounded-[20px] flex items-center justify-center text-white text-2xl shadow-md mx-auto mb-4">
          🏥
        </div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Create Health Profile</h2>
        <p className="text-xs text-slate-400 font-semibold mt-1 max-w-xs mx-auto leading-relaxed">
          Create a permanent MedQueue ID (MQID) to sync records across all clinics.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Phone number display */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Verified Mobile</label>
          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl min-h-[48px]">
            <span className="text-emerald-500 font-black text-sm">✓</span>
            <span className="text-sm font-extrabold text-slate-700">{phone}</span>
          </div>
        </div>

        {/* Full Name */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Full Name *</label>
          <input
            type="text"
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base md:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#005EB8] outline-none transition-colors min-h-[48px]"
            placeholder="As matching your primary ID card"
            value={form.fullName}
            onChange={e => set('fullName', e.target.value)}
          />
        </div>

        {/* DOB */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Date of Birth</label>
          <input
            type="date"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base md:text-sm font-semibold text-slate-700 focus:bg-white focus:border-[#005EB8] outline-none transition-colors min-h-[48px]"
            value={form.dob}
            onChange={e => set('dob', e.target.value)}
          />
        </div>

        {/* Gender Selection Grid */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Gender Identification</label>
          <div className="grid grid-cols-2 gap-2">
            {GENDERS.map(g => (
              <button
                key={g.value}
                type="button"
                onClick={() => set('gender', g.value)}
                className={`min-h-[48px] py-2.5 px-4 text-xs rounded-2xl border transition-all font-bold uppercase tracking-wider ${
                  form.gender === g.value
                    ? 'bg-gradient-to-r from-[#005EB8] to-[#004a96] border-transparent text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-350'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Blood Group Wrap Selection */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Blood Group</label>
          <div className="flex flex-wrap gap-1.5">
            {BLOOD_GROUPS.map(bg => (
              <button
                key={bg}
                type="button"
                onClick={() => set('bloodGroup', bg)}
                className={`min-h-[40px] px-3.5 py-1.5 text-xs rounded-xl border transition-all font-black uppercase tracking-wider ${
                  form.bloodGroup === bg
                    ? 'bg-rose-500 border-transparent text-white shadow-sm'
                    : 'border-slate-250 bg-white text-slate-650 hover:border-rose-300'
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Residential Address</label>
          <input
            type="text"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base md:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#005EB8] outline-none transition-colors min-h-[48px]"
            placeholder="House/Apt No, Street Name"
            value={form.address}
            onChange={e => set('address', e.target.value)}
          />
        </div>

        {/* City */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">City</label>
          <input
            type="text"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base md:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#005EB8] outline-none transition-colors min-h-[48px]"
            placeholder="e.g. New Delhi, Mumbai, Gurugram"
            value={form.city}
            onChange={e => set('city', e.target.value)}
          />
        </div>

        {/* Emergency Contact */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Emergency Contact Phone</label>
          <input
            type="tel"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-base md:text-sm font-mono font-semibold text-slate-850 placeholder-slate-400 focus:bg-white focus:border-[#005EB8] outline-none transition-colors min-h-[48px]"
            placeholder="Guardian or spouse's phone number"
            value={form.emergencyContact}
            onChange={e => set('emergencyContact', e.target.value)}
          />
        </div>

        {/* Allergy Tags Selector */}
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Known Clinical Allergies</label>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {COMMON_ALLERGIES.map(a => {
              const isSelected = form.allergies.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAllergy(a)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors font-semibold ${
                    isSelected
                      ? 'bg-orange-500 border-transparent text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-orange-300'
                  }`}
                >
                  {a}
                </button>
              );
            })}
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-base md:text-sm font-semibold outline-none focus:bg-white focus:border-orange-400 transition-colors min-h-[48px]"
              placeholder="Add other custom allergy tag..."
              value={allergyInput}
              onChange={e => setAllergyInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (allergyInput.trim()) {
                    toggleAllergy(allergyInput.trim());
                    setAllergyInput('');
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (allergyInput.trim()) {
                  toggleAllergy(allergyInput.trim());
                  setAllergyInput('');
                }
              }}
              className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-2xl transition-colors min-h-[48px] uppercase tracking-wider border border-slate-250"
            >
              Add
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-650 font-bold leading-relaxed">
            ⚠️ {error}
          </div>
        )}

        {/* Primary Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !form.fullName.trim()}
          className="w-full py-4 bg-gradient-to-r from-[#005EB8] to-[#004a96] hover:opacity-95 disabled:bg-slate-200 disabled:text-slate-450 disabled:shadow-none text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-md shadow-[#005EB8]/10 min-h-[50px] flex items-center justify-center"
        >
          {loading ? '⏳ Generating Health Account...' : 'Create MedQueue ID Registry'}
        </button>
      </form>

      <p className="text-[9px] text-slate-400 text-center mt-4 font-bold tracking-wider uppercase leading-relaxed">
        Registry keys are universally stored and accepted at all connected clinics.
      </p>
    </div>
  );
}
