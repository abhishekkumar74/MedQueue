-- =====================================================================
-- MedQueue Lossless Database Migration Script (Safe Consolidation)
-- =====================================================================

-- ── STEP 1: Rename current tables to temporary backup tables ──────────────────
-- We use ALTER TABLE ... RENAME TO to safely rename without data loss.

DO $$
BEGIN
    -- Rename patient tables
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'patients') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'patients_old') THEN
        ALTER TABLE patients RENAME TO patients_old;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'mq_patients') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'mq_patients_old') THEN
        ALTER TABLE mq_patients RENAME TO mq_patients_old;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'hospital_patients') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'hospital_patients_old') THEN
        ALTER TABLE hospital_patients RENAME TO hospital_patients_old;
    END IF;

    -- Rename queue/token tables
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tokens') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'tokens_old') THEN
        ALTER TABLE tokens RENAME TO tokens_old;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'qr_tokens') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'qr_tokens_old') THEN
        ALTER TABLE qr_tokens RENAME TO qr_tokens_old;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'patient_intake') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'patient_intake_old') THEN
        ALTER TABLE patient_intake RENAME TO patient_intake_old;
    END IF;

    -- Rename health details tables
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'visits') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'visits_old') THEN
        ALTER TABLE visits RENAME TO visits_old;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'prescriptions') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'prescriptions_old') THEN
        ALTER TABLE prescriptions RENAME TO prescriptions_old;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'appointments') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'appointments_old') THEN
        ALTER TABLE appointments RENAME TO appointments_old;
    END IF;

    -- Rename logging tables
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'activity_logs') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'activity_logs_old') THEN
        ALTER TABLE activity_logs RENAME TO activity_logs_old;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'crash_logs') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'crash_logs_old') THEN
        ALTER TABLE crash_logs RENAME TO crash_logs_old;
    END IF;

    -- Rename OTP tables
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'otps') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'otps_old') THEN
        ALTER TABLE otps RENAME TO otps_old;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'email_otps') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'email_otps_old') THEN
        ALTER TABLE email_otps RENAME TO email_otps_old;
    END IF;
END $$;

-- ── STEP 2: Create new consolidated schema ──────────────────────────────────
-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Hospitals (check if table exists, create if not)
CREATE TABLE IF NOT EXISTS hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    address TEXT,
    subscription_status TEXT DEFAULT 'ACTIVE' CHECK (subscription_status IN ('ACTIVE', 'HOLD', 'SUSPENDED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Doctors (check if table exists, create if not)
CREATE TABLE IF NOT EXISTS doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    room_number TEXT,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Unified Patients Table
CREATE TABLE patients (
    id UUID PRIMARY KEY,
    mqid TEXT UNIQUE NOT NULL,
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    dob DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    blood_group TEXT CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown')),
    address TEXT,
    city TEXT,
    emergency_contact TEXT,
    allergies TEXT[] DEFAULT '{}',
    chronic_conditions TEXT[] DEFAULT '{}',
    linked_hospital_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- Unified Tokens Table with Embedded Vitals
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_number INTEGER,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    phone TEXT NOT NULL,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    doctor_name TEXT,
    room_number TEXT,
    status TEXT DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'SERVING', 'COMPLETED', 'CANCELLED')),
    priority INTEGER DEFAULT 2 CHECK (priority IN (0, 1, 2)),
    department TEXT NOT NULL,
    source TEXT DEFAULT 'walk_in' CHECK (source IN ('qr_scan', 'walk_in', 'online_booking')),
    intake_status TEXT DEFAULT 'ARRIVED' CHECK (intake_status IN ('ARRIVED', 'INTAKE_DONE', 'READY_FOR_DOCTOR', 'WITH_DOCTOR')),
    temperature NUMERIC,
    bp TEXT,
    pulse INTEGER,
    oxygen INTEGER,
    weight NUMERIC,
    sugar INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Unified Medical Records Table
CREATE TABLE medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('consultation', 'prescription', 'lab_report', 'appointment')),
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    doctor_name TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'COMPLETED', 'DISPENSED', 'VERIFIED', 'PENDING')),
    details JSONB DEFAULT '{}' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Medicines Table (check if table exists, create if not)
