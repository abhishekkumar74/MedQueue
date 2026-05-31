import { useState, useEffect } from 'react';
import { getIntakeByToken, startIntake, updateIntake, getSelectedHospitalId } from '../../../../lib/api';
import { supabase } from '../../../../lib/supabase';
import { Token, PatientIntake, PRIORITY_LABEL, DEPARTMENT_LABEL, Department, Priority } from '../../../../types';
import { 
  Loader2, AlertCircle, CheckCircle2, Heart, MapPin, Sparkles, Activity, Clock, ShieldAlert, Check
} from 'lucide-react';

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
  load: number;
  is_available: boolean;
}

export default function WardBoyIntake({ token, onDone }: { token: Token; onDone?: () => void }) {
  const [intake, setIntake] = useState<PatientIntake | null>(null);
  const [form, setForm] = useState<IntakeForm>({ bp: '', sugar: '', temperature: '', symptoms: '', notes: '' });
  
  // Quick Priority State
  const [priority, setPriority] = useState<Priority>(token.priority);
  
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  const currentHospitalId = getSelectedHospitalId();

  // Symptom Tags
  const SYMPTOM_TAGS = ['Fever', 'Cough', 'Weakness', 'Chest Pain', 'Follow-up', 'Headache', 'Stomach Ache'];

  // ── Load Vitals, Doctors, & Doctor active loads ───────────────────
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // 1. Load existing intake if any
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

        // 2. Fetch all active token loads to map active doctor queues
        const { data: activeTokens } = await supabase
          .from('tokens')
          .select('room_number, status')
          .in('status', ['WAITING', 'SERVING'])
          .eq('hospital_id', currentHospitalId);

        const loadMap: Record<string, number> = {};
        activeTokens?.forEach(t => {
          if (t.room_number) {
            loadMap[t.room_number] = (loadMap[t.room_number] || 0) + 1;
          }
        });

        // 3. Load all doctors in this hospital from the 'doctors' table (available & offline)
        const query = supabase
          .from('doctors')
          .select('id, name, department, room_number, is_available')
          .eq('hospital_id', currentHospitalId);

        const { data: staffDoctors } = await query;

        if (staffDoctors && staffDoctors.length > 0) {
          const mappedDocs = staffDoctors.map(d => ({
            id: d.id,
            name: d.name,
            department: d.department ?? '',
            room_number: d.room_number ?? '',
            floor: extractFloor(d.room_number ?? ''),
            load: loadMap[d.room_number ?? ''] || 0,
            is_available: d.is_available ?? false
          }));

          // Helper to check department match (e.g. orthopedic vs orthopedics)
          const isDeptMatch = (docDept: string, tokenDept?: string) => {
            if (!tokenDept || !docDept) return false;
            const d = docDept.toLowerCase().trim();
            const t = tokenDept.toLowerCase().trim();
            return d === t || d.startsWith(t) || t.startsWith(d) || d.substring(0, 5) === t.substring(0, 5);
          };

          // Filter only doctors matching the patient's department (fuzzy match)
          const deptDocs = mappedDocs.filter(d => isDeptMatch(d.department, token.department));

          // Sort matching doctors: online doctors first (by load), then offline doctors (by load)
          deptDocs.sort((a, b) => {
            if (a.is_available && !b.is_available) return -1;
            if (!a.is_available && b.is_available) return 1;
            return a.load - b.load;
          });
          
          setDoctors(deptDocs);
          if (deptDocs.length > 0) {
            setSelectedDoctorId(deptDocs[0].id);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load intake console');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [token.id, token.department, currentHospitalId]);

  // Extract Floor number from room code
  function extractFloor(roomNumber: string): string {
    const match = roomNumber.match(/\d+/);
    if (!match) return 'Ground Floor';
    const num = parseInt(match[0]);
    if (num < 100) return 'Ground Floor';
    return `Floor ${Math.floor(num / 100)}`;
  }

  // ── Emergency Threshold Triage Detection ──────────────────────────
  const getVitalsStatus = () => {
    let isEmergency = false;
    let alerts: string[] = [];

    // Parse Blood Pressure (Format: 120/80)
    if (form.bp) {
      const parts = form.bp.split('/');
      const sys = parseInt(parts[0]);
      const dia = parseInt(parts[1]);
      if (!isNaN(sys) && (sys > 140 || sys < 90)) {
        isEmergency = true;
        alerts.push(`BP Systolic abnormal: ${sys} mmHg`);
      }
      if (!isNaN(dia) && (dia > 90 || dia < 60)) {
        isEmergency = true;
        alerts.push(`BP Diastolic abnormal: ${dia} mmHg`);
      }
    }

    // Parse Sugar (mg/dL)
    if (form.sugar) {
      const sugarVal = parseInt(form.sugar);
      if (!isNaN(sugarVal) && (sugarVal > 180 || sugarVal < 70)) {
        isEmergency = true;
        alerts.push(`Sugar Level critical: ${sugarVal} mg/dL`);
      }
    }

    // Parse Temperature (°F)
    if (form.temperature) {
      const tempVal = parseFloat(form.temperature);
      if (!isNaN(tempVal) && (tempVal > 100.4 || tempVal < 95.0)) {
        isEmergency = true;
        alerts.push(`Temperature abnormal: ${tempVal}°F`);
      }
    }

    return { isEmergency, alerts };
  };

  const triage = getVitalsStatus();

  // Auto-upgrade priority to Emergency if vital limits exceeded
  useEffect(() => {
    if (triage.isEmergency) {
      setPriority(0); // Set to Emergency priority (Priority 0)
    }
  }, [triage.isEmergency]);

  // ── Toggle Symptom Tags ──────────────────────────────────────────
  const toggleSymptomTag = (tag: string) => {
    setForm(f => {
      const current = f.symptoms.trim();
      if (!current) return { ...f, symptoms: tag };
      
      const tags = current.split(',').map(s => s.trim());
      if (tags.includes(tag)) {
        const filtered = tags.filter(t => t !== tag).join(', ');
        return { ...f, symptoms: filtered };
      } else {
        return { ...f, symptoms: [...tags, tag].join(', ') };
      }
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bp || !form.sugar || !form.symptoms) {
      return setError('Blood Pressure (BP), Sugar level, and Chief symptoms are required.');
    }
    setSubmitting(true);
    setError('');
    
    try {
      let currentIntake = intake;
      if (!currentIntake) {
        const { intake: created } = await startIntake(token.id);
        currentIntake = created;
        setIntake(created);
      }

      // 1. Save intake vital details
      await updateIntake(currentIntake!.id, form);

      // 2. Select matching doctor & write details back to the active Token
      const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
      const updates: Record<string, any> = {
        priority: priority // Save the (potentially upgraded) priority
      };

      if (selectedDoctor) {
        updates.room_number = selectedDoctor.room_number;
        updates.doctor_id = selectedDoctor.id;
      }

      const { error: tokenUpdateErr } = await supabase
        .from('tokens')
        .update(updates)
        .eq('id', token.id);

      if (tokenUpdateErr) throw new Error(tokenUpdateErr.message);

      setCompleted(true);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to finalize patient triage');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-[#005EB8]" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Configuring Console...</span>
      </div>
    );
  }

  if (completed) {
    const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
    return (
      <div className="bg-emerald-50/70 border border-emerald-150 rounded-2xl p-5 text-center animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        </div>
        <p className="font-extrabold text-emerald-800 text-base">Intake Finalized Successfully</p>
        <p className="text-xs text-emerald-600 font-semibold mt-0.5">Triage logged and patient routed to clinic</p>
        
        {selectedDoctor && (
          <div className="mt-4 bg-white rounded-2xl p-4 text-left border border-emerald-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Assigned Practitioner</p>
              <p className="font-black text-slate-800 text-sm mt-0.5">{selectedDoctor.name}</p>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                {selectedDoctor.department.toUpperCase()} • {selectedDoctor.room_number} ({selectedDoctor.floor})
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 font-black text-xs flex items-center justify-center border border-emerald-100">
              {selectedDoctor.room_number.replace(/\D/g, '') || 'R'}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
      {error && (
        <div className="flex items-center gap-2.5 bg-rose-50 border border-rose-150 text-rose-700 rounded-xl px-4 py-3 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ⚠️ Abnormal Vital Alert Banner */}
      {triage.isEmergency && (
        <div className="bg-rose-50 border-l-4 border-rose-500 rounded-r-xl p-3.5 flex gap-2.5 items-start animate-pulse">
          <ShieldAlert className="w-4.5 h-4.5 text-rose-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-extrabold text-rose-800 uppercase tracking-wider">Critical Triage Detected</div>
            <div className="text-[10px] text-rose-600 font-semibold mt-0.5 space-y-0.5">
              {triage.alerts.map((al, idx) => (
                <div key={idx}>• {al}</div>
              ))}
            </div>
            <div className="text-[9px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-black mt-2 inline-block uppercase tracking-widest">
              Queue Upgraded to Emergency (Top Priority)
            </div>
          </div>
        </div>
      )}

      {/* Vitals Form Block */}
      <div className={`p-4 rounded-2xl border transition-all duration-300 ${triage.isEmergency ? 'bg-rose-50/20 border-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.06)]' : 'bg-white border-slate-150 shadow-sm'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-[#005EB8]" />
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Vitals Assessment</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* BP */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Blood Pressure</label>
            <div className="relative">
              <input 
                type="text" 
                value={form.bp} 
                onChange={e => setForm(f => ({ ...f, bp: e.target.value }))}
                placeholder="120/80"
                className="w-full border border-slate-200 focus:border-[#005EB8] bg-white rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none" 
              />
            </div>
          </div>

          {/* Sugar */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Sugar (mg/dL)</label>
            <input 
              type="text" 
              value={form.sugar} 
              onChange={e => setForm(f => ({ ...f, sugar: e.target.value }))}
              placeholder="110"
              className="w-full border border-slate-200 focus:border-[#005EB8] bg-white rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none" 
            />
          </div>

          {/* Temperature */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Temp (°F)</label>
            <input 
              type="text" 
              value={form.temperature} 
              onChange={e => setForm(f => ({ ...f, temperature: e.target.value }))}
              placeholder="98.6"
              className="w-full border border-slate-200 focus:border-[#005EB8] bg-white rounded-xl px-2.5 py-2 text-xs font-bold text-slate-800 focus:outline-none" 
            />
          </div>
        </div>
      </div>

      {/* Symptom Tag Chips Panel */}
      <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Chief Complaints & Symptoms</span>
          <span className="text-[9px] text-[#005EB8] font-extrabold uppercase">Tap to toggle</span>
        </div>

        {/* Symptoms quick tag grid */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {SYMPTOM_TAGS.map(tag => {
            const isSelected = form.symptoms.split(',').map(s => s.trim()).includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleSymptomTag(tag)}
                className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl border transition-all ${
                  isSelected 
                    ? 'bg-[#005EB8] text-white border-[#005EB8] shadow-sm'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        {/* Symptoms text field */}
        <textarea 
          rows={2} 
          value={form.symptoms} 
          onChange={e => setForm(f => ({ ...f, symptoms: e.target.value }))}
          placeholder="Chief complaints details..."
          className="w-full border border-slate-200 focus:border-[#005EB8] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none resize-none" 
        />
      </div>

      {/* One-Tap Priority Options */}
      <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-3">Set Triage Queue Priority</span>
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map(pr => {
            const isSelected = priority === pr;
            const label = PRIORITY_LABEL[pr as Priority];
            let activeColor = '';
            
            if (pr === 0) activeColor = 'bg-rose-50 text-rose-700 border-rose-500 shadow-sm';
            else if (pr === 1) activeColor = 'bg-amber-50 text-amber-700 border-amber-500 shadow-sm';
            else activeColor = 'bg-emerald-50 text-emerald-700 border-emerald-500 shadow-sm';

            return (
              <button
                key={pr}
                type="button"
                onClick={() => setPriority(pr as Priority)}
                className={`py-2 px-3 border rounded-xl text-xs font-black transition-all text-center flex flex-col items-center justify-center ${
                  isSelected ? activeColor : 'bg-slate-50/50 border-slate-200 text-slate-500 hover:bg-slate-100/50'
                }`}
              >
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ward Boy notes */}
      <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">Internal Nurse/Ward Boy Notes</label>
        <textarea 
          rows={1} 
          value={form.notes} 
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Any physical notes, oxygen readings, behavior observations..."
          className="w-full border border-slate-200 focus:border-[#005EB8] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none resize-none" 
        />
      </div>

      {/* Smart Doctor Assignment Directory */}
      <div className="bg-violet-50/40 border border-violet-100 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-violet-600" />
            <span className="text-xs font-black text-violet-700 uppercase tracking-wider">Smart Doctor Routing Directory</span>
          </div>
          <span className="text-[9px] bg-violet-100 text-violet-700 font-black px-1.5 py-0.5 rounded uppercase">
            {doctors.length} Active {doctors.length === 1 ? 'Doctor' : 'Doctors'}
          </span>
        </div>

        {doctors.length === 0 ? (
          <p className="text-xs text-amber-700 font-semibold p-4 text-center bg-amber-50/60 rounded-xl border border-amber-150 leading-relaxed">
            ⚠️ No registered practitioners found in <strong>{DEPARTMENT_LABEL[token.department as Department] ?? token.department}</strong> department.
          </p>
        ) : (
          <div className="space-y-2.5">
            {doctors.map((doc, idx) => {
              const isSelected = selectedDoctorId === doc.id;
              const isLeastBusy = idx === 0;

              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoctorId(doc.id)}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between bg-white relative overflow-hidden ${
                    isSelected 
                      ? 'border-violet-500 shadow-md shadow-violet-500/5'
                      : 'border-slate-150 hover:border-violet-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg font-black text-[10px] flex items-center justify-center uppercase ${isSelected ? 'bg-violet-100 text-violet-700' : 'bg-slate-50 text-slate-400'}`}>
                      {doc.room_number.replace(/\D/g, '') || 'R'}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                        {doc.name}
                        {!doc.is_available && (
                          <span className="bg-slate-100 text-slate-500 text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider">
                            Offline
                          </span>
                        )}
                        {isLeastBusy && doc.is_available && (
                          <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider flex items-center gap-0.5">
                            <Sparkles className="w-2 h-2" /> Best Match
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                        {doc.room_number} • {doc.floor} • {DEPARTMENT_LABEL[doc.department as Department] ?? doc.department}
                      </div>
                    </div>
                  </div>

                  {/* Active Doctor queues & load waiting tracker */}
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <div className="text-xs font-black text-slate-700">{doc.load} Patients</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1 justify-end">
                        <Clock className="w-2.5 h-2.5 text-slate-300" /> ~{doc.load * 10} Mins Wait
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${isSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-200'}`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Complete & route submit button */}
      <button 
        type="submit" 
        disabled={submitting}
        className="w-full py-3 bg-[#005EB8] hover:bg-[#004a96] text-white rounded-xl font-bold shadow-md shadow-blue-500/10 hover:shadow-blue-500/15 active:scale-98 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4 fill-white" />}
        {submitting ? 'Finalizing Intake...' : 'Finalize Intake & Route to Room'}
      </button>
    </form>
  );
}
