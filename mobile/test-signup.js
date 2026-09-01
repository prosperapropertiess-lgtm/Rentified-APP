const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.auth.signUp({
    email: 'investor123@rentified.com',
    password: 'Password123!'
  });
  console.log('SignUp Error:', error?.message);
  console.log('SignUp Data:', !!data?.user);
}
test();
