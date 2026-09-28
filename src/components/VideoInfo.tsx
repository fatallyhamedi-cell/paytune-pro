import React, { useState } from 'react';
import { 
  CheckCircle2, 
  UserPlus, 
  UserCheck, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Tag,
  ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoData } from '../hooks/useVideo';
import { useAuth } from '../hooks/useAuth';

interface VideoInfoProps {
  video: VideoData;
  onToggleSubscribe: () => Promise<any>;
}

export const VideoInfo: React.FC<VideoInfoProps> = ({ video, onToggleSubscribe }) => {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [following, setFollowing] = useState(false);

  // Format views
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Format date
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recently uploaded';
    }
  };

  const handleFollow = async () => {
    if (!user) {
      alert("Please sign in to follow this artist.");
      return;
    }
    setFollowing(true);
    try {
      await onToggleSubscribe();
    } catch (e) {
      console.error(e);
    } finally {
      setFollowing(false);
    }
  };

  const artist = video.artists || {
    id: video.artist_id,
    full_name: video.artist_name,
    profile_image: "",
    is_verified: true,
    subscribers_count: 0
  };

  return (
    <div id="video-info-section" className="space-y-4 pt-4">
      {/* Title */}
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
        {video.title}
      </h1>

      {/* Artist Profile Bar & Follow Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-1 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div className="flex items-center gap-3">
          {artist.profile_image ? (
            <img
              src={artist.profile_image}
              alt={artist.full_name}
              className="w-11 h-11 rounded-full object-cover border border-amber-500/40"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-black font-black text-base border border-amber-500/40">
              {artist.full_name ? artist.full_name.charAt(0).toUpperCase() : 'A'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-900 dark:text-white hover:text-amber-500 transition-colors cursor-pointer">
                {artist.full_name}
              </span>
              {artist.is_verified && (
                <span title="Verified PAYTUNE Artist">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 fill-amber-500/20" />
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatNumber(artist.subscribers_count || 0)} followers
            </p>
          </div>

          <Button
            id="channel-follow-btn"
            onClick={handleFollow}
            disabled={following}
            variant={video.userSubscribed ? "outline" : "default"}
            className={`ml-2 h-9 px-4 rounded-full text-xs font-bold transition-all cursor-pointer ${
              video.userSubscribed
                ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                : "bg-amber-500 hover:bg-amber-400 text-black shadow-sm"
            }`}
          >
            {video.userSubscribed ? (
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-500" /> Following
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" /> Follow
              </span>
            )}
          </Button>
        </div>

        {/* Pricing / Access Status Badge */}
        <div className="flex items-center gap-2">
          {video.is_free ? (
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold">
              Free to Watch
            </span>
          ) : video.userOwns ? (
            <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/40 text-xs font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Lifetime Unlocked
            </span>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e1e1e] border border-amber-500/40 text-xs">
              <span className="font-bold text-amber-400">{video.price_rwf.toLocaleString()} RWF</span>
              <span className="text-gray-400 font-medium">(${video.price_usd.toFixed(2)})</span>
            </div>
          )}
        </div>
      </div>

      {/* Description Card (Expandable) */}
      <div 
        id="video-description-box"
        className="p-4 rounded-xl bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800/80 text-sm transition-all"
      >
        <div className="flex flex-wrap items-center gap-2 font-semibold text-xs text-gray-700 dark:text-gray-300 mb-2">
          <span>{formatNumber(video.views)} views</span>
          <span>•</span>
          <span>{formatDate(video.uploaded_at || video.upload_date || '')}</span>
          <span>•</span>
          <span className="text-amber-600 dark:text-amber-400 font-bold">{video.category || "Afrobeats"}</span>
          {video.purchaseCount ? (
            <>
              <span>•</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {video.purchaseCount} purchases
              </span>
            </>
          ) : null}
        </div>

        {/* Text content */}
        <div className={`text-gray-800 dark:text-gray-300 text-sm whitespace-pre-line leading-relaxed ${
          isExpanded ? '' : 'line-clamp-2'
        }`}>
          {video.description || "Official music video released on PAYTUNE. Support the artist with direct mobile money transactions."}
        </div>

        {/* Tags & Credits (Visible when expanded) */}
        {isExpanded && (
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800 space-y-3">
            {video.tags && video.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-500" />
                {video.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="text-xs text-gray-500 dark:text-gray-400 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <div><strong>Artist:</strong> {video.artist_name}</div>
              <div><strong>Genre:</strong> {video.category}</div>
              <div><strong>License:</strong> PAYTUNE Direct Artist Revenue Share (70/30)</div>
              <div><strong>Tax:</strong> 5% Rwanda VAT Included</div>
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          {isExpanded ? (
            <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>Show More <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>
      </div>
    </div>
  );
};
