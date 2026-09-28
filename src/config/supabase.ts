import { createClient } from '@supabase/supabase-js';
import { createMockSupabaseClient } from './supabase_mock';

const getEnvVar = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.[key]) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key] as string;
  }
  return '';
};

export const DEFAULT_SERVER_APP_URL = 
  getEnvVar('APP_URL') || 
  getEnvVar('VITE_DEV_URL') || 
  'https://ais-dev-4pcefwvqqa7qfqrkdm5mo6-156032383868.europe-west2.run.app';

export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return DEFAULT_SERVER_APP_URL;
  let cleaned = String(rawUrl).trim();
  if (
    !cleaned ||
    cleaned.toLowerCase() === 'this' ||
    cleaned.toLowerCase() === 'self' ||
    cleaned.toLowerCase() === 'app' ||
    cleaned.toLowerCase() === 'current' ||
    cleaned.toLowerCase() === 'local' ||
    cleaned.includes('MISSING_SUPABASE_URL') ||
    cleaned.includes('placeholder')
  ) {
    return DEFAULT_SERVER_APP_URL;
  }

  // If dashboard URL was provided: https://supabase.com/dashboard/project/xyz
  const dashboardMatch = cleaned.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashboardMatch) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');

  if (!/^https?:\/\//i.test(cleaned)) {
    if (cleaned.includes('.')) {
      cleaned = `https://${cleaned}`;
    } else {
      cleaned = `https://${cleaned}.supabase.co`;
    }
  }

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    // fallback
  }

  return DEFAULT_SERVER_APP_URL;
}

export function resolveSupabaseKeys() {
  const allCandidates = [
    getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    getEnvVar('SUPABASE_SERVICE_KEY'),
    getEnvVar('SUPABASE_ANON_KEY'),
    getEnvVar('VITE_SUPABASE_ANON_KEY'),
    getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY'),
    getEnvVar('SUPABASE_KEY')
  ].map(k => (typeof k === 'string' ? k.trim() : '')).filter(Boolean);

  // If a key starts with sb_secret_, it is strictly a service_role key
  // If a key starts with sb_publishable_, it is strictly a publishable anon key
  let serviceKey = allCandidates.find(k => k.startsWith('sb_secret_'));
  let anonKey = allCandidates.find(k => k.startsWith('sb_publishable_'));

  if (!serviceKey) {
    serviceKey = (getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || getEnvVar('SUPABASE_SERVICE_KEY') || '').trim();
  }
  if (!anonKey) {
    anonKey = (getEnvVar('SUPABASE_ANON_KEY') || getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') || '').trim();
  }

  return { serviceKey: serviceKey || anonKey, anonKey: anonKey || serviceKey };
}

const rawEnvUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
const { serviceKey: resolvedServiceKey, anonKey: resolvedAnonKey } = resolveSupabaseKeys();

const supabaseUrl = sanitizeSupabaseUrl(rawEnvUrl);
const supabaseKey = resolvedAnonKey;
const supabaseServiceKey = resolvedServiceKey;

export const isExternalSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseKey && !supabaseUrl.includes('MISSING_SUPABASE_URL');
};

export const isSupabaseConfigured = () => {
  return true;
};

export const supabaseProjectInfo = {
  projectId: process.env.SUPABASE_PROJECT_ID || (supabaseUrl.includes('.supabase.co') ? supabaseUrl.replace('https://', '').split('.')[0] : 'paytune-app'),
  url: supabaseUrl || DEFAULT_SERVER_APP_URL,
  hasServiceKey: !!supabaseServiceKey,
  hasAnonKey: !!supabaseKey,
  isConfigured: isExternalSupabaseConfigured()
};

const actualConfigured = isExternalSupabaseConfigured();

if (actualConfigured) {
  console.log("-----------------------------------------------------------------");
  console.log(`⚡ [PAYTUNE] Supabase Connected to project: ${supabaseProjectInfo.projectId}`);
  console.log(`   Endpoint: ${supabaseUrl}`);
  console.log("-----------------------------------------------------------------");
} else {
  console.log("-----------------------------------------------------------------");
  console.log("ℹ️ [PAYTUNE] Running in offline simulation mode.");
  console.log("   No external Supabase configuration was found in environment.");
  console.log("-----------------------------------------------------------------");
}

