const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bsdnbmnfswwmzxqfdpsx.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzZG5ibW5mc3d3bXp4cWZkcHN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcwMzA3MCwiZXhwIjoyMDk2Mjc5MDcwfQ.Zn_UbA3cyNt_5_fEWmyEfU1nSoRfGtwVR3vpRQ_7T8o');

async function checkData() {
  const { data: landlords } = await supabase.from('landlords').select('*');
  console.log("Landlords:", landlords);
  const { data: tenants } = await supabase.from('tenants').select('*');
  console.log("Tenants:", tenants);
}
checkData();
