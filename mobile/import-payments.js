const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bsdnbmnfswwmzxqfdpsx.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzZG5ibW5mc3d3bXp4cWZkcHN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDcwMzA3MCwiZXhwIjoyMDk2Mjc5MDcwfQ.Zn_UbA3cyNt_5_fEWmyEfU1nSoRfGtwVR3vpRQ_7T8o');

async function run() {
  const { data: landlord } = await supabase.from('landlords').select('id, user_id').eq('email', 'homesbylah@gmail.com').single();
  const landlordId = landlord.id;
  
  const { data: units } = await supabase.from('units').select('id, rent_amount').eq('status', 'occupied');
  
  for (const unit of units) {
    await supabase.from('payments').insert([
      { landlord_id: landlordId, unit_id: unit.id, amount: unit.rent_amount, status: 'paid', type: 'rent' }
    ]);
  }
}
run();
