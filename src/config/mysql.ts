/**
 * MySQL Configuration (DEPRECATED - Single Database is Supabase)
 * PAYTUNE uses Supabase as its single unified database.
 * This file is retained as a compatibility stub for clean migration.
 */

export async function getMysqlPool(): Promise<null> {
  return null;
}

export function isMysqlConnected(): boolean {
  return false;
}

export async function loadStateFromMysql(): Promise<null> {
  return null;
}

export async function saveStateToMysql(_state: any): Promise<boolean> {
  // Single database is Supabase only
  return true;
}
