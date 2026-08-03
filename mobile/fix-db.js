const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
  console.log('Fetching users...');
  
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.log('Error listing users:', listError.message);
    return;
  }
  
  const user = users.users.find(u => u.email === 'ebinjaison123@gmail.com');
  if (!user) {
    console.log('User not found. Need to create user first.');
    return;
  }
  
  console.log('Found user:', user.id);
  
  const { data: landlord, error: llError } = await supabase
    .from('landlords')
    .select('*')
    .eq('user_id', user.id)
    .single();
    
  if (landlord) {
    console.log('Landlord profile already exists:', landlord);
  } else {
    console.log('Creating landlord profile...');
    const { data: newLl, error: insertErr } = await supabase
      .from('landlords')
      .insert({
        user_id: user.id,
        first_name: 'Ebin',
        last_name: 'Jaison',
        email: 'ebinjaison123@gmail.com'
      });
      
    if (insertErr) {
      console.log('Error inserting:', insertErr);
    } else {
      console.log('Success! Landlord profile created.');
    }
  }
}
fix();
