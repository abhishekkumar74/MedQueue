-- =====================================================================
-- MedQueue Enterprise Database Consolidation Script (Rebuild from Scratch)
-- Target: 8 Consolidated Tables (Optimized for Apple Health / ZocDoc Architecture)
-- =====================================================================

-- ── 1. Drop existing tables to start clean ──────────────────────────
DROP TABLE IF EXISTS active_sessions, activity_logs, app_logs, audit_log, auth_logs, crash_logs, security_events, security_logs, qr_tokens, patient_intake, tokens, prescriptions, appointments, visits, patients, mq_patients, hospital_patients, medicines, doctors, hospitals, otps, email_otps CASCADE;

-- ── 2. Enable UUID Extension ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 3. Table: hospitals (Tenants) ────────────────────────────────────
CREATE TABLE hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    address TEXT,
    subscription_status TEXT DEFAULT 'ACTIVE' CHECK (subscription_status IN ('ACTIVE', 'HOLD', 'SUSPENDED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 4. Table: patients (Unified Registry) ────────────────────────────
CREATE TABLE patients (
    id UUID PRIMARY KEY, -- Maps directly to auth.users.id
    mqid TEXT UNIQUE NOT NULL, -- Universal Patient ID (e.g. MQ-2026-XXXX-XXXX)
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

-- ── 5. Table: doctors (Practitioners) ────────────────────────────────
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    room_number TEXT,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ON_LEAVE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 6. Table: tokens (Queue Tickets + Embedded Vitals) ───────────────
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_number INTEGER, -- Auto-sequenced daily per hospital via trigger
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    phone TEXT NOT NULL,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    doctor_name TEXT,
    room_number TEXT,
    status TEXT DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'SERVING', 'COMPLETED', 'CANCELLED')),
    priority INTEGER DEFAULT 2 CHECK (priority IN (0, 1, 2)), -- 0: Emergency, 1: Senior, 2: Normal
    department TEXT NOT NULL,
    source TEXT DEFAULT 'walk_in' CHECK (source IN ('qr_scan', 'walk_in', 'online_booking')),
    intake_status TEXT DEFAULT 'ARRIVED' CHECK (intake_status IN ('ARRIVED', 'INTAKE_DONE', 'READY_FOR_DOCTOR', 'WITH_DOCTOR')),
    
    -- Triage Intake (Embedded)
    temperature NUMERIC CHECK (temperature > 0 AND temperature < 120),
    bp TEXT, -- e.g. "120/80"
    pulse INTEGER CHECK (pulse > 0 AND pulse < 300),
    oxygen INTEGER CHECK (oxygen >= 0 AND oxygen <= 100),
    weight NUMERIC CHECK (weight > 0),
    sugar INTEGER CHECK (sugar > 0),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 7. Table: medical_records (Unified Health Vault) ────────────────
CREATE TABLE medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('consultation', 'prescription', 'lab_report', 'appointment')),
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    doctor_name TEXT NOT NULL,
    title TEXT NOT NULL, -- e.g. "Consultation findings", "Diagnostic CBC Report"
    subtitle TEXT,      -- e.g. "Diagnosis: Migraine", "Lab Report"
    status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'COMPLETED', 'DISPENSED', 'VERIFIED', 'PENDING')),
    details JSONB DEFAULT '{}' NOT NULL, -- Holds context details (medications list, notes, symptoms, slots, fees)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 8. Table: medicines (Inventory Stock) ────────────────────────────
CREATE TABLE medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('tablet', 'syrup', 'capsule', 'injection', 'cream', 'drops')),
    formula TEXT,
    stock INTEGER DEFAULT 0 CHECK (stock >= 0),
    price NUMERIC DEFAULT 0 CHECK (price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 9. Table: system_logs (Centralized Logging Sink) ──────────────────
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

-- ── 10. Table: otps (Consolidated OTP Codes Verification) ────────────
CREATE TABLE otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target TEXT NOT NULL, -- Email or phone number string
    code TEXT NOT NULL,
    used BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================================
-- TRIGGERS: Auto-Sequencing Token Numbers Daily per Hospital
-- =====================================================================

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

CREATE TRIGGER trigger_generate_token_number
BEFORE INSERT ON tokens
FOR EACH ROW
WHEN (NEW.token_number IS NULL)
EXECUTE FUNCTION generate_daily_token_number();

-- =====================================================================
-- PERFORMANCE INDEXES (Optimized for Fast Lookups)
-- =====================================================================
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_mqid ON patients(mqid);
CREATE INDEX idx_patients_auth ON patients(auth_user_id);
CREATE INDEX idx_tokens_hospital_date ON tokens(hospital_id, created_at DESC);
CREATE INDEX idx_tokens_patient ON tokens(patient_id);
CREATE INDEX idx_tokens_status ON tokens(status);
CREATE INDEX idx_medical_records_patient ON medical_records(patient_id, event_date DESC);
CREATE INDEX idx_medical_records_type ON medical_records(patient_id, type);
CREATE INDEX idx_medicines_hospital ON medicines(hospital_id);
CREATE INDEX idx_system_logs_category ON system_logs(category, created_at DESC);
CREATE INDEX idx_otps_target ON otps(target, used);

-- =====================================================================
-- SECURITY: Row-Level Security (RLS) Policies
-- =====================================================================

-- Enable RLS
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE otps ENABLE ROW LEVEL SECURITY;

-- 1. Patients Policies
CREATE POLICY select_own_profile ON patients
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY insert_own_profile ON patients
    FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

CREATE POLICY update_own_profile ON patients
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- 2. Medical Records (Vault Timeline) Policies
CREATE POLICY select_own_health_records ON medical_records
    FOR SELECT USING (auth.uid() = patient_id);

-- 3. Tokens Queue Policies
CREATE POLICY select_all_live_tokens ON tokens
    FOR SELECT USING (true); -- Public/authenticated view of active queue tracking lists

CREATE POLICY insert_own_token ON tokens
    FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY update_own_token ON tokens
    FOR UPDATE USING (auth.uid() = patient_id);
