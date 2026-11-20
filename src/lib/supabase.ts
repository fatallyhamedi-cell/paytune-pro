import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env: Record<string, string | undefined> =
  typeof import.meta !== 'undefined' && (import.meta as any)?.env ? (import.meta as any).env : {};

export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

export function sanitizeSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
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
    return '';
  }

  const dashboardMatch = cleaned.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashboardMatch) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');

  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = cleaned.includes('.') ? `https://${cleaned}` : `https://${cleaned}.supabase.co`;
  }

  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    return '';
  }

  return '';
}

export function sanitizeSupabaseKey(rawKey?: string): string {
  if (!rawKey) return '';
  const cleaned = String(rawKey).trim();

  // Strictly block service_role / secret keys in client-side code
  if (
    cleaned.toLowerCase().includes('service_role') ||
    cleaned.toLowerCase().includes('secret') ||
    cleaned.includes('sb_secret_')
  ) {
    console.error(
      '[Supabase Security Warning] Secret/service_role key blocked in browser code.'
    );
    return '';
  }

  return cleaned;
}

const rawUrl = env.VITE_SUPABASE_URL || '';
const rawKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseUrl = sanitizeSupabaseUrl(rawUrl);
export const supabasePublishableKey = sanitizeSupabaseKey(rawKey);

export const isExternalSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabasePublishableKey);
};

export const isSupabaseConfigured = (): boolean => {
  return isExternalSupabaseConfigured();
};

export const supabaseProjectInfo = {
  projectId: supabaseUrl.includes('.supabase.co')
    ? supabaseUrl.replace('https://', '').split('.')[0]
    : 'unconfigured',
  url: supabaseUrl,
  isConfigured: isExternalSupabaseConfigured(),
};

let clientInstance: SupabaseClient | null = null;

if (isExternalSupabaseConfigured()) {
  try {
    clientInstance = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'paytune_supabase_auth',
      },
    });
  } catch (err) {
    console.error('[Supabase Client] Initialization failed:', err);
    clientInstance = null;
  }
}

export const rawSupabaseBrowser: SupabaseClient | null = clientInstance;

const unconfiguredStub: any = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === 'from') {
        return () =>
          new Proxy(
            {},
            {
              get(_qt, qProp) {
                const err = {
                  data: null,
                  error: { message: 'Supabase client is not configured.', code: 'DB_NOT_CONFIGURED' },
                };
                if (qProp === 'then') {
                  return (cb?: any) => Promise.resolve(cb ? cb(err) : err);
                }
                if (qProp === 'single' || qProp === 'maybeSingle') {
                  return async () => err;
                }
                return () => unconfiguredStub.from('');
              },
            }
          );
      }
      if (prop === 'auth') {
        return {
          getSession: async () => ({ data: { session: null }, error: null }),
          getUser: async () => ({ data: { user: null }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signOut: async () => ({ error: null }),
        };
      }
      if (prop === 'channel') {
        return () => ({
          on: () => ({ subscribe: () => ({}) }),
          subscribe: () => ({}),
        });
      }
      if (prop === 'removeChannel') {
        return async () => 'ok';
      }
      return undefined;
    },
  }
);

export const supabase: any = clientInstance || unconfiguredStub;

export async function invokeEdgeFunction<T = any>(
  functionName: string,
  body?: any,
  options?: { headers?: Record<string, string> }
): Promise<{ data: T | null; error: any | null }> {
  if (isExternalSupabaseConfigured() && clientInstance?.functions?.invoke) {
    try {
      const response = await clientInstance.functions.invoke(functionName, {
        body,
        headers: options?.headers,
      });
      if (!response.error) {
        return { data: response.data as T, error: null };
      }
    } catch (err: any) {
      console.warn(`[Edge Function] Invoke failed for ${functionName}:`, err.message);
    }
  }

  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('paytune_auth_token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    };

    const res = await fetch(`/api/edge-functions/${functionName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
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
    return { data: null, error: fallbackErr };
  }
}
