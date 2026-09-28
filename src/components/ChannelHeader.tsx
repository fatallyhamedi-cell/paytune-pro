import React, { useState } from 'react';
import { 
  CheckCircle, 
  Share2, 
  Flag, 
  Bell, 
  Calendar, 
  Eye, 
  Video, 
  Users,
  Check,
  ChevronDown,
  ChevronUp
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
  return num.toLocaleString();
}

// Format join date
function formatJoinDate(dateString: string): string {
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
  onShare
}: ChannelHeaderProps) {
  const [bioExpanded, setBioExpanded] = useState(false);

  return (
    <div id="channel-header-container" className="w-full bg-[#0F0F0F] text-white">
      {/* 1. 16:9 Channel Banner with Dark Gradient Overlay */}
      <div 
        id="channel-banner" 
        className="relative w-full h-44 sm:h-56 md:h-72 lg:h-80 bg-neutral-900 overflow-hidden"
      >
        {(artist.banner_image || (artist as any).banner_url) ? (
          <img
            src={artist.banner_image || (artist as any).banner_url}
            alt={`${artist.full_name} Channel Banner`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center transform scale-100 hover:scale-105 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-neutral-950 via-[#1a1a1a] to-amber-950/30" />
        )}
        {/* Cinematic dark overlay gradient to guarantee text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-black/40 to-transparent pointer-events-none" />
      </div>

      {/* 2. Channel Info & Actions Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 sm:-mt-16 relative z-10 pb-6">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          
          {/* Avatar & Channel Metadata */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            {/* Circular Avatar (100x100px) with Amber (#FFB300) border */}
            <div className="relative shrink-0">
              {(artist.profile_image || (artist as any).avatar_url) ? (
                <img
                  src={artist.profile_image || (artist as any).avatar_url}
                  alt={artist.full_name}
                  referrerPolicy="no-referrer"
                  className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full object-cover border-4 border-[#FFB300] shadow-2xl bg-neutral-800"
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full border-4 border-[#FFB300] shadow-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-black font-black text-3xl">
                  {artist.full_name ? artist.full_name.charAt(0).toUpperCase() : 'A'}
                </div>
              )}
              {artist.is_verified && (
                <div 
                  title="Verified PAYTUNE Artist"
                  className="absolute bottom-1 right-1 bg-[#FFB300] text-black p-1 rounded-full border-2 border-[#0F0F0F] shadow"
                >
                  <CheckCircle className="w-4 h-4 fill-black text-[#FFB300]" />
                </div>
              )}
            </div>

            {/* Name, Handle, and Stats */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  {artist.full_name}
                  {artist.is_verified && (
                    <CheckCircle className="w-5 h-5 text-[#FFB300] shrink-0" />
                  )}
                </h1>
              </div>

              <p className="text-sm font-medium text-neutral-400">
                @{artist.username}
              </p>

              {/* Dynamic Stats Row */}
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-neutral-300 pt-1">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#FFB300]" />
                  {formatCompactNumber(subscriberCount)} followers
                </span>
                <span className="text-neutral-500">•</span>
                <span className="flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-neutral-400" />
                  {artist.video_count || 0} videos
                </span>
                <span className="text-neutral-500">•</span>
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-neutral-400" />
                  {formatCompactNumber(artist.total_views || 0)} views
                </span>
                <span className="text-neutral-500 hidden sm:inline">•</span>
                <span className="text-neutral-400 hidden sm:flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                  {formatJoinDate(artist.join_date)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Follow, Share, Report */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
            {/* Follow Button (Amber #FFB300) */}
            <button
              id="channel-follow-btn"
              onClick={onToggleSubscribe}
              disabled={isSubscribing}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all duration-200 shadow-md active:scale-95 cursor-pointer ${
                subscribed
                  ? "bg-[#272727] hover:bg-[#383838] text-neutral-200 border border-neutral-700"
                  : "bg-[#FFB300] hover:bg-[#FFA000] text-black hover:shadow-[#FFB300]/20"
              }`}
            >
              {subscribed ? (
                <>
                  <Check className="w-4 h-4 text-[#FFB300]" />
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
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[#222222] hover:bg-[#333333] text-neutral-200 border border-neutral-800 text-sm font-medium transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4 text-neutral-300" />
              <span className="hidden sm:inline">Share</span>
            </button>

            {/* Report Button */}
            <button
              id="channel-report-btn"
              onClick={onOpenReportModal}
              title="Report Channel"
              className="p-2.5 rounded-full bg-[#222222] hover:bg-red-950/40 text-neutral-400 hover:text-red-400 border border-neutral-800 transition-colors active:scale-95"
            >
              <Flag className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3. Expandable Artist Bio */}
        {artist.bio && (
          <div className="mt-4 pt-3 border-t border-neutral-800/80 max-w-4xl">
            <div 
              onClick={() => setBioExpanded(!bioExpanded)}
              className="group cursor-pointer text-sm text-neutral-300 leading-relaxed hover:text-white transition-colors"
            >
              <p className={bioExpanded ? "whitespace-pre-line" : "line-clamp-2"}>
                {artist.bio}
              </p>
              <button 
                type="button" 
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#FFB300] mt-1 hover:underline focus:outline-none"
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
