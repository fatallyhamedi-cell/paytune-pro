import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Play, CheckCircle, Star } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { formatViews, formatPrice, formatDuration } from "../utils/formatNumber";
import { formatRelativeTime } from "../utils/formatRelativeTime";

export interface VideoItem {
  id: string | number;
  title: string;
  artist_name?: string;
  artist_id?: string | number;
  thumbnail_url?: string;
  preview_url?: string;
  video_url?: string;
  price_rwf?: number | null;
  price_usd?: number | null;
  is_free?: boolean;
  views?: number;
  rating_avg?: number;
  uploaded_at?: string;
  created_at?: string;
  duration?: number;
  category?: string;
  is_short?: boolean;
  artists?: {
    id?: string | number;
    full_name?: string;
    profile_image?: string;
  };
}

interface VideoCardProps {
  video: VideoItem;
  trending?: boolean;
}

export default function VideoCard({ video, trending }: VideoCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimer = useRef<any>(null);

  useEffect(() => {
    if (isHovering) {
      hoverTimer.current = setTimeout(() => {
        setShowPreview(true);
      }, 400);
    } else {
      clearTimeout(hoverTimer.current);
      setShowPreview(false);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
    }
    return () => clearTimeout(hoverTimer.current);
  }, [isHovering]);

  const artistName = video.artist_name || video.artists?.full_name || "PAYTUNE Artist";
  const artistAvatar = video.artists?.profile_image || "";
  const artistId = video.artist_id || video.artists?.id || "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
  
  const formattedPrice = formatPrice(video);
  const formattedViews = formatViews(video.views);
  const relativeTime = formatRelativeTime(video.uploaded_at || video.created_at);
  const rating = (video.rating_avg || 4.8).toFixed(1);

  return (
    <div
      id={`video-card-${video.id}`}
      className="group cursor-pointer flex flex-col w-full text-left"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* 16:9 Thumbnail Aspect Ratio */}
      <Link to={`/watch/${video.id}`} className="block w-full">
        <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-[#181818] mb-2.5 transition-all duration-300 shadow-sm group-hover:rounded-lg">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              className={`w-full h-full object-cover transition-transform duration-300 ${
                showPreview ? "opacity-0 scale-105" : "opacity-100 group-hover:scale-105"
              }`}
              alt={video.title}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-neutral-900 via-neutral-800 to-amber-950/60 flex items-center justify-center">
              <Play className="w-8 h-8 text-[#FFB300] opacity-60" />
            </div>
          )}

          {/* Hover Preview (Muted video plays on hover, loops, resets on mouse leave) */}
          <AnimatePresence>
            {showPreview && (video.preview_url || video.video_url) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 bg-black"
              >
                <video
                  ref={videoRef}
                  src={video.preview_url || video.video_url}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  onTimeUpdate={() => {
                    // Loop first 30 seconds as specified
                    if (videoRef.current && videoRef.current.currentTime > 30) {
                      videoRef.current.currentTime = 0;
                    }
                  }}
                />
                <div className="absolute top-2 right-2 z-20">
                  <Badge className="bg-red-600 text-[10px] font-black tracking-tight uppercase px-2 h-4 flex items-center border-none text-white shadow-xs">
                    Preview
                  </Badge>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Duration Badge (Bottom Right) */}
          <div className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1">
            <span className="bg-black/80 backdrop-blur-xs px-1.5 py-0.5 rounded text-[11px] font-bold text-white tracking-tight">
              {formatDuration(video.duration)}
            </span>
          </div>

          {/* Price Badge */}
          <div className="absolute top-2 left-2 z-20">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide shadow-md ${
                video.is_free
                  ? "bg-emerald-500 text-black font-extrabold"
                  : "bg-amber-500 text-black font-extrabold"
              }`}
            >
              {formattedPrice}
            </span>
          </div>

          {/* Play Icon overlay on hover */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center border border-white/20 scale-90 group-hover:scale-100 transition-transform duration-200">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>
      </Link>

      {/* Video Info Row */}
      <div className="flex gap-2.5 sm:gap-3 items-start px-0.5 mt-1 sm:mt-0">
        {/* Clickable Channel Avatar */}
        <Link
          to={`/artist/${artistId}`}
          className="flex-shrink-0 mt-0.5 hover:opacity-80 transition-opacity"
          title={artistName}
        >
          <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-gray-200 dark:bg-neutral-800 overflow-hidden ring-1 ring-gray-300 dark:ring-gray-700 flex items-center justify-center">
            {video.artists?.profile_image ? (
              <img
                src={video.artists.profile_image}
                className="w-full h-full object-cover"
                alt={artistName}
                loading="lazy"
              />
            ) : (
              <span className="text-xs font-bold text-amber-500">
                {(artistName || "A").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </Link>

        {/* Video Title & Metadata */}
        <div className="flex-1 min-w-0">
          <Link to={`/watch/${video.id}`} className="block">
            <h3 className="text-sm sm:text-[13px] font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-amber-500 transition-colors">
              {video.title}
            </h3>
          </Link>

          {/* Clickable Artist Name */}
          <Link
            to={`/artist/${artistId}`}
            className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 font-medium hover:text-gray-900 dark:hover:text-white transition-colors mt-0.5 max-w-full truncate"
          >
            <span className="truncate">{artistName}</span>
            <CheckCircle className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20 flex-shrink-0" />
          </Link>

          {/* Views, Rating & Upload Time */}
          <Link to={`/watch/${video.id}`} className="block">
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium">
              <span>{formattedViews}</span>
              <span className="opacity-40">•</span>
              <span>{relativeTime}</span>
              <span className="opacity-40">•</span>
              <span className="inline-flex items-center gap-0.5 text-amber-500 font-bold">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                {rating}
              </span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
