/**
 * Client API layer — calls Supabase directly using the anon key.
 * All database operations go through the Supabase JS client.
 * 
 * NOTE: If you want to use the Express server instead, set VITE_USE_SERVER=true
 * in client/.env and fill in server/.env with your SUPABASE_SERVICE_ROLE_KEY,
 * then run: npm run dev (starts both client + server)
 */
import { supabase } from './supabase';
import { todayStartUTC } from './dateUtils';
import { getCachedUser } from './auth';
import {
  lookupPatientByPhone,
  registerNewPatient,
  getOrCreateHospitalProfile,
} from './mqid';
import type { PatientRegistrationForm } from '../types/mqid';

// ─── TENANT ROUTING ──────────────────────────────────────────────────────────

export function getSelectedHospitalId(): string {
  const cachedUser = getCachedUser();
  if (cachedUser?.type === 'patient') {
    return localStorage.getItem('mq_selected_hospital_id') || 'd290f1ee-6c54-4b01-90e6-d701748f0851';
  }
  if (cachedUser?.role === 'SUPER_ADMIN') {
    return localStorage.getItem('mq_selected_hospital_id') || cachedUser.hospital_id || 'd290f1ee-6c54-4b01-90e6-d701748f0851';
  }
  if (cachedUser?.hospital_id) {
    return cachedUser.hospital_id;
  }
  return localStorage.getItem('mq_selected_hospital_id') || 'd290f1ee-6c54-4b01-90e6-d701748f0851'; // Fallback: Apollo Clinic
}

export function setSelectedHospitalId(id: string) {
  localStorage.setItem('mq_selected_hospital_id', id);
}

function getHospitalFilter() {
  return getSelectedHospitalId();
}

export async function registerToken(params: {
  phone: string;
  name?: string;
  age?: number;
  address?: string;
  hospitalId?: string;
  hospitalName?: string;
  localPrefix?: string;
  department?: string;
  priority?: 'normal' | 'senior' | 'emergency' | number;
}) {
  const {
    phone,
    name,
    age,
    address,
    hospitalId,
    hospitalName,
    localPrefix,
    department,
    priority = 2
  } = params;

  // 1. Resolve Hospital Info
  const resolvedHospitalId = hospitalId || getSelectedHospitalId();
  let resolvedHospitalName = hospitalName;
  let resolvedLocalPrefix = localPrefix;

  if (!resolvedHospitalName || !resolvedLocalPrefix) {
    try {
      const { data: hosp } = await supabase
        .from('hospitals')
        .select('name, slug')
        .eq('id', resolvedHospitalId)
        .maybeSingle();

      resolvedHospitalName = resolvedHospitalName || hosp?.name || 'MedQueue Clinic';
      resolvedLocalPrefix = resolvedLocalPrefix || hosp?.slug?.substring(0, 3).toUpperCase() || 'MQC';
    } catch (_) {
      resolvedHospitalName = resolvedHospitalName || 'MedQueue Clinic';
      resolvedLocalPrefix = resolvedLocalPrefix || 'MQC';
    }
  }

  // 2. Resolve Patient Identity (normalized phone)
  const normalizedPhone = phone.startsWith('+')
    ? phone
    : `+91${phone.replace(/\D/g, '')}`;

  let patient = await lookupPatientByPhone(normalizedPhone)
    ?? await lookupPatientByPhone(phone);

  if (!patient) {
    // Walk-in fallback registration
    const form: PatientRegistrationForm = {
      fullName:         name || 'Walk-in Patient',
      phone:            normalizedPhone,
      dob:              '',
      gender:           null,
      bloodGroup:       null,
      address:          address ?? '',
      city:             '',
      emergencyContact: '',
      allergies:        [],
    };

    let userSessionId = '';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      userSessionId = user?.id ?? '';
    } catch (_) {}

    const result = await registerNewPatient(form, userSessionId);
    patient = result.patient;
  }

  // 3. Ensure Hospital Profile Exists
  try {
    await getOrCreateHospitalProfile(
      patient.mqid,
      resolvedHospitalId,
      resolvedHospitalName!,
      resolvedLocalPrefix!,
      {
        fullName: name || patient.fullName,
        phone: normalizedPhone,
        address: address || '',
        city: ''
      }
    );
  } catch (err) {
    console.warn('Failed to ensure hospital patient profile exists:', err);
  }

  // 4. Sequence Token Number
  const todayStart = todayStartUTC();
  let tokenNumber = 1;
  try {
    const { data: lastToken } = await supabase
      .from('tokens')
      .select('token_number')
      .eq('hospital_id', resolvedHospitalId)
      .eq('department', department ?? '')
      .gte('created_at', todayStart)
      .order('token_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    tokenNumber = (lastToken?.token_number ?? 0) + 1;
  } catch (_) {}

  // 5. Map Priority Parameter
  let numericPriority: 0 | 1 | 2 = 2;
  if (typeof priority === 'number') {
    numericPriority = (priority === 0 || priority === 1 || priority === 2) ? priority : 2;
  } else if (priority === 'emergency') {
    numericPriority = 0;
  } else if (priority === 'senior') {
    numericPriority = 1;
  } else {
    numericPriority = 2;
  }

  // 6. Insert Token Scoped to Hospital + MQID
  const { data: token, error: te } = await supabase
    .from('tokens')
    .insert({
      phone:         normalizedPhone,
      patient_id:    patient.id,
      mqid:          patient.mqid,
      status:        'WAITING',
      priority:      numericPriority,
      token_number:  tokenNumber,
      intake_status: 'ARRIVED',
      department:    department ?? null,
      hospital_id:   resolvedHospitalId,
    })
    .select('*, patients(*)')
    .single();

  if (te) throw new Error(te.message);
  return { success: true, token, mqid: patient.mqid, patientId: patient.id };
}

