const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://reuekwbqdjtwqzpyqtuc.supabase.co';
const cleanUrl = rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'dummy_key';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || serviceKey;

const supabase = createClient(
  cleanUrl,
  serviceKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const supabasePublic = createClient(
  cleanUrl,
  anonKey
);

console.log('✅ Supabase connected:', cleanUrl);

module.exports = { supabase, supabasePublic, supabaseAdmin: supabase };
