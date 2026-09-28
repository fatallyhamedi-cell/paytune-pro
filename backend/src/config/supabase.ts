import { createClient } from '@supabase/supabase-js';
import { supabase as rootSupabase, supabaseAdmin as rootSupabaseAdmin } from '../../../src/config/supabase';

const url = process.env.SUPABASE_URL || 'https://reuekwbqdjtwqzpyqtuc.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

export const supabase: any = (serviceKey && serviceKey.startsWith('sb_secret_'))
  ? createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : (rootSupabaseAdmin || rootSupabase);

export const supabaseAdmin: any = supabase;
export default supabase;
