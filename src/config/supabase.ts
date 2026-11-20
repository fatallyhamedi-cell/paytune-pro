import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.[key]) {
    return String((import.meta as any).env[key]);
  }
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return String(process.env[key]);
  }
  return '';
};

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

export function resolveSupabaseKeys() {
  const allCandidates = [
    getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    getEnvVar('SUPABASE_SERVICE_KEY'),
    getEnvVar('SUPABASE_ANON_KEY'),
    getEnvVar('VITE_SUPABASE_ANON_KEY'),
    getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY'),
    getEnvVar('SUPABASE_KEY'),
  ]
    .map((k) => (typeof k === 'string' ? k.trim() : ''))
    .filter(Boolean);

  // If a key starts with sb_secret_, it is strictly a service_role key
  // If a key starts with sb_publishable_, it is strictly a publishable anon key
  let serviceKey = allCandidates.find((k) => k.startsWith('sb_secret_'));
  let anonKey = allCandidates.find((k) => k.startsWith('sb_publishable_'));

  if (!serviceKey) {
    serviceKey = (
      getEnvVar('SUPABASE_SERVICE_ROLE_KEY') ||
      getEnvVar('SUPABASE_SERVICE_KEY') ||
      ''
    ).trim();
  }
  if (!anonKey) {
    anonKey = (
      getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') ||
      getEnvVar('VITE_SUPABASE_ANON_KEY') ||
      getEnvVar('SUPABASE_ANON_KEY') ||
      ''
    ).trim();
  }

  return { serviceKey: serviceKey || '', anonKey: anonKey || '' };
}

const rawEnvUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
const { serviceKey: resolvedServiceKey, anonKey: resolvedAnonKey } = resolveSupabaseKeys();

const supabaseUrl = sanitizeSupabaseUrl(rawEnvUrl);
const supabaseKey = resolvedAnonKey || resolvedServiceKey;
const supabaseServiceKey = resolvedServiceKey || resolvedAnonKey;

export const isExternalSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && (supabaseKey || supabaseServiceKey));
};

export const isSupabaseConfigured = (): boolean => {
  return isExternalSupabaseConfigured();
};

export const supabaseProjectInfo = {
  projectId:
    getEnvVar('SUPABASE_PROJECT_ID') ||
    (supabaseUrl.includes('.supabase.co') ? supabaseUrl.replace('https://', '').split('.')[0] : 'unconfigured'),
  url: supabaseUrl,
  hasServiceKey: Boolean(resolvedServiceKey),
  hasAnonKey: Boolean(resolvedAnonKey),
  isConfigured: isExternalSupabaseConfigured(),
};

let internalSupabase: SupabaseClient | null = null;
let internalSupabaseAdmin: SupabaseClient | null = null;

if (isExternalSupabaseConfigured()) {
  try {
    internalSupabase = createClient(supabaseUrl, supabaseKey);
    internalSupabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log(`✅ [PAYTUNE] Connected to live Supabase PostgreSQL project: ${supabaseProjectInfo.projectId}`);
  } catch (err) {
    console.error('[PAYTUNE] Failed to initialize Supabase client:', err);
    internalSupabase = null;
    internalSupabaseAdmin = null;
  }
} else {
  console.warn('[PAYTUNE] Supabase environment variables are missing. Database operations will fail until configured.');
}

function createUnconfiguredClientProxy(): any {
  const errResponse = {
    data: null,
    error: {
      message: 'Supabase PostgreSQL is not configured. Please set VITE_SUPABASE_URL and service/publishable keys.',
      code: 'DB_NOT_CONFIGURED',
    },
    count: null,
  };
  const queryStub: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (onfulfilled?: any) => Promise.resolve(onfulfilled ? onfulfilled(errResponse) : errResponse);
        }
        if (prop === 'single' || prop === 'maybeSingle') {
          return async () => errResponse;
        }
        return () => queryStub;
      },
    }
  );
  return {
    from: () => queryStub,
    rpc: async () => errResponse,
    auth: {
      getUser: async () => ({ data: { user: null }, error: errResponse.error }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: errResponse.error }),
      signUp: async () => ({ data: { user: null, session: null }, error: errResponse.error }),
      updateUser: async () => ({ data: { user: null }, error: errResponse.error }),
      admin: {
        createUser: async () => ({ data: { user: null }, error: errResponse.error }),
        getUserById: async () => ({ data: { user: null }, error: errResponse.error }),
        listUsers: async () => ({ data: { users: [] }, error: errResponse.error }),
        updateUserById: async () => ({ data: { user: null }, error: errResponse.error }),
        deleteUser: async () => ({ data: null, error: errResponse.error }),
      },
    },
    storage: {
      listBuckets: async () => ({ data: [], error: errResponse.error }),
      createBucket: async () => ({ data: null, error: errResponse.error }),
      from: () => ({
        upload: async () => ({ data: null, error: errResponse.error }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: async () => ({ data: null, error: errResponse.error }),
        createSignedUrl: async () => ({ data: null, error: errResponse.error }),
      }),
    },
  };
}

// Raw clients (null when unconfigured)
export const rawSupabaseClient: SupabaseClient | null = internalSupabase;
export const rawSupabaseAdmin: SupabaseClient | null = internalSupabaseAdmin;

// Standard clients (real SupabaseClient when configured; unconfigured error stub otherwise — NEVER mock data)
export const supabase: any = internalSupabase || createUnconfiguredClientProxy();
export const supabaseAdmin: any = internalSupabaseAdmin || createUnconfiguredClientProxy();

const REQUIRED_STORAGE_BUCKETS = [
  { name: 'videos', public: true },
  { name: 'audio', public: true },
  { name: 'thumbnails', public: true },
  { name: 'avatars', public: true },
  { name: 'banners', public: true },
  { name: 'previews', public: true },
  { name: 'media_assets', public: true },
];

export async function ensureSupabaseStorageBuckets(): Promise<{
  checked: boolean;
  existing: string[];
  created: string[];
  errors: string[];
}> {
  if (!rawSupabaseAdmin?.storage) {
    return { checked: false, existing: [], created: [], errors: ['Supabase storage client not configured'] };
  }

  const created: string[] = [];
  const errors: string[] = [];
  let existing: string[] = [];

  try {
    const { data: buckets, error } = await rawSupabaseAdmin.storage.listBuckets();
    if (error) {
      errors.push(error.message || 'Failed to list buckets');
      return { checked: false, existing, created, errors };
    }

    existing = (buckets || []).map((b: any) => b.name || b.id).filter(Boolean);
    const existingSet = new Set(existing);

    for (const reqBucket of REQUIRED_STORAGE_BUCKETS) {
      if (!existingSet.has(reqBucket.name)) {
        try {
          const { error: createErr } = await rawSupabaseAdmin.storage.createBucket(reqBucket.name, {
            public: reqBucket.public,
          });
          if (!createErr) {
            created.push(reqBucket.name);
            existing.push(reqBucket.name);
          } else if (!String(createErr.message || '').toLowerCase().includes('already exists')) {
            errors.push(`${reqBucket.name}: ${createErr.message}`);
          }
        } catch (err: any) {
          errors.push(`${reqBucket.name}: ${err?.message || 'create failed'}`);
        }
      }
    }

    return { checked: true, existing, created, errors };
  } catch (err: any) {
    errors.push(err?.message || 'Storage initialization error');
    return { checked: false, existing, created, errors };
  }
}
