import { db } from './db';

const defaultHospitals = [
  {
    id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    name: 'Apollo Clinic',
    slug: 'apollo',
    address: 'Apollo Street, Delhi',
    phone: '9999999991',
    subscription_status: 'ACTIVE'
  },
  {
    id: 'a4220b22-83b3-4f9e-a89e-cb01748ff002',
    name: 'Max Health',
    slug: 'max',
    address: 'Max Highway, Noida',
    phone: '9999999992',
    subscription_status: 'ACTIVE'
  },
  {
    id: '7e90a5fe-4b01-90c6-ff22-a701748f0222',
    name: 'City Hospital',
    slug: 'city',
    address: 'Central Sector, Gurugram',
    phone: '9999999993',
    subscription_status: 'ACTIVE'
  }
];

async function seed() {
  console.log('Seeding initial hospitals to database...');
  try {
    for (const hosp of defaultHospitals) {
      const { data, error } = await db
        .from('hospitals')
        .upsert(hosp, { onConflict: 'slug' })
        .select();

      if (error) {
        console.error(`Error seeding ${hosp.name}:`, error.message);
      } else {
        console.log(`Successfully seeded hospital: ${hosp.name}`, data);
      }
    }
  } catch (err) {
    console.error('Seeding crashed:', err);
  }
}

seed();
