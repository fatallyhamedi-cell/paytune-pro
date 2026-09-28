import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

export interface Artist {
  id: string;
  user_id?: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  banner_url?: string | null;
  bio?: string | null;
  phone: string;
  phone_verified: boolean;
  is_approved: boolean;
  approval_status: 'pending' | 'approved' | 'rejected' | string;
  rejection_reason?: string;
  currency_code: string;
  country_code?: string;
  momo_code?: string;
  momo_provider?: string;
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
  verifyPhone: (id: string, code: string) => Promise<any>;
  resendOTP: (id: string) => Promise<any>;
  login: (email: string, password: string) => Promise<any>;
  logout: () => void;
  refreshArtist: () => Promise<void>;
  loginArtist: (token: string, artistData: Artist) => void;
  logoutArtist: () => void;
  refreshArtistProfile: () => Promise<void>;
}

export const ArtistAuthContext = createContext<ArtistAuthContextType | undefined>(undefined);

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

  useEffect(() => {
    const cached = localStorage.getItem('artist') || localStorage.getItem('paytune_artist_data');
    const token = localStorage.getItem('artist_token') || localStorage.getItem('token');
    if (token && cached) {
      try {
        setArtist(JSON.parse(cached));
      } catch {
        localStorage.removeItem('artist');
      }
      // Silently refresh profile
      api.get('/auth/artist/me')
        .then((res) => {
          if (res.data?.artist) {
            setArtist(res.data.artist);
            localStorage.setItem('artist', JSON.stringify(res.data.artist));
            localStorage.setItem('artist_id', res.data.artist.id);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const register = async (data: any) => {
    const res = await api.post('/auth/artist/register', data);
    return res.data;
  };

  const verifyPhone = async (id: string, code: string) => {
    const res = await api.post('/auth/artist/verify-phone', { artistId: id, code });
    if (res.data?.success) {
      if (res.data.token) {
        localStorage.setItem('artist_token', res.data.token);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('paytune_artist_token', res.data.token);
        localStorage.setItem('role', 'artist');
      }
      if (res.data.artist) {
        setArtist(res.data.artist);
        localStorage.setItem('artist', JSON.stringify(res.data.artist));
        localStorage.setItem('artist_id', res.data.artist.id);
      } else {
        setArtist((prev) => {
          if (!prev) return null;
          const updated = { ...prev, phone_verified: true };
          localStorage.setItem('artist', JSON.stringify(updated));
          return updated;
        });
      }
    }
    return res.data;
  };

  const resendOTP = async (id: string) => {
    const res = await api.post('/auth/artist/resend-otp', { artistId: id });
    return res.data;
  };

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/artist/login', { email, password });
    const { token, artist: artistData } = res.data;

    if (token) {
      localStorage.setItem('artist_token', token);
      localStorage.setItem('token', token);
      localStorage.setItem('paytune_artist_token', token);
      localStorage.setItem('role', 'artist');
    }
    if (artistData) {
      localStorage.setItem('artist', JSON.stringify(artistData));
      localStorage.setItem('artist_id', artistData.id);
      localStorage.setItem('paytune_artist_data', JSON.stringify(artistData));
      setArtist(artistData);
    }
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('artist_token');
    localStorage.removeItem('artist');
    localStorage.removeItem('artist_id');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user_role');
    localStorage.removeItem('paytune_artist_token');
    localStorage.removeItem('paytune_artist_data');
    setArtist(null);
    window.location.href = '/artist/login';
  };

  const refreshArtist = async () => {
    try {
      const res = await api.get('/auth/artist/me');
      if (res.data?.artist) {
        setArtist(res.data.artist);
        localStorage.setItem('artist', JSON.stringify(res.data.artist));
        localStorage.setItem('artist_id', res.data.artist.id);
      }
    } catch {}
  };

  const artistToken = localStorage.getItem('artist_token') || localStorage.getItem('token');
  const isAuthenticated = !!artist;
  const isArtistAuthenticated = !!(artistToken && artist);

  const loginArtist = (token: string, artistData: Artist) => {
    localStorage.setItem('artist_token', token);
    localStorage.setItem('token', token);
    localStorage.setItem('artist', JSON.stringify(artistData));
    localStorage.setItem('artist_id', artistData.id);
    localStorage.setItem('role', 'artist');
    setArtist(artistData);
  };

  const logoutArtist = () => {
    logout();
  };

  const refreshArtistProfile = async () => {
    await refreshArtist();
  };

  return (
    <ArtistAuthContext.Provider value={{
      artist,
      loading,
      isAuthenticated,
      isArtistAuthenticated,
      artistToken,
      register,
      verifyPhone,
      resendOTP,
      login,
      logout,
      refreshArtist,
      loginArtist,
      logoutArtist,
      refreshArtistProfile
    }}>
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
