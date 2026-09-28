import { Request, Response } from 'express';
import { getTableData, saveTableData, dispatchRealtimeEvent } from '../config/supabase_mock';
import { getNotificationPreferences, saveNotificationPreferences } from '../services/notificationService';

export const getNotifications = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    return res.json({
      notifications: [],
      unreadCount: 0
    });
  }

  try {
    const requestedRole = (req.query.role as string) || '';
    const artists = getTableData('artists') || [];
    const userArtist = artists.find((a: any) => a.user_id === user.id || a.id === user.artist_id || a.email === user.email);
    const isMaster = user.role === 'master' || user.role === 'admin' || user.email === 'master@paytune.com';

    const allNotifications = getTableData('notifications') || [];

    const userNotifications = allNotifications.filter((n: any) => {
      // 1. Direct user notifications
      if (n.recipient_type === 'user' && n.user_id === user.id) {
        return true;
      }
      // 2. Artist notifications if the user is an artist
      if (userArtist && n.recipient_type === 'artist' && n.artist_id === userArtist.id) {
        return true;
      }
      // 3. Master admin notifications
      if (isMaster && n.recipient_type === 'master') {
        return true;
      }
      // 4. If requested explicitly via query param
      if (requestedRole === 'artist' && userArtist && n.artist_id === userArtist.id) {
        return true;
      }
      if (requestedRole === 'master' && isMaster && n.recipient_type === 'master') {
        return true;
      }
      return false;
    });

    // Sort unread first, then newest
    userNotifications.sort((a: any, b: any) => {
      if (a.is_read !== b.is_read) {
        return a.is_read ? 1 : -1;
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    const unreadCount = userNotifications.filter((n: any) => !n.is_read).length;

    res.json({
      notifications: userNotifications,
      unreadCount
    });
  } catch (err: any) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.json({ success: true, message: 'No active session.' });

  try {
    const artists = getTableData('artists') || [];
    const userArtist = artists.find((a: any) => a.user_id === user.id || a.id === user.artist_id || a.email === user.email);
    const isMaster = user.role === 'master' || user.role === 'admin' || user.email === 'master@paytune.com';

    const notifications = getTableData('notifications') || [];
    notifications.forEach((n: any) => {
      const isTarget =
        (n.recipient_type === 'user' && n.user_id === user.id) ||
        (userArtist && n.recipient_type === 'artist' && n.artist_id === userArtist.id) ||
        (isMaster && n.recipient_type === 'master');

      if (isTarget) {
        n.is_read = true;
      }
    });

    saveTableData('notifications', notifications);
    dispatchRealtimeEvent('notifications', 'UPDATE', { is_read: true });
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err: any) {
    console.error('markAllAsRead error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.json({ success: true, message: 'No active session.' });

  const { id } = req.params;

  try {
    const notifications = getTableData('notifications') || [];
    const target = notifications.find((n: any) => n.id === id);

    if (target) {
      target.is_read = true;
      saveTableData('notifications', notifications);
      dispatchRealtimeEvent('notifications', 'UPDATE', target);
    }

    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err: any) {
    console.error('markAsRead error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getPreferences = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    return res.json({
      success: true,
      preferences: {
        email_notifications: true,
        sms_notifications: true,
        push_notifications: true,
        momo_receipts: true,
        artist_announcements: true,
        stream_alerts: true
      }
    });
  }

  try {
    const artists = getTableData('artists') || [];
    const userArtist = artists.find((a: any) => a.user_id === user.id || a.id === user.artist_id);
    const prefs = getNotificationPreferences(user.id, userArtist?.id || null);

    res.json({ success: true, preferences: prefs });
  } catch (err: any) {
    console.error('getPreferences error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const updatePreferences = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    return res.json({
      success: true,
      preferences: req.body
    });
  }

  try {
    const artists = getTableData('artists') || [];
    const userArtist = artists.find((a: any) => a.user_id === user.id || a.id === user.artist_id);
    const updated = saveNotificationPreferences(user.id, userArtist?.id || null, req.body);

    res.json({ success: true, preferences: updated });
  } catch (err: any) {
    console.error('updatePreferences error:', err);
    res.status(500).json({ error: err.message });
  }
};
