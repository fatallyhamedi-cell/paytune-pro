import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { supabase } from './supabase';

/**
 * PAYTUNE Authenticated Axios Client
 * - Respects VITE_API_URL environment variable if configured, or falls back to same-origin /api/*
 * - Automatically injects Authorization: Bearer <token> for all authenticated requests
 * - Intercepts 401 errors to attempt silent token refresh via Supabase Auth
 * - Broadcasts 401 session expiry events for graceful UI handling
 */

const rawBaseURL = ((import.meta as any).env?.VITE_API_URL as string) || '';
const isRemoteHost = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
// If running on a remote preview/production domain or if VITE_API_URL points to localhost:5000, fallback to same-origin
const baseURL = (isRemoteHost && rawBaseURL.includes('localhost')) ? '' : (rawBaseURL || '');

export const api: AxiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
});

// Flag and queue to manage concurrent token refreshes
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Attach Bearer Token to Every Request
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (typeof FormData !== 'undefined' && config.data instanceof FormData && config.headers) {
      config.headers.delete('Content-Type');
    }

    try {
      const url = String(config.url || '');
      const isMasterTarget =
        url.startsWith('/api/master') ||
        (typeof window !== 'undefined' && window.location.pathname.startsWith('/master'));
      const isArtistTarget =
        url.startsWith('/api/artist') || url.startsWith('/api/auth/artist');

      let token: string | null = null;

      if (isMasterTarget && typeof window !== 'undefined') {
        token =
          localStorage.getItem('master_token') ||
          localStorage.getItem('paytune_master_token') ||
          localStorage.getItem('paytune_auth_token') ||
          localStorage.getItem('token');
      } else if (isArtistTarget && typeof window !== 'undefined') {
        token =
          localStorage.getItem('artist_token') ||
          localStorage.getItem('paytune_artist_token') ||
          localStorage.getItem('paytune_auth_token') ||
          localStorage.getItem('token');
      }

      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || null;
      }

      if (!token && typeof window !== 'undefined') {
        token =
          localStorage.getItem('paytune_auth_token') ||
          localStorage.getItem('token') ||
          localStorage.getItem('artist_token') ||
          localStorage.getItem('paytune_artist_token') ||
          localStorage.getItem('supabase.auth.token');
      }

      if (token) {
        let cleanToken = String(token).replace(/^"|"$/g, '').trim();
        if (cleanToken.startsWith('Bearer ')) cleanToken = cleanToken.slice(7).trim();
        if (cleanToken && !config.headers.get('Authorization')) {
          config.headers.set('Authorization', `Bearer ${cleanToken}`);
        }
      }
    } catch (err) {
      console.warn('[API Interceptor] Error retrieving auth session:', err);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401, Auto-Refresh Token when Supabase session exists
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest: any = error.config;
    const reqUrl = String(originalRequest?.url || '');
    const isAuthEndpoint = reqUrl.includes('/auth/') || reqUrl.includes('/artist/login') || reqUrl.includes('/artist/register');

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token) {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data: { session: currentSupaSession } } = await supabase.auth.getSession();
        if (!currentSupaSession?.refresh_token) {
          processQueue(error, null);
          return Promise.reject(error);
        }

        const { data, error: refreshError } = await supabase.auth.refreshSession();
        const newSession = data?.session;

        if (!refreshError && newSession?.access_token) {
          processQueue(null, newSession.access_token);
          originalRequest.headers['Authorization'] = `Bearer ${newSession.access_token}`;
          return api(originalRequest);
        } else {
          processQueue(refreshError, null);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('paytune:auth_unauthorized', {
                detail: {
                  message: 'Your session has expired. Please sign in again to continue.',
                  endpoint: originalRequest.url,
                  status: 401
                }
              })
            );
          }
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
