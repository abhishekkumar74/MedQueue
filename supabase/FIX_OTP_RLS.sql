-- ================================================================
-- FIX OTP / QR / REFRESH TOKEN RLS POLICIES
-- Run this in Supabase SQL Editor to fix "row-level security" errors
-- ================================================================

-- ── OTP TABLE ────────────────────────────────────────────────────

-- Remove the blocking policy
DROP POLICY IF EXISTS "No direct OTP access" ON otps;

-- Allow insert (patient requests OTP from browser)
DROP POLICY IF EXISTS "Allow OTP insert" ON otps;
CREATE POLICY "Allow OTP insert" ON otps
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow select (patient verifies OTP)
DROP POLICY IF EXISTS "Allow OTP select" ON otps;
CREATE POLICY "Allow OTP select" ON otps
  FOR SELECT TO anon, authenticated
  USING (true);

-- Allow update (mark OTP as used)
DROP POLICY IF EXISTS "Allow OTP update" ON otps;
CREATE POLICY "Allow OTP update" ON otps
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Allow delete (clear old OTPs before inserting new one)
DROP POLICY IF EXISTS "Allow OTP delete" ON otps;
CREATE POLICY "Allow OTP delete" ON otps
  FOR DELETE TO anon, authenticated
  USING (true);

-- ── QR TOKENS TABLE ──────────────────────────────────────────────

DROP POLICY IF EXISTS "No direct QR token access" ON qr_tokens;

DROP POLICY IF EXISTS "Allow QR token insert" ON qr_tokens;
CREATE POLICY "Allow QR token insert" ON qr_tokens
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow QR token select" ON qr_tokens;
CREATE POLICY "Allow QR token select" ON qr_tokens
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow QR token update" ON qr_tokens;
CREATE POLICY "Allow QR token update" ON qr_tokens
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ── REFRESH TOKENS TABLE ─────────────────────────────────────────

DROP POLICY IF EXISTS "No direct refresh token access" ON refresh_tokens;

DROP POLICY IF EXISTS "Allow refresh token insert" ON refresh_tokens;
CREATE POLICY "Allow refresh token insert" ON refresh_tokens
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow refresh token select" ON refresh_tokens;
CREATE POLICY "Allow refresh token select" ON refresh_tokens
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow refresh token delete" ON refresh_tokens;
CREATE POLICY "Allow refresh token delete" ON refresh_tokens
  FOR DELETE TO anon, authenticated
  USING (true);

-- ── STAFF USERS TABLE ────────────────────────────────────────────
-- Allow anon to read staff_users (needed for login)
DROP POLICY IF EXISTS "Staff read record" ON staff_users;
CREATE POLICY "Staff read record" ON staff_users
  FOR SELECT TO anon, authenticated
  USING (true);
