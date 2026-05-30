import { db } from './db.js';

async function migrate() {
  console.log('Running database migration to update "city" slug to "citycare"...');
  try {
    const { data, error } = await db
      .from('hospitals')
      .update({ slug: 'citycare', name: 'City Hospital & Care' })
      .eq('slug', 'city')
      .select();

    if (error) {
      console.error('Error during migration:', error.message);
    } else {
      console.log('Migration successful! Updated rows:', data);
    }
  } catch (err) {
    console.error('Migration crashed:', err);
  }
}

migrate();