CREATE TABLE IF NOT EXISTS medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('tablet', 'syrup', 'capsule', 'injection', 'cream', 'drops')),
    formula TEXT,
    stock INTEGER DEFAULT 0 CHECK (stock >= 0),
    price NUMERIC DEFAULT 0 CHECK (price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- System Logs Table
CREATE TABLE system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('auth', 'security', 'crash', 'audit', 'app')),
    actor_id UUID,
    actor_email TEXT,
    action TEXT NOT NULL,
    payload JSONB DEFAULT '{}' NOT NULL,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- OTPs Table
CREATE TABLE otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target TEXT NOT NULL,
    code TEXT NOT NULL,
    used BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── STEP 3: Lossless Data Migration (INSERT SELECT) ──────────────────────────

-- 1. Migrate patients from global mq_patients_old
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'mq_patients_old') THEN
        INSERT INTO patients (id, mqid, auth_user_id, name, phone, dob, gender, blood_group, address, city, emergency_contact, allergies, chronic_conditions, created_at, updated_at)
        SELECT 
            COALESCE(auth_user_id, id) as id,
            COALESCE(mqid, 'MQ-2026-' || substring(md5(random()::text) from 1 for 8)) as mqid,
            auth_user_id,
            full_name as name,
            phone,
            dob,
            gender,
            blood_group,
            address,
            city,
            emergency_contact,
            COALESCE(allergies, '{}') as allergies,
            '{}'::text[] as chronic_conditions,
            created_at,
            COALESCE(updated_at, created_at)
        FROM mq_patients_old
        ON CONFLICT (phone) DO NOTHING;
    END IF;
    
    -- Migrate remaining local patient accounts
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'patients_old') THEN
        INSERT INTO patients (id, mqid, auth_user_id, name, phone, created_at, updated_at)
        SELECT 
            id,
            'MQ-2026-' || substring(md5(random()::text) from 1 for 8) as mqid,
            auth_user_id,
            name,
            phone,
            created_at,
            created_at
        FROM patients_old
        ON CONFLICT (phone) DO NOTHING;
    END IF;
END $$;

-- 2. Migrate tokens queue with embedded vitals
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'tokens_old') THEN
        INSERT INTO tokens (id, token_number, hospital_id, patient_id, phone, doctor_id, doctor_name, room_number, status, priority, department, source, intake_status, temperature, bp, pulse, oxygen, weight, sugar, created_at, updated_at)
        SELECT 
            t.id,
            t.token_number,
            t.hospital_id,
            p.id as patient_id,
            t.phone,
            t.doctor_id,
            t.doctor_name,
            t.room_number,
            t.status,
            COALESCE(t.priority, 2) as priority,
            t.department,
            'walk_in' as source,
            CASE WHEN vi.id IS NOT NULL THEN 'INTAKE_DONE' ELSE 'ARRIVED' END as intake_status,
            vi.temperature,
            vi.bp,
            vi.pulse,
            vi.oxygen,
            vi.weight,
            vi.sugar,
            t.created_at,
            COALESCE(t.updated_at, t.created_at)
        FROM tokens_old t
        JOIN patients p ON p.phone = t.phone
        LEFT JOIN patient_intake_old vi ON vi.token_id = t.id
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 3. Migrate Medical Records (Vault Timeline)
-- Appointments ➔ Medical Records
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'appointments_old') THEN
        INSERT INTO medical_records (id, patient_id, hospital_id, type, event_date, doctor_name, title, subtitle, status, details, created_at)
        SELECT 
            id,
            patient_id,
            hospital_id,
            'appointment' as type,
            appointment_date::timestamp with time zone as event_date,
            COALESCE(doctor_name, 'General Consultant') as doctor_name,
            'Scheduled Appointment' as title,
            'Department: ' || department as subtitle,
            status,
            jsonb_build_object('time_slot', time_slot, 'fee', consultation_fee) as details,
            created_at
        FROM appointments_old;
    END IF;
END $$;

