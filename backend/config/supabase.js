const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
let supabaseUrl = (rawUrl || '').trim();
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
    if (supabaseUrl.includes('.')) {
      supabaseUrl = `https://${supabaseUrl}`;
    } else {
      supabaseUrl = `https://${supabaseUrl}.supabase.co`;
    }
  }
}

const allCandidates = [
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.SUPABASE_SERVICE_KEY,
  process.env.SUPABASE_ANON_KEY,
  process.env.VITE_SUPABASE_ANON_KEY,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  process.env.SUPABASE_KEY
].map(k => (typeof k === 'string' ? k.trim() : '')).filter(Boolean);

let serviceKey = allCandidates.find(k => k.startsWith('sb_secret_'));
let anonKey = allCandidates.find(k => k.startsWith('sb_publishable_'));

if (!serviceKey) serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!anonKey) anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// MUST use service_role key on the backend to bypass RLS policies
const supabaseKey = serviceKey || anonKey || 'placeholder-key';

const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

module.exports = {
  supabase,
  supabaseUrl,
  hasServiceRoleKey: !!serviceKey,
  hasUrl: !!supabaseUrl
};
