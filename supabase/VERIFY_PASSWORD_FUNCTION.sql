-- Run this in Supabase SQL Editor
-- Enables bcrypt password verification from the browser

-- Enable pgcrypto extension (needed for crypt function)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to verify bcrypt password
CREATE OR REPLACE FUNCTION verify_password(password text, hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN hash = crypt(password, hash);
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION verify_password(text, text) TO anon, authenticated;
