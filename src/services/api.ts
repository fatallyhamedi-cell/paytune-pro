import axios from 'axios';

// When running in browser preview environment, relative /api is preferred over localhost:3000
const isBrowser = typeof window !== 'undefined';
const isRemotePreview = isBrowser && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const configuredUrl = (import.meta as any).env?.VITE_API_URL || '';
const base = isRemotePreview ? '' : configuredUrl;
const baseURL = base ? `${base}/api` : '/api';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData && config.headers) {
    if (typeof (config.headers as any).delete === 'function') {
      (config.headers as any).delete('Content-Type');
    } else {
      delete (config.headers as any)['Content-Type'];
    }
  }

  const reqUrl = String(config.url || '');
  const isMasterTarget =
    reqUrl.includes('/master') ||
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/master'));
  let token = isMasterTarget
    ? (localStorage.getItem('master_token') || localStorage.getItem('paytune_master_token') || localStorage.getItem('token') || localStorage.getItem('paytune_auth_token'))
    : (localStorage.getItem('artist_token') || localStorage.getItem('paytune_artist_token') || localStorage.getItem('paytune_auth_token') || localStorage.getItem('token'));

  if (!token && typeof window !== 'undefined') {
    try {
      const rawSbSession = localStorage.getItem('paytune_supabase_auth');
      if (rawSbSession) {
        const parsed = JSON.parse(rawSbSession);
        token = parsed?.access_token || parsed?.currentSession?.access_token || null;
      }
    } catch {}
  }

  if (token) {
    token = String(token).replace(/^"|"$/g, '').replace(/\s/g, '');
    if (token.startsWith('Bearer ')) token = token.substring(7);
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Only clear session on authenticated route failures
    const url = err.config?.url || '';
    const isAuthRoute = url.includes('/auth/');
    if (err.response?.status === 401 && !isAuthRoute) {
      // Do NOT auto-redirect or wipe token blindly; let caller decide
    }
    return Promise.reject(err);
  }
);

export { api };
export default api;
