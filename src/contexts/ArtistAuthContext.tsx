import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '../services/api';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';

export interface Artist {
  id: string;
  user_id?: string;
  channel_id?: string | null;
  email: string;
  full_name: string;
  artist_name?: string;
  artist_handle?: string;
  artist_type?: string;
  avatar_url: string | null;
  banner_url?: string | null;
  bio?: string | null;
  phone: string;
  is_approved: boolean;
  approval_status: 'pending' | 'approved' | 'rejected' | string;
  rejection_reason?: string;
  currency_code: string;
  country_code?: string;
  momo_code?: string;
  momo_provider?: string | null;
  total_earnings?: number;
  pending_balance?: number;
  total_views?: number;
  follower_count?: number;
}

export type ArtistProfile = Artist;

export interface ArtistAuthContextType {
  artist: Artist | null;
  loading: boolean;
  isAuthenticated: boolean;
  isArtistAuthenticated: boolean;
  artistToken: string | null;
  register: (data: any) => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  refreshArtist: () => Promise<void>;
  loginArtist: (token: string, artistData: Artist) => void;
  logoutArtist: () => void;
  refreshArtistProfile: () => Promise<void>;
}

export const ArtistAuthContext = createContext<ArtistAuthContextType | undefined>(undefined);

function clearArtistKeys() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('artist_token');
  localStorage.removeItem('artist');
  localStorage.removeItem('artist_id');
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('user_role');
  localStorage.removeItem('paytune_artist_token');
  localStorage.removeItem('paytune_artist_data');
  localStorage.removeItem('paytune_auth_token');
  localStorage.removeItem('paytune_custom_session');
  localStorage.removeItem('master_token');
  localStorage.removeItem('admin_token');
  localStorage.removeItem('paytune_master_token');
  localStorage.removeItem('paytune_master_data');
  localStorage.removeItem('master');
}

export const ArtistAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [artist, setArtist] = useState<Artist | null>(() => {
    try {
      const cached = localStorage.getItem('artist') || localStorage.getItem('paytune_artist_data');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const persistArtistSession = useCallback((token: string, artistData: Artist) => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('master_token');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('paytune_master_token');
      localStorage.removeItem('paytune_master_data');
      localStorage.removeItem('master');
      queryClient.clear();

      localStorage.setItem('artist_token', token);
      localStorage.setItem('token', token);
      localStorage.setItem('paytune_artist_token', token);
      localStorage.setItem('paytune_auth_token', token);
      localStorage.setItem('artist', JSON.stringify(artistData));
      localStorage.setItem('paytune_artist_data', JSON.stringify(artistData));
      localStorage.setItem('artist_id', artistData.id);
      localStorage.setItem('role', 'artist');

      const userId = artistData.user_id || artistData.id;
      const customSession = {
        access_token: token,
        token_type: 'bearer',
        expires_in: 86400 * 7,
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 7,
        refresh_token: '',
        user: {
          id: userId,
          email: artistData.email,
          phone: artistData.phone || '',
          role: 'authenticated',
          app_metadata: { provider: 'email' },
          user_metadata: {
            full_name: artistData.full_name || artistData.artist_name,
            email: artistData.email,
            role: 'artist',
            artistId: artistData.id,
            channelId: artistData.channel_id || null,
          },
        },
      };
      localStorage.setItem('paytune_custom_session', JSON.stringify(customSession));
    }

    setArtist(artistData);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('paytune-auth-changed'));
    }
  }, []);

  const syncFromServer = useCallback(async () => {
    const explicitArtistToken =
      localStorage.getItem('artist_token') ||
      localStorage.getItem('paytune_artist_token');
    const cachedArtist =
      localStorage.getItem('artist') ||
      localStorage.getItem('paytune_artist_data');
    const storedRole = localStorage.getItem('role');
    const authToken =
      explicitArtistToken ||
      localStorage.getItem('token') ||
      localStorage.getItem('paytune_auth_token');

    if (!authToken || (!explicitArtistToken && !cachedArtist && storedRole !== 'artist')) {
      setArtist(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/auth/artist/me');
      if (res.data?.artist) {
        setArtist(res.data.artist);
        localStorage.setItem('artist', JSON.stringify(res.data.artist));
        localStorage.setItem('paytune_artist_data', JSON.stringify(res.data.artist));
        localStorage.setItem('artist_id', res.data.artist.id);
      } else {
        setArtist(null);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403 || status === 404) {
        setArtist(null);
        localStorage.removeItem('artist');
        localStorage.removeItem('paytune_artist_data');
        localStorage.removeItem('artist_id');
        localStorage.removeItem('artist_token');
        localStorage.removeItem('paytune_artist_token');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    syncFromServer();
    const handleSync = () => {
      syncFromServer();
    };
    window.addEventListener('paytune-auth-changed', handleSync);
    return () => window.removeEventListener('paytune-auth-changed', handleSync);
  }, [syncFromServer]);

  const register = async (data: any) => {
    const res = await api.post('/auth/artist/register', data);
    if (res.data?.success && res.data?.token && res.data?.artist) {
      persistArtistSession(res.data.token, res.data.artist);
    }
    return res.data;
  };

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/artist/login', { email, password });
    const { token, artist: artistData } = res.data;

    if (token && artistData) {
      persistArtistSession(token, artistData);
    }
    return res.data;
  };

  const logout = () => {
    clearArtistKeys();
    queryClient.clear();
    setArtist(null);
    supabase.auth.signOut().catch(() => {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('paytune-auth-changed'));
    }
  };

  const refreshArtist = async () => {
    await syncFromServer();
  };

  const artistToken =
    (typeof window !== 'undefined' &&
      (localStorage.getItem('artist_token') ||
        localStorage.getItem('paytune_artist_token') ||
        localStorage.getItem('token'))) ||
    null;
  const isAuthenticated = !!artist;
  const isArtistAuthenticated = !!(artistToken && artist);

  const loginArtist = (token: string, artistData: Artist) => {
    persistArtistSession(token, artistData);
  };

  const logoutArtist = () => {
    logout();
  };

  const refreshArtistProfile = async () => {
    await refreshArtist();
  };

  return (
    <ArtistAuthContext.Provider
      value={{
        artist,
        loading,
        isAuthenticated,
        isArtistAuthenticated,
        artistToken,
        register,
        login,
        logout,
        refreshArtist,
        loginArtist,
        logoutArtist,
        refreshArtistProfile,
      }}
    >
      {children}
    </ArtistAuthContext.Provider>
  );
};

export function useArtistAuth() {
  const ctx = useContext(ArtistAuthContext);
  if (!ctx) throw new Error('useArtistAuth must be used inside ArtistAuthProvider');
  return ctx;
}

export default ArtistAuthContext;