// ─── QUEUE ───────────────────────────────────────────────────────────────────

export async function getQueue(department?: string) {
  const hospitalFilter = getHospitalFilter();

  let waitingQuery = supabase
    .from('tokens')
    .select('*, patients(*), patient_intake(*)')
    .eq('status', 'WAITING')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (hospitalFilter) {
    waitingQuery = waitingQuery.eq('hospital_id', hospitalFilter);
  }

  // Filter by department if provided (for doctor role)
  if (department) {
    waitingQuery = waitingQuery.eq('department', department);
  }

  const { data: waiting, error: we } = await waitingQuery;
  if (we) throw new Error(we.message);

  let servingQuery = supabase
    .from('tokens')
    .select('*, patients(*), patient_intake(*)')
    .eq('status', 'SERVING')
    .order('created_at', { ascending: false })
    .limit(1);

  if (hospitalFilter) {
    servingQuery = servingQuery.eq('hospital_id', hospitalFilter);
  }

  if (department) {
    servingQuery = servingQuery.eq('department', department);
  }

  const { data: serving } = await servingQuery.maybeSingle();

  return { waiting: waiting ?? [], serving: serving ?? null };
}

// ─── TOKEN STATUS ─────────────────────────────────────────────────────────────

export async function getTokenStatus(phone: string) {
  const todayStart = todayStartUTC();
  const hospitalFilter = getHospitalFilter();

  let tokenQuery = supabase
    .from('tokens').select('*, patients(*)')
    .eq('phone', phone)
    .gte('created_at', todayStart)
    .order('created_at', { ascending: false })
    .limit(1);

  if (hospitalFilter) {
    tokenQuery = tokenQuery.eq('hospital_id', hospitalFilter);
  }

  const { data: token } = await tokenQuery.maybeSingle();

  if (!token) return { token: null, ahead: 0 };

  let ahead = 0;
  if (token.status === 'WAITING') {
    let aheadQuery = supabase
      .from('tokens')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'WAITING')
      .or(`priority.lt.${token.priority},and(priority.eq.${token.priority},created_at.lt.${token.created_at})`);

    if (hospitalFilter) {
      aheadQuery = aheadQuery.eq('hospital_id', hospitalFilter);
    }
    const { count } = await aheadQuery;
    ahead = count ?? 0;
  }

  return { token, ahead };
}

// ─── CALL NEXT PATIENT ────────────────────────────────────────────────────────

