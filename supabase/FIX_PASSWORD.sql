-- ================================================================
-- FIX STAFF PASSWORDS
-- Run this in Supabase SQL Editor
-- This generates FRESH bcrypt hashes using Supabase's own crypt()
-- ================================================================

-- Make sure pgcrypto is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Recreate verify_password function (clean)
CREATE OR REPLACE FUNCTION verify_password(password text, hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN hash = crypt(password, hash);
END;
$$;
GRANT EXECUTE ON FUNCTION verify_password(text, text) TO anon, authenticated;

-- ── Update ALL existing staff passwords to Admin@1234 ────────────
-- Uses crypt() to generate a proper hash right here in Supabase
UPDATE staff_users
SET password_hash = crypt('Admin@1234', gen_salt('bf', 10))
WHERE is_active = true;

-- ── Verify it worked ─────────────────────────────────────────────
SELECT 
  name,
  email, 
  role,
  verify_password('Admin@1234', password_hash) AS login_works
FROM staff_users
ORDER BY role, name;
