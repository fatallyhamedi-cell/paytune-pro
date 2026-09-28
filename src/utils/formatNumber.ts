/**
 * Number and currency formatting utilities for PayTune
 */

export function formatViews(views: number | undefined | null): string {
  const count = views || 0;
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K views`;
  }
  return `${count} ${count === 1 ? 'view' : 'views'}`;
}

export function formatCompactNumber(num: number | undefined | null): string {
  const count = num || 0;
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `${count}`;
}

export function formatPrice(video: { is_free?: boolean; price_rwf?: number | null; price_usd?: number | null }): string {
  if (video.is_free) {
    return 'FREE';
  }
  if (video.price_rwf) {
    return `${video.price_rwf.toLocaleString()} RWF`;
  }
  if (video.price_usd) {
    return `$${video.price_usd.toFixed(2)}`;
  }
  return '500 RWF';
}

export function formatDuration(seconds: number | undefined | null): string {
  if (!seconds) return '3:45';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
