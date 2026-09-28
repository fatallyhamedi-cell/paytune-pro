import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createMockSupabaseClient } from '../config/supabase_mock';

// Read Vite environment variables (client-safe)
const env: Record<string, string | undefined> = 
  typeof import.meta !== 'undefined' && (import.meta as any)?.env ? (import.meta as any).env : {};

export const THIS_APP_URL = 'https://ais-dev-4pcefwvqqa7qfqrkdm5mo6-156032383868.europe-west2.run.app';

export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return THIS_APP_URL;
}

export function sanitizeSupabaseUrl(rawUrl?: string): string {
  const currentAppUrl = getAppBaseUrl();
  if (!rawUrl) return currentAppUrl;
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
    return currentAppUrl;
  }

  // If dashboard URL was provided: https://supabase.com/dashboard/project/xyz
  const dashboardMatch = cleaned.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashboardMatch) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // Strip trailing /rest/v1 or trailing slashes
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');

  // If user provided just project ID e.g. "abcdefghijklmnop"
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

  return currentAppUrl;
}

export function sanitizeSupabaseKey(rawKey?: string): string {
  if (!rawKey) return '';
  const cleaned = String(rawKey).trim();

  // STRICT SECURITY GUARD: Never allow service_role or secret keys in browser code
  if (
    cleaned.toLowerCase().includes('service_role') ||
    cleaned.toLowerCase().includes('secret') ||
    cleaned.includes('sb_secret_')
  ) {
    console.error(
      '[Supabase Security Warning] Detected service_role or secret key in browser environment. ' +
      'Service role keys MUST NOT be exposed to client-side code. Discarding key for security.'
    );
    return '';
  }

  return cleaned;
}

// Read Vite environment variables as requested:
// - VITE_SUPABASE_URL
// - VITE_SUPABASE_PUBLISHABLE_KEY (with VITE_SUPABASE_ANON_KEY fallback for backward compatibility)
const rawUrl = env.VITE_SUPABASE_URL || getAppBaseUrl();
const rawKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseUrl = sanitizeSupabaseUrl(rawUrl);
export const supabasePublishableKey = sanitizeSupabaseKey(rawKey);

export const isExternalSupabaseConfigured = (): boolean => {
  return !!supabaseUrl && !!supabasePublishableKey && !supabaseUrl.includes('MISSING_SUPABASE_URL');
};

export const isSupabaseConfigured = (): boolean => {
  return true;
};

export const supabaseProjectInfo = {
  projectId: supabaseUrl.includes('.supabase.co')
    ? supabaseUrl.replace('https://', '').split('.')[0]
    : 'paytune-app',
  url: supabaseUrl || getAppBaseUrl(),
  isConfigured: isExternalSupabaseConfigured()
};

const mockInstance = createMockSupabaseClient();

/**
 * Resilient query wrapper to transparently fall back to mock data store
 * if remote tables are not yet created or during offline development.
 */
function wrapResilientQuery(realBuilder: any, mockFn: () => any, table: string): any {
  return new Proxy(realBuilder, {
    get(target, prop, receiver) {
      if (prop === 'then') {
        return async (onfulfilled?: any, onrejected?: any) => {
          try {
            const result = await target;
            if (
              result &&
              result.error &&
              (result.error.code === 'PGRST205' ||
               result.error.message?.includes('schema cache') ||
               result.error.message?.includes('relation') ||
               result.error.code === '42P01')
            ) {
              const mockResult = await mockFn();
              return onfulfilled ? onfulfilled(mockResult) : mockResult;
            }
            return onfulfilled ? onfulfilled(result) : result;
          } catch {
            const mockResult = await mockFn();
            return onfulfilled ? onfulfilled(mockResult) : mockResult;
          }
        };
      }
      if (prop === 'single' || prop === 'maybeSingle') {
        return async () => {
          try {
            const result = await target[prop]();
            if (
              result &&
              result.error &&
              (result.error.code === 'PGRST205' ||
               result.error.message?.includes('schema cache') ||
               result.error.message?.includes('relation') ||
               result.error.code === '42P01')
            ) {
              return await mockFn()[prop]();
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

function createResilientClient(realClient: SupabaseClient, mockClient: any): any {
  return new Proxy(realClient, {
    get(target: any, prop: string | symbol, receiver: any) {
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
      if (prop === 'channel') {
        return (channelName: string) => {
          try {
            return target.channel(channelName);
          } catch {
            return mockClient.channel(channelName);
          }
        };
      }
      if (prop === 'removeChannel') {
        return (channelObj: any) => {
          try {
            return target.removeChannel(channelObj);
          } catch {
            return mockClient.removeChannel(channelObj);
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

// Initialize Supabase client
let clientInstance: any = mockInstance;

if (isExternalSupabaseConfigured()) {
  try {
    const rawSupabase = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'paytune_supabase_auth'
      }
    });
    clientInstance = createResilientClient(rawSupabase, mockInstance);
  } catch (err) {
    console.warn('[Supabase Client] Failed to initialize client, using resilient mock store:', err);
    clientInstance = mockInstance;
  }
} else {
  clientInstance = mockInstance;
}

/**
 * The reusable Supabase client instance
 */
export const supabase: any = clientInstance;

/**
 * Helper to invoke Supabase Edge Functions.
 * Reads the project URL from VITE_SUPABASE_URL and uses supabase.functions.invoke,
 * falling back gracefully to server-side edge function proxy if needed.
 */
export async function invokeEdgeFunction<T = any>(
  functionName: string,
  body?: any,
  options?: { headers?: Record<string, string> }
): Promise<{ data: T | null; error: any | null }> {
  // 1. If real external Supabase client is configured, call Supabase Edge Function
  if (isExternalSupabaseConfigured() && supabase?.functions?.invoke) {
    try {
      const response = await supabase.functions.invoke(functionName, {
        body,
        headers: options?.headers
      });
      if (!response.error) {
        return { data: response.data as T, error: null };
      }
      console.warn(`[Edge Function] Remote invoke for ${functionName} reported:`, response.error);
    } catch (err: any) {
      console.warn(`[Edge Function] Remote invoke failed for ${functionName}:`, err.message);
    }
  }

  // 2. Fallback to server-side Edge Function route
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('paytune_auth_token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {})
    };

    const res = await fetch(`/api/edge-functions/${functionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {})
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsedErr: any;
      try {
        parsedErr = JSON.parse(errText);
      } catch {
        parsedErr = { message: errText || `Error ${res.status}: ${res.statusText}` };
      }
      return { data: null, error: parsedErr };
    }

    const data = await res.json();
    return { data: data as T, error: null };
  } catch (fallbackErr: any) {
    console.error(`[Edge Function] Fallback execution failed for ${functionName}:`, fallbackErr);
    return { data: null, error: fallbackErr };
  }
}
