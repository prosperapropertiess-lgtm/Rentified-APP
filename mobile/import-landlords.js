const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bsdnbmnfswwmzxqfdpsx.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzZG5ibW5mc3d3bXp4cWZkcHN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcwMzA3MCwiZXhwIjoyMDk2Mjc5MDcwfQ.Zn_UbA3cyNt_5_fEWmyEfU1nSoRfGtwVR3vpRQ_7T8o');

const users = [
  { email: 'Pshaikh5683@gmail.com', first: 'Parvez' },
  { email: 'parveen@rentified.com', first: 'Parveen' },
  { email: 'randy.lendahand@gmail.com', first: 'Randy' },
  { email: 'homesbylah@gmail.com', first: 'Tina' }
];

async function run() {
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  
  for (const u of users) {
    const authUser = authUsers.users.find(au => au.email.toLowerCase() === u.email.toLowerCase());
    if (authUser) {
      const { error } = await supabase.from('landlords').insert({
        user_id: authUser.id,
        email: u.email,
        first_name: u.first,
        last_name: 'Owner'
      });
      if (!error) console.log(`Migrated ${u.first}`);
      else console.log(error.message);
    }
  }
}
run();
