// ── Global patient identity ───────────────────────────────
export interface MQPatient {
  id: string
  mqid: string                 // e.g. "MQ-2024-4821-7392"
  authUserId: string | null    // Supabase auth.uid()
  fullName: string
  phone: string
  dob: string | null           // ISO date "1990-05-21"
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown' | null
  profilePhotoUrl: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

// ── Per-hospital patient profile ─────────────────────────
export interface HospitalPatient {
  id: string
  mqid: string                 // FK → mq_patients.mqid
  hospitalId: string           // FK → hospitals.id
  hospitalName: string | null
  localPatientNo: number       // hospital's own sequential number
  localPrefix: string | null   // e.g. "APL", "RBM"
  address: string | null
  city: string | null
  emergencyContact: string | null
  allergies: string[]
  chronicConditions: string[]
  insuranceNo: string | null
  notes: string | null
  isActive: boolean
  firstVisitAt: string
  lastVisitAt: string
  totalVisits: number
}

// ── Combined view (patient + their profile at current hospital)
export interface PatientWithHospitalProfile {
  global: MQPatient
  hospitalProfile: HospitalPatient | null
}

// ── Registration form data ────────────────────────────────
export interface PatientRegistrationForm {
  fullName: string
  phone: string
  dob: string
  gender: MQPatient['gender']
  bloodGroup: MQPatient['bloodGroup']
  address: string
  city: string
  emergencyContact: string
  allergies: string[]
}
