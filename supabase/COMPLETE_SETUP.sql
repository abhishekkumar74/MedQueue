-- ================================================================
-- MedQueue — COMPLETE DATABASE SETUP
-- Run this ONE TIME in Supabase SQL Editor
-- It is safe to run again (uses IF NOT EXISTS everywhere)
-- ================================================================
-- Password for ALL default accounts: Admin@1234
-- ================================================================


-- ════════════════════════════════════════════════════════════════
-- SECTION 1: CORE TABLES (patients, tokens, visits)
-- ════════════════════════════════════════════════════════════════

-- PATIENTS
CREATE TABLE IF NOT EXISTS patients (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      text        UNIQUE NOT NULL,
  name       text        NOT NULL DEFAULT '',
  age        integer     DEFAULT 0,
  address    text        DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "patients_select" ON patients FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "patients_insert" ON patients FOR INSERT TO anon, authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "patients_update" ON patients FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TOKENS
CREATE TABLE IF NOT EXISTS tokens (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        text        NOT NULL,
  patient_id   uuid        REFERENCES patients(id),
  status       text        NOT NULL DEFAULT 'WAITING'
                           CHECK (status IN ('WAITING','SERVING','DONE','NO_SHOW')),
  priority     integer     NOT NULL DEFAULT 2
                           CHECK (priority IN (0,1,2)),
  token_number integer     NOT NULL DEFAULT 1,
  intake_status text       NOT NULL DEFAULT 'ARRIVED'
                           CHECK (intake_status IN ('ARRIVED','INTAKE_DONE','READY_FOR_DOCTOR','WITH_DOCTOR','COMPLETED')),
  department   text,
  room_number  text,
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "tokens_select" ON tokens FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "tokens_insert" ON tokens FOR INSERT TO anon, authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "tokens_update" ON tokens FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- VISITS
CREATE TABLE IF NOT EXISTS visits (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   uuid        NOT NULL REFERENCES patients(id),
  token_id     uuid        NOT NULL REFERENCES tokens(id),
  bp           text        DEFAULT '',
  sugar        text        DEFAULT '',
  symptoms     text        DEFAULT '',
  doctor_notes text        DEFAULT '',
  created_at   timestamptz DEFAULT now()
);
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "visits_select" ON visits FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "visits_insert" ON visits FOR INSERT TO anon, authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "visits_update" ON visits FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════
-- SECTION 2: PATIENT INTAKE (ward boy fills vitals)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS patient_intake (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id     uuid        NOT NULL REFERENCES tokens(id),
  patient_id   uuid        NOT NULL REFERENCES patients(id),
  bp           text        DEFAULT '',
  sugar        text        DEFAULT '',
  temperature  text        DEFAULT '',
  symptoms     text        DEFAULT '',
  notes        text        DEFAULT '',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
ALTER TABLE patient_intake ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "intake_select" ON patient_intake FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "intake_insert" ON patient_intake FOR INSERT TO anon, authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "intake_update" ON patient_intake FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════
-- SECTION 3: PRESCRIPTIONS (doctor writes → pharmacy dispenses)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prescriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id     uuid        NOT NULL REFERENCES tokens(id),
  patient_id   uuid        NOT NULL REFERENCES patients(id),
  visit_id     uuid        NOT NULL REFERENCES visits(id),
  diagnosis    text        NOT NULL DEFAULT '',
  medications  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  status       text        NOT NULL DEFAULT 'PENDING'
                           CHECK (status IN ('PENDING','IN_PROGRESS','DISPENSED','CANCELLED')),
  notes        text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  dispensed_at timestamptz,
  dispensed_by text
);
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "rx_select" ON prescriptions FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "rx_insert" ON prescriptions FOR INSERT TO anon, authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "rx_update" ON prescriptions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════
-- SECTION 4: APPOINTMENTS (patient books time slot)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS appointments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid        REFERENCES patients(id),
  phone            text        NOT NULL,
  patient_name     text        NOT NULL,
  department       text        NOT NULL,
  doctor_id        text,
  appointment_date date        NOT NULL,
  time_slot        text        NOT NULL,
  status           text        NOT NULL DEFAULT 'SCHEDULED'
                               CHECK (status IN ('SCHEDULED','CONFIRMED','COMPLETED','CANCELLED')),
  consultation_fee numeric     NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "appt_select" ON appointments FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "appt_insert" ON appointments FOR INSERT TO anon, authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "appt_update" ON appointments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_appt_doctor_date_slot
  ON appointments (doctor_id, appointment_date, time_slot)
  WHERE doctor_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════════
-- SECTION 5: STAFF AUTH (login, roles, OTP, QR)
-- ════════════════════════════════════════════════════════════════

-- Staff role enum
DO $$ BEGIN
  CREATE TYPE staff_role AS ENUM ('ADMIN', 'DOCTOR', 'WARD_BOY', 'PHARMACY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- STAFF USERS
CREATE TABLE IF NOT EXISTS staff_users (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  email         text        UNIQUE NOT NULL,
  phone         text,
  password_hash text        NOT NULL,
  role          staff_role  NOT NULL DEFAULT 'WARD_BOY',
  department    text,        -- 'general' | 'cardiology' | 'orthopedic' | etc.
  room_number   text,        -- 'Room 101' (for doctors)
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "staff_select" ON staff_users FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DOCTORS (linked to staff_users)
CREATE TABLE IF NOT EXISTS doctors (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid        NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  specialty     text        NOT NULL,
  department    text        NOT NULL,
  room_number   text,
  is_available  boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "doctors_select" ON doctors FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OTP TABLE (patient phone login)
CREATE TABLE IF NOT EXISTS otps (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      text        NOT NULL,
  code       text        NOT NULL,
  expires_at timestamptz NOT NULL,
  used       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE otps ENABLE ROW LEVEL SECURITY;
-- OTP must be open so patients can request/verify from browser
DO $$ BEGIN CREATE POLICY "otp_insert" ON otps FOR INSERT TO anon, authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "otp_select" ON otps FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "otp_update" ON otps FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "otp_delete" ON otps FOR DELETE TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- QR TOKENS (patient quick login via QR scan)
CREATE TABLE IF NOT EXISTS qr_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  token      text        NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE qr_tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "qr_insert" ON qr_tokens FOR INSERT TO anon, authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "qr_select" ON qr_tokens FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- REFRESH TOKENS
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid        REFERENCES staff_users(id) ON DELETE CASCADE,
  patient_id    uuid        REFERENCES patients(id) ON DELETE CASCADE,
  token_hash    text        NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_owner CHECK (
    (staff_user_id IS NOT NULL AND patient_id IS NULL) OR
    (staff_user_id IS NULL AND patient_id IS NOT NULL)
  )
);
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "rt_insert" ON refresh_tokens FOR INSERT TO anon, authenticated WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "rt_select" ON refresh_tokens FOR SELECT TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "rt_delete" ON refresh_tokens FOR DELETE TO anon, authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add doctor_id to tokens and visits (safe if already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tokens' AND column_name='doctor_id') THEN
    ALTER TABLE tokens ADD COLUMN doctor_id uuid REFERENCES doctors(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='visits' AND column_name='doctor_id') THEN
    ALTER TABLE visits ADD COLUMN doctor_id uuid REFERENCES doctors(id);
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════
-- SECTION 6: PASSWORD VERIFICATION FUNCTION (bcrypt)
-- ════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION verify_password(password text, hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN hash = crypt(password, hash);
END;
$$;

GRANT EXECUTE ON FUNCTION verify_password(text, text) TO anon, authenticated;


-- ════════════════════════════════════════════════════════════════
-- SECTION 7: INDEXES (performance)
-- ════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tokens_queue          ON tokens (priority ASC, created_at ASC) WHERE status = 'WAITING';
CREATE INDEX IF NOT EXISTS idx_tokens_status         ON tokens (status);
CREATE INDEX IF NOT EXISTS idx_tokens_department     ON tokens (department);
CREATE INDEX IF NOT EXISTS idx_patients_phone        ON patients (phone);
CREATE INDEX IF NOT EXISTS idx_tokens_phone          ON tokens (phone);
CREATE INDEX IF NOT EXISTS idx_visits_patient        ON visits (patient_id);
CREATE INDEX IF NOT EXISTS idx_intake_token          ON patient_intake (token_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status  ON prescriptions (status);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created ON prescriptions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_email           ON staff_users (email);
CREATE INDEX IF NOT EXISTS idx_staff_role            ON staff_users (role);
CREATE INDEX IF NOT EXISTS idx_doctors_dept          ON doctors (department);
CREATE INDEX IF NOT EXISTS idx_otps_phone            ON otps (phone);
CREATE INDEX IF NOT EXISTS idx_qr_token              ON qr_tokens (token);


-- ════════════════════════════════════════════════════════════════
-- SECTION 8: STAFF ACCOUNTS
-- ════════════════════════════════════════════════════════════════
-- HOW TO ADD NEW STAFF:
--   Just copy any line below and change: name, email, role, department, room_number
--   crypt('Admin@1234', gen_salt('bf',10)) automatically makes the correct password hash
--
-- HOW TO REMOVE STAFF:
--   Run in SQL Editor: DELETE FROM staff_users WHERE email = 'someone@hospital.com';
--   Or deactivate:     UPDATE staff_users SET is_active = false WHERE email = '...';
--
-- ROLES:   'ADMIN' | 'DOCTOR' | 'WARD_BOY' | 'PHARMACY'
-- DEPTS:   'general' | 'cardiology' | 'orthopedic' | 'gynecology' | 'dermatology'
--          'pediatrics' | 'neurology' | 'ent' | 'ophthalmology'
-- ════════════════════════════════════════════════════════════════

-- Make sure pgcrypto is ready for crypt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── ADMIN ────────────────────────────────────────────────────────
INSERT INTO staff_users (name, email, password_hash, role, is_active) VALUES
  ('Hospital Admin', 'admin@hospital.com', crypt('Admin@1234', gen_salt('bf',10)), 'ADMIN', true)
ON CONFLICT (email) DO UPDATE SET password_hash = crypt('Admin@1234', gen_salt('bf',10)), is_active = true;

-- ── DOCTORS ──────────────────────────────────────────────────────
-- Format: ('Name', 'email', crypt('password', gen_salt('bf',10)), 'DOCTOR', 'department', 'Room X', true)
INSERT INTO staff_users (name, email, password_hash, role, department, room_number, is_active) VALUES
  ('Dr. Amit Sharma',    'dr.general@hospital.com',     crypt('Admin@1234', gen_salt('bf',10)), 'DOCTOR', 'general',     'Room 101', true),
  ('Dr. Priya Verma',    'dr.cardiology@hospital.com',  crypt('Admin@1234', gen_salt('bf',10)), 'DOCTOR', 'cardiology',  'Room 201', true),
  ('Dr. Rajesh Singh',   'dr.orthopedic@hospital.com',  crypt('Admin@1234', gen_salt('bf',10)), 'DOCTOR', 'orthopedic',  'Room 301', true),
  ('Dr. Neha Gupta',     'dr.gynecology@hospital.com',  crypt('Admin@1234', gen_salt('bf',10)), 'DOCTOR', 'gynecology',  'Room 401', true),
  ('Dr. Arjun Mehta',    'dr.dermatology@hospital.com', crypt('Admin@1234', gen_salt('bf',10)), 'DOCTOR', 'dermatology', 'Room 501', true),
  ('Dr. Muskan Kumari',  'dr.muskan@hospital.com',      crypt('Admin@1234', gen_salt('bf',10)), 'DOCTOR', 'general',     'Room 102', true)
  -- ↑ ADD NEW DOCTOR HERE — copy the line above, change name/email/department/room
ON CONFLICT (email) DO UPDATE SET password_hash = crypt('Admin@1234', gen_salt('bf',10)), is_active = true;

-- ── WARD BOYS ────────────────────────────────────────────────────
-- Format: ('Name', 'email', crypt('password', gen_salt('bf',10)), 'WARD_BOY', 'department', true)
INSERT INTO staff_users (name, email, password_hash, role, department, is_active) VALUES
  ('Suresh (Ward Boy)', 'wb.general@hospital.com',    crypt('Admin@1234', gen_salt('bf',10)), 'WARD_BOY', 'general',    true),
  ('Ravi (Ward Boy)',   'wb.cardiology@hospital.com', crypt('Admin@1234', gen_salt('bf',10)), 'WARD_BOY', 'cardiology', true),
  ('Mohan (Ward Boy)',  'wb.orthopedic@hospital.com', crypt('Admin@1234', gen_salt('bf',10)), 'WARD_BOY', 'orthopedic', true)
  -- ↑ ADD NEW WARD BOY HERE
ON CONFLICT (email) DO UPDATE SET password_hash = crypt('Admin@1234', gen_salt('bf',10)), is_active = true;

-- ── PHARMACY ─────────────────────────────────────────────────────
-- Format: ('Name', 'email', crypt('password', gen_salt('bf',10)), 'PHARMACY', true)
INSERT INTO staff_users (name, email, password_hash, role, is_active) VALUES
  ('Pharmacy Staff 1', 'pharma1@hospital.com', crypt('Admin@1234', gen_salt('bf',10)), 'PHARMACY', true),
  ('Pharmacy Staff 2', 'pharma2@hospital.com', crypt('Admin@1234', gen_salt('bf',10)), 'PHARMACY', true)
  -- ↑ ADD NEW PHARMACY STAFF HERE
ON CONFLICT (email) DO UPDATE SET password_hash = crypt('Admin@1234', gen_salt('bf',10)), is_active = true;

-- ── Link all doctors to doctors table (for routing) ──────────────
INSERT INTO doctors (staff_user_id, name, specialty, department, room_number, is_available)
SELECT id, name,
  CASE department
    WHEN 'general'     THEN 'General Practitioner'
    WHEN 'cardiology'  THEN 'Cardiologist'
    WHEN 'orthopedic'  THEN 'Orthopedic Surgeon'
    WHEN 'gynecology'  THEN 'Gynecologist'
    WHEN 'dermatology' THEN 'Dermatologist'
    WHEN 'pediatrics'  THEN 'Pediatrician'
    WHEN 'neurology'   THEN 'Neurologist'
    WHEN 'ent'         THEN 'ENT Specialist'
    ELSE 'Specialist'
  END,
  department, room_number, true
FROM staff_users
WHERE role = 'DOCTOR' AND is_active = true
ON CONFLICT DO NOTHING;


-- ════════════════════════════════════════════════════════════════
-- DONE! Run this file in Supabase SQL Editor.
-- ════════════════════════════════════════════════════════════════
--
-- LOGIN CREDENTIALS (password: Admin@1234):
--
--   ADMIN    → admin@hospital.com
--   DOCTORS  → dr.general@hospital.com      (General,     Room 101)
--              dr.cardiology@hospital.com   (Cardiology,  Room 201)
--              dr.orthopedic@hospital.com   (Orthopedic,  Room 301)
--              dr.gynecology@hospital.com   (Gynecology,  Room 401)
--              dr.dermatology@hospital.com  (Dermatology, Room 501)
--              dr.muskan@hospital.com       (General,     Room 102)  ← NEW
--   WARD BOY → wb.general@hospital.com
--              wb.cardiology@hospital.com
--              wb.orthopedic@hospital.com
--   PHARMACY → pharma1@hospital.com
--              pharma2@hospital.com
--
-- ════════════════════════════════════════════════════════════════
