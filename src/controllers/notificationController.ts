import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { getNotificationPreferences, saveNotificationPreferences } from '../services/notificationService';

export const getNotifications = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) {
    return res.json({
      notifications: [],
      unreadCount: 0
    });
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('recipient_user_id', user.id)
      .eq('is_archived', false)
      .order('is_read', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const notifications = (rows || []).map((n: any) => ({
      id: n.id,
      user_id: n.recipient_user_id,
      artist_id: n.metadata?.artist_id || null,
      recipient_type: n.metadata?.recipient_type || 'user',
      type: n.metadata?.legacy_type || n.notification_type,
      title: n.title,
      message: n.message,
      link: n.action_url || '/dashboard',
      is_read: Boolean(n.is_read),
      related_id: n.metadata?.related_id || n.content_id || null,
      created_at: n.created_at
    }));

    const unreadCount = notifications.filter((n: any) => !n.is_read).length;

    res.json({
      notifications,
      unreadCount
    });
  } catch (err: any) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Authentication required.' });

  try {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true, read_at: now, updated_at: now })
      .eq('recipient_user_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err: any) {
    console.error('markAllAsRead error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) return res.status(401).json({ error: 'Authentication required.' });

  const { id } = req.params;

  try {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true, read_at: now, updated_at: now })
      .eq('id', id)
      .eq('recipient_user_id', user.id);

    if (error) throw error;
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err: any) {
    console.error('markAsRead error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getPreferences = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const { data: artist } = await supabaseAdmin
      .from('artist_profiles')
      .select('id')
      .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
      .maybeSingle();

    const prefs = await getNotificationPreferences(user.id, artist?.id || null);
    res.json({ success: true, preferences: prefs });
  } catch (err: any) {
    console.error('getPreferences error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const updatePreferences = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const { data: artist } = await supabaseAdmin
      .from('artist_profiles')
      .select('id')
      .or(`created_by_user_id.eq.${user.id},primary_contact_user_id.eq.${user.id}`)
      .maybeSingle();

    const updated = await saveNotificationPreferences(user.id, artist?.id || null, req.body || {});
    res.json({ success: true, preferences: updated });
  } catch (err: any) {
    console.error('updatePreferences error:', err);
    res.status(500).json({ error: err.message });
  }
};