-- Visits ➔ Medical Records (Consultations)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'visits_old') THEN
        INSERT INTO medical_records (id, patient_id, hospital_id, type, event_date, doctor_name, title, subtitle, status, details, created_at)
        SELECT 
            id,
            patient_id,
            hospital_id,
            'consultation' as type,
            created_at as event_date,
            doctor_name,
            'Doctor Consultation Visit' as title,
            'Department: ' || department as subtitle,
            'COMPLETED' as status,
            jsonb_build_object(
                'symptoms', symptoms,
                'notes', doctor_notes,
                'temperature', temperature,
                'bp', bp,
                'pulse', pulse,
                'oxygen', oxygen,
                'sugar', sugar
            ) as details,
            created_at
        FROM visits_old;
    END IF;
END $$;

-- Prescriptions ➔ Medical Records
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'prescriptions_old') THEN
        INSERT INTO medical_records (id, patient_id, hospital_id, type, event_date, doctor_name, title, subtitle, status, details, created_at)
        SELECT 
            id,
            patient_id,
            hospital_id,
            'prescription' as type,
            created_at as event_date,
            doctor_name,
            'Digital Rx Prescription' as title,
            'Diagnosis: ' || COALESCE(diagnosis, 'General Routine') as subtitle,
            status,
            jsonb_build_object(
                'medications', medications,
                'diagnosis', diagnosis
            ) as details,
            created_at
        FROM prescriptions_old;
    END IF;
END $$;

-- 4. Migrate logs from activity_logs_old
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'activity_logs_old') THEN
        INSERT INTO system_logs (id, category, actor_id, actor_email, action, payload, severity, created_at)
        SELECT 
            id,
            'app' as category,
            actor_id,
            actor_email,
            action,
            payload,
            'info' as severity,
            created_at
        FROM activity_logs_old;
    END IF;
END $$;

-- 5. Migrate OTP codes
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'otps_old') THEN
        INSERT INTO otps (id, target, code, used, created_at)
        SELECT id, phone as target, code, used, created_at
        FROM otps_old;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'email_otps_old') THEN
        INSERT INTO otps (id, target, code, used, created_at)
        SELECT id, email as target, code, used, created_at
        FROM email_otps_old;
    END IF;
END $$;

-- ── STEP 4: Trigger daily token resets ──────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_daily_token_number()
RETURNS TRIGGER AS $$
DECLARE
    today_start TIMESTAMP;
    next_token INT;
BEGIN
    today_start := CURRENT_DATE;
    
    SELECT COALESCE(MAX(token_number), 0) + 1
    INTO next_token
    FROM tokens
    WHERE hospital_id = NEW.hospital_id
      AND created_at >= today_start;
      
    NEW.token_number := next_token;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_token_number ON tokens;
CREATE TRIGGER trigger_generate_token_number
BEFORE INSERT ON tokens
FOR EACH ROW
WHEN (NEW.token_number IS NULL)
EXECUTE FUNCTION generate_daily_token_number();

-- ── STEP 5: Index Optimizations ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_mqid ON patients(mqid);
CREATE INDEX IF NOT EXISTS idx_patients_auth ON patients(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_hospital_date ON tokens(hospital_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_patient ON tokens(patient_id);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status);
CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_medical_records_type ON medical_records(patient_id, type);
CREATE INDEX IF NOT EXISTS idx_medicines_hospital ON medicines(hospital_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otps_target ON otps(target, used);

-- ── STEP 6: Row-Level Security ──────────────────────────────────────────────
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE otps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_profile ON patients;
CREATE POLICY select_own_profile ON patients FOR SELECT USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS insert_own_profile ON patients;
CREATE POLICY insert_own_profile ON patients FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS update_own_profile ON patients;
CREATE POLICY update_own_profile ON patients FOR UPDATE USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS select_own_health_records ON medical_records;
CREATE POLICY select_own_health_records ON medical_records FOR SELECT USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS select_all_live_tokens ON tokens;
CREATE POLICY select_all_live_tokens ON tokens FOR SELECT USING (true);

DROP POLICY IF EXISTS insert_own_token ON tokens;
CREATE POLICY insert_own_token ON tokens FOR INSERT WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS update_own_token ON tokens;
CREATE POLICY update_own_token ON tokens FOR UPDATE USING (auth.uid() = patient_id);
