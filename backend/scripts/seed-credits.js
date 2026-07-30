require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedCredits() {
  const email = 'admin@promptverse.com';
  
  // Get user ID
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('Error fetching users:', authError);
    process.exit(1);
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    console.error('User not found!');
    process.exit(1);
  }

  const { error } = await supabase
    .from('wallets')
    .update({ 
      free_credits: 1000,
      last_free_reset_date: new Date().toISOString().split('T')[0]
    })
    .eq('user_id', user.id);

  if (error) {
    console.error('Failed to update credits:', error);
    process.exit(1);
  }

  console.log(`Successfully seeded 1000 credits for ${email} (ID: ${user.id})`);
}

seedCredits();
