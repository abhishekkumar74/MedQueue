import { useState, useEffect } from 'react';
import { getIntakeByToken, startIntake, updateIntake } from '../lib/api';
import { supabase } from '../lib/supabase';
import { Token, PatientIntake, PRIORITY_LABEL, DEPARTMENT_LABEL, Department } from '../types';
import { Loader2, AlertCircle, CheckCircle2, User, Heart, MapPin } from 'lucide-react';

interface IntakeForm {
  bp: string;
  sugar: string;
  temperature: string;
  symptoms: string;
  notes: string;
}

interface DoctorOption {
  id: string;
  name: string;
  department: string;
  room_number: string;
  floor: string;
}

export default function WardBoyIntake({ token, onDone }: { token: Token; onDone?: () => void }) {
  const [intake, setIntake] = useState<PatientIntake | null>(null);
  const [form, setForm] = useState<IntakeForm>({ bp: '', sugar: '', temperature: '', symptoms: '', notes: '' });
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // Load existing intake if any
        const data = await getIntakeByToken(token.id);
        setIntake(data);
        if (data) {
          setForm({
            bp: data.bp || '',
            sugar: data.sugar || '',
            temperature: data.temperature || '',
            symptoms: data.symptoms || '',
            notes: data.notes || '',
          });
        }

        // Load available doctors — filter by token's department if set
        const query = supabase
          .from('staff_users')
          .select('id, name, department, room_number')
          .eq('role', 'DOCTOR')
          .eq('is_active', true);

        if (token.department) {
          query.eq('department', token.department);
        }

        const { data: staffDoctors } = await query;

        if (staffDoctors && staffDoctors.length > 0) {
          setDoctors(staffDoctors.map(d => ({
            id: d.id,
            name: d.name,
            department: d.department ?? '',
            room_number: d.room_number ?? '',
            floor: extractFloor(d.room_number ?? ''),
          })));
          // Auto-select first doctor
          setSelectedDoctorId(staffDoctors[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token.id, token.department]);

  // Extract floor from room number e.g. "Room 201" → "Floor 2"
  function extractFloor(roomNumber: string): string {
    const match = roomNumber.match(/\d+/);
    if (!match) return '';
    const num = parseInt(match[0]);
    if (num < 100) return 'Ground Floor';
    return `Floor ${Math.floor(num / 100)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bp || !form.sugar || !form.symptoms) return setError('BP, Sugar, and Symptoms are required');
    setSubmitting(true);
    setError('');
    try {
      let currentIntake = intake;
      if (!currentIntake) {
        const { intake: created } = await startIntake(token.id);
        currentIntake = created;
        setIntake(created);
      }

      // Save intake vitals
      await updateIntake(currentIntake!.id, form);

      // Save doctor routing info to token
      const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
      if (selectedDoctor) {
        await supabase.from('tokens').update({
          room_number: selectedDoctor.room_number,
          // Store doctor name in notes for display — we use room_number column
        }).eq('id', token.id);
      }

      setCompleted(true);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-[#005EB8]" /></div>;

  if (completed) {
    const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
        <p className="font-bold text-emerald-700">Intake Complete!</p>
        {selectedDoctor && (
          <div className="mt-2 bg-white rounded-lg p-3 text-left border border-emerald-200">
            <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Patient Routed To</p>
            <p className="font-semibold text-gray-800 text-sm">{selectedDoctor.name}</p>
            <p className="text-xs text-gray-500">
              {selectedDoctor.room_number}
              {selectedDoctor.floor ? ` • ${selectedDoctor.floor}` : ''}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Patient info */}
      <div className="bg-[#E8F3FF] rounded-xl p-3 border border-blue-200">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#005EB8] mb-1">
          <User className="w-4 h-4" />
          {token.patients?.name || 'Patient'}
          {token.patients?.age && `, ${token.patients.age} yrs`}
        </div>
        <div className="text-xs text-gray-600">
          Token #{token.token_number} • {PRIORITY_LABEL[token.priority]}
          {token.department && ` • ${DEPARTMENT_LABEL[token.department as Department] ?? token.department}`}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Vitals */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">BP (mmHg) *</label>
          <input type="text" value={form.bp} onChange={e => setForm(f => ({ ...f, bp: e.target.value }))}
            placeholder="120/80"
            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:border-[#005EB8] focus:outline-none" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1">Sugar (mg/dL) *</label>
          <input type="text" value={form.sugar} onChange={e => setForm(f => ({ ...f, sugar: e.target.value }))}
            placeholder="110"
            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:border-[#005EB8] focus:outline-none" />
        </div>
        <div className="col-span-2">
          <label className="text-xs font-bold text-gray-700 block mb-1">Temperature (°F)</label>
          <input type="text" value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: e.target.value }))}
            placeholder="98.6"
            className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:border-[#005EB8] focus:outline-none" />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1">Symptoms / Chief Complaint *</label>
        <textarea rows={2} value={form.symptoms} onChange={e => setForm(f => ({ ...f, symptoms: e.target.value }))}
          placeholder="Describe what patient came for..."
          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:border-[#005EB8] focus:outline-none resize-none" />
      </div>

      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1">Ward Boy Notes</label>
        <textarea rows={1} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Any observations..."
          className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:border-[#005EB8] focus:outline-none resize-none" />
      </div>

      {/* Doctor assignment */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
        <label className="text-xs font-bold text-violet-700 block mb-2 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" />
          Assign Doctor / Room
        </label>
        {doctors.length === 0 ? (
          <p className="text-xs text-gray-500 italic">
            No doctors found for this department. Patient will be queued for general consultation.
          </p>
        ) : (
          <div className="space-y-2">
            {doctors.map(doc => (
              <label key={doc.id} className={`flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                selectedDoctorId === doc.id
                  ? 'border-violet-500 bg-violet-100'
                  : 'border-gray-200 bg-white hover:border-violet-300'
              }`}>
                <input
                  type="radio"
                  name="doctor"
                  value={doc.id}
                  checked={selectedDoctorId === doc.id}
                  onChange={() => setSelectedDoctorId(doc.id)}
                  className="accent-violet-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 text-sm">{doc.name}</div>
                  <div className="text-xs text-gray-500">
                    {doc.room_number || 'Room TBD'}
                    {doc.floor ? ` • ${doc.floor}` : ''}
                    {doc.department ? ` • ${DEPARTMENT_LABEL[doc.department as Department] ?? doc.department}` : ''}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <button type="submit" disabled={submitting}
        className="w-full py-2.5 bg-[#005EB8] text-white rounded-lg font-bold hover:bg-[#004a96] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 text-sm">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
        {submitting ? 'Saving...' : 'Complete Intake & Route to Doctor'}
      </button>
    </form>
  );
}
