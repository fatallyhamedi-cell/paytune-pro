import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
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
  Heart,
  Radio,
  Check
} from 'lucide-react';
import { VideoPlayer } from '../components/VideoPlayer';
import { CommentSection } from '../components/CommentSection';
import { UpNextSidebar } from '../components/UpNextSidebar';
import { PaymentModal } from '../components/PaymentModal';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useAuth } from '../hooks/useAuth';
import { notifyFollowingChanged } from '../lib/followingEvents';

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
  content_type?: string;
  series_id?: string | null;
  episode_number?: number | null;
  userOwns: boolean;
  userLiked?: boolean;
  userSubscribed?: boolean;
  userRating?: number;
  captions?: Array<{
    id?: string;
    language_code: string;
    label?: string;
    kind?: string;
    url: string;
    is_default?: boolean;
  }>;
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
  const { user } = useAuth();
  const { requireAuth } = useRequireAuth();

  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feature 3: Optimistic Like State
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  // Feature 4: Optimistic Follow State
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  // Feature 5: Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Feature 6: Rating Modal State
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Related videos & Autoplay
  const [relatedVideos, setRelatedVideos] = useState<any[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [autoplay, setAutoplay] = useState(true);

  // Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Watch Progress Resilience (saves every 5s, resumes position)
  const [savedProgress, setSavedProgress] = useState(0);
  const lastProgressRef = React.useRef(0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Fetch Video Details & Saved Progress
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    console.log(`[Watch.tsx] Fetching video details for ID: ${id}`);

    api
      .get(`/api/videos/${id}`)
      .then((res) => {
        const data = res.data;
        console.log('[Watch.tsx] Video data loaded:', data);
        setVideo(data);
        setIsLiked(Boolean(data.userLiked));
        setLikesCount(Number(data.likes || 0));
        setIsFollowing(Boolean(data.userSubscribed));
        setUserRating(Number(data.userRating || 0));
        const subCount = Number(data.artists?.subscribers_count ?? 0);
        setFollowersCount(subCount);
      })
      .catch((err) => {
        console.error('[Watch.tsx] Failed to load video:', err);
        setError(err.response?.data?.error || err.message || 'Video not found');
      })
      .finally(() => {
        setLoading(false);
      });

    // Fetch saved watch progress
    api
      .get(`/api/videos/${id}/progress`)
      .then((res) => {
        const pos = Number(res.data?.positionSeconds || res.data?.position_seconds || 0);
        if (pos > 5) {
          console.log(`[Watch.tsx] Loaded saved progress: ${pos}s`);
          setSavedProgress(pos);
        }
      })
      .catch(() => {});
  }, [id]);

  // Throttled progress update (saves position every 5s)
  const handleProgressUpdate = (seconds: number) => {
    const sec = Math.floor(seconds);
    if (Math.abs(sec - lastProgressRef.current) >= 5 && id) {
      lastProgressRef.current = sec;
      api
        .post(`/api/videos/${id}/progress`, { positionSeconds: sec })
        .catch(() => {});
    }
  };

  // 2. Fetch Related Videos
  useEffect(() => {
    if (!id) return;
    setLoadingRelated(true);
    api
      .get(`/api/videos/${id}/related`)
      .then((res) => {
        setRelatedVideos(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        api.get('/api/videos/trending').then((t) => {
          setRelatedVideos(Array.isArray(t.data) ? t.data : []);
        }).catch(() => setRelatedVideos([]));
      })
      .finally(() => {
        setLoadingRelated(false);
      });
  }, [id]);

  // FEATURE 3 — LIKE BUTTON (OPTIMISTIC UI UPDATE)
  const handleLike = () => {
    requireAuth(async () => {
      if (!video) return;

      const previousLiked = isLiked;
      const previousLikesCount = likesCount;

      const newLikedState = !previousLiked;
      const newCount = newLikedState ? previousLikesCount + 1 : Math.max(0, previousLikesCount - 1);
      setIsLiked(newLikedState);
      setLikesCount(newCount);

      try {
        if (newLikedState) {
          const res = await api.post(`/api/videos/${video.id}/like`);
          if (res.data?.likes !== undefined) setLikesCount(res.data.likes);
        } else {
          const res = await api.delete(`/api/videos/${video.id}/like`);
          if (res.data?.likes !== undefined) setLikesCount(res.data.likes);
        }
      } catch (err: any) {
        console.error('[Watch.tsx] Failed to toggle like, reverting:', err);
        setIsLiked(previousLiked);
        setLikesCount(previousLikesCount);
        showToast('Failed to update like status');
      }
    }, 'Please sign in to like this video.');
  };

  // FEATURE 4 — FOLLOW BUTTON (OPTIMISTIC UI UPDATE)
  const handleFollow = () => {
    requireAuth(async () => {
      if (!video) return;

      const artistId = video.artist_id || video.artists?.id || video.id;
      const previousFollowing = isFollowing;
      const previousCount = followersCount;

      const newFollowingState = !previousFollowing;
      const newCount = newFollowingState ? previousCount + 1 : Math.max(0, previousCount - 1);
      setIsFollowing(newFollowingState);
      setFollowersCount(newCount);

      try {
        if (newFollowingState) {
          const res = await api.post(`/api/artists/${artistId}/follow`, { action: 'follow' });
          if (res.data?.followers_count !== undefined) {
            setFollowersCount(res.data.followers_count);
          }
        } else {
          const res = await api.delete(`/api/artists/${artistId}/follow`);
          if (res.data?.followers_count !== undefined) {
            setFollowersCount(res.data.followers_count);
          }
        }
        notifyFollowingChanged(user?.id);
      } catch (err: any) {
        console.error('[Watch.tsx] Failed to toggle follow, reverting:', err);
        setIsFollowing(previousFollowing);
        setFollowersCount(previousCount);
        showToast('Failed to update follow status');
      }
    }, 'Please sign in to follow this artist.');
  };

  // FEATURE 5 — SHARE BUTTON
  const handleShare = async () => {
    try {
      const currentUrl = window.location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentUrl);
        showToast('Link copied to clipboard!');
      } else {
        const tempInput = document.createElement('input');
        tempInput.value = currentUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(tempInput);
        showToast(copied ? 'Link copied to clipboard!' : `Share URL: ${currentUrl}`);
      }
    } catch (err) {
      console.error('[Watch.tsx] Share error:', err);
      showToast('Unable to copy link automatically. Copy from browser address bar.');
    }
  };

  // FEATURE 6 — RATE BUTTON
  const handleRateStar = async (stars: number) => {
    requireAuth(async () => {
      if (!video) return;
      setIsSubmittingRating(true);

      try {
        const res = await api.post(`/api/videos/${video.id}/rate`, { rating: stars });
        setUserRating(stars);
        if (res.data?.rating_avg !== undefined) {
          setVideo((prev) =>
            prev
              ? {
                  ...prev,
                  rating_avg: Number(res.data.rating_avg),
                  rating_count: Number(res.data.rating_count ?? prev.rating_count),
                }
              : null
          );
        }
        setIsRatingModalOpen(false);
        showToast('Thank you for rating!');
      } catch (err: any) {
        console.error('[Watch.tsx] Rate error:', err);
        showToast('Failed to save rating. Try again.');
      } finally {
        setIsSubmittingRating(false);
      }
    }, 'Please sign in to rate this video.');
  };

  // FEATURE 8 — DOWNLOAD BUTTON
  const handleDownload = () => {
    requireAuth(() => {
      if (!video) return;

      const isAllowed = video.is_free || video.userOwns;
      if (!isAllowed) {
        showToast('Purchase this video to unlock offline download.');
        setIsPaymentModalOpen(true);
        return;
      }

      const downloadUrl = video.video_url || video.preview_url;
      if (!downloadUrl) {
        showToast('Download link is currently unavailable.');
        return;
      }

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${video.title || 'paytune-video'}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Starting download...');
    }, 'Please sign in to download this video.');
  };

  // Purchase complete callback
  const handlePurchaseSuccess = () => {
    console.log('[Watch.tsx] Purchase completed! Updating entitlement to true.');
    setVideo((prev) => (prev ? { ...prev, userOwns: true } : null));
    showToast('Video unlocked! Permanent access granted.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-purple-600 mb-4" />
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Loading video...</p>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h2 className="text-xl font-bold mb-2">Video Unavailable</h2>
        <p className="text-xs sm:text-sm text-gray-500 max-w-sm mb-6">{error || 'Video not found.'}</p>
        <Link
          to="/"
          className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-md transition-colors"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  const artistName = video.artists?.full_name || video.artist_name || 'PAYTUNE Creator';
  const artistAvatar = video.artists?.profile_image || '';

  return (
    <div id="watch-page" className="min-h-screen bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white transition-colors pb-24">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-black/90 text-white border border-purple-600/50 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-fade-in">
          <Check className="w-4 h-4 text-purple-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-[1720px] mx-auto px-3 sm:px-5 lg:px-6 py-4">
        {/* Back Link */}
        <div className="mb-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-purple-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>

        {/* Main Grid: Video Player Column + Sidebar Column */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content Column */}
          <div className="lg:col-span-8 space-y-4">
            {/* FEATURE 1: CUSTOM VIDEO PLAYER WITH WATERMARK & PAYWALL STRIP */}
            <VideoPlayer
              src={video.userOwns || video.is_free ? video.video_url : (video.preview_url || video.video_url)}
              videoId={video.id}
              video={video}
              captions={video.captions || []}
              poster={video.thumbnail_url}
              savedProgress={savedProgress}
              hasNext={relatedVideos.length > 0}
              onNext={() => {
                if (relatedVideos.length > 0) {
                  navigate(`/watch/${relatedVideos[0].id}`);
                }
              }}
              isSubscribed={isFollowing}
              onToggleSubscribe={handleFollow}
              onShare={handleShare}
              onOpenPaymentModal={() => setIsPaymentModalOpen(true)}
              onProgressUpdate={handleProgressUpdate}
              onEnded={() => {
                if (autoplay && relatedVideos.length > 0) {
                  navigate(`/watch/${relatedVideos[0].id}`);
                }
              }}
            />

            {/* Video Title & Price Badge */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-lg sm:text-xl md:text-2xl font-black leading-snug tracking-tight">
                  {video.title}
                </h1>

                {/* Price / Purchase Badge */}
                {!video.is_free && !video.userOwns ? (
                  <button
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Unlock Full Video ({video.price_rwf ? `${video.price_rwf.toLocaleString()} RWF` : '$0.50'})</span>
                  </button>
                ) : (
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-xs font-extrabold uppercase tracking-wide">
                    {video.is_free ? 'Free' : 'Purchased'}
                  </span>
                )}
              </div>

              {/* Views, Upload Date, Category */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span>{(video.views || 0).toLocaleString()} views</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(video.uploaded_at || Date.now()).toLocaleDateString()}</span>
                </span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 font-semibold text-gray-700 dark:text-gray-300">
                  {video.category || 'Afrobeat'}
                </span>
                {video.rating_avg && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-purple-600 font-bold">
                      <Star className="w-3.5 h-3.5 fill-purple-600" />
                      <span>{video.rating_avg.toFixed(1)}</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Artist & Action Buttons Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-y border-gray-200 dark:border-neutral-800">
              {/* Artist Profile & Follow Button */}
              <div className="flex items-center gap-3">
                <Link to={`/artist/${video.artist_id || '1'}`} className="flex items-center gap-3 group">
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0 ring-2 ring-purple-600/30">
                    {artistAvatar ? (
                      <img src={artistAvatar} alt={artistName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-purple-600">
                        {artistName[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-sm font-bold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">
                      <span>{artistName}</span>
                      <CheckCircle className="w-3.5 h-3.5 text-purple-600 fill-purple-600/20" />
                    </div>
                    <p className="text-xs text-gray-500">
                      {Number(followersCount || 0).toLocaleString()} followers
                    </p>
                  </div>
                </Link>

                {/* FEATURE 4: FOLLOW BUTTON */}
                <button
                  id="btn-follow-artist"
                  type="button"
                  onClick={handleFollow}
                  className={`ml-2 px-4 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer shadow-xs ${
                    isFollowing
                      ? 'bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-neutral-700'
                      : 'bg-purple-600 hover:bg-purple-500 text-white'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>

              {/* Action Buttons Row: Like, Share, Rate, Download */}
              <div className="flex flex-wrap items-center gap-2">
                {/* FEATURE 3: LIKE BUTTON */}
                <button
                  id="btn-like-video"
                  type="button"
                  onClick={handleLike}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                    isLiked
                      ? 'bg-purple-600/15 text-purple-600 border-purple-600/40 shadow-xs'
                      : 'bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#252525] border-gray-200 dark:border-neutral-800'
                  }`}
                >
                  <ThumbsUp className={`w-4 h-4 ${isLiked ? 'fill-purple-600 text-purple-600' : ''}`} />
                  <span>{likesCount.toLocaleString()}</span>
                </button>

                {/* FEATURE 5: SHARE BUTTON */}
                <button
                  id="btn-share-video"
                  type="button"
                  onClick={handleShare}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#252525] border border-gray-200 dark:border-neutral-800 transition-all cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>

                {/* FEATURE 6: RATE BUTTON */}
                <button
                  id="btn-rate-video"
                  type="button"
                  onClick={() => {
                    requireAuth(() => setIsRatingModalOpen(true), 'Please sign in to rate this video.');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                    userRating > 0
                      ? 'bg-purple-600/15 text-purple-600 border-purple-600/40'
                      : 'bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#252525] border-gray-200 dark:border-neutral-800'
                  }`}
                >
                  <Star className={`w-4 h-4 ${userRating > 0 ? 'fill-purple-600 text-purple-600' : ''}`} />
                  <span>{userRating > 0 ? `${userRating}★` : 'Rate'}</span>
                </button>

                {/* FEATURE 8: DOWNLOAD BUTTON */}
                <button
                  id="btn-download-video"
                  type="button"
                  onClick={handleDownload}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-gray-100 dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#252525] border border-gray-200 dark:border-neutral-800 transition-all cursor-pointer"
                  title={video.is_free || video.userOwns ? 'Download Video' : 'Purchase required to download'}
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>

            {/* Video Description Box */}
            <div className="p-4 rounded-2xl bg-gray-100 dark:bg-[#161616] border border-gray-200 dark:border-neutral-800 text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {video.description || 'Experience official Rwandan music and exclusive creator releases on PAYTUNE.'}
            </div>

            {/* FEATURE 7: COMMENTS SECTION */}
            <CommentSection videoId={video.id} />
          </div>

          {/* Right Column: Dynamic Dark Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <UpNextSidebar
              currentVideoId={video.id}
              artistName={artistName}
              category={video.category}
              contentType={video.content_type}
              relatedVideos={relatedVideos}
              loadingRelated={loadingRelated}
              autoplay={autoplay}
              onToggleAutoplay={setAutoplay}
            />
          </div>
        </div>
      </div>

      {/* FEATURE 6: 5-STAR RATING MODAL */}
      {isRatingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-2xl p-6 max-w-sm w-full text-center space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Star className="w-4 h-4 text-purple-600 fill-purple-600" />
                <span>Rate this Video</span>
              </h3>
              <button
                onClick={() => setIsRatingModalOpen(false)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              How would you rate "{video.title}"?
            </p>

            {/* 5 Stars Selection */}
            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => handleRateStar(star)}
                  disabled={isSubmittingRating}
                  className="p-1 text-2xl transition-transform hover:scale-125 cursor-pointer"
                >
                  <Star
                    className={`w-8 h-8 ${
                      (hoverRating || userRating) >= star
                        ? 'fill-purple-600 text-purple-600'
                        : 'text-gray-300 dark:text-neutral-700'
                    }`}
                  />
                </button>
              ))}
            </div>

            {isSubmittingRating && (
              <div className="flex items-center justify-center gap-2 text-xs text-purple-600 font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Submitting rating...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        video={{
          id: video.id,
          title: video.title,
          artist_name: artistName,
          thumbnail_url: video.thumbnail_url,
          price_rwf: video.price_rwf,
          price_usd: video.price_usd
        }}
        onSuccess={handlePurchaseSuccess}
      />
    </div>
  );
}
