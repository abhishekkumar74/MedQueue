import { db } from './db';

async function tryRPC() {
  console.log('Testing RPC execution...');
  try {
    const { data, error } = await db.rpc('exec_sql', {
      query: 'ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT \'Basic\';'
    });
    if (error) {
      console.log('RPC exec_sql does not exist or failed:', error.message);
    } else {
      console.log('RPC exec_sql succeeded! Data:', data);
    }
  } catch (err) {
    console.error('RPC crashed:', err);
  }
}

tryRPC();
