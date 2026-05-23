import { db } from './db';

async function checkSchema() {
  console.log('--- Checking hospitals columns ---');
  const { data: hospData, error: hospErr } = await db
    .from('hospitals')
    .select('*')
    .limit(1);

  if (hospErr) {
    console.error('Error fetching hospitals:', hospErr.message);
  } else {
    console.log('Successfully fetched hospital columns. Keys:', hospData && hospData.length > 0 ? Object.keys(hospData[0]) : 'No records');
  }

  console.log('\n--- Checking staff_users columns ---');
  const { data: staffData, error: staffErr } = await db
    .from('staff_users')
    .select('*')
    .limit(1);

  if (staffErr) {
    console.error('Error fetching staff_users:', staffErr.message);
  } else {
    console.log('Successfully fetched staff_users columns. Keys:', staffData && staffData.length > 0 ? Object.keys(staffData[0]) : 'No records');
  }
}

checkSchema();
