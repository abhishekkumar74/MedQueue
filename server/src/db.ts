import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.\n' +
    'Copy server/.env.example to server/.env and fill in your credentials.'
  );
}

// Server uses the service role key — bypasses RLS, safe because it's never sent to the browser
export const db = createClient(supabaseUrl, supabaseKey);
