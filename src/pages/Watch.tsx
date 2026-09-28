import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';
import { useVideo } from '../hooks/useVideo';
import { useAuth } from '../hooks/useAuth';
import { VideoPlayer } from '../components/VideoPlayer';
import { VideoInfo } from '../components/VideoInfo';
import { ActionButtons } from '../components/ActionButtons';
import { CommentSection } from '../components/CommentSection';
import { UpNextSidebar } from '../components/UpNextSidebar';
import { PaymentModal } from '../components/PaymentModal';

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    video,
    loading,
    error,
    relatedVideos,
    loadingRelated,
    comments,
    loadingComments,
    savedProgress,
    refetchVideo,
    toggleLike,
    toggleSubscribe,
    recordView,
    saveProgress,
    postComment,
    toggleCommentLike,
    deleteComment,
    pinComment,
    setVideo
  } = useVideo(id);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [autoplay, setAutoplay] = useState(true);

  // Autoplay next video on ended
  const handleVideoEnded = () => {
    if (autoplay && relatedVideos.length > 0) {
      const nextVideo = relatedVideos[0];
      navigate(`/watch/${nextVideo.id}`);
    }
  };

  // Record view after 5 seconds of watching
  useEffect(() => {
    if (!video) return;
    const timer = setTimeout(() => {
      recordView();
    }, 5000);
    return () => clearTimeout(timer);
  }, [video?.id]);

  // Handle successful purchase
  const handlePurchaseSuccess = (purchaseData: any) => {
    setVideo(prev => prev ? {
      ...prev,
      userOwns: true,
      purchaseCount: (prev.purchaseCount || 0) + 1
    } : null);
    refetchVideo();
  };

  if (loading) {
    return (
      <div 
        id="watch-loading-state"
        className="min-h-screen bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white flex flex-col items-center justify-center p-6"
      >
        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading video...</p>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div 
        id="watch-error-state"
        className="min-h-screen bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white flex flex-col items-center justify-center p-6"
      >
        <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Video Not Found</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-sm">
          {error || "The video you are looking for might have been moved or is currently unavailable."}
        </p>
        <Link
          to="/"
          className="px-5 py-2.5 rounded-xl bg-[#FFB300] hover:bg-amber-500 text-black font-extrabold text-xs transition-all shadow-sm"
        >
          Return to Explore
        </Link>
      </div>
    );
  }

  return (
    <div 
      id="watch-page"
      className="min-h-screen bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white transition-colors"
    >
      {/* Container with responsive YouTube-style grid */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Back Link Breadcrumb */}
        <div className="mb-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-amber-500 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Browse</span>
          </button>
        </div>

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Left Column: Video Player, Info, Actions, Comments */}
          <div className="lg:col-span-8 space-y-4">
            {/* Core HTML5 + HLS Player with 30s Free Preview & Paywall */}
            <VideoPlayer
              video={video}
              savedProgress={savedProgress}
              onOpenPaymentModal={() => setIsPaymentModalOpen(true)}
              onProgressUpdate={(secs) => saveProgress(secs)}
              onEnded={handleVideoEnded}
            />

            {/* Video Info: Title, Artist, Subscribers, Description */}
            <VideoInfo
              video={video}
              onToggleSubscribe={toggleSubscribe}
            />

            {/* Action Buttons: Like, Share, Download, Gift */}
            <ActionButtons
              video={video}
              onToggleLike={toggleLike}
              onBuyNow={() => setIsPaymentModalOpen(true)}
            />

            {/* Discussion & 3-Level Threaded Comments */}
            <CommentSection
              videoId={video.id}
              comments={comments}
              userOwns={video.userOwns}
              isFree={video.is_free}
              priceRwf={video.price_rwf}
              loadingComments={loadingComments}
              onPostComment={postComment}
              onToggleCommentLike={toggleCommentLike}
              onDeleteComment={deleteComment}
              onPinComment={pinComment}
              onBuyNow={() => setIsPaymentModalOpen(true)}
            />
          </div>

          {/* Right Column: Up Next & Related Recommendations */}
          <div className="lg:col-span-4 space-y-6">
            <UpNextSidebar
              currentVideoId={video.id}
              artistName={video.artist_name}
              category={video.category}
              relatedVideos={relatedVideos}
              loadingRelated={loadingRelated}
              autoplay={autoplay}
              onToggleAutoplay={setAutoplay}
            />
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        video={{
          id: video.id,
          title: video.title,
          artist_name: video.artist_name,
          thumbnail_url: video.thumbnail_url,
          price_rwf: video.price_rwf,
          price_usd: video.price_usd
        }}
        onSuccess={handlePurchaseSuccess}
      />
    </div>
  );
}
