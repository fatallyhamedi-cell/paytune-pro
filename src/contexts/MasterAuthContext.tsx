import React, { createContext, useContext, useState } from 'react';
import { queryClient } from '../lib/queryClient';

export interface MasterUser {
  id: string;
  email: string;
  role: 'MASTER_ADMIN';
  full_name: string;
}

export interface MasterAuthContextType {
  master: MasterUser | null;
  masterToken: string | null;
  loginMaster: (token: string, masterData?: Partial<MasterUser>) => void;
  logoutMaster: () => void;
  isMasterAuthenticated: boolean;
}

export const MasterAuthContext = createContext<MasterAuthContextType | undefined>(undefined);

export const MasterAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [masterToken, setMasterToken] = useState<string | null>(() => {
    return localStorage.getItem('paytune_master_token') || localStorage.getItem('master_token') || null;
  });

  const [master, setMaster] = useState<MasterUser | null>(() => {
    try {
      const saved = localStorage.getItem('paytune_master_data') || localStorage.getItem('master');
      if (saved) return JSON.parse(saved);
      const token = localStorage.getItem('paytune_master_token') || localStorage.getItem('master_token');
      if (token) {
        return {
          id: 'master-admin',
          email: '',
          role: 'MASTER_ADMIN',
          full_name: 'Platform Master Administrator'
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  const loginMaster = (token: string, masterData?: Partial<MasterUser>) => {
    const user: MasterUser = {
      id: masterData?.id || 'master-admin',
      email: masterData?.email || '',
      role: 'MASTER_ADMIN',
      full_name: masterData?.full_name || 'Platform Master Administrator'
    };
    queryClient.clear();
    setMasterToken(token);
    setMaster(user);
    try {
      localStorage.removeItem('artist_token');
      localStorage.removeItem('paytune_artist_token');
      localStorage.removeItem('artist');
      localStorage.removeItem('artist_id');
      localStorage.removeItem('paytune_artist_data');

      localStorage.setItem('master_token', token);
      localStorage.setItem('paytune_master_token', token);
      localStorage.setItem('paytune_master_data', JSON.stringify(user));
      localStorage.setItem('master', JSON.stringify(user));
      localStorage.setItem('role', 'master');
      localStorage.setItem('user_role', 'master');
    } catch (e) {
      console.error('Failed to save master auth:', e);
    }
  };

  const logoutMaster = () => {
    queryClient.clear();
    setMasterToken(null);
    setMaster(null);
    try {
      localStorage.removeItem('master_token');
      localStorage.removeItem('admin_token');
      localStorage.removeItem('paytune_master_token');
      localStorage.removeItem('paytune_master_data');
      localStorage.removeItem('master');
      localStorage.removeItem('role');
      localStorage.removeItem('user_role');
      localStorage.removeItem('impersonate_token');
      localStorage.removeItem('impersonate_artist_data');
    } catch (e) {
      console.error('Failed to clear master auth:', e);
    }
  };

  return (
    <MasterAuthContext.Provider
      value={{
        master,
        masterToken,
        loginMaster,
        logoutMaster,
        isMasterAuthenticated: !!masterToken
      }}
    >
      {children}
    </MasterAuthContext.Provider>
  );
};

export const useMasterAuth = () => {
  const context = useContext(MasterAuthContext);
  if (context === undefined) {
    throw new Error('useMasterAuth must be used within a MasterAuthProvider');
  }
  return context;
};

export default MasterAuthContext;
