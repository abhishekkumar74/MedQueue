import { createClient } from '@supabase/supabase-js';

const url = 'https://sfpmbjbnsvgfnspesmrn.supabase.co';
const serviceKey = 'sb_publishable_SXyJVPVKgh6xxAI2vaZ4Eg_1EHj-P2S'; 

const db = createClient(url, serviceKey);

async function run() {
  console.log('=== STARTING DATABASE OPERATIONS ===');
  
  // 1. Activate all staff and doctors in Apollo Clinic (d290f1ee-6c54-4b01-90e6-d701748f0851)
  const apolloId = 'd290f1ee-6c54-4b01-90e6-d701748f0851';
  
  console.log('Activating all staff users for Apollo Clinic...');
  const { error: staffErr } = await db
    .from('staff_users')
    .update({ is_active: true })
    .eq('hospital_id', apolloId);
    
  if (staffErr) {
    console.error('Failed to activate staff users:', staffErr);
  } else {
    console.log('Successfully activated all Apollo Clinic staff users!');
  }

  console.log('Activating all doctors for Apollo Clinic...');
  const { error: docErr } = await db
    .from('doctors')
    .update({ is_available: true })
    .eq('hospital_id', apolloId);

  if (docErr) {
    console.error('Failed to activate doctors:', docErr);
  } else {
    console.log('Successfully activated all Apollo Clinic doctors!');
  }

  // 2. Diagnostics: test insert a new staff member to see why registration fails
  console.log('Diagnosing staff_users insert...');
  const { data: testStaff, error: testStaffErr } = await db
    .from('staff_users')
    .insert({
      name: 'Diagnostic Test Staff',
      email: 'teststaff@diagnostic.com',
      password_hash: '$2a$10$x1swqRLVaF8w6nEAvRoM.uU9DUj49w9MQ0UrzHQ63SSiWj8Ht.v1.',
      role: 'WARD_BOY',
      department: 'general',
      is_active: true,
      hospital_id: apolloId
    })
    .select();

  if (testStaffErr) {
    console.error('Test staff insert failed:', testStaffErr);
  } else {
    console.log('Test staff insert succeeded:', testStaff);
    // Delete it right away
    await db.from('staff_users').delete().eq('email', 'teststaff@diagnostic.com');
  }

  console.log('=== DATABASE OPERATIONS COMPLETE ===');
}

run();
