import { useState } from 'react';
import { 
  CheckCircle, 
  Share2, 
  Flag, 
  Video, 
  Eye, 
  Users,
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  Sparkles
} from 'lucide-react';
import { ArtistProfile } from '../hooks/useArtist';

interface ChannelHeaderProps {
  artist: ArtistProfile;
  subscribed: boolean;
  subscriberCount: number;
  isSubscribing: boolean;
  onToggleSubscribe: () => void;
  onOpenReportModal: () => void;
  onShare: () => void;
}

// Format numbers (e.g. 48500 -> 48.5K)
function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return (num || 0).toLocaleString();
}

// Format join date
function formatJoinDate(dateString?: string): string {
  if (!dateString) return 'Joined 2024';
  try {
    const d = new Date(dateString);
    const month = d.toLocaleString('default', { month: 'short' });
    const year = d.getFullYear();
    return `Joined ${month} ${year}`;
  } catch {
    return 'Joined 2024';
  }
}

export default function ChannelHeader({
  artist,
  subscribed,
  subscriberCount,
  isSubscribing,
  onToggleSubscribe,
  onOpenReportModal,
  onShare,
}: ChannelHeaderProps) {
  const [bioExpanded, setBioExpanded] = useState(false);

  const bannerImg = artist.banner_image || (artist as any).banner_url;
  const avatarImg = artist.profile_image || (artist as any).avatar_url;
  const focalX = (artist as any).banner_focal_x ?? 50;
  const focalY = (artist as any).banner_focal_y ?? 50;
  const zoom = (artist as any).banner_zoom ?? 1;

  const isMonetizedPartner = Boolean(
    (artist as any).monetization_lifetime ||
    (artist as any).monetization_status === 'approved_monetized' ||
    (artist as any).monetization_level === 3
  );

  return (
    <div id="channel-header-container" className="w-full bg-white text-gray-900 border-b border-gray-200">
      {/* 1. Full-Width YouTube-Style Channel Cover Banner (2560x1440 standard) */}
      <div 
        id="channel-banner" 
        className="relative w-full h-44 sm:h-56 md:h-72 lg:h-80 bg-neutral-900 overflow-hidden select-none"
      >
        {bannerImg ? (
          <img
            src={bannerImg}
            alt={`${artist.full_name} Channel Cover`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-500 ease-out"
            style={{
              objectPosition: `${focalX}% ${focalY}%`,
              transform: `scale(${zoom})`,
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-purple-900 via-purple-700 to-amber-500 flex items-center justify-center">
            <span className="text-white/40 text-sm font-semibold tracking-wider uppercase">
              {artist.full_name || 'PayTune Channel'}
            </span>
          </div>
        )}
        {/* Subtle bottom shadow vignette for contrast against the light page */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 pointer-events-none" />
      </div>

      {/* 2. Channel Info & Actions Section (Light Theme) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 sm:-mt-16 relative z-10 pb-6">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          
          {/* Avatar & Channel Metadata */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            {/* Circular Avatar (1024x1024 master) with white border & purple/amber ring */}
            <div className="relative shrink-0">
              {avatarImg ? (
                <img
                  src={avatarImg}
                  alt={artist.full_name}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full object-cover border-4 border-white shadow-xl ring-2 ring-purple-600 bg-white"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full border-4 border-white shadow-xl ring-2 ring-purple-600 bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white font-black text-3xl">
                  {artist.full_name ? artist.full_name.charAt(0).toUpperCase() : 'A'}
                </div>
              )}
              {artist.is_verified && (
                <div 
                  title="Verified PayTune Creator"
                  className="absolute bottom-1 right-1 bg-purple-600 text-white p-1 rounded-full border-2 border-white shadow"
                >
                  <CheckCircle className="w-4 h-4 fill-white text-purple-600" />
                </div>
              )}
            </div>

            {/* Name, Handle, Partner Badge, and Stats */}
            <div className="space-y-1.5 pt-2 sm:pt-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
                  {artist.full_name}
                  {artist.is_verified && (
                    <CheckCircle className="w-5 h-5 text-purple-600 shrink-0" />
                  )}
                </h1>

                {/* Lifetime Partner Program Badge */}
                {isMonetizedPartner && (
                  <span 
                    title="PayTune Partner Program: Approved Lifetime Monetization"
                    className="inline-flex items-center gap-1 text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#FFB300]" />
                    <span>PayTune Partner</span>
                  </span>
                )}
              </div>

              <p className="text-sm font-medium text-gray-500">
                @{artist.username}
              </p>

              {/* Dynamic Stats Row */}
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-600 pt-1">
                <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-600" />
                  {formatCompactNumber(subscriberCount)} followers
                </span>
                <span className="text-gray-300">•</span>
                <span className="flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-gray-400" />
                  {artist.video_count || 0} videos
                </span>
                <span className="text-gray-300">•</span>
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-gray-400" />
                  {formatCompactNumber(artist.total_views || 0)} views
                </span>
                <span className="text-gray-300 hidden sm:inline">•</span>
                <span className="text-gray-500 hidden sm:flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  {formatJoinDate(artist.join_date)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Follow, Share, Report */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
            {/* Follow Button (Brand Purple #8B5CF6 / Active Gray) */}
            <button
              id="channel-follow-btn"
              onClick={onToggleSubscribe}
              disabled={isSubscribing}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm transition-all duration-200 shadow-sm active:scale-95 cursor-pointer ${
                subscribed
                  ? "bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300"
                  : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20"
              }`}
            >
              {subscribed ? (
                <>
                  <Check className="w-4 h-4 text-purple-600" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  <span>Follow</span>
                </>
              )}
            </button>

            {/* Share Button */}
            <button
              id="channel-share-btn"
              onClick={onShare}
              title="Share Channel"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 text-sm font-medium transition-all active:scale-95 cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-gray-500" />
              <span className="hidden sm:inline">Share</span>
            </button>

            {/* Report Button */}
            <button
              id="channel-report-btn"
              onClick={onOpenReportModal}
              title="Report Channel"
              className="p-2.5 rounded-full bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-300 transition-colors active:scale-95 cursor-pointer"
            >
              <Flag className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3. Expandable Artist Bio */}
        {artist.bio && (
          <div className="mt-4 pt-3 border-t border-gray-100 max-w-4xl">
            <div 
              onClick={() => setBioExpanded(!bioExpanded)}
              className="group cursor-pointer text-sm text-gray-700 leading-relaxed hover:text-gray-900 transition-colors"
            >
              <p className={bioExpanded ? "whitespace-pre-line" : "line-clamp-2"}>
                {artist.bio}
              </p>
              <button 
                type="button" 
                className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 mt-1 hover:underline focus:outline-none cursor-pointer"
              >
                {bioExpanded ? (
                  <>Show less <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>Read more <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
