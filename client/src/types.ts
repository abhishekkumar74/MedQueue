export type TokenStatus = 'WAITING' | 'SERVING' | 'DONE' | 'NO_SHOW';
export type IntakeStatus = 'ARRIVED' | 'INTAKE_DONE' | 'READY_FOR_DOCTOR' | 'WITH_DOCTOR' | 'COMPLETED';
export type Priority = 0 | 1 | 2;

export type Department = 'general' | 'cardiology' | 'orthopedics' | 'pediatrics' | 'gynecology' | 'neurology' | 'dermatology' | 'ent' | 'ophthalmology' | 'pharmacy';

export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface TimeSlot {
  id: string;
  startTime: string;  // '09:00'
  endTime: string;    // '09:30'
  available: boolean;
  doctorId: string;
}

export interface Appointment {
  id: string;
  patient_id: string | null;
  phone: string;
  patient_name: string;
  department: Department;
  doctor_id: string | null;
  appointment_date: string;
  time_slot: string;
  status: AppointmentStatus;
  consultation_fee: number;
  created_at: string;
}

export interface Patient {
  id: string;
  phone: string;
  name: string;
  age: number;
  address: string;
  created_at: string;
}

export interface Token {
  id: string;
  phone: string;
  patient_id: string | null;
  status: TokenStatus;
  priority: Priority;
  token_number: number;
  intake_status: IntakeStatus;
  created_at: string;
  patients?: Patient | null;
  department?: Department;
  room_number?: string;
  doctor_name?: string;
}

export interface PatientIntake {
  id: string;
  token_id: string;
  patient_id: string;
  bp: string;
  sugar: string;
  temperature: string;
  symptoms: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Visit {
  id: string;
  patient_id: string;
  token_id: string;
  bp: string;
  sugar: string;
  symptoms: string;
  doctor_notes: string;
  created_at: string;
  tokens?: Token;
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  0: 'Emergency',
  1: 'Senior / Special',
  2: 'Normal',
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  0: 'bg-red-100 text-red-700 border-red-300',
  1: 'bg-amber-100 text-amber-700 border-amber-300',
  2: 'bg-emerald-100 text-emerald-700 border-emerald-300',
};

export const STATUS_COLOR: Record<TokenStatus, string> = {
  WAITING: 'bg-blue-100 text-blue-700',
  SERVING: 'bg-green-100 text-green-700',
  DONE: 'bg-gray-100 text-gray-600',
  NO_SHOW: 'bg-red-100 text-red-600',
};

export const INTAKE_STATUS_LABEL: Record<IntakeStatus, string> = {
  ARRIVED: 'Arrived',
  INTAKE_DONE: 'Intake Complete',
  READY_FOR_DOCTOR: 'Ready for Doctor',
  WITH_DOCTOR: 'With Doctor',
  COMPLETED: 'Completed',
};

export const INTAKE_STATUS_COLOR: Record<IntakeStatus, string> = {
  ARRIVED: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  INTAKE_DONE: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  READY_FOR_DOCTOR: 'bg-violet-100 text-violet-700 border-violet-300',
  WITH_DOCTOR: 'bg-green-100 text-green-700 border-green-300',
  COMPLETED: 'bg-gray-100 text-gray-600 border-gray-300',
};

export type PrescriptionStatus = 'PENDING' | 'IN_PROGRESS' | 'DISPENSED' | 'CANCELLED';

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity: number;
}

export interface Prescription {
  id: string;
  token_id: string;
  patient_id: string;
  visit_id: string;
  diagnosis: string;
  medications: Medication[];
  status: PrescriptionStatus;
  notes: string;
  created_at: string;
  dispensed_at: string | null;
  dispensed_by: string | null;
  tokens?: Token;
  patients?: Patient;
}

export const PRESCRIPTION_STATUS_LABEL: Record<PrescriptionStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  DISPENSED: 'Dispensed',
  CANCELLED: 'Cancelled',
};

export const PRESCRIPTION_STATUS_COLOR: Record<PrescriptionStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-300',
  DISPENSED: 'bg-green-100 text-green-700 border-green-300',
  CANCELLED: 'bg-red-100 text-red-600 border-red-300',
};

export const DEPARTMENT_LABEL: Record<Department, string> = {
  general: 'General',
  cardiology: 'Cardiology',
  orthopedics: 'Orthopedics',
  pediatrics: 'Pediatrics',
  gynecology: 'Gynecology',
  neurology: 'Neurology',
  dermatology: 'Dermatology',
  ent: 'ENT',
  ophthalmology: 'Ophthalmology',
  pharmacy: 'Pharmacy',
};
