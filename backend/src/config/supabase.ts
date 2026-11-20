import { createClient } from '@supabase/supabase-js';
import {
  supabase as rootSupabase,
  supabaseAdmin as rootSupabaseAdmin,
  sanitizeSupabaseUrl,
  resolveSupabaseKeys,
} from '../../../src/config/supabase';

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const { serviceKey } = resolveSupabaseKeys();
const cleanUrl = rawUrl ? sanitizeSupabaseUrl(rawUrl) : '';

export const supabase: any =
  cleanUrl && serviceKey && serviceKey.startsWith('sb_secret_') && rootSupabaseAdmin
    ? rootSupabaseAdmin
    : cleanUrl && serviceKey
      ? createClient(cleanUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : (rootSupabaseAdmin || rootSupabase);

export const supabaseAdmin: any = rootSupabaseAdmin || supabase;
export default supabase;
