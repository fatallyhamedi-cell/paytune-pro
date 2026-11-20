import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from './useAuth';

export interface ArtistProfile {
  id: string;
  user_id?: string | null;
  full_name: string;
  username: string;
  email?: string;
  phone?: string;
  profile_image: string;
  bio: string;
  banner_image: string;
  social_links: {
    website?: string;
    instagram?: string;
    twitter?: string;
    youtube?: string;
    spotify?: string;
  };
  is_verified: boolean;
  featured_video_id?: string | null;
  subscriber_count: number;
  subscribers_count: number;
  video_count: number;
  total_views: number;
  join_date: string;
  membership_tiers: any[];
}

export function useArtist(artistIdOrUsername: string | undefined) {
  const { user } = useAuth();
  const [artist, setArtist] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Fetch Artist details and subscription status
  const fetchArtist = useCallback(async () => {
    const cleanId = (!artistIdOrUsername || artistIdOrUsername === "undefined" || artistIdOrUsername === "null")
      ? ""
      : artistIdOrUsername;

    if (!cleanId) {
      setArtist(null);
      setError("Artist channel identifier is required.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.get<ArtistProfile>(`/api/artists/${cleanId}`);
      const rawData = res.data;
      const data: ArtistProfile = {
        ...rawData,
        profile_image: (rawData as any).avatar_url || rawData.profile_image || '',
        banner_image: (rawData as any).banner_url || rawData.banner_image || '',
      };
      setArtist(data);
      setSubscriberCount(data.subscriber_count ?? data.subscribers_count ?? 0);

      if (user) {
        try {
          const subRes = await api.get<{ subscribed: boolean }>(`/api/artists/${data.id}/subscribe-status`);
          setSubscribed(!!subRes.data.subscribed);
        } catch {
          setSubscribed(false);
        }
      } else {
        setSubscribed(false);
      }
    } catch (err: any) {
      setArtist(null);
      setSubscriberCount(0);
      setSubscribed(false);
      setError(err?.response?.data?.error || err?.message || "Failed to load artist channel.");
    } finally {
      setLoading(false);
    }
  }, [artistIdOrUsername, user]);

  useEffect(() => {
    fetchArtist();
  }, [fetchArtist]);

  // Subscribe / Unsubscribe toggle
  const toggleSubscribe = async (): Promise<{ success: boolean; requiresAuth?: boolean; subscribed?: boolean }> => {
    if (!user) {
      return { success: false, requiresAuth: true };
    }
    if (!artist) return { success: false };

    setIsSubscribing(true);
    // Optimistic update
    const previousSubscribed = subscribed;
    const previousCount = subscriberCount;
    const newSubscribed = !previousSubscribed;
    const newCount = newSubscribed ? previousCount + 1 : Math.max(0, previousCount - 1);

    setSubscribed(newSubscribed);
    setSubscriberCount(newCount);

    try {
      const res = await api.post<{ subscribed: boolean; subscriber_count: number }>(
        `/api/artists/${artist.id}/subscribe`
      );
      if (typeof res.data.subscribed === 'boolean') {
        setSubscribed(res.data.subscribed);
      }
      if (typeof res.data.subscriber_count === 'number') {
        setSubscriberCount(res.data.subscriber_count);
      }
      return { success: true, subscribed: res.data.subscribed };
    } catch (err: any) {
      console.error("Toggle subscribe error:", err);
      // Revert optimistic update
      setSubscribed(previousSubscribed);
      setSubscriberCount(previousCount);
      return { success: false };
    } finally {
      setIsSubscribing(false);
    }
  };

  // Submit report
  const reportArtist = async (reason: string, details: string) => {
    if (!artist) throw new Error("Artist profile not loaded");
    const res = await api.post(`/api/artists/${artist.id}/report`, {
      reason,
      details
    });
    return res.data;
  };

  return {
    artist,
    loading,
    error,
    subscribed,
    subscriberCount,
    isSubscribing,
    toggleSubscribe,
    reportArtist,
    refetch: fetchArtist
  };
}
