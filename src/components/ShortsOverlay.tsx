import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Volume2, 
  VolumeX, 
  CheckCircle2, 
  Music2, 
  Coins,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ShortItem } from '../hooks/useShorts';

interface ShortsOverlayProps {
  short: ShortItem;
  isMuted: boolean;
  onToggleMute: () => void;
  onLike: () => void;
  onSubscribe: () => void;
  onOpenComments: () => void;
  onOpenShare: () => void;
  onOpenTip?: () => void;
}

// Utility to format numbers e.g. 14200 -> 14.2K
function formatCount(num: number): string {
  if (!num || isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return String(num);
}

// Format relative date
function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
  } catch {
    return 'Recently';
  }
}

export const ShortsOverlay: React.FC<ShortsOverlayProps> = ({
  short,
  isMuted,
  onToggleMute,
  onLike,
  onSubscribe,
  onOpenComments,
  onOpenShare,
  onOpenTip
}) => {
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [likeBouncing, setLikeBouncing] = useState(false);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLikeBouncing(true);
    setTimeout(() => setLikeBouncing(false), 400);
    onLike();
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 pb-6 z-20">
      {/* Top Header Row: Mute status pill & Quality badge */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-black/50 backdrop-blur-md text-amber-400 border border-amber-500/30">
            Shorts
          </span>
          <span className="text-xs text-white/70 font-medium px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm">
            {formatRelativeTime(short.created_at)}
          </span>
        </div>

        {/* Audio status toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className="p-2.5 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 active:scale-95 transition-all border border-white/10"
          aria-label={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? (
            <div className="flex items-center gap-1.5 px-1">
              <VolumeX className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400 hidden sm:inline">Tap to unmute</span>
            </div>
          ) : (
            <Volume2 className="w-4 h-4 text-white" />
          )}
        </button>
      </div>

      {/* Bottom Area: Metadata on Left, Interaction rail on Right */}
      <div className="flex items-end justify-between gap-3 w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent -mx-4 -mb-6 p-4 pt-16 rounded-b-2xl">
        {/* Left Information Area */}
        <div className="flex-1 max-w-[76%] sm:max-w-[80%] pointer-events-auto space-y-2.5">
          {/* Artist identity & Subscribe Button */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link 
              to={`/artist/${short.artist_id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <div className="relative">
                {short.artist_avatar ? (
                  <img
                    src={short.artist_avatar}
                    alt={short.artist_name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-amber-400 group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-500 text-black font-black text-sm flex items-center justify-center border-2 border-amber-400">
                    {short.artist_name?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                )}
                {short.artist_verified && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 fill-black absolute -bottom-0.5 -right-0.5" />
                )}
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors drop-shadow-sm">
                    {short.artist_name}
                  </span>
                </div>
                <span className="text-xs text-white/70">
                  {short.artist_username}
                </span>
              </div>
            </Link>

            {/* Amber Follow Button */}
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={(e) => {
                e.stopPropagation();
                onSubscribe();
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-md cursor-pointer ${
                short.is_subscribed
                  ? "bg-white/20 hover:bg-white/30 text-white border border-white/30"
                  : "bg-amber-400 hover:bg-amber-500 text-black shadow-amber-500/20"
              }`}
            >
              {short.is_subscribed ? "Following" : "Follow"}
            </motion.button>
          </div>

          {/* Video Title & Description */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-white/95 line-clamp-2 drop-shadow-md">
              {short.title}
            </p>
            {short.description && (
              <div>
                <AnimatePresence initial={false}>
                  {expandedDesc ? (
                    <motion.p 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-white/80 leading-relaxed max-h-28 overflow-y-auto pr-1"
                    >
                      {short.description}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedDesc(!expandedDesc);
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-0.5 mt-0.5"
                >
                  {expandedDesc ? (
                    <>Show less <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>...more <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Music Audio Tag & Rotating Disc */}
          <div className="flex items-center gap-2 text-xs text-white/90 pt-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 max-w-[240px] truncate">
              <Music2 className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
              <span className="truncate">{short.song_title}</span>
            </div>
          </div>
        </div>

        {/* Right Interaction Vertical Rail */}
        <div className="flex flex-col items-center gap-4 pointer-events-auto shrink-0 pb-1">
          {/* Like Button */}
          <div className="flex flex-col items-center gap-1">
            <motion.button
              whileTap={{ scale: 0.8 }}
              animate={likeBouncing ? { scale: [1, 1.35, 0.95, 1.1, 1] } : {}}
              transition={{ duration: 0.4 }}
              onClick={handleLikeClick}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                short.is_liked
                  ? "bg-red-500/20 text-red-500 border border-red-500/40"
                  : "bg-black/50 backdrop-blur-md text-white hover:bg-black/70 border border-white/10"
              }`}
              aria-label="Like short"
            >
              <Heart 
                className={`w-6 h-6 transition-colors ${
                  short.is_liked ? "fill-red-500 text-red-500" : "text-white"
                }`} 
              />
            </motion.button>
            <span className="text-xs font-semibold text-white drop-shadow">
              {formatCount(short.likes)}
            </span>
          </div>

          {/* Comment Button */}
          <div className="flex flex-col items-center gap-1">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenComments();
              }}
              className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 border border-white/10 flex items-center justify-center transition-all"
              aria-label="Open comments"
            >
              <MessageSquare className="w-5 h-5 text-white" />
            </motion.button>
            <span className="text-xs font-semibold text-white drop-shadow">
              {formatCount(short.comments_count)}
            </span>
          </div>

          {/* Share Button */}
          <div className="flex flex-col items-center gap-1">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenShare();
              }}
              className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 border border-white/10 flex items-center justify-center transition-all"
              aria-label="Share short"
            >
              <Share2 className="w-5 h-5 text-white" />
            </motion.button>
            <span className="text-xs font-semibold text-white drop-shadow">
              Share
            </span>
          </div>

          {/* MoMo Tip Button */}
          {onOpenTip && (
            <div className="flex flex-col items-center gap-1">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTip();
                }}
                className="w-12 h-12 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/40 hover:bg-amber-400/30 backdrop-blur-md flex items-center justify-center transition-all"
                aria-label="Tip artist via Mobile Money"
              >
                <Coins className="w-5 h-5 text-amber-400" />
              </motion.button>
              <span className="text-xs font-semibold text-amber-400 drop-shadow">
                Tip
              </span>
            </div>
          )}

          {/* Animated Spinning Vinyl Disc */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="w-10 h-10 rounded-full p-1 bg-neutral-900 border-2 border-amber-400/70 shadow-lg flex items-center justify-center cursor-pointer mt-1"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
          >
            {short.artist_avatar ? (
              <img 
                src={short.artist_avatar} 
                alt="disc" 
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-amber-500 text-black font-bold text-[10px] flex items-center justify-center">
                {short.artist_name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ShortsOverlay;
