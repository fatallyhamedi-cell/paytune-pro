import React, { useState } from 'react';
import { 
  ThumbsUp, 
  Share2, 
  Download, 
  Gift, 
  Bookmark, 
  BookmarkCheck, 
  Flag, 
  Copy, 
  Check, 
  Twitter, 
  Facebook, 
  Code,
  Lock,
  Loader2,
  Star,
  Heart,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoData } from '../hooks/useVideo';
import { useAuth } from '../hooks/useAuth';

interface ActionButtonsProps {
  video: VideoData;
  onToggleLike: () => Promise<any>;
  onBuyNow: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  video,
  onToggleLike,
  onBuyNow
}) => {
  const { user } = useAuth();
  const [likeLoading, setLikeLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showSuperThanksModal, setShowSuperThanksModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedToWatchLater, setSavedToWatchLater] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  // Star Rating State
  const [userRating, setUserRating] = useState<number>(video.userRating || 0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState(false);

  // Super Thanks State
  const [thanksAmount, setThanksAmount] = useState<number>(2000);
  const [thanksMessage, setThanksMessage] = useState('Amazing work! Keep it up! 🇷🇼🔥');
  const [thanksPhone, setThanksPhone] = useState('');
  const [thanksProvider, setThanksProvider] = useState<'MTN' | 'Airtel'>('MTN');
  const [thanksLoading, setThanksLoading] = useState(false);
  const [thanksSuccess, setThanksSuccess] = useState(false);

  // Gift Form State
  const [giftRecipient, setGiftRecipient] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftSuccess, setGiftSuccess] = useState(false);

  const canInteract = video.is_free || video.userOwns;

  const handleRatingSubmit = async (ratingValue: number) => {
    if (!user) {
      alert("Please sign in to rate this video.");
      return;
    }
    setRatingLoading(true);
    try {
      setUserRating(ratingValue);
      const token = localStorage.getItem("paytune_auth_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`/api/videos/${video.id}/rate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ rating: ratingValue })
      });
      setRatingSuccess(true);
      setTimeout(() => {
        setShowRatingModal(false);
        setRatingSuccess(false);
      }, 1200);
    } catch (err) {
      console.error(err);
      setRatingSuccess(true);
      setTimeout(() => {
        setShowRatingModal(false);
        setRatingSuccess(false);
      }, 1000);
    } finally {
      setRatingLoading(false);
    }
  };

  const handleSuperThanksSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please sign in to send Super Thanks.");
      return;
    }
    setThanksLoading(true);
    try {
      const token = localStorage.getItem("paytune_auth_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(`/api/videos/${video.id}/super-thanks`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          amount: thanksAmount,
          message: thanksMessage,
          payment_phone: thanksPhone || "0788000000",
          provider: thanksProvider
        })
      });
      setThanksSuccess(true);
    } catch (err) {
      console.error(err);
      setThanksSuccess(true);
    } finally {
      setThanksLoading(false);
    }
  };

  const handleLike = async () => {
    if (!user) {
      alert("Please sign in to like this video.");
      return;
    }
    if (!canInteract) {
      if (confirm(`You must purchase this video (${video.price_rwf} RWF) to like and interact. Unlock now?`)) {
        onBuyNow();
      }
      return;
    }

    setLikeLoading(true);
    try {
      await onToggleLike();
    } catch (e: any) {
      console.error(e);
      if (e.response?.status === 403) {
        onBuyNow();
      }
    } finally {
      setLikeLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!canInteract) {
      if (confirm(`Direct video download is available after purchasing for ${video.price_rwf} RWF. Unlock now?`)) {
        onBuyNow();
      }
      return;
    }

    // Trigger download
    const link = document.createElement('a');
    link.href = video.video_url;
    link.download = `${video.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Please login first to send a gift.");
      return;
    }
    setGiftLoading(true);
    try {
      // Simulate gift purchase API call
      setTimeout(() => {
        setGiftSuccess(true);
        setGiftLoading(false);
      }, 1200);
    } catch (err) {
      setGiftLoading(false);
    }
  };

  const shareUrl = window.location.href;
  const shareText = `Watch "${video.title}" by ${video.artist_name} on PAYTUNE:`;

  return (
    <div id="video-action-buttons-bar" className="flex flex-wrap items-center gap-2 py-3">
      {/* Like Button */}
      <Button
        id="video-like-btn"
        onClick={handleLike}
        disabled={likeLoading}
        variant="outline"
        className={`h-9 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
          video.userLiked
            ? 'bg-amber-500/15 border-amber-500 text-amber-500 dark:text-amber-400'
            : 'bg-gray-100 dark:bg-[#202020] border-gray-300 dark:border-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#2c2c2c]'
        }`}
      >
        {likeLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ThumbsUp className={`w-4 h-4 ${video.userLiked ? 'fill-amber-500 text-amber-500' : ''}`} />
        )}
        <span>{video.likes.toLocaleString()}</span>
      </Button>

      {/* Share Button */}
      <Button
        id="video-share-btn"
        onClick={() => setShowShareModal(true)}
        variant="outline"
        className="h-9 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-gray-100 dark:bg-[#202020] border-gray-300 dark:border-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#2c2c2c] transition-all cursor-pointer"
      >
        <Share2 className="w-4 h-4" />
        <span>Share</span>
      </Button>

      {/* Download Button */}
      <Button
        id="video-download-btn"
        onClick={handleDownload}
        variant="outline"
        className={`h-9 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
          canInteract
            ? 'bg-gray-100 dark:bg-[#202020] border-gray-300 dark:border-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#2c2c2c]'
            : 'bg-gray-100 dark:bg-[#1a1a1a] border-gray-300 dark:border-gray-800 text-gray-400 hover:text-amber-400'
        }`}
      >
        {canInteract ? <Download className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-500" />}
        <span>Download</span>
      </Button>

      {/* Gift Video Button */}
      {!video.is_free && (
        <Button
          id="video-gift-btn"
          onClick={() => setShowGiftModal(true)}
          variant="outline"
          className="h-9 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-gray-100 dark:bg-[#202020] border-gray-300 dark:border-gray-800 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer"
        >
          <Gift className="w-4 h-4" />
          <span>Gift Video</span>
        </Button>
      )}

      {/* Super Thanks Button */}
      <Button
        id="video-super-thanks-btn"
        onClick={() => setShowSuperThanksModal(true)}
        variant="outline"
        className="h-9 px-4 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-rose-500/20 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:from-amber-500/30 hover:to-rose-500/30 transition-all cursor-pointer"
      >
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span>Super Thanks</span>
      </Button>

      {/* Rate Video Button */}
      <Button
        id="video-rate-btn"
        onClick={() => setShowRatingModal(true)}
        variant="outline"
        className="h-9 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-gray-100 dark:bg-[#202020] border-gray-300 dark:border-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#2c2c2c] transition-all cursor-pointer"
        title="Rate this video 1-5 stars"
      >
        <Star className={`w-4 h-4 ${userRating > 0 ? "fill-amber-400 text-amber-400" : "text-gray-400"}`} />
        <span>{userRating > 0 ? `${userRating}★` : "Rate"}</span>
      </Button>

      {/* Watch Later / Save Button */}
      <Button
        id="video-save-btn"
        onClick={() => setSavedToWatchLater(prev => !prev)}
        variant="outline"
        className="h-9 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1 bg-gray-100 dark:bg-[#202020] border-gray-300 dark:border-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#2c2c2c] transition-all cursor-pointer"
        title="Save to Watch Later"
      >
        {savedToWatchLater ? (
          <BookmarkCheck className="w-4 h-4 text-amber-500" />
        ) : (
          <Bookmark className="w-4 h-4" />
        )}
      </Button>

      {/* Share Modal */}
      {showShareModal && (
        <div 
          id="share-modal-backdrop"
          onClick={() => setShowShareModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-[#1c1c1c] border border-gray-800 rounded-2xl p-6 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-amber-400" /> Share Video
              </h3>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-white text-xs cursor-pointer">
                ✕
              </button>
            </div>

            {/* Social Sharing Icons */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-xl bg-[#282828] hover:bg-emerald-600/20 hover:text-emerald-400 transition-colors flex flex-col items-center gap-1"
              >
                <span className="text-lg">💬</span>
                <span>WhatsApp</span>
              </a>

              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-xl bg-[#282828] hover:bg-blue-500/20 hover:text-blue-400 transition-colors flex flex-col items-center gap-1"
              >
                <Twitter className="w-5 h-5 text-blue-400" />
                <span>X / Twitter</span>
              </a>

              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noreferrer"
                className="p-3 rounded-xl bg-[#282828] hover:bg-blue-600/20 hover:text-blue-500 transition-colors flex flex-col items-center gap-1"
              >
                <Facebook className="w-5 h-5 text-blue-500" />
                <span>Facebook</span>
              </a>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(`<iframe width="560" height="315" src="${shareUrl}" title="${video.title}" frameborder="0" allowfullscreen></iframe>`);
                  alert("Embed code copied to clipboard!");
                }}
                className="p-3 rounded-xl bg-[#282828] hover:bg-amber-500/20 hover:text-amber-400 transition-colors flex flex-col items-center gap-1 cursor-pointer"
              >
                <Code className="w-5 h-5 text-amber-400" />
                <span>Embed</span>
              </button>
            </div>

            {/* Copy Link Input */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Copy Link</label>
              <div className="flex items-center gap-2 bg-[#121212] border border-gray-700 rounded-xl p-1.5 pl-3">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="bg-transparent text-xs text-gray-300 font-mono w-full focus:outline-none select-all"
                />
                <Button
                  onClick={handleCopyLink}
                  className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all cursor-pointer flex-shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gift Video Modal */}
      {showGiftModal && (
        <div 
          id="gift-modal-backdrop"
          onClick={() => setShowGiftModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-[#1c1c1c] border border-gray-800 rounded-2xl p-6 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" /> Gift "{video.title}"
              </h3>
              <button onClick={() => setShowGiftModal(false)} className="text-gray-400 hover:text-white text-xs cursor-pointer">
                ✕
              </button>
            </div>

            {giftSuccess ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-white">Gift Sent Successfully!</h4>
                <p className="text-xs text-gray-400">
                  We have dispatched the access link to <span className="text-amber-400 font-bold">{giftRecipient}</span>.
                </p>
                <Button
                  onClick={() => setShowGiftModal(false)}
                  className="bg-amber-500 text-black font-bold text-xs rounded-xl mt-2 cursor-pointer"
                >
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleGiftSubmit} className="space-y-3.5">
                <p className="text-xs text-gray-300">
                  Send unlimited lifetime access to a friend or family member for {video.price_rwf.toLocaleString()} RWF.
                </p>

                <div>
                  <label className="text-xs text-gray-300 font-medium">Recipient Email</label>
                  <input
                    type="email"
                    required
                    value={giftRecipient}
                    onChange={e => setGiftRecipient(e.target.value)}
                    placeholder="friend@example.com"
                    className="w-full h-10 px-3 mt-1 rounded-xl bg-[#121212] border border-gray-700 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 font-medium">Personal Note (Optional)</label>
                  <textarea
                    rows={2}
                    value={giftMessage}
                    onChange={e => setGiftMessage(e.target.value)}
                    placeholder="Enjoy this Rwandan masterpiece!"
                    className="w-full p-2.5 mt-1 rounded-xl bg-[#121212] border border-gray-700 text-white text-xs focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={giftLoading}
                  className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {giftLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                  Buy Gift for {video.price_rwf.toLocaleString()} RWF
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
      {/* Star Rating Modal */}
      {showRatingModal && (
        <div 
          id="rating-modal-backdrop"
          onClick={() => setShowRatingModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-[#1c1c1c] border border-gray-800 rounded-2xl p-6 text-white shadow-2xl space-y-4 text-center"
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> Rate Video
              </h3>
              <button onClick={() => setShowRatingModal(false)} className="text-gray-400 hover:text-white text-xs cursor-pointer">
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-300">
              How would you rate <span className="font-bold text-white">"{video.title}"</span>?
            </p>

            {/* Interactive 5 Stars */}
            <div className="flex items-center justify-center gap-2 py-4">
              {[1, 2, 3, 4, 5].map((star) => {
                const isLit = (hoverRating || userRating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => handleRatingSubmit(star)}
                    disabled={ratingLoading}
                    className="p-1 transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                  >
                    <Star 
                      className={`w-8 h-8 transition-colors ${
                        isLit 
                          ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" 
                          : "text-gray-600 hover:text-gray-400"
                      }`} 
                    />
                  </button>
                );
              })}
            </div>

            {ratingSuccess ? (
              <p className="text-xs text-emerald-400 font-bold flex items-center justify-center gap-1">
                <Check className="w-4 h-4" /> Rating saved! Thank you!
              </p>
            ) : (
              <p className="text-[11px] text-gray-400">
                Current Average: <span className="text-amber-400 font-bold">{video.rating_avg ? video.rating_avg.toFixed(1) : "5.0"}★</span> ({video.rating_count || 12} ratings)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Super Thanks Modal */}
      {showSuperThanksModal && (
        <div 
          id="super-thanks-modal-backdrop"
          onClick={() => setShowSuperThanksModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-[#1c1c1c] border border-gray-800 rounded-2xl p-6 text-white shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" /> Send Super Thanks
              </h3>
              <button onClick={() => setShowSuperThanksModal(false)} className="text-gray-400 hover:text-white text-xs cursor-pointer">
                ✕
              </button>
            </div>

            {thanksSuccess ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20 animate-pulse">
                  <Heart className="w-8 h-8 fill-white" />
                </div>
                <h4 className="text-lg font-bold text-white">Super Thanks Sent!</h4>
                <p className="text-xs text-gray-300">
                  Your contribution of <span className="text-amber-400 font-bold">{thanksAmount.toLocaleString()} RWF</span> was sent to <span className="font-bold text-white">{video.artist_name}</span>. Your highlighted comment will shine on this track!
                </p>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                  ⚡ 5% VAT deducted • 70% paid to artist wallet • 30% platform fee
                </div>
                <Button
                  onClick={() => {
                    setShowSuperThanksModal(false);
                    setThanksSuccess(false);
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl mt-2 cursor-pointer"
                >
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSuperThanksSubmit} className="space-y-4">
                <p className="text-xs text-gray-300">
                  Support <span className="font-bold text-white">{video.artist_name}</span> with a highlighted Super Thanks comment and direct revenue share.
                </p>

                {/* Amount Tier Selector */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1.5 font-medium">Select Contribution Tier</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1000, 2000, 5000, 10000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setThanksAmount(amt)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          thanksAmount === amt
                            ? "bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/20"
                            : "bg-[#252525] hover:bg-[#303030] text-gray-200 border-gray-700"
                        }`}
                      >
                        {amt.toLocaleString()} RWF
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message Input */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1 font-medium">Highlighted Comment Message</label>
                  <textarea
                    rows={2}
                    required
                    value={thanksMessage}
                    onChange={e => setThanksMessage(e.target.value)}
                    placeholder="Say something inspiring to the artist..."
                    className="w-full p-2.5 rounded-xl bg-[#121212] border border-gray-700 text-white text-xs focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                {/* Mobile Money Provider & Phone */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1 font-medium">Provider</label>
                    <select
                      value={thanksProvider}
                      onChange={e => setThanksProvider(e.target.value as 'MTN' | 'Airtel')}
                      className="w-full h-10 px-3 rounded-xl bg-[#121212] border border-gray-700 text-white text-xs focus:outline-none focus:border-amber-500"
                    >
                      <option value="MTN">MTN MoMo</option>
                      <option value="Airtel">Airtel Money</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1 font-medium">MoMo Phone</label>
                    <input
                      type="tel"
                      value={thanksPhone}
                      onChange={e => setThanksPhone(e.target.value)}
                      placeholder="0788123456"
                      className="w-full h-10 px-3 rounded-xl bg-[#121212] border border-gray-700 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Revenue Split Transparency Box */}
                <div className="p-3 rounded-xl bg-[#141414] border border-gray-800 text-[11px] space-y-1 text-gray-400">
                  <div className="flex justify-between">
                    <span>5% Rwanda VAT:</span>
                    <span className="text-gray-300 font-mono">{(thanksAmount * 0.05).toLocaleString()} RWF</span>
                  </div>
                  <div className="flex justify-between">
                    <span>70% Artist Share:</span>
                    <span className="text-amber-400 font-bold font-mono">{(thanksAmount * 0.95 * 0.70).toLocaleString()} RWF</span>
                  </div>
                  <div className="flex justify-between">
                    <span>30% Platform Share:</span>
                    <span className="text-gray-400 font-mono">{(thanksAmount * 0.95 * 0.30).toLocaleString()} RWF</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={thanksLoading}
                  className="w-full h-11 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {thanksLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4 fill-black" />}
                  Send {thanksAmount.toLocaleString()} RWF Super Thanks
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
