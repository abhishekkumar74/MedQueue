import { supabase } from './supabase'
import type {
  MQPatient,
  HospitalPatient,
  PatientRegistrationForm
} from '../types/mqid'

// ── Row mappers ───────────────────────────────────────────

export function mapMQPatient(row: any): MQPatient {
  return {
    id:              row.id,
    mqid:            row.mqid,
    authUserId:      row.auth_user_id,
    fullName:        row.full_name ?? '',
    phone:           row.phone ?? '',
    dob:             row.dob ?? null,
    gender:          row.gender ?? null,
    bloodGroup:      row.blood_group ?? null,
    profilePhotoUrl: row.profile_photo_url ?? null,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
    lastLoginAt:     row.last_login_at ?? null,
  }
}

export function mapHospitalPatient(row: any): HospitalPatient {
  return {
    id:               row.id,
    mqid:             row.mqid,
    hospitalId:       row.hospital_id,
    hospitalName:     row.hospital_name ?? null,
    localPatientNo:   row.local_patient_no ?? 0,
    localPrefix:      row.local_prefix ?? null,
    address:          row.address ?? null,
    city:             row.city ?? null,
    emergencyContact: row.emergency_contact ?? null,
    allergies:        row.allergies ?? [],
    chronicConditions: row.chronic_conditions ?? [],
    insuranceNo:      row.insurance_no ?? null,
    notes:            row.notes ?? null,
    isActive:         row.is_active ?? true,
    firstVisitAt:     row.first_visit_at,
    lastVisitAt:      row.last_visit_at,
    totalVisits:      row.total_visits ?? 1,
  }
}

// ── Core MQID operations ──────────────────────────────────

/**
 * Look up a patient by phone number in the global registry.
 * Returns null if not found.
 */
export async function lookupPatientByPhone(
  phone: string
): Promise<MQPatient | null> {
  const { data, error } = await supabase
    .from('mq_patients')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()

  if (error || !data) return null
  return mapMQPatient(data)
}

/**
 * Look up a patient by MQID.
 * Used when patient presents their card/ID at reception.
 */
export async function lookupPatientByMQID(
  mqid: string
): Promise<MQPatient | null> {
  const { data, error } = await supabase
    .from('mq_patients')
    .select('*')
    .eq('mqid', mqid)
    .maybeSingle()

  if (error || !data) return null
  return mapMQPatient(data)
}

/**
 * Get current logged-in patient's global profile.
 * Uses Supabase Auth session.
 */
export async function getCurrentPatient(): Promise<MQPatient | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('mq_patients')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error || !data) return null
  return mapMQPatient(data)
}

/**
 * Register a brand new patient into the global registry.
 * Called ONLY on first-ever registration.
 * Returns the generated MQID.
 */
export async function registerNewPatient(
  form: PatientRegistrationForm,
  authUserId: string
): Promise<{ mqid: string; patient: MQPatient }> {
  const { data, error } = await supabase
    .from('mq_patients')
    .insert({
      id:           (authUserId && authUserId.length === 36) ? authUserId : undefined,
      auth_user_id: (authUserId && authUserId.length === 36) ? authUserId : null,
      full_name:    form.fullName,
      phone:        form.phone,
      dob:          form.dob || null,
      gender:       form.gender || null,
      blood_group:  form.bloodGroup || null,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to register patient: ${error.message}`)
  const patient = mapMQPatient(data)
  return { mqid: patient.mqid, patient }
}

/**
 * Link Supabase auth.uid() to an existing patient record.
 * Called after OTP verification when patient already exists.
 */
export async function linkAuthToPatient(
  phone: string,
  authUserId: string
): Promise<MQPatient | null> {
  const { data, error } = await supabase
    .from('mq_patients')
    .update({
      auth_user_id: (authUserId && authUserId.length === 36) ? authUserId : null,
      last_login_at: new Date().toISOString(),
    })
    .eq('phone', phone)
    .select('*')
    .single()

  if (error || !data) return null
  return mapMQPatient(data)
}

/**
 * Get or create a hospital-specific patient profile.
 * Called every time a patient visits a new hospital.
 * Idempotent — safe to call multiple times.
 */
export async function getOrCreateHospitalProfile(
  mqid: string,
  hospitalId: string,
  hospitalName: string,
  localPrefix: string,
  formData?: Partial<PatientRegistrationForm>
): Promise<HospitalPatient> {
  // Check if profile already exists for this hospital
  const { data: existing } = await supabase
    .from('hospital_patients')
    .select('*')
    .eq('mqid', mqid)
    .eq('hospital_id', hospitalId)
    .maybeSingle()

  if (existing) {
    // Update last visit and increment visit count
    const { data: updated } = await supabase
      .from('hospital_patients')
      .update({
        last_visit_at: new Date().toISOString(),
        total_visits: existing.total_visits + 1,
        // Update address if provided
        ...(formData?.address && { address: formData.address }),
        ...(formData?.city && { city: formData.city }),
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    return mapHospitalPatient(updated ?? existing)
  }

  // Create new hospital profile
  const { data: created, error } = await supabase
    .from('hospital_patients')
    .insert({
      mqid,
      hospital_id:       hospitalId,
      hospital_name:     hospitalName,
      local_prefix:      localPrefix,
      address:           formData?.address ?? null,
      city:              formData?.city ?? null,
      emergency_contact: formData?.emergencyContact ?? null,
      allergies:         formData?.allergies ?? [],
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to create hospital profile: ${error.message}`)
  return mapHospitalPatient(created)
}

/**
 * Get patient's complete record at a specific hospital.
 * Used in doctor/staff view.
 */
export async function getPatientAtHospital(
  mqid: string,
  hospitalId: string
): Promise<{ global: MQPatient; hospitalProfile: HospitalPatient | null } | null> {
  const [globalRes, profileRes] = await Promise.all([
    supabase.from('mq_patients').select('*').eq('mqid', mqid).maybeSingle(),
    supabase.from('hospital_patients').select('*').eq('mqid', mqid).eq('hospital_id', hospitalId).maybeSingle(),
  ])

  if (!globalRes.data) return null

  return {
    global: mapMQPatient(globalRes.data),
    hospitalProfile: profileRes.data ? mapHospitalPatient(profileRes.data) : null,
  }
}

/**
 * Get all hospitals a patient has visited.
 * Used in patient's Health Vault cross-clinic view.
 */
export async function getPatientHospitalHistory(
  mqid: string
): Promise<HospitalPatient[]> {
  const { data, error } = await supabase
    .from('hospital_patients')
    .select('*')
    .eq('mqid', mqid)
    .order('last_visit_at', { ascending: false })

  if (error || !data) return []
  return data.map(mapHospitalPatient)
}

/**
 * Format MQID for display: MQ-2024-4821-7392
 * Validates the format before displaying.
 */
export function formatMQID(mqid: string): string {
  const parts = mqid.split('-')
  if (parts.length === 4 && parts[0] === 'MQ') {
    return mqid  // already formatted
  }
  return mqid.toUpperCase()
}

/**
 * Validate MQID format.
 */
export function isValidMQID(mqid: string): boolean {
  return /^MQ-\d{4}-\d{4}-\d{4}$/.test(mqid)
}
