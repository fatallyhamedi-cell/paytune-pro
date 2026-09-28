import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const rawUrl = (env.VITE_SUPABASE_URL as string) || '';
const rawAnonKey = (env.VITE_SUPABASE_ANON_KEY as string) || '';

let supabaseUrl = rawUrl;
if (supabaseUrl && !supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`;
}

if (!supabaseUrl || !rawAnonKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(
  supabaseUrl || 'https://reuekwbqdjtwqzpyqtuc.supabase.co',
  rawAnonKey || 'sb_publishable_reuekwbqdjtwqzpyqtuc'
);

export default supabase;
