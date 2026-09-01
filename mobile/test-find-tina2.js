const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://hwaroazxbzgmjjasgtdb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3YXJvYXp4YnpnbWpqYXNndGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDc4NzYsImV4cCI6MjA5MjUyMzg3Nn0.Y0ny9gXQXmWg84_m1BXDGCVrmBaZtl8VY_3Vgtz57RA');

async function findTina() {
  const { data: properties, error } = await supabase.from('properties').select('*');
  console.log("Properties:", properties, error);
}
findTina();
