import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { api } from '../lib/api';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ data: { user: User | null; session: Session | null } | null; error: AuthError | Error | null }>;
  signUp: (email: string, password: string, options?: { data?: { full_name?: string; [key: string]: any } } | string) => Promise<{ data: { user: User | null; session: Session | null } | null; error: AuthError | Error | null }>;
  signOut: () => Promise<{ error: AuthError | Error | null }>;

  roleData: any | null;
  logout: () => Promise<{ error: AuthError | Error | null }>;
  refreshProfile: () => Promise<void>;
  signInWithCredentials: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: string; redirectTo?: string; artist?: any }>;
  signUpWithCredentials: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string; errors?: Record<string, string>; requiresEmailConfirmation?: boolean }>;
  signInArtist?: (email: string, password: string) => Promise<{ success: boolean; error?: string; redirectTo?: string; artist?: any }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearStaleArtistStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('artist_token');
  localStorage.removeItem('paytune_artist_token');
  localStorage.removeItem('artist');
  localStorage.removeItem('artist_id');
  localStorage.removeItem('paytune_artist_data');
  localStorage.removeItem('role');
  localStorage.removeItem('token');
}

function clearAllAuthStorage() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('paytune_auth_token');
  localStorage.removeItem('paytune_custom_session');
  clearStaleArtistStorage();
  localStorage.removeItem('user_role');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roleData, setRoleData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (userId: string, tokenOverride?: string): Promise<any | null> => {
    try {
      const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : undefined;
      const res = await api.get('/api/auth/me', headers ? { headers } : undefined);
      if (res.data?.success) {
        const resolvedRoleData = res.data.roleData || {
          id: userId,
          role: res.data?.user?.role || 'user',
          full_name: res.data?.user?.fullName || 'User',
        };
        setRoleData(resolvedRoleData);

        if (resolvedRoleData?.role === 'artist' && res.data?.artist) {
          const activeToken =
            tokenOverride ||
            localStorage.getItem('artist_token') ||
            localStorage.getItem('paytune_auth_token');
          if (activeToken) {
            localStorage.setItem('artist_token', activeToken);
            localStorage.setItem('paytune_artist_token', activeToken);
          }
          localStorage.setItem('artist', JSON.stringify(res.data.artist));
          localStorage.setItem('artist_id', res.data.artist.id);
          localStorage.setItem('role', 'artist');
        }
        return resolvedRoleData;
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        localStorage.removeItem('paytune_custom_session');
      }
    }

    // Fallback to safe non-privileged local profile row if backend is temporarily unreachable
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const fallback = profileData
        ? { ...profileData, id: userId, full_name: profileData.display_name, role: 'user' }
        : { id: userId, role: 'user', full_name: 'Member' };
      setRoleData(fallback);
      return fallback;
    } catch {
      const minimal = { id: userId, role: 'user', full_name: 'Member' };
      setRoleData(minimal);
      return minimal;
    }
  };

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session: initialSession } }: any) => {
      if (!isMounted) return;

      if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user ?? null);
        if (initialSession.user) {
          fetchProfile(initialSession.user.id, initialSession.access_token);
        }
      } else {
        const customSessionRaw = localStorage.getItem('paytune_custom_session');
        if (customSessionRaw) {
          try {
            const parsed = JSON.parse(customSessionRaw);
            if (parsed && parsed.user && parsed.access_token) {
              setSession(parsed);
              setUser(parsed.user);
              fetchProfile(parsed.user.id, parsed.access_token);
            }
          } catch {
            localStorage.removeItem('paytune_custom_session');
          }
        }
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, authSession: Session | null) => {
      if (!isMounted) return;

      if (authSession) {
        setSession(authSession);
        setUser(authSession.user ?? null);
        if (authSession.user) {
          fetchProfile(authSession.user.id, authSession.access_token);
        }
      } else {
        const customSessionRaw = localStorage.getItem('paytune_custom_session');
        if (customSessionRaw) {
          try {
            const parsed = JSON.parse(customSessionRaw);
            if (parsed && parsed.user && parsed.access_token) {
              setSession(parsed);
              setUser(parsed.user);
              fetchProfile(parsed.user.id, parsed.access_token);
              setLoading(false);
              return;
            }
          } catch {}
        }
        setSession(null);
        setUser(null);
        setRoleData(null);
      }
      setLoading(false);
    });

    const handleAuthSync = () => {
      if (!isMounted) return;
      supabase.auth.getSession().then(({ data: { session: currentSession } }: any) => {
        if (!isMounted) return;
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user ?? null);
          if (currentSession.user) fetchProfile(currentSession.user.id, currentSession.access_token);
        } else {
          const customSessionRaw = localStorage.getItem('paytune_custom_session');
          if (customSessionRaw) {
            try {
              const parsed = JSON.parse(customSessionRaw);
              if (parsed?.user && parsed?.access_token) {
                setSession(parsed);
                setUser(parsed.user);
                fetchProfile(parsed.user.id, parsed.access_token);
                setLoading(false);
                return;
              }
            } catch {}
          }
          setSession(null);
          setUser(null);
          setRoleData(null);
        }
        setLoading(false);
      });
    };
    window.addEventListener('paytune-auth-changed', handleAuthSync);

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
      window.removeEventListener('paytune-auth-changed', handleAuthSync);
    };
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`;
      localStorage.setItem('paytune_auth_token', session.access_token);
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('paytune_auth_token');
    }
  }, [session]);

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ data: { user: User | null; session: Session | null } | null; error: AuthError | Error | null }> => {
    try {
      clearStaleArtistStorage();
      localStorage.removeItem('paytune_custom_session');

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        return { data: null, error };
      }

      if (data?.session) {
        setSession(data.session);
        setUser(data.session.user);
        localStorage.setItem('paytune_auth_token', data.session.access_token);
        api.defaults.headers.common['Authorization'] = `Bearer ${data.session.access_token}`;
        if (data.session.user) {
          await fetchProfile(data.session.user.id, data.session.access_token);
        }
        window.dispatchEvent(new CustomEvent('paytune-auth-changed'));
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    options?: { data?: { full_name?: string; [key: string]: any } } | string
  ): Promise<{ data: { user: User | null; session: Session | null } | null; error: AuthError | Error | null }> => {
    try {
      clearStaleArtistStorage();
      localStorage.removeItem('paytune_custom_session');

      const normalizedOptions =
        typeof options === 'string'
          ? { data: { full_name: options } }
          : options;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: normalizedOptions
      });

      if (error) {
        return { data: null, error };
      }

      if (data?.session) {
        setSession(data.session);
        setUser(data.session.user);
        localStorage.setItem('paytune_auth_token', data.session.access_token);
        api.defaults.headers.common['Authorization'] = `Bearer ${data.session.access_token}`;
        if (data.session.user) {
          await fetchProfile(data.session.user.id, data.session.access_token);
        }
        window.dispatchEvent(new CustomEvent('paytune-auth-changed'));
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  };

  const signOut = async (): Promise<{ error: AuthError | Error | null }> => {
    try {
      clearAllAuthStorage();
      delete api.defaults.headers.common['Authorization'];

      const { error } = await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setRoleData(null);
      window.dispatchEvent(new CustomEvent('paytune-auth-changed'));
      return { error: error || null };
    } catch (err: any) {
      setSession(null);
      setUser(null);
      setRoleData(null);
      window.dispatchEvent(new CustomEvent('paytune-auth-changed'));
      return { error: err };
    }
  };

  const signInWithCredentials = async (
    email: string,
    password: string
  ): Promise<{
    success: boolean;
    error?: string;
    role?: string;
    redirectTo?: string;
    artist?: any;
  }> => {
    const supaRes = await signIn(email, password);
    if (!supaRes.error && supaRes.data?.session) {
      const resolved = await fetchProfile(supaRes.data.session.user.id, supaRes.data.session.access_token);
      const role = resolved?.role || 'user';
      const redirectTo =
        role === 'master' || role === 'admin'
          ? '/master'
          : role === 'artist'
          ? '/artist/dashboard'
          : '/dashboard';
      return {
        success: true,
        role,
        redirectTo,
        artist: role === 'artist' ? resolved : undefined,
      };
    }

    try {
      const res = await api.post('/api/auth/login', { email, password });
      if (res.data?.success && res.data?.token) {
        const token = res.data.token;
        const resUser = res.data.user;
        const resolvedRole = res.data.role || resUser?.role || 'user';
        const appUser: User = {
          id: resUser.id,
          app_metadata: { provider: 'email' },
          user_metadata: { full_name: resUser.full_name || resUser.fullName, email: resUser.email, role: resolvedRole },
          aud: 'authenticated',
          confirmation_sent_at: '',
          recovery_sent_at: '',
          email_change_sent_at: '',
          new_email: '',
          invited_at: '',
          action_link: '',
          email: resUser.email,
          phone: '',
          created_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString(),
          email_confirmed_at: new Date().toISOString(),
          phone_confirmed_at: '',
          last_sign_in_at: new Date().toISOString(),
          role: 'authenticated',
          updated_at: new Date().toISOString(),
          identities: [],
          factors: []
        };

        const newSession: Session = {
          access_token: token,
          token_type: 'bearer',
          expires_in: 86400 * 7,
          expires_at: Math.floor(Date.now() / 1000) + (86400 * 7),
          refresh_token: '',
          user: appUser
        };

        if (resolvedRole !== 'artist') {
          clearStaleArtistStorage();
        }

        localStorage.setItem('paytune_custom_session', JSON.stringify(newSession));
        localStorage.setItem('paytune_auth_token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        setSession(newSession);
        setUser(appUser);
        if (res.data?.artist) {
          setRoleData({ ...res.data.artist, role: 'artist', full_name: res.data.artist.artist_name || res.data.artist.full_name });
        } else {
          await fetchProfile(appUser.id, token);
        }
        window.dispatchEvent(new CustomEvent('paytune-auth-changed'));
        return {
          success: true,
          role: resolvedRole,
          redirectTo: res.data?.redirectTo || (resolvedRole === 'artist' ? '/artist/dashboard' : '/dashboard'),
          artist: res.data?.artist,
        };
      }
    } catch (apiErr: any) {
      const respData = apiErr?.response?.data;
      if (respData?.message) {
        return { success: false, error: respData.message };
      }
    }

    return {
      success: false,
      error: supaRes.error?.message || 'Sign in failed. Please check your email and password.'
    };
  };

  const signInArtist = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; redirectTo?: string; artist?: any }> => {
    try {
      const res = await api.post('/api/artist/login', { email, password });
      if (res.data?.success && res.data?.token) {
        const token = res.data.token;
        const resArtist = res.data.artist || {};
        const appUser: User = {
          id: res.data.userId || resArtist.user_id || resArtist.id,
          app_metadata: { provider: 'email' },
          user_metadata: {
            full_name: resArtist.full_name || res.data.user?.fullName,
            email: resArtist.email || email,
            role: 'artist',
            artistId: res.data.artistId,
          },
          aud: 'authenticated',
          confirmation_sent_at: '',
          recovery_sent_at: '',
          email_change_sent_at: '',
          new_email: '',
          invited_at: '',
          action_link: '',
          email: resArtist.email || email,
          phone: resArtist.phone || '',
          created_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString(),
          email_confirmed_at: new Date().toISOString(),
          phone_confirmed_at: '',
          last_sign_in_at: new Date().toISOString(),
          role: 'authenticated',
          updated_at: new Date().toISOString(),
          identities: [],
          factors: []
        };

        const newSession: Session = {
          access_token: token,
          token_type: 'bearer',
          expires_in: 86400 * 7,
          expires_at: Math.floor(Date.now() / 1000) + (86400 * 7),
          refresh_token: '',
          user: appUser
        };

        localStorage.setItem('paytune_custom_session', JSON.stringify(newSession));
        localStorage.setItem('paytune_auth_token', token);
        localStorage.setItem('artist_token', token);
        localStorage.setItem('paytune_artist_token', token);
        localStorage.setItem('token', token);
        localStorage.setItem('artist', JSON.stringify(resArtist));
        localStorage.setItem('paytune_artist_data', JSON.stringify(resArtist));
        if (resArtist.id) localStorage.setItem('artist_id', resArtist.id);
        localStorage.setItem('role', 'artist');
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        setSession(newSession);
        setUser(appUser);
        setRoleData({ ...resArtist, role: 'artist' });
        window.dispatchEvent(new CustomEvent('paytune-auth-changed'));

        return {
          success: true,
          redirectTo: res.data.redirectTo || '/artist/dashboard',
          artist: resArtist
        };
      }
      return { success: false, error: res.data?.message || 'Artist sign in failed.' };
    } catch (apiErr: any) {
      const respData = apiErr?.response?.data;
      return {
        success: false,
        error: respData?.message || apiErr.message || 'Failed to sign in as artist.'
      };
    }
  };

  const signUpWithCredentials = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ success: boolean; error?: string; errors?: Record<string, string>; requiresEmailConfirmation?: boolean }> => {
    const supaRes = await signUp(email, password, { data: { full_name: fullName, role: 'user' } });
    if (!supaRes.error && supaRes.data?.user) {
      const requiresEmailConfirmation = !supaRes.data.session;
      return { success: true, requiresEmailConfirmation };
    }

    try {
      const res = await api.post('/api/auth/register', { email, password, fullName });
      if (res.data?.success) {
        if (res.data.token && res.data.user) {
          const token = res.data.token;
          const resUser = res.data.user;
          const appUser: User = {
            id: resUser.id,
            app_metadata: { provider: 'email' },
            user_metadata: { full_name: resUser.fullName, email: resUser.email, role: 'user' },
            aud: 'authenticated',
            confirmation_sent_at: '',
            recovery_sent_at: '',
            email_change_sent_at: '',
            new_email: '',
            invited_at: '',
            action_link: '',
            email: resUser.email,
            phone: '',
            created_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
            email_confirmed_at: new Date().toISOString(),
            phone_confirmed_at: '',
            last_sign_in_at: new Date().toISOString(),
            role: 'authenticated',
            updated_at: new Date().toISOString(),
            identities: [],
            factors: []
          };

          const newSession: Session = {
            access_token: token,
            token_type: 'bearer',
            expires_in: 86400 * 7,
            expires_at: Math.floor(Date.now() / 1000) + (86400 * 7),
            refresh_token: '',
            user: appUser
          };

          clearStaleArtistStorage();
          localStorage.setItem('paytune_custom_session', JSON.stringify(newSession));
          localStorage.setItem('paytune_auth_token', token);
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          setSession(newSession);
          setUser(appUser);
          await fetchProfile(appUser.id, token);
          window.dispatchEvent(new CustomEvent('paytune-auth-changed'));
          return { success: true, requiresEmailConfirmation: false };
        }
        return {
          success: true,
          requiresEmailConfirmation: Boolean(res.data.requiresEmailConfirmation ?? true),
        };
      }
    } catch (apiErr: any) {
      const respData = apiErr?.response?.data;
      if (respData) {
        return {
          success: false,
          error: respData.message || 'Registration failed.',
          errors: respData.errors
        };
      }
    }

    return {
      success: false,
      error: supaRes.error?.message || 'Registration failed.'
    };
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, session?.access_token);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      logout: signOut,
      roleData,
      refreshProfile,
      signInWithCredentials,
      signUpWithCredentials,
      signInArtist
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
