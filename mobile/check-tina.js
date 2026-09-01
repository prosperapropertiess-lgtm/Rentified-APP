const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bsdnbmnfswwmzxqfdpsx.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzZG5ibW5mc3d3bXp4cWZkcHN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcwMzA3MCwiZXhwIjoyMDk2Mjc5MDcwfQ.Zn_UbA3cyNt_5_fEWmyEfU1nSoRfGtwVR3vpRQ_7T8o');

async function run() {
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const tinaAuth = authUsers.users.find(u => u.email === 'homesbylah@gmail.com');
  console.log("Tina Auth User ID:", tinaAuth?.id);

  const { data: landlord } = await supabase.from('landlords').select('*').eq('email', 'homesbylah@gmail.com');
  console.log("Tina Landlord Records:", JSON.stringify(landlord, null, 2));
}
run();
