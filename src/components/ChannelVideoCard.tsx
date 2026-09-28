import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Play, Eye, Clock, Lock, Sparkles } from 'lucide-react';

interface ChannelVideoCardProps {
  video: {
    id: string;
    title: string;
    description?: string;
    thumbnail_url: string;
    preview_url?: string;
    video_url?: string;
    price_rwf?: number | null;
    price_usd?: number | null;
    is_free?: boolean;
    duration?: number | string;
    views?: number;
    uploaded_at?: string;
    created_at?: string;
    category?: string;
    artists?: {
      full_name?: string;
      profile_image?: string;
    };
  };
}

// Format duration in seconds to MM:SS
function formatDuration(sec: number | string | undefined): string {
  if (!sec) return '3:45';
  const total = typeof sec === 'string' ? parseInt(sec) || 210 : sec;
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Format compact view count
function formatViews(count: number | undefined): string {
  if (!count) return '0 views';
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M views';
  }
  if (count >= 1_000) {
    return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K views';
  }
  return `${count} views`;
}

// Relative time format
function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return 'Recently';
  try {
    const now = new Date();
    const past = new Date(dateStr);
    const diffMs = now.getTime() - past.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    if (diffYear > 0) return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
    if (diffMonth > 0) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
    if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    if (diffHr > 0) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
    if (diffMin > 0) return `${diffMin} min ago`;
    return 'Just now';
  } catch {
    return 'Recently';
  }
}

export default function ChannelVideoCard({ video }: ChannelVideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isFree = video.is_free || (!video.price_rwf && !video.price_usd);
  const formattedPrice = isFree 
    ? "FREE" 
    : video.price_rwf 
      ? `${video.price_rwf.toLocaleString()} RWF` 
      : `$${video.price_usd || '1.00'}`;

  const previewSource = video.preview_url || video.video_url || "https://www.w3schools.com/html/mov_bbb.mp4";

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    }, 280);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div 
      id={`channel-video-card-${video.id}`}
      className="group flex flex-col bg-[#161616] hover:bg-[#1f1f1f] rounded-xl overflow-hidden border border-neutral-800/70 hover:border-neutral-700 transition-all duration-300 hover:shadow-xl hover:shadow-black/60"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link to={`/watch/${video.id}`} className="block relative aspect-video w-full bg-neutral-900 overflow-hidden">
        {/* Static 16:9 Thumbnail Image */}
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              isHovered ? 'opacity-0' : 'opacity-100'
            }`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-neutral-900 via-neutral-800 to-amber-950/60 flex items-center justify-center">
            <Play className="w-8 h-8 text-[#FFB300] opacity-60" />
          </div>
        )}

        {/* Hover 30s Muted Video Preview */}
        <video
          ref={videoRef}
          src={previewSource}
          muted
          playsInline
          loop
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isHovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Hover Play Icon Overlay */}
        <div className={`absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] transition-opacity duration-200 ${
          isHovered ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
        }`}>
          <div className="w-11 h-11 rounded-full bg-[#FFB300] text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
            <Play className="w-5 h-5 fill-black ml-0.5" />
          </div>
        </div>

        {/* Price Badge: Amber (#FFB300) for Paid, Green for FREE */}
        <div className="absolute top-2.5 left-2.5 z-10">
          <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded shadow-md tracking-wider uppercase ${
            isFree 
              ? 'bg-emerald-600 text-white font-bold' 
              : 'bg-[#FFB300] text-black font-extrabold shadow-[#FFB300]/20'
          }`}>
            {!isFree && <Lock className="w-2.5 h-2.5" />}
            {formattedPrice}
          </span>
        </div>

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 z-10">
          <span className="bg-black/85 backdrop-blur-sm text-neutral-200 text-[11px] font-semibold px-1.5 py-0.5 rounded tracking-tight">
            {formatDuration(video.duration)}
          </span>
        </div>

        {/* Preview status bar when hovered */}
        {isHovered && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#FFB300] animate-pulse z-20" />
        )}
      </Link>

      {/* Video Info Section */}
      <div className="p-3.5 flex flex-col flex-1 justify-between gap-2">
        <Link to={`/watch/${video.id}`} className="block">
          <h3 
            title={video.title}
            className="text-sm font-semibold text-neutral-100 group-hover:text-[#FFB300] line-clamp-2 leading-snug transition-colors"
          >
            {video.title}
          </h3>
        </Link>

        {/* Metadata: Views & Upload Date */}
        <div className="flex items-center justify-between text-xs text-neutral-400 pt-1 border-t border-neutral-800/60">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-neutral-500" />
            <span>{formatViews(video.views)}</span>
          </div>

          <div className="flex items-center gap-1.5 text-neutral-400">
            <Clock className="w-3.5 h-3.5 text-neutral-500" />
            <span>{formatRelativeTime(video.uploaded_at || video.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
