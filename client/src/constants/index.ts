import { Department, Priority } from '../types';

/**
 * MedQueue System-Wide Shared Constants
 * Consolidates enterprise presets, clinical specialties, and metadata mapping.
 */

export const DEPARTMENTS: Department[] = [
  'general',
  'cardiology',
  'orthopedics',
  'pediatrics',
  'gynecology',
  'neurology',
  'dermatology',
  'ent',
  'ophthalmology',
  'pharmacy'
];

export const DEPARTMENT_LABEL: Record<Department, string> = {
  general: 'General Medicine',
  cardiology: 'Cardiology (Heart)',
  orthopedics: 'Orthopedics (Bone)',
  pediatrics: 'Pediatrics (Child)',
  gynecology: 'Gynecology (Women)',
  neurology: 'Neurology (Brain)',
  dermatology: 'Dermatology (Skin)',
  ent: 'E.N.T (Ear/Nose/Throat)',
  ophthalmology: 'Ophthalmology (Eye)',
  pharmacy: 'Pharmacy Desk'
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  0: 'Emergency',
  1: 'Senior / Special',
  2: 'Normal'
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  0: 'bg-rose-500 text-white shadow-sm shadow-rose-500/10',
  1: 'bg-amber-100 text-amber-800 border border-amber-200',
  2: 'bg-emerald-100 text-emerald-800 border border-emerald-200'
};

export const PRIORITY_OPTIONS: { value: Priority; label: string; desc: string; color: string; dot: string }[] = [
  { value: 0, label: 'Emergency', desc: 'Life-threatening condition', color: 'border-red-400 bg-red-50 text-red-700', dot: 'bg-red-500' },
  { value: 1, label: 'Senior / Special', desc: 'Age 60+ or disability', color: 'border-amber-400 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { value: 2, label: 'Normal', desc: 'Regular consultation', color: 'border-emerald-400 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
];

export const MEDICINE_DIRECTORY = [
  'Paracetamol 500mg',
  'Amoxicillin 500mg',
  'Pantoprazole 40mg',
  'Metformin 500mg',
  'Amlodipine 5mg',
  'Ibuprofen 400mg',
  'Cetirizine 10mg',
  'Azithromycin 500mg',
  'Telmisartan 40mg',
  'Atorvastatin 10mg',
  'Domperidone 10mg',
  'Glimepiride 2mg',
  'Cough Syrup 100ml',
  'Multivitamin Capsule'
];

export const PRESCRIPTION_TEMPLATES: Record<string, { name: string; dosage: string; frequency: string; duration: string; instructions: string }[]> = {
  'Fever': [
    { name: 'Paracetamol 500mg', dosage: '1 tablet', frequency: '1-0-1 (Morning & Night)', duration: '5 days', instructions: 'After meals' },
    { name: 'Cetirizine 10mg', dosage: '1 tablet', frequency: '0-0-1 (Night Only)', duration: '3 days', instructions: 'Before sleep' }
  ],
  'Viral': [
    { name: 'Amoxicillin 500mg', dosage: '1 tablet', frequency: '1-0-1 (Morning & Night)', duration: '5 days', instructions: 'After meals' },
    { name: 'Paracetamol 500mg', dosage: '1 tablet', frequency: '1-1-1 (Morning, Afternoon & Night)', duration: '5 days', instructions: 'After meals' },
    { name: 'Cough Syrup 100ml', dosage: '10 ml', frequency: '1-1-1 (Morning, Afternoon & Night)', duration: '5 days', instructions: 'After meals' }
  ],
  'Gastric': [
    { name: 'Pantoprazole 40mg', dosage: '1 tablet', frequency: '1-0-0 (Morning Only)', duration: '10 days', instructions: 'Before meals (Empty stomach)' },
    { name: 'Domperidone 10mg', dosage: '1 tablet', frequency: '1-0-1 (Morning & Night)', duration: '5 days', instructions: 'Before meals' }
  ],
  'Migraine': [
    { name: 'Ibuprofen 400mg', dosage: '1 tablet', frequency: '1-0-1 (Morning & Night)', duration: '3 days', instructions: 'After meals' },
    { name: 'Pantoprazole 40mg', dosage: '1 tablet', frequency: '1-0-0 (Morning Only)', duration: '3 days', instructions: 'Empty stomach' }
  ],
  'BP Follow-up': [
    { name: 'Amlodipine 5mg', dosage: '1 tablet', frequency: '1-0-0 (Morning Only)', duration: '30 days', instructions: 'After breakfast' },
    { name: 'Telmisartan 40mg', dosage: '1 tablet', frequency: '0-0-1 (Night Only)', duration: '30 days', instructions: 'Before bed' }
  ],
  'Diabetes Follow-up': [
    { name: 'Metformin 500mg', dosage: '1 tablet', frequency: '1-0-1 (Morning & Night)', duration: '30 days', instructions: 'With meals' },
    { name: 'Glimepiride 2mg', dosage: '1 tablet', frequency: '1-0-0 (Morning Only)', duration: '30 days', instructions: 'Before breakfast' }
  ]
};

export const DIAGNOSIS_CHIPS = [
  'Acute Fever',
  'Viral Infection',
  'Gastroenteritis',
  'Migraine',
  'Hypertension',
  'Type 2 Diabetes',
  'General Weakness'
];
