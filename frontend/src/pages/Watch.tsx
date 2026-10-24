import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  ThumbsUp,
  Share2,
  Download,
  Star,
  CheckCircle,
  Eye,
  Calendar,
  X,
  Lock,
  Check
} from 'lucide-react';
import { VideoPlayer } from '../components/VideoPlayer';
import { CommentSection } from '../components/CommentSection';
import { useRequireAuth } from '../hooks/useRequireAuth';

export interface VideoDetail {
  id: string;
  title: string;
  description: string;
  artist_id: string;
  artist_name: string;
  price_rwf: number;
  price_usd: number;
  is_free: boolean;
  video_url: string;
  preview_url: string;
  thumbnail_url: string;
  duration: number;
  views: number;
  likes: number;
  rating_avg: number;
  rating_count: number;
  uploaded_at: string;
  category: string;
  userOwns: boolean;
  userLiked?: boolean;
  userSubscribed?: boolean;
  userRating?: number;
  artists?: {
    id: string;
    full_name: string;
    profile_image?: string;
    subscribers_count?: number;
  };
}

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { requireAuth } = useRequireAuth();

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(14200);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    console.log(`[Watch.tsx] Fetching video ID: ${id}`);

    axios
      .get(`/api/videos/${id}`)
      .then((res) => {
        const data = res.data;
        console.log('[Watch.tsx] Loaded video:', data);
        setVideo(data);
        setIsLiked(Boolean(data.userLiked));
        setLikesCount(Number(data.likes || 0));
        setIsFollowing(Boolean(data.userSubscribed));
        setUserRating(Number(data.userRating || 0));
        setFollowersCount(data.artists?.subscribers_count || 14200);
      })
      .catch((err) => {
        console.error('[Watch.tsx] Error loading video:', err);
        setError(err.response?.data?.error || 'Video not found');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handleLike = () => {
    requireAuth(async () => {
      if (!video) return;

      const previousLiked = isLiked;
      const previousLikesCount = likesCount;

      const newLikedState = !previousLiked;
      const newCount = newLikedState ? previousLikesCount + 1 : Math.max(0, previousLikesCount - 1);
      console.log(`[Watch.tsx] Optimistic like: ${newLikedState}, count: ${newCount}`);
      setIsLiked(newLikedState);
      setLikesCount(newCount);

      try {
        if (newLikedState) {
          const res = await axios.post(`/api/videos/${video.id}/like`);
          if (res.data?.likes !== undefined) setLikesCount(res.data.likes);
        } else {
          const res = await axios.delete(`/api/videos/${video.id}/like`);
          if (res.data?.likes !== undefined) setLikesCount(res.data.likes);
        }
      } catch (err) {
        console.error('[Watch.tsx] Failed to like:', err);
        setIsLiked(previousLiked);
        setLikesCount(previousLikesCount);
        showToast('Failed to update like status');
      }
    }, 'Please sign in to like this video.');
  };

  const handleFollow = () => {
    requireAuth(async () => {
      if (!video) return;

      const artistId = video.artist_id || video.artists?.id || video.id;
      const previousFollowing = isFollowing;
      const previousCount = followersCount;

      const newFollowingState = !previousFollowing;
      const newCount = newFollowingState ? previousCount + 1 : Math.max(0, previousCount - 1);
      console.log(`[Watch.tsx] Optimistic follow: ${newFollowingState}, count: ${newCount}`);
      setIsFollowing(newFollowingState);
      setFollowersCount(newCount);

      try {
        if (newFollowingState) {
          const res = await axios.post(`/api/artists/${artistId}/follow`);
          if (res.data?.followers_count !== undefined) {
            setFollowersCount(res.data.followers_count);
          }
        } else {
          const res = await axios.delete(`/api/artists/${artistId}/follow`);
          if (res.data?.followers_count !== undefined) {
            setFollowersCount(res.data.followers_count);
          }
        }
      } catch (err) {
        console.error('[Watch.tsx] Failed to follow:', err);
        setIsFollowing(previousFollowing);
        setFollowersCount(previousCount);
        showToast('Failed to update follow status');
      }
    }, 'Please sign in to follow this artist.');
  };

  const handleShare = () => {
    const currentUrl = window.location.href;
    console.log('[Watch.tsx] Sharing URL:', currentUrl);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(currentUrl).then(() => {
        showToast('Link copied to clipboard!');
      }).catch(() => {
        showToast('Link copied to clipboard!');
      });
    } else {
      window.prompt('Copy video link:', currentUrl);
      showToast('Link copied to clipboard!');
    }
  };

  const handleRateStar = async (stars: number) => {
    requireAuth(async () => {
      if (!video) return;
      setIsSubmittingRating(true);
      console.log(`[Watch.tsx] Submitting rating: ${stars} stars for video ${video.id}`);

      try {
        await axios.post(`/api/videos/${video.id}/rate`, { rating: stars });
        setUserRating(stars);
        setIsRatingModalOpen(false);
        showToast('Thank you for rating!');
      } catch (err) {
        console.error('[Watch.tsx] Rate error:', err);
        showToast('Failed to save rating.');
      } finally {
        setIsSubmittingRating(false);
      }
    }, 'Please sign in to rate this video.');
  };

  const handleDownload = () => {
    requireAuth(() => {
      if (!video) return;

      const isAllowed = video.is_free || video.userOwns;
      console.log(`[Watch.tsx] Download request. Allowed: ${isAllowed}`);

      if (!isAllowed) {
        alert('You must purchase this video to download it.');
        return;
      }

      const downloadUrl = video.video_url || video.preview_url;
      if (!downloadUrl) {
        alert('Download link unavailable.');
        return;
      }

      console.log('[Watch.tsx] Downloading from:', downloadUrl);
      window.open(downloadUrl, '_blank');
      showToast('Starting download...');
    }, 'Please sign in to download this video.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <p className="text-sm font-semibold text-gray-500">Loading video...</p>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h2 className="text-xl font-bold mb-2">Video Unavailable</h2>
        <p className="text-xs text-gray-500 mb-6">{error || 'Video not found.'}</p>
        <Link to="/" className="px-5 py-2.5 rounded-xl bg-amber-500 text-black font-extrabold text-xs shadow-md">
          Return to Home
        </Link>
      </div>
    );
  }

  const artistName = video.artists?.full_name || video.artist_name || 'Bruce Melodie';
  const artistAvatar = video.artists?.profile_image || '';

  return (
    <div id="watch-page" className="min-h-screen bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white pb-24">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-black/90 text-white border border-amber-500/50 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-fade-in">
          <Check className="w-4 h-4 text-amber-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-[1720px] mx-auto px-4 py-4 space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-amber-500 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        {/* FEATURE 1: VIDEO PLAYER */}
        <VideoPlayer
          src={video.userOwns || video.is_free ? video.video_url : (video.preview_url || video.video_url)}
          videoId={video.id}
          video={video}
          poster={video.thumbnail_url}
        />

        {/* Video Title */}
        <div className="space-y-2">
          <h1 className="text-lg sm:text-2xl font-black">{video.title}</h1>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>{(video.views || 0).toLocaleString()} views</span>
            <span>•</span>
            <span>{new Date(video.uploaded_at || Date.now()).toLocaleDateString()}</span>
            <span>•</span>
            <span>{video.category || 'Afrobeat'}</span>
          </div>
        </div>

        {/* Artist Bar & Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-y border-gray-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
              {artistAvatar ? (
                <img src={artistAvatar} alt={artistName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-amber-500">
                  {artistName[0]}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1 text-sm font-bold">
                <span>{artistName}</span>
                <CheckCircle className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
              </div>
              <p className="text-xs text-gray-500">{(followersCount || 14200).toLocaleString()} followers</p>
            </div>

            {/* FEATURE 4: FOLLOW BUTTON */}
            <button
              id="btn-follow-artist"
              onClick={handleFollow}
              className={`ml-2 px-4 py-1.5 rounded-full text-xs font-extrabold cursor-pointer transition-all ${
                isFollowing
                  ? 'bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-300'
                  : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* FEATURE 3: LIKE BUTTON */}
            <button
              id="btn-like-video"
              onClick={handleLike}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border cursor-pointer ${
                isLiked
                  ? 'bg-amber-500/15 text-amber-500 border-amber-500/40'
                  : 'bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-neutral-800'
              }`}
            >
              <ThumbsUp className={`w-4 h-4 ${isLiked ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>{likesCount.toLocaleString()}</span>
            </button>

            {/* FEATURE 5: SHARE BUTTON */}
            <button
              id="btn-share-video"
              onClick={handleShare}
              className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-neutral-800 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>

            {/* FEATURE 6: RATE BUTTON */}
            <button
              id="btn-rate-video"
              onClick={() => {
                requireAuth(() => setIsRatingModalOpen(true), 'Please sign in to rate this video.');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                userRating > 0
                  ? 'bg-amber-500/15 text-amber-500 border-amber-500/40'
                  : 'bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-neutral-800'
              }`}
            >
              <Star className={`w-4 h-4 ${userRating > 0 ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>{userRating > 0 ? `${userRating}★` : 'Rate'}</span>
            </button>

            {/* FEATURE 8: DOWNLOAD BUTTON */}
            <button
              id="btn-download-video"
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-neutral-800 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Video Description */}
        <div className="p-4 rounded-2xl bg-gray-100 dark:bg-[#161616] text-xs sm:text-sm text-gray-700 dark:text-gray-300">
          {video.description || 'Official Rwandan music video on PAYTUNE.'}
        </div>

        {/* FEATURE 7: COMMENTS SECTION */}
        <CommentSection videoId={video.id} />
      </div>

      {/* FEATURE 6: RATING MODAL */}
      {isRatingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-neutral-800 p-6 max-w-sm w-full text-center space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-neutral-800">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>Rate this Video</span>
              </h3>
              <button onClick={() => setIsRatingModalOpen(false)} className="text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => handleRateStar(star)}
                  disabled={isSubmittingRating}
                  className="p-1 cursor-pointer"
                >
                  <Star
                    className={`w-8 h-8 ${
                      (hoverRating || userRating) >= star
                        ? 'fill-amber-500 text-amber-500'
                        : 'text-gray-300 dark:text-neutral-700'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
