const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://hwaroazxbzgmjjasgtdb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3YXJvYXp4YnpnbWpqYXNndGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDc4NzYsImV4cCI6MjA5MjUyMzg3Nn0.Y0ny9gXQXmWg84_m1BXDGCVrmBaZtl8VY_3Vgtz57RA';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findTina() {
  const { data: profiles, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.log("Profiles error:", error);
    const { data: users, err2 } = await supabase.from('users').select('*');
    console.log("Users:", users, err2);
  } else {
    console.log("Profiles:", profiles);
  }
}
findTina();