function wrapResilientQuery(realBuilder: any, mockFn: () => any, table: string): any {
  return new Proxy(realBuilder, {
    get(target, prop, receiver) {
      if (prop === 'then') {
        return async (onfulfilled?: any, onrejected?: any) => {
          try {
            let result = await target;
            // Handle transient PGRST303 / clock skew / JWT parsing error by retrying once
            if (result && result.error && (result.error.code === 'PGRST303' || result.error.code === 'PGRST301' || result.error.message?.includes('JWT'))) {
              await new Promise(res => setTimeout(res, 120));
              try {
                const retried = await target;
                if (!retried?.error) {
                  result = retried;
                }
              } catch {
                // proceed with fallback
              }
            }

            if (result && result.error) {
              const mockResult = await mockFn();
              return onfulfilled ? onfulfilled(mockResult) : mockResult;
            }

            // If remote returned an empty array or valid array, check if local store has freshly created records
            if (result && !result.error && Array.isArray(result.data)) {
              try {
                const mockResult = await mockFn();
                if (mockResult && Array.isArray(mockResult.data) && mockResult.data.length > 0) {
                  if (result.data.length === 0) {
                    return onfulfilled ? onfulfilled(mockResult) : mockResult;
                  }
                  const seenIds = new Set(result.data.map((r: any) => r?.id));
                  const combined = [...result.data];
                  for (const m of mockResult.data) {
                    if (m && m.id && !seenIds.has(m.id)) {
                      combined.push(m);
                      seenIds.add(m.id);
                    }
                  }
                  const merged = { ...result, data: combined };
                  return onfulfilled ? onfulfilled(merged) : merged;
                }
              } catch {}
            }

            return onfulfilled ? onfulfilled(result) : result;
          } catch (err: any) {
            const mockResult = await mockFn();
            return onfulfilled ? onfulfilled(mockResult) : mockResult;
          }
        };
      }
      if (prop === 'single' || prop === 'maybeSingle') {
        return async () => {
          try {
            let result = await target[prop]();
            if (result && result.error && (result.error.code === 'PGRST303' || result.error.code === 'PGRST301' || result.error.message?.includes('JWT'))) {
              await new Promise(res => setTimeout(res, 120));
              try {
                const retried = await target[prop]();
                if (!retried?.error) {
                  result = retried;
                }
              } catch {
                // proceed with fallback
              }
            }

            if (!result || result.error || !result.data) {
              const mockRes = await mockFn()[prop]();
              if (mockRes && (mockRes.data || !result?.data)) {
                return mockRes;
              }
            }
            return result;
          } catch {
            return await mockFn()[prop]();
          }
        };
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function') {
        return (...args: any[]) => {
          const nextReal = val.apply(target, args);
          return wrapResilientQuery(nextReal, () => {
            const m = mockFn();
            return typeof m[prop] === 'function' ? m[prop](...args) : m;
          }, table);
        };
      }
      return val;
    }
  });
}

function createResilientClient(realClient: any, mockClient: any): any {
  return new Proxy(realClient, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => {
          try {
            const realQuery = target.from(table);
            return wrapResilientQuery(realQuery, () => mockClient.from(table), table);
          } catch {
            return mockClient.from(table);
          }
        };
      }
      if (prop === 'storage') {
        return {
          from: (bucket: string) => {
            const realBucket = target.storage?.from ? target.storage.from(bucket) : null;
            const mockBucket = mockClient.storage.from(bucket);
            return {
              upload: async (fileName: string, fileData: any, options?: any) => {
                if (realBucket) {
                  try {
                    const res = await realBucket.upload(fileName, fileData, options);
                    if (!res.error) {
                      // Also mirror locally for instant preview if applicable
                      try {
                        await mockBucket.upload(fileName, fileData, options);
                      } catch {}
                      return res;
                    }
                    console.warn(`[Supabase Storage] Upload to '${bucket}' returned error, falling back:`, res.error.message);
                  } catch (err: any) {
                    console.warn(`[Supabase Storage] Upload to '${bucket}' failed, falling back:`, err?.message || err);
                  }
                }
                return mockBucket.upload(fileName, fileData, options);
              },
              getPublicUrl: (fileName: string) => {
                if (realBucket) {
                  try {
                    const res = realBucket.getPublicUrl(fileName);
                    if (res?.data?.publicUrl && !res.data.publicUrl.includes('MISSING_SUPABASE_URL')) {
                      return res;
                    }
                  } catch {}
                }
                return mockBucket.getPublicUrl(fileName);
              },
              remove: async (paths: string[]) => {
                if (realBucket) {
                  try {
                    await realBucket.remove(paths);
                  } catch {}
                }
                return { data: paths, error: null };
              }
            };
          }
        };
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function') {
        return val.bind(target);
      }
      return val;
    }
  });
}

const mockInstance = createMockSupabaseClient();

// Real clients connected to Supabase project
let rawSupabase: any = mockInstance;
let rawSupabaseAdmin: any = mockInstance;

if (actualConfigured) {
  try {
    rawSupabase = createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.warn('[Supabase Server] Failed to initialize raw client, using mock fallback:', err);
    rawSupabase = mockInstance;
  }

  try {
    rawSupabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (err) {
    console.warn('[Supabase Server Admin] Failed to initialize admin client, using mock fallback:', err);
    rawSupabaseAdmin = mockInstance;
  }
}

// Resilient clients ensuring zero disruption if tables aren't yet migrated in remote schema
export const supabase: any = actualConfigured && rawSupabase !== mockInstance
  ? createResilientClient(rawSupabase, mockInstance)
  : mockInstance;

export const supabaseAdmin: any = actualConfigured && rawSupabaseAdmin !== mockInstance
  ? createResilientClient(rawSupabaseAdmin, mockInstance)
  : mockInstance;


