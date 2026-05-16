import { useState, useEffect, useCallback } from 'react';
import { getQueue, callNextPatient, markTokenNoShow, createPrescription } from '../lib/api';
import { Token, PatientIntake, Medication, PRIORITY_LABEL, INTAKE_STATUS_COLOR, INTAKE_STATUS_LABEL } from '../types';
import { Loader2, Phone, CheckCircle2, UserX, Stethoscope, RefreshCw, AlertCircle, Plus, Trash2 } from 'lucide-react';

const EMPTY_MED: Medication = { name: '', dosage: '', frequency: '', duration: '', instructions: '', quantity: 1 };

interface QueueData {
  waiting: Array<Token & { patient_intake?: PatientIntake[] }>;
  serving: (Token & { patient_intake?: PatientIntake[] }) | null;
}

interface DoctorPanelProps {
  doctorDepartment?: string;
  doctorName?: string;
  roomNumber?: string;
}

export default function DoctorPanel({ doctorDepartment, doctorName, roomNumber }: DoctorPanelProps = {}) {
  const [queue, setQueue] = useState<QueueData>({ waiting: [], serving: null });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [medications, setMedications] = useState<Medication[]>([{ ...EMPTY_MED }]);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fetchQueue = useCallback(async () => {
    try {
      const data = await getQueue(doctorDepartment);
      setQueue(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [doctorDepartment]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 8000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  async function callNext() {
    setActionLoading('calling');
    try {
      await callNextPatient(doctorDepartment);
      setDiagnosis('');
      setMedications([{ ...EMPTY_MED }]);
      setDoctorNotes('');
      setFieldErrors({});
      await fetchQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to call next');
    } finally {
      setActionLoading('');
    }
  }

  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (!diagnosis.trim()) errs.diagnosis = 'Diagnosis is required';
    medications.forEach((med, i) => {
      if (!med.name.trim()) errs[`med_${i}_name`] = 'Medication name required';
      if (!med.dosage.trim()) errs[`med_${i}_dosage`] = 'Dosage required';
    });
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function addMedication() {
    setMedications(prev => [...prev, { ...EMPTY_MED }]);
  }

  function removeMedication(index: number) {
    setMedications(prev => prev.filter((_, i) => i !== index));
  }

  function updateMedication(index: number, field: keyof Medication, value: string | number) {
    setMedications(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  }

  async function completeConsultation() {
    if (!queue.serving) return;
    if (!validateForm()) return;
    setNotesLoading(true);
    setError('');
    try {
      await createPrescription({
        patient_id: queue.serving.patient_id!,
        token_id: queue.serving.id,
        diagnosis: diagnosis.trim(),
        medications,
        doctor_notes: doctorNotes,
      });
      setDiagnosis('');
      setMedications([{ ...EMPTY_MED }]);
      setDoctorNotes('');
      setFieldErrors({});
      await fetchQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete — token status unchanged');
    } finally {
      setNotesLoading(false);
    }
  }

  async function markNoShow() {
    if (!queue.serving) return;
    setActionLoading('noshow');
    try {
      await markTokenNoShow(queue.serving.id);
      await fetchQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setActionLoading('');
    }
  }

  const servingIntake = queue.serving?.patient_intake?.[0];
  const readyCount = queue.waiting.filter(t => t.intake_status === 'READY_FOR_DOCTOR').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#005EB8]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Stethoscope className="w-7 h-7 text-[#005EB8]" />
          <div>
            <h1 className="text-2xl font-bold text-[#005EB8]">Doctor Consultation Panel</h1>
            <p className="text-gray-500 text-sm">
              {doctorName && <span className="font-semibold text-gray-700">{doctorName}</span>}
              {doctorDepartment && <span> • {doctorDepartment.charAt(0).toUpperCase() + doctorDepartment.slice(1)}</span>}
              {roomNumber && <span> • Room {roomNumber}</span>}
              {!doctorName && <span>{readyCount} patients ready for doctor</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={callNext}
            disabled={!!actionLoading || readyCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
          >
            {actionLoading === 'calling' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
            Call Next
            {readyCount > 0 && <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{readyCount}</span>}
          </button>
          <button
            onClick={fetchQueue}
            className="flex items-center gap-2 px-3 py-2 border-2 border-[#005EB8] text-[#005EB8] rounded-xl font-semibold hover:bg-[#E8F3FF] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Now Consulting */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-bold text-gray-700 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            Now Consulting
          </h2>

          {queue.serving ? (
            <div className="space-y-5">
              {/* Patient Info */}
              <div className="bg-gradient-to-r from-[#E8F3FF] to-blue-50 rounded-xl p-5 border border-blue-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-4xl font-extrabold text-[#005EB8] leading-none">
                      #{queue.serving.token_number}
                    </div>
                    {queue.serving.patients?.name && (
                      <div className="text-lg font-bold text-gray-800 mt-1">
                        {queue.serving.patients.name}
                        {queue.serving.patients.age && ` • ${queue.serving.patients.age} yrs`}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${INTAKE_STATUS_COLOR[queue.serving.intake_status]}`}>
                    {INTAKE_STATUS_LABEL[queue.serving.intake_status]}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <p><span className="font-semibold">Phone:</span> {queue.serving.phone}</p>
                  {queue.serving.patients?.address && (
                    <p><span className="font-semibold">Address:</span> {queue.serving.patients.address}</p>
                  )}
                </div>
              </div>

              {/* Vitals from Intake */}
              {servingIntake && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'BP', value: servingIntake.bp },
                    { label: 'Sugar', value: servingIntake.sugar },
                    { label: 'Temp', value: servingIntake.temperature },
                  ].map(
                    (v) =>
                      v.value && (
                        <div key={v.label} className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
                          <div className="text-xs font-bold text-gray-500 uppercase mb-1">{v.label}</div>
                          <div className="text-lg font-bold text-[#005EB8]">{v.value}</div>
                        </div>
                      )
                  )}
                </div>
              )}

              {/* Chief Complaint */}
              {servingIntake?.symptoms && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="text-xs font-bold text-amber-700 uppercase mb-1">Chief Complaint</div>
                  <p className="text-sm text-gray-700">{servingIntake.symptoms}</p>
                </div>
              )}

              {/* Ward Boy Notes */}
              {servingIntake?.notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-xs font-bold text-blue-700 uppercase mb-1">Ward Boy Notes</div>
                  <p className="text-sm text-gray-700">{servingIntake.notes}</p>
                </div>
              )}

              {/* Doctor's Diagnosis & Prescription */}
              <div className="space-y-4">
                {/* Diagnosis */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Diagnosis *
                  </label>
                  <textarea
                    rows={2}
                    value={diagnosis}
                    onChange={(e) => { setDiagnosis(e.target.value); setFieldErrors(f => ({ ...f, diagnosis: '' })); }}
                    placeholder="Enter diagnosis..."
                    className={`w-full border-2 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none ${fieldErrors.diagnosis ? 'border-red-400' : 'border-gray-200 focus:border-[#005EB8]'}`}
                  />
                  {fieldErrors.diagnosis && <p className="text-xs text-red-500 mt-1">{fieldErrors.diagnosis}</p>}
                </div>

                {/* Medications */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-gray-700">Medications *</label>
                    <button
                      type="button"
                      onClick={addMedication}
                      className="flex items-center gap-1 text-xs text-[#005EB8] font-semibold hover:underline"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                  <div className="space-y-3">
                    {medications.map((med, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-500">Medication {i + 1}</span>
                          {medications.length > 1 && (
                            <button onClick={() => removeMedication(i)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <input
                              value={med.name}
                              onChange={e => { updateMedication(i, 'name', e.target.value); setFieldErrors(f => ({ ...f, [`med_${i}_name`]: '' })); }}
                              placeholder="Medicine name *"
                              className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none ${fieldErrors[`med_${i}_name`] ? 'border-red-400' : 'border-gray-200 focus:border-[#005EB8]'}`}
                            />
                            {fieldErrors[`med_${i}_name`] && <p className="text-xs text-red-500">{fieldErrors[`med_${i}_name`]}</p>}
                          </div>
                          <div>
                            <input
                              value={med.dosage}
                              onChange={e => { updateMedication(i, 'dosage', e.target.value); setFieldErrors(f => ({ ...f, [`med_${i}_dosage`]: '' })); }}
                              placeholder="Dosage e.g. 500mg *"
                              className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none ${fieldErrors[`med_${i}_dosage`] ? 'border-red-400' : 'border-gray-200 focus:border-[#005EB8]'}`}
                            />
                            {fieldErrors[`med_${i}_dosage`] && <p className="text-xs text-red-500">{fieldErrors[`med_${i}_dosage`]}</p>}
                          </div>
                          <input
                            value={med.frequency}
                            onChange={e => updateMedication(i, 'frequency', e.target.value)}
                            placeholder="Frequency e.g. Twice daily"
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:border-[#005EB8] focus:outline-none"
                          />
                          <input
                            value={med.duration}
                            onChange={e => updateMedication(i, 'duration', e.target.value)}
                            placeholder="Duration e.g. 5 days"
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:border-[#005EB8] focus:outline-none"
                          />
                          <input
                            value={med.instructions}
                            onChange={e => updateMedication(i, 'instructions', e.target.value)}
                            placeholder="Instructions e.g. After meals"
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:border-[#005EB8] focus:outline-none"
                          />
                          <input
                            type="number"
                            value={med.quantity}
                            onChange={e => updateMedication(i, 'quantity', parseInt(e.target.value) || 1)}
                            placeholder="Qty"
                            min={1}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:border-[#005EB8] focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Doctor notes */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Additional Notes</label>
                  <textarea
                    rows={2}
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    placeholder="Follow-up instructions, advice..."
                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-[#005EB8] focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={completeConsultation}
                  disabled={notesLoading}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {notesLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Complete & Send to Pharmacy
                </button>
                <button
                  onClick={markNoShow}
                  disabled={!!actionLoading}
                  className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-600 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {actionLoading === 'noshow' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                  Mark No-Show
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Phone className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p className="font-medium mb-1">No patient currently</p>
              <p className="text-sm">Call next patient to start consultation</p>
            </div>
          )}
        </div>

        {/* Ready Queue */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-bold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
            Ready for Doctor
            <span className="ml-auto bg-violet-100 text-violet-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {readyCount}
            </span>
          </h2>

          {readyCount === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <p>Waiting for patients to complete intake</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {queue.waiting.map((t) => {
                if (t.intake_status !== 'READY_FOR_DOCTOR') return null;
                const intake = t.patient_intake?.[0];
                return (
                  <div
                    key={t.id}
                    className="bg-violet-50 border border-violet-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-bold text-lg text-[#005EB8]">#{t.token_number}</div>
                        <div className="text-sm font-semibold text-gray-700">
                          {t.patients?.name || 'Patient'}
                          {t.patients?.age && ` • ${t.patients.age}y`}
                        </div>
                      </div>
                      <span className="text-xs font-bold px-1.5 py-0.5 bg-violet-200 text-violet-700 rounded">
                        {PRIORITY_LABEL[t.priority]}
                      </span>
                    </div>
                    {intake?.symptoms && (
                      <p className="text-xs text-gray-600 line-clamp-1">
                        <span className="font-semibold">Chief:</span> {intake.symptoms}
                      </p>
                    )}
                    {intake && (
                      <div className="flex gap-2 text-xs text-gray-500 mt-1">
                        {intake.bp && <span className="font-semibold">BP {intake.bp}</span>}
                        {intake.sugar && <span className="font-semibold">Sugar {intake.sugar}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={callNext}
            disabled={!!actionLoading || !queue.serving === false && readyCount === 0}
            className="w-full mt-3 py-3 bg-[#005EB8] hover:bg-[#004a96] disabled:opacity-50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {actionLoading === 'calling' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
            Call Next Patient
          </button>
        </div>
      </div>
    </div>
  );
}
