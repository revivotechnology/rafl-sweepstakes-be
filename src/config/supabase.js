const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error.message);
      process.exit(1);
    }
    
    console.log('✅ Supabase connected successfully');
  } catch (error) {
    console.error('Supabase connection test failed:', error.message);
    process.exit(1);
  }
};

module.exports = {
  supabase,
  testConnection
};
