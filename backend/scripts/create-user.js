require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createUser() {
  const email = 'admin@promptverse.com';
  const password = 'TestPassword123!';

  console.log(`[1/3] Creating user in Supabase Auth: ${email}`);
  
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already exists') || authError.message.includes('already been registered')) {
      console.log('User already exists in Auth. Fetching user details...');
      // To keep it simple, we might just fail here or fetch
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        console.error('Error listing users:', listError);
        process.exit(1);
      }
      const existingUser = users.find(u => u.email === email);
      if (existingUser) {
        console.log('Found existing user:', existingUser.id);
        await seedData(existingUser.id, email);
      }
      return;
    }
    console.error('Auth Creation Error:', authError.message);
    process.exit(1);
  }

  const user = authData.user;
  console.log(`User created successfully with ID: ${user.id}`);
  await seedData(user.id, email);
}

async function seedData(userId, email) {
  console.log(`[2/3] Seeding public.users table...`);
  const { error: userError } = await supabase
    .from('users')
    .upsert([{ id: userId, email: email }], { onConflict: 'id' });

  if (userError) {
    console.error('Error seeding public.users:', userError);
  } else {
    console.log('Successfully seeded public.users.');
  }

  console.log(`[3/3] Seeding public.wallets table...`);
  const { error: walletError } = await supabase
    .from('wallets')
    .upsert([{ user_id: userId, free_credits: 10, purchased_credits: 0 }], { onConflict: 'user_id' });

  if (walletError) {
    console.error('Error seeding public.wallets:', walletError);
  } else {
    console.log('Successfully seeded public.wallets.');
  }
}

createUser().catch(console.error);
