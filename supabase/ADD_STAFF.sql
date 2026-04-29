-- ================================================================
-- ADD NEW STAFF MEMBER
-- Copy the relevant block below, fill in the details, and run
-- in Supabase SQL Editor.
-- Password for all accounts: Admin@1234
-- Hash: $2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
-- ================================================================
-- To use a DIFFERENT password:
--   1. Go to https://bcrypt-generator.com
--   2. Enter your password, rounds = 12
--   3. Copy the generated hash and replace the password_hash below
-- ================================================================


-- ── ADD A DOCTOR ─────────────────────────────────────────────────
-- Departments: general | cardiology | orthopedic | gynecology |
--              dermatology | pediatrics | neurology | ent | ophthalmology

INSERT INTO staff_users (name, email, password_hash, role, department, room_number, is_active)
VALUES (
  'Dr. Full Name',           -- change this
  'doctor.email@hospital.com', -- change this (must be unique)
  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Admin@1234
  'DOCTOR',
  'general',                 -- change department
  'Room 102',                -- change room number
  true
)
ON CONFLICT (email) DO NOTHING;

-- Also add to doctors table (for routing)
INSERT INTO doctors (staff_user_id, name, specialty, department, room_number, is_available)
SELECT id, 'Dr. Full Name', 'General Practitioner', 'general', 'Room 102', true
FROM staff_users WHERE email = 'doctor.email@hospital.com'
ON CONFLICT DO NOTHING;


-- ── ADD A WARD BOY ───────────────────────────────────────────────

INSERT INTO staff_users (name, email, password_hash, role, department, is_active)
VALUES (
  'Ward Boy Name',             -- change this
  'wardboy.email@hospital.com', -- change this (must be unique)
  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Admin@1234
  'WARD_BOY',
  'general',                   -- change department
  true
)
ON CONFLICT (email) DO NOTHING;


-- ── ADD PHARMACY STAFF ───────────────────────────────────────────

INSERT INTO staff_users (name, email, password_hash, role, is_active)
VALUES (
  'Pharmacy Staff Name',       -- change this
  'pharma.email@hospital.com', -- change this (must be unique)
  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Admin@1234
  'PHARMACY',
  true
)
ON CONFLICT (email) DO NOTHING;


-- ── ADD AN ADMIN ─────────────────────────────────────────────────

INSERT INTO staff_users (name, email, password_hash, role, is_active)
VALUES (
  'Admin Name',                -- change this
  'admin2@hospital.com',       -- change this (must be unique)
  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Admin@1234
  'ADMIN',
  true
)
ON CONFLICT (email) DO NOTHING;


-- ── DEACTIVATE A STAFF MEMBER (instead of deleting) ─────────────

-- UPDATE staff_users SET is_active = false WHERE email = 'someone@hospital.com';


-- ── VIEW ALL STAFF ───────────────────────────────────────────────

-- SELECT id, name, email, role, department, room_number, is_active
-- FROM staff_users
-- ORDER BY role, name;
