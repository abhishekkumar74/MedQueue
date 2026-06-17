import { db } from './db';

async function checkColumns() {
  console.log('Querying hospitals with subscription_tier...');
  try {
    const { data: hospData, error: hospErr } = await db
      .from('hospitals')
      .select('id, name, slug, subscription_status, subscription_tier');
    
    if (hospErr) {
      console.log('Query with subscription_tier failed. This likely means the column is missing. Error:', hospErr.message);
    } else {
      console.log('Query with subscription_tier succeeded! Data:', hospData);
    }

    const { data: staffData, error: staffErr } = await db
      .from('staff_users')
      .select('id, name, email, role');
    
    if (staffErr) {
      console.log('Query on staff_users failed:', staffErr.message);
    } else {
      console.log('Staff users in DB count:', staffData?.length || 0, 'Data:', staffData);
    }
  } catch (err) {
    console.error('Diagnostics error:', err);
  }
}

checkColumns();

