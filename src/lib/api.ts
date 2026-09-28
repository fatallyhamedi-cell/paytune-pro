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
    try {
      // 1. Check active Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        // 2. Fallback: check localStorage for custom or mock tokens
        const storedToken = 
          localStorage.getItem('paytune_auth_token') || 
          localStorage.getItem('token') ||
          localStorage.getItem('supabase.auth.token');
        
        if (storedToken) {
          config.headers.set('Authorization', `Bearer ${storedToken}`);
        }
      }
    } catch (err) {
      console.warn('[API Interceptor] Error retrieving auth session:', err);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401, Auto-Refresh Token, and Graceful Fallback
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest: any = error.config;

    // Check if error is 401 Unauthorized and not already retried
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
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
        // Fix 7: Token Refresh via Supabase Auth
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        const newSession = data?.session;

        if (!refreshError && newSession?.access_token) {
          processQueue(null, newSession.access_token);
          originalRequest.headers['Authorization'] = `Bearer ${newSession.access_token}`;
          return api(originalRequest);
        } else {
          processQueue(refreshError, null);
          
          // Fix 6: Graceful UI notification for unrecoverable 401
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
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('paytune:auth_unauthorized', {
              detail: {
                message: 'Authentication session expired. Please sign in.',
                status: 401
              }
            })
          );
        }
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
