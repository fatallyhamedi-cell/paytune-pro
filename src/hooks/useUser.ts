import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { UserProfile } from '../types/dashboard';
import { useAuth } from './useAuth';

export function useUser() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await axios.get('/api/user/me');
      setProfile(res.data);
    } catch (err: any) {
      console.error('Failed to fetch user profile:', err);
      setError(err.response?.data?.error || 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (data: Partial<UserProfile>) => {
    try {
      const res = await axios.put('/api/user/me', data);
      if (res.data?.user) {
        setProfile(res.data.user);
      } else {
        await fetchProfile();
      }
      return true;
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      throw new Error(err.response?.data?.error || 'Failed to update profile');
    }
  };

  const changePassword = async (currentPassword?: string, newPassword?: string) => {
    try {
      const res = await axios.post('/api/user/change-password', {
        currentPassword,
        newPassword
      });
      return { success: true, message: res.data?.message || 'Password changed successfully' };
    } catch (err: any) {
      console.error('Failed to change password:', err);
      return { success: false, message: err.response?.data?.error || 'Failed to change password' };
    }
  };

  const deleteAccount = async () => {
    try {
      await axios.delete('/api/user/account');
      setProfile(null);
      return { success: true };
    } catch (err: any) {
      console.error('Failed to delete account:', err);
      throw new Error(err.response?.data?.error || 'Failed to delete account');
    }
  };

  return {
    profile,
    loading,
    error,
    refreshUser: fetchProfile,
    updateProfile,
    changePassword,
    deleteAccount
  };
}
