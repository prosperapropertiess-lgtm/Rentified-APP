const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://bsdnbmnfswwmzxqfdpsx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzZG5ibW5mc3d3bXp4cWZkcHN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcwMzA3MCwiZXhwIjoyMDk2Mjc5MDcwfQ.Zn_UbA3cyNt_5_fEWmyEfU1nSoRfGtwVR3vpRQ_7T8o';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findTina() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.log("Auth error:", error);
  } else {
    users.users.forEach(u => console.log(u.email));
  }
}
findTina();
