import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useCallback, useRef } from 'react';

export interface ShortItem {
  id: string;
  title: string;
  description: string;
  artist_id: string;
  artist_name: string;
  artist_username: string;
  artist_avatar: string;
  artist_verified: boolean;
  subscribers_count: number;
  followers_count?: number;
  thumbnail_url: string;
  video_url: string;
  vertical_url?: string;
  duration: number;
  views: number;
  likes: number;
  comments_count: number;
  shares_count: number;
  created_at: string;
  uploaded_at: string;
  song_title: string;
  is_short: boolean;
  is_free: boolean;
  is_liked: boolean;
  is_subscribed: boolean;
  is_followed?: boolean;
  category: string;
}

interface ShortsFeedResponse {
  items: ShortItem[];
  total: number;
  nextOffset: number | null;
  hasMore: boolean;
}

export function useShorts(sort: 'trending' | 'new' | 'following' = 'trending') {
  const queryClient = useQueryClient();
  const preloadedUrls = useRef<Set<string>>(new Set());

  // Infinite Query for shorts feed
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ['shortsFeed', sort],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await axios.get<ShortsFeedResponse>('/api/shorts/feed', {
        params: {
          limit: 15,
          offset: pageParam,
          sort
        }
      });
      return res.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextOffset : undefined;
    },
    staleTime: 1000 * 60 * 3 // 3 minutes
  });

  // Flattened list of all loaded shorts
  const shorts: ShortItem[] = data
    ? data.pages.flatMap((page) => page.items || [])
    : [];

  // Toggle Like Mutation
  const likeMutation = useMutation({
    mutationFn: async (shortId: string) => {
      const res = await axios.post(`/api/shorts/${shortId}/like`);
      return res.data;
    },
    onMutate: async (shortId: string) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['shortsFeed'] });
      const previousFeed = queryClient.getQueryData(['shortsFeed', sort]);

      queryClient.setQueryData(['shortsFeed', sort], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: ShortsFeedResponse) => ({
            ...page,
            items: page.items.map((item: ShortItem) => {
              if (item.id === shortId) {
                const nextLiked = !item.is_liked;
                return {
                  ...item,
                  is_liked: nextLiked,
                  likes: nextLiked ? item.likes + 1 : Math.max(0, item.likes - 1)
                };
              }
              return item;
            })
          }))
        };
      });

      return { previousFeed };
    },
    onError: (_err, _shortId, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(['shortsFeed', sort], context.previousFeed);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shortsFeed', sort] });
    }
  });

  // Toggle Subscribe Mutation
  const subscribeMutation = useMutation({
    mutationFn: async (shortId: string) => {
      const res = await axios.post(`/api/shorts/${shortId}/subscribe`);
      return res.data;
    },
    onMutate: async (shortId: string) => {
      const currentShort = shorts.find(s => s.id === shortId);
      const artistId = currentShort?.artist_id;

      queryClient.setQueryData(['shortsFeed', sort], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: ShortsFeedResponse) => ({
            ...page,
            items: page.items.map((item: ShortItem) => {
              if (item.artist_id === artistId) {
                const nextSub = !(item.is_followed ?? item.is_subscribed);
                const count = item.followers_count ?? item.subscribers_count;
                const nextCount = nextSub ? count + 1 : Math.max(0, count - 1);
                return {
                  ...item,
                  is_subscribed: nextSub,
                  is_followed: nextSub,
                  subscribers_count: nextCount,
                  followers_count: nextCount
                };
              }
              return item;
            })
          }))
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['shortsFeed', sort] });
    }
  });

  // Record View Mutation
  const viewMutation = useMutation({
    mutationFn: async ({
      shortId,
      watchedSeconds,
      completed
    }: {
      shortId: string;
      watchedSeconds: number;
      completed: boolean;
    }) => {
      const res = await axios.post(`/api/shorts/${shortId}/view`, {
        watched_seconds: watchedSeconds,
        completed,
        device_type: window.innerWidth < 768 ? 'mobile' : 'desktop'
      });
      return res.data;
    }
  });

  // Helper to preload the upcoming video in browser cache
  const preloadNextVideo = useCallback((url?: string) => {
    if (!url || preloadedUrls.current.has(url)) return;
    try {
      preloadedUrls.current.add(url);
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'video';
      link.href = url;
      document.head.appendChild(link);
    } catch {
      // ignore
    }
  }, []);

  return {
    shorts,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    toggleLike: likeMutation.mutate,
    toggleFollow: subscribeMutation.mutate,
    toggleSubscribe: subscribeMutation.mutate,
    recordView: viewMutation.mutate,
    preloadNextVideo
  };
}
