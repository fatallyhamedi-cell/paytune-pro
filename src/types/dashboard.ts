export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  phone?: string;
  avatar_url?: string;
  total_spent?: number;
  join_date?: string;
  pause_history?: boolean;
  notify_releases?: boolean;
  notify_live?: boolean;
  notify_receipts?: boolean;
}

export interface LibraryVideo {
  id: string;
  title: string;
  description?: string;
  artist_id?: string;
  artist_name?: string;
  thumbnail_url?: string;
  video_url?: string;
  price_rwf?: number | null;
  price_usd?: number | null;
  purchased_at?: string;
  position_seconds?: number;
  duration?: number;
  category?: string;
  completed?: boolean;
}

export interface WatchHistoryItem {
  id: string;
  video_id: string;
  title: string;
  artist_id?: string;
  artist_name?: string;
  thumbnail_url?: string;
  position_seconds: number;
  duration: number;
  completed: boolean;
  last_watched_at: string;
}

export interface Playlist {
  id: string;
  user_id?: string;
  name?: string;
  title?: string;
  description?: string;
  thumbnail_url?: string;
  video_count?: number;
  is_public?: boolean;
  created_at?: string;
  updated_at?: string;
  videos?: LibraryVideo[];
}

export interface FollowedArtist {
  id: string;
  artist_id: string;
  full_name: string;
  username: string;
  profile_image?: string;
  subscriber_count?: number;
  is_verified?: boolean;
  bio?: string;
  video_count?: number;
}

export interface FollowingVideo {
  id: string;
  title: string;
  description?: string;
  artist_id: string;
  artist_name: string;
  artist_avatar?: string;
  thumbnail_url: string;
  duration?: number;
  category?: string;
  price_rwf?: number | null;
  price_usd?: number | null;
  is_free?: boolean;
  views?: number;
  uploaded_at: string;
}

export interface WishlistItem {
  id: string;
  video_id: string;
  title: string;
  artist_id?: string;
  artist_name?: string;
  thumbnail_url?: string;
  price_rwf?: number | null;
  price_usd?: number | null;
  duration?: number;
  category?: string;
  created_at?: string;
}

export interface PaymentPhone {
  id: string;
  user_id: string;
  phone: string;
  provider: 'MTN' | 'Airtel';
  is_default: boolean;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  user_id?: string | null;
  artist_id?: string | null;
  recipient_type: 'user' | 'artist' | 'master';
  type: string; // 'new_video' | 'new_follower' | 'new_purchase' | 'new_comment' | 'super_thanks' | 'membership' | 'withdrawal' | 'live_stream' | 'copyright' | 'system'
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  related_id?: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  id?: string;
  user_id?: string | null;
  artist_id?: string | null;
  email_new_video: boolean;
  email_new_follower: boolean;
  email_new_purchase: boolean;
  email_new_comment: boolean;
  email_super_thanks: boolean;
  email_membership: boolean;
  email_withdrawal: boolean;
  email_marketing: boolean;
  push_enabled: boolean;
}
