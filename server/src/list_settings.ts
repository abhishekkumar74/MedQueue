import { db } from './db.js';

async function listSettings() {
  console.log('--- Listing system_settings ---');
  const { data, error } = await db
    .from('system_settings')
    .select('*');

  if (error) {
    console.error('Error fetching settings:', error.message);
  } else {
    console.log(data);
  }
}

listSettings();