export async function callNextPatient(department?: string) {
  const hospitalId = getSelectedHospitalId(); // Always call within current hospital context

  // Mark current serving patient as done (only in same department if filtered)
  let currentQuery = supabase
    .from('tokens').select('id').eq('status', 'SERVING').eq('hospital_id', hospitalId);
  if (department) currentQuery = currentQuery.eq('department', department);
  const { data: current } = await currentQuery.maybeSingle();

  if (current) {
    await supabase.from('tokens')
      .update({ status: 'DONE', intake_status: 'COMPLETED' })
      .eq('id', current.id);
  }

  let nextQuery = supabase
    .from('tokens').select('*')
    .eq('status', 'WAITING').eq('intake_status', 'READY_FOR_DOCTOR')
    .eq('hospital_id', hospitalId)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1);

  if (department) nextQuery = nextQuery.eq('department', department);

  const { data: next, error: ne } = await nextQuery.maybeSingle();

  if (ne) throw new Error(ne.message);
  if (!next) return { success: true, token: null, message: 'No patient ready for doctor' };

  const { data: updated, error: ue } = await supabase
    .from('tokens')
    .update({ status: 'SERVING', intake_status: 'WITH_DOCTOR' })
    .eq('id', next.id)
    .select('*, patients(*), patient_intake(*)')
    .single();

  if (ue) throw new Error(ue.message);
  return { success: true, token: updated };
}

// ─── MARK DONE / NO-SHOW ─────────────────────────────────────────────────────

export async function markTokenDone(id: string) {
  const hospitalId = getSelectedHospitalId();
  const { data, error } = await supabase
    .from('tokens')
    .update({ status: 'DONE', intake_status: 'COMPLETED' })
    .eq('id', id)
    .eq('hospital_id', hospitalId)
    .select().single();
  if (error) throw new Error(error.message);
  return { success: true, token: data };
}

export async function markTokenNoShow(id: string) {
  const hospitalId = getSelectedHospitalId();
  const { data, error } = await supabase
    .from('tokens')
    .update({ status: 'NO_SHOW', intake_status: 'COMPLETED' })
    .eq('id', id)
    .eq('hospital_id', hospitalId)
    .select().single();
  if (error) throw new Error(error.message);
  return { success: true, token: data };
}

// ─── INTAKE ───────────────────────────────────────────────────────────────────

