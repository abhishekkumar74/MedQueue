import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('--- DIAGNOSTICS START ---');
  try {
    console.log('Attempting insert of test clinic...');
    const { data: insertData, error: insertErr } = await db
      .from('hospitals')
      .insert({
        name: 'Paras Hospital Test',
        slug: 'parashospitaltest',
        address: 'Darbhanga, Bihar',
        phone: '9876543212',
        subscription_status: 'ACTIVE',
        subscription_tier: 'Basic'
      })
      .select();

    if (insertErr) {
      console.error('INSERT FAILED! Error:', insertErr);
    } else {
      console.log('INSERT SUCCEEDED! Data:', insertData);
      // Clean it up immediately
      await db.from('hospitals').delete().eq('slug', 'parashospitaltest');
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
  console.log('--- DIAGNOSTICS END ---');
}

check();
