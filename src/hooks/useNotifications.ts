import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { NotificationItem, NotificationPreferences } from '../types/dashboard';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import io, { Socket } from 'socket.io-client';

export function useNotifications() {
  const { user, roleData, session } = useAuth();
  const role = roleData?.role?.toLowerCase().includes('master') || roleData?.is_master ? 'master' : (roleData?.is_artist || roleData?.momo_code ? 'artist' : 'user');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const getAuthHeaders = useCallback(() => {
    const token = session?.access_token || localStorage.getItem('paytune_auth_token') || localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [session]);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const res = await api.get('/api/user/notifications', { headers });
      const notifs: NotificationItem[] = res.data?.notifications || [];
      setNotifications(notifs);
      const unread = notifs.filter(n => !n.is_read).length;
      setUnreadCount(res.data?.unreadCount !== undefined ? res.data.unreadCount : unread);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setNotifications([]);
        setUnreadCount(0);
      } else {
        console.warn('Could not load notifications:', err?.message || err);
      }
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders]);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    try {
      const headers = getAuthHeaders();
      const res = await api.get('/api/user/notifications/preferences', { headers });
      if (res.data && res.data.preferences) {
        setPreferences(res.data.preferences);
      }
    } catch (err) {
      // Gracefully ignore preference loading errors
    }
  }, [user, getAuthHeaders]);

  const updatePreferences = async (newPrefs: Partial<NotificationPreferences>) => {
    try {
      const headers = getAuthHeaders();
      const res = await api.put('/api/user/notifications/preferences', newPrefs, { headers });
      if (res.data && res.data.preferences) {
        setPreferences(res.data.preferences);
      }
      return { success: true };
    } catch (err: any) {
      console.warn('Could not update notification preferences:', err?.message || err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchPreferences();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, fetchNotifications, fetchPreferences]);

  // Real-time notifications listener via Supabase Realtime + Mock Realtime Window Event + Socket.io
  useEffect(() => {
    if (!user) return;

    const artistId = (roleData as any)?.artist_id || (role === 'artist' ? user.id : undefined);

    const isRelevantNotification = (n: any) => {
      if (!n) return false;
      if (n.user_id && n.user_id === user.id) return true;
      if (n.artist_id && (n.artist_id === artistId || n.artist_id === user.id)) return true;
      if (n.recipient_type === 'master' && (role === 'master' || (role as string) === 'admin')) return true;
      if (n.recipient_type === 'artist' && (role === 'artist' || (roleData as any)?.is_artist)) return true;
      if (!n.user_id && !n.artist_id && n.recipient_type === 'user') return true;
      return false;
    };

    // 1. Supabase Realtime channel subscription
    let channel: any = null;
    try {
      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications'
          },
          (payload: any) => {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            if (eventType === 'INSERT' && newRecord) {
              if (isRelevantNotification(newRecord)) {
                setNotifications(prev => {
                  if (prev.some(item => item.id === newRecord.id)) return prev;
                  return [newRecord, ...prev];
                });
                if (!newRecord.is_read) {
                  setUnreadCount(prev => prev + 1);
                }
              }
            } else if (eventType === 'UPDATE' && newRecord) {
              setNotifications(prev =>
                prev.map(item => (item.id === newRecord.id ? { ...item, ...newRecord } : item))
              );
              if (newRecord.is_read && oldRecord && !oldRecord.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
              }
            } else if (eventType === 'DELETE' && oldRecord) {
              setNotifications(prev => prev.filter(item => item.id !== oldRecord.id));
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Could not establish Supabase Realtime channel:', e);
    }

    // 2. Custom window event listener for local/mock Supabase Realtime simulation
    const handleMockRealtimeEvent = (e: CustomEvent) => {
      const detail = e.detail;
      if (!detail || detail.table !== 'notifications') return;
      const { eventType, newRecord, oldRecord } = detail;
      if (eventType === 'INSERT' && newRecord) {
        if (isRelevantNotification(newRecord)) {
          setNotifications(prev => {
            if (prev.some(item => item.id === newRecord.id)) return prev;
            return [newRecord, ...prev];
          });
          if (!newRecord.is_read) {
            setUnreadCount(prev => prev + 1);
          }
        }
      } else if (eventType === 'UPDATE' && newRecord) {
        setNotifications(prev =>
          prev.map(item => (item.id === newRecord.id ? { ...item, ...newRecord } : item))
        );
        if (newRecord.is_read && oldRecord && !oldRecord.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      } else if (eventType === 'DELETE' && oldRecord) {
        setNotifications(prev => prev.filter(item => item.id !== oldRecord.id));
      }
    };

    window.addEventListener('supabase-realtime-event' as any, handleMockRealtimeEvent);

    // 3. Socket.IO connection for instant notification delivery fallback
    try {
      const socket = io();
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('notifications:join', {
          userId: user.id,
          artistId,
          role
        });
      });

      socket.on('notification:new', (notif: NotificationItem) => {
        if (isRelevantNotification(notif)) {
          setNotifications(prev => {
            if (prev.some(item => item.id === notif.id)) return prev;
            return [notif, ...prev];
          });
          if (!notif.is_read) {
            setUnreadCount(prev => prev + 1);
          }
        }
      });
    } catch (socketErr) {
      console.warn('Socket.IO notification listener error:', socketErr);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
      window.removeEventListener('supabase-realtime-event' as any, handleMockRealtimeEvent);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, role, roleData]);

  const markAllAsRead = async () => {
    try {
      const headers = getAuthHeaders();
      await api.put('/api/user/notifications/read', {}, { headers });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err: any) {
      console.warn('Could not mark notifications read:', err?.message || err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const headers = getAuthHeaders();
      await api.put(`/api/user/notifications/${id}/read`, {}, { headers });
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      console.warn('Could not mark notification read:', err?.message || err);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    preferences,
    updatePreferences,
    markAllAsRead,
    markAsRead,
    refreshNotifications: fetchNotifications
  };
}
