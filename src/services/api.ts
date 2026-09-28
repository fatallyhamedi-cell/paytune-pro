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
  let token = localStorage.getItem('artist_token') || localStorage.getItem('token') || localStorage.getItem('paytune_artist_token');
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