export async function getIntakeByToken(tokenId: string) {
  const { data, error } = await supabase
    .from('patient_intake').select('*').eq('token_id', tokenId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function startIntake(tokenId: string) {
  const hospitalId = getSelectedHospitalId();
  const { data: token, error: te } = await supabase
    .from('tokens').select('patient_id, hospital_id').eq('id', tokenId).maybeSingle();
  if (te || !token) throw new Error('Token not found');
  if (!token.patient_id) throw new Error('Patient not linked to token');

  const { data: intake, error: ie } = await supabase
    .from('patient_intake')
    .insert({
      token_id: tokenId,
      patient_id: token.patient_id,
      hospital_id: token.hospital_id ?? hospitalId
    })
    .select().single();
  if (ie) throw new Error(ie.message);
  return { success: true, intake };
}

export async function updateIntake(id: string, form: {
  bp: string; sugar: string; temperature: string; symptoms: string; notes: string;
}) {
  const hospitalId = getSelectedHospitalId();
  const { data, error } = await supabase
    .from('patient_intake')
    .update({ ...form, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('hospital_id', hospitalId)
    .select().single();
  if (error) throw new Error(error.message);

  // Mark token as READY_FOR_DOCTOR
  await supabase.from('tokens')
    .update({ intake_status: 'READY_FOR_DOCTOR' })
    .eq('id', data.token_id)
    .eq('hospital_id', hospitalId);

  return { success: true, intake: data };
}

// ─── PRESCRIPTIONS ────────────────────────────────────────────────────────────

export async function createPrescription(params: {
  token_id: string;
  patient_id: string;
  diagnosis: string;
  medications: object[];
  doctor_notes?: string;
}) {
  const { token_id, patient_id, diagnosis, medications, doctor_notes } = params;
  const hospitalId = getSelectedHospitalId();

  const { data: intake } = await supabase
    .from('patient_intake').select('bp, sugar, symptoms')
    .eq('token_id', token_id).maybeSingle();

  const { data: visit, error: ve } = await supabase
    .from('visits')
    .insert({
      patient_id,
      token_id,
      bp: intake?.bp ?? '',
      sugar: intake?.sugar ?? '',
      symptoms: intake?.symptoms ?? '',
      doctor_notes: doctor_notes ?? '',
      hospital_id: hospitalId,
    })
    .select('id').single();
  if (ve) throw new Error(ve.message);

  const { data: prescription, error: pe } = await supabase
    .from('prescriptions')
    .insert({
      token_id,
      patient_id,
      visit_id: visit.id,
      diagnosis,
      medications,
      status: 'PENDING',
      notes: '',
      hospital_id: hospitalId,
    })
    .select().single();
  if (pe) throw new Error(pe.message);

  await supabase.from('tokens')
    .update({ status: 'DONE', intake_status: 'COMPLETED' })
    .eq('id', token_id);

  return { success: true, prescription };
}

export async function getPendingPrescriptions() {
  const hospitalFilter = getHospitalFilter();

  let query = supabase
    .from('prescriptions')
    .select('*, tokens(*), patients(*)')
    .in('status', ['PENDING', 'IN_PROGRESS'])
    .order('created_at', { ascending: true });

  if (hospitalFilter) {
    query = query.eq('hospital_id', hospitalFilter);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function dispensePrescription(id: string, dispensedBy = 'Pharmacy Staff') {
  const { data: current, error: ge } = await supabase
    .from('prescriptions').select('status').eq('id', id).single();
  if (ge) throw new Error(ge.message);
  if (current.status === 'DISPENSED') throw new Error('Already dispensed');
  if (current.status === 'CANCELLED') throw new Error('Cannot dispense cancelled prescription');

  const { data, error } = await supabase
    .from('prescriptions')
    .update({
      status: 'DISPENSED',
      dispensed_at: new Date().toISOString(),
      dispensed_by: dispensedBy,
    })
    .eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return { success: true, prescription: data };
}

// ─── APPOINTMENTS ─────────────────────────────────────────────────────────────

export async function bookAppointment(params: {
  phone: string;
  patient_name: string;
  department: string;
  doctor_id?: string;
  appointment_date: string;
  time_slot: string;
  consultation_fee?: number;
}) {
  const { phone, patient_name, department, doctor_id, appointment_date, time_slot, consultation_fee = 0 } = params;
  const hospitalId = getSelectedHospitalId();

  if (doctor_id) {
    const { data: existing } = await supabase
      .from('appointments').select('id')
      .eq('doctor_id', doctor_id)
      .eq('appointment_date', appointment_date)
      .eq('time_slot', time_slot)
      .eq('hospital_id', hospitalId)
      .maybeSingle();
    if (existing) throw new Error('Time slot already booked');
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: patient?.id ?? null,
      phone,
      patient_name,
      department,
      doctor_id: doctor_id ?? null,
      appointment_date,
      time_slot,
      status: 'SCHEDULED',
      consultation_fee,
      hospital_id: hospitalId,
    })
    .select().single();
  if (error) throw new Error(error.message);
  return { success: true, appointment: data };
}

export async function getAppointmentSlots(date: string, doctorId?: string) {
  const hospitalFilter = getHospitalFilter();

  let query = supabase
    .from('appointments').select('time_slot')
    .eq('appointment_date', date)
    .in('status', ['SCHEDULED', 'CONFIRMED']);

  if (hospitalFilter) {
    query = query.eq('hospital_id', hospitalFilter);
  }

  if (doctorId) query.eq('doctor_id', doctorId);

  const { data: booked } = await query;
  const bookedSlots = new Set((booked ?? []).map((a: { time_slot: string }) => a.time_slot));

  const slots = [];
  for (let hour = 9; hour < 17; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const startTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const endMin = min + 30;
      const endHour = endMin >= 60 ? hour + 1 : hour;
      const endTime = `${endHour.toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`;
      const slotStr = `${startTime}-${endTime}`;
      slots.push({ id: slotStr, startTime, endTime, available: !bookedSlots.has(slotStr), doctorId: doctorId ?? '' });
    }
  }
  return slots;
}

// ─── PATIENT HISTORY ──────────────────────────────────────────────────────────

export async function getPatientHistory(phone: string) {
  const hospitalFilter = getHospitalFilter();

  let patientQuery = supabase
    .from('patients').select('*').eq('phone', phone);

  const { data: patient } = await patientQuery.maybeSingle();

  if (!patient) return { patient: null, visits: [] };

  let visitsQuery = supabase
    .from('visits').select('*, tokens(*)')
    .eq('patient_id', patient.id)
    .order('created_at', { ascending: false });

  if (hospitalFilter) {
    visitsQuery = visitsQuery.eq('hospital_id', hospitalFilter);
  }

  const { data: visits } = await visitsQuery;

  return { patient, visits: visits ?? [] };
}
