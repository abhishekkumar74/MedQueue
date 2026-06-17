import { createClient } from '@supabase/supabase-js';

const url = 'https://sfpmbjbnsvgfnspesmrn.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmcG1iamJuc3ZnZm5zcGVzbXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNzM2NTAsImV4cCI6MjA5Mjk0OTY1MH0.lVrFyK5p93BhlLDOxW8FMFxwWmPGIHqXYgoZfibSER4';

const client = createClient(url, anonKey);

async function test() {
  console.log('Testing client upsert...');
  const { data, error } = await client
    .from('system_settings')
    .upsert({
      key: 'test_key',
      value: { test: true }
    }, { onConflict: 'key' })
    .select();

  if (error) {
    console.error('ERROR during upsert:', error);
  } else {
    console.log('SUCCESS! Data:', data);
  }
}

test();
