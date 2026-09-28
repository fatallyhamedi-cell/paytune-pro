import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session, AuthError } from '@supabase/supabase-js';
import axios from 'axios';
import { api } from '../lib/api';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ data: { user: User | null; session: Session | null } | null; error: AuthError | Error | null }>;
  signUp: (email: string, password: string, options?: { data?: { full_name?: string; [key: string]: any } } | string) => Promise<{ data: { user: User | null; session: Session | null } | null; error: AuthError | Error | null }>;
  signOut: () => Promise<{ error: AuthError | Error | null }>;
  
  // Platform & Role helpers
  roleData: any | null;
  logout: () => Promise<{ error: AuthError | Error | null }>;
  refreshProfile: () => Promise<void>;
  loginWithGoogleDemo: (email: string, fullName?: string) => Promise<void>;
  signInWithCredentials: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: string; redirectTo?: string; phone_verified?: boolean }>;
  signUpWithCredentials: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string; errors?: Record<string, string> }>;
  signInArtist?: (email: string, password: string) => Promise<{ success: boolean; error?: string; redirectTo?: string; phone_verified?: boolean; artist?: any }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roleData, setRoleData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (userId: string, email?: string) => {
    if (email === 'master@paytune.com' || user?.user_metadata?.role === 'MASTER_ADMIN') {
      setRoleData({
        id: userId,
        email: email || 'master@paytune.com',
        is_master: true,
        role: 'MASTER_ADMIN',
        full_name: 'Platform Master Admin'
      });
      return;
    }

    try {
      // Check artist account first
      const { data: artistByUserId } = await supabase
        .from('artists')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (artistByUserId) {
        setRoleData(artistByUserId);
        return;
      }

      const { data: artistById } = await supabase
        .from('artists')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (artistById) {
        setRoleData(artistById);
        return;
      }

      if (email) {
        const { data: artistByEmail } = await supabase
          .from('artists')
          .select('*')
          .ilike('email', email)
          .maybeSingle();

        if (artistByEmail) {
          setRoleData(artistByEmail);
          return;
        }
      }
    } catch {
      // ignore
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    setRoleData(profileData);
  };

  // 1. Load the current session & 2. Listen for auth state changes
  useEffect(() => {
    let isMounted = true;

    // Load initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }: any) => {
      if (!isMounted) return;

      if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user ?? null);
        if (initialSession.user) {
          fetchProfile(initialSession.user.id, initialSession.user.email);
        }
      } else {
        // Fallback: check stored custom session if in local/demo mode
        const customSessionRaw = localStorage.getItem('paytune_custom_session');
        if (customSessionRaw) {
          try {
            const parsed = JSON.parse(customSessionRaw);
            if (parsed && parsed.user) {
              setSession(parsed);
              setUser(parsed.user);
              fetchProfile(parsed.user.id, parsed.user.email);
            }
          } catch {
            localStorage.removeItem('paytune_custom_session');
          }
        }
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, authSession: Session | null) => {
      if (!isMounted) return;

      if (authSession) {
        setSession(authSession);
        setUser(authSession.user ?? null);
        if (authSession.user) {
          fetchProfile(authSession.user.id, authSession.user.email);
        }
      } else {
        const customSessionRaw = localStorage.getItem('paytune_custom_session');
        if (customSessionRaw) {
          try {
            const parsed = JSON.parse(customSessionRaw);
            if (parsed && parsed.user) {
              setSession(parsed);
              setUser(parsed.user);
              fetchProfile(parsed.user.id, parsed.user.email);
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

    const handleMockAuthSync = () => {
      if (!isMounted) return;
      supabase.auth.getSession().then(({ data: { session: currentSession } }: any) => {
        if (!isMounted) return;
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user ?? null);
          if (currentSession.user) fetchProfile(currentSession.user.id, currentSession.user.email);
        }
        setLoading(false);
      });
    };
    window.addEventListener('mock-auth-changed', handleMockAuthSync);

    return () => {
      isMounted = false;
      subscription?.unsubscribe?.();
      window.removeEventListener('mock-auth-changed', handleMockAuthSync);
    };
  }, []);

  // Synchronize HTTP Authorization headers whenever session token updates
  useEffect(() => {
    if (session?.access_token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`;
      api.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`;
      localStorage.setItem('paytune_auth_token', session.access_token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('paytune_auth_token');
    }
  }, [session]);

  /**
   * Supabase Authentication with Email & Password: Sign In
   */
  const signIn = async (
    email: string, 
    password: string
  ): Promise<{ data: { user: User | null; session: Session | null } | null; error: AuthError | Error | null }> => {
    try {
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
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.session.access_token}`;
        api.defaults.headers.common['Authorization'] = `Bearer ${data.session.access_token}`;
        if (data.session.user) {
          await fetchProfile(data.session.user.id, data.session.user.email);
        }
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  };

  /**
   * Supabase Authentication with Email & Password: Sign Up
   */
  const signUp = async (
    email: string, 
    password: string, 
    options?: { data?: { full_name?: string; [key: string]: any } } | string
  ): Promise<{ data: { user: User | null; session: Session | null } | null; error: AuthError | Error | null }> => {
    try {
      const opts = typeof options === 'string'
        ? { data: { full_name: options } }
        : options || {};

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: opts
      });

      if (error) {
        return { data: null, error };
      }

      if (data?.session) {
        setSession(data.session);
        setUser(data.session.user);
        localStorage.setItem('paytune_auth_token', data.session.access_token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${data.session.access_token}`;
        api.defaults.headers.common['Authorization'] = `Bearer ${data.session.access_token}`;
        if (data.session.user) {
          await fetchProfile(data.session.user.id, data.session.user.email);
        }
      }

      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  };

  /**
   * Supabase Authentication: Sign Out
   */
  const signOut = async (): Promise<{ error: AuthError | Error | null }> => {
    try {
      localStorage.removeItem('paytune_auth_token');
      localStorage.removeItem('paytune_custom_session');
      delete axios.defaults.headers.common['Authorization'];
      delete api.defaults.headers.common['Authorization'];
      
      const { error } = await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setRoleData(null);
      return { error: error || null };
    } catch (err: any) {
      setSession(null);
      setUser(null);
      setRoleData(null);
      return { error: err };
    }
  };

  const loginWithGoogleDemo = async (email: string, fullName?: string) => {
    const cleanEmail = (email || 'fatallyhamedi@gmail.com').trim().toLowerCase();
    const displayName = fullName || cleanEmail.split('@')[0];
    const generatedUserId = 'google-user-' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 15);
    
    let token = 'google_demo_jwt_' + generatedUserId + '_' + Date.now();
    try {
      const res = await api.post('/api/auth/google/demo', { email: cleanEmail, fullName: displayName });
      if (res.data?.token) {
        token = res.data.token;
      }
    } catch {
      // fallback
    }

    const googleUser: User = {
      id: generatedUserId,
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: displayName, email: cleanEmail, provider: 'google' },
      aud: 'authenticated',
      confirmation_sent_at: '',
      recovery_sent_at: '',
      email_change_sent_at: '',
      new_email: '',
      invited_at: '',
      action_link: '',
      email: cleanEmail,
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

    const demoSession: Session = {
      access_token: token,
      token_type: 'bearer',
      expires_in: 86400 * 7,
      expires_at: Math.floor(Date.now() / 1000) + (86400 * 7),
      refresh_token: 'google_refresh_' + generatedUserId,
      user: googleUser
    };

    localStorage.setItem('paytune_custom_session', JSON.stringify(demoSession));
    localStorage.setItem('paytune_auth_token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    setSession(demoSession);
    setUser(googleUser);
    await fetchProfile(googleUser.id, googleUser.email);
    window.dispatchEvent(new CustomEvent('mock-auth-changed'));
  };

  const signInWithCredentials = async (
    email: string, 
    password: string
  ): Promise<{ 
    success: boolean; 
    error?: string; 
    role?: string; 
    redirectTo?: string; 
    phone_verified?: boolean 
  }> => {
    // 1. Direct Supabase signIn attempt
    const supaRes = await signIn(email, password);
    if (!supaRes.error && supaRes.data?.session) {
      return { success: true };
    }

    // 2. Hybrid backend login fallback
    try {
      const res = await api.post('/api/auth/login', { email, password });
      if (res.data?.success && res.data?.token) {
        const token = res.data.token;
        const resUser = res.data.user;
        const appUser: User = {
          id: resUser.id,
          app_metadata: { provider: 'email' },
          user_metadata: { full_name: resUser.fullName, email: resUser.email, role: resUser.role },
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
          refresh_token: 'refresh_' + resUser.id,
          user: appUser
        };

        localStorage.setItem('paytune_custom_session', JSON.stringify(newSession));
        localStorage.setItem('paytune_auth_token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        setSession(newSession);
        setUser(appUser);
        if (res.data?.artist) {
          setRoleData(res.data.artist);
        } else {
          await fetchProfile(appUser.id, appUser.email);
        }
        window.dispatchEvent(new CustomEvent('mock-auth-changed'));
        return { 
          success: true, 
          role: res.data?.role, 
          redirectTo: res.data?.redirectTo, 
          phone_verified: res.data?.phone_verified 
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
  ): Promise<{ success: boolean; error?: string; redirectTo?: string; phone_verified?: boolean; artist?: any }> => {
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
            phone_verified: res.data.phone_verified
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
          phone_confirmed_at: res.data.phone_verified ? new Date().toISOString() : '',
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
          refresh_token: 'refresh_artist_' + (res.data.artistId || res.data.userId),
          user: appUser
        };

        localStorage.setItem('paytune_custom_session', JSON.stringify(newSession));
        localStorage.setItem('paytune_auth_token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        setSession(newSession);
        setUser(appUser);
        setRoleData(resArtist);
        window.dispatchEvent(new CustomEvent('mock-auth-changed'));

        return {
          success: true,
          phone_verified: res.data.phone_verified,
          redirectTo: res.data.redirectTo,
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
  ): Promise<{ success: boolean; error?: string; errors?: Record<string, string> }> => {
    // 1. Supabase direct signUp
    const supaRes = await signUp(email, password, { data: { full_name: fullName } });
    if (!supaRes.error) {
      return { success: true };
    }

    // 2. Hybrid backend register fallback
    try {
      const res = await api.post('/api/auth/register', { email, password, fullName });
      if (res.data?.success && res.data?.token) {
        const token = res.data.token;
        const resUser = res.data.user;
        const appUser: User = {
          id: resUser.id,
          app_metadata: { provider: 'email' },
          user_metadata: { full_name: resUser.fullName, email: resUser.email, role: resUser.role },
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
          refresh_token: 'refresh_' + resUser.id,
          user: appUser
        };

        localStorage.setItem('paytune_custom_session', JSON.stringify(newSession));
        localStorage.setItem('paytune_auth_token', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        setSession(newSession);
        setUser(appUser);
        await fetchProfile(appUser.id, appUser.email);
        window.dispatchEvent(new CustomEvent('mock-auth-changed'));
        return { success: true };
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
    if (user) await fetchProfile(user.id, user.email);
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
      loginWithGoogleDemo,
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
