import { queryClient } from './queryClient';

export const FOLLOWING_CHANGED_EVENT = 'paytune-following-changed';

export function notifyFollowingChanged(userId?: string | null) {
  queryClient.invalidateQueries({ queryKey: ['following-artists'] });
  queryClient.invalidateQueries({ queryKey: ['following-feed'] });
  queryClient.invalidateQueries({ queryKey: ['shortsFeed', 'following'] });
  queryClient.invalidateQueries({ queryKey: ['music-home'] });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(FOLLOWING_CHANGED_EVENT, {
        detail: { userId: userId || null, timestamp: Date.now() },
      })
    );
  }
}
