import { supabase, supabaseAdmin, isSupabaseConfigured, supabaseProjectInfo } from '../config/supabase';
import * as schema from './schema';

export { supabase, supabaseAdmin, isSupabaseConfigured, supabaseProjectInfo, schema };

export const db = supabaseAdmin;
export default db;
