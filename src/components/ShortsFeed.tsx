import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronUp, 
  ChevronDown, 
  X, 
  Send, 
  Share2, 
  Copy, 
  Check, 
  Coins, 
  Loader2,
  Sparkles,
  Phone,
  Flame,
  Clock,
  Users,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { useShorts, ShortItem } from '../hooks/useShorts';
import { ShortsPlayer } from './ShortsPlayer';
import { useAuth } from '../hooks/useAuth';

export const ShortsFeed: React.FC = () => {
  const { id: paramShortId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sortTab, setSortTab] = useState<'trending' | 'new' | 'following'>('trending');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Modals state
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState<number>(1000);
  const [tipPhone, setTipPhone] = useState('');
  const [tipProvider, setTipProvider] = useState<'MTN' | 'Airtel'>('MTN');
  const [isTipping, setIsTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);

  const feedContainerRef = useRef<HTMLDivElement>(null);

  const {
    shorts,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    toggleLike,
    toggleSubscribe,
    recordView,
    preloadNextVideo
  } = useShorts(sortTab);

  const activeShort = shorts[activeIndex] as ShortItem | undefined;

  // Jump to specific short if paramShortId was supplied in route
  useEffect(() => {
    if (paramShortId && shorts.length > 0) {
      const targetIndex = shorts.findIndex(s => s.id === paramShortId);
      if (targetIndex >= 0 && targetIndex !== activeIndex) {
        scrollToIndex(targetIndex);
      }
    }
  }, [paramShortId, shorts.length]);

  // Preload upcoming video
  useEffect(() => {
    if (shorts.length > activeIndex + 1) {
      const nextShort = shorts[activeIndex + 1];
      preloadNextVideo(nextShort?.video_url);
    }
  }, [activeIndex, shorts, preloadNextVideo]);

  // Record view when active short is viewed for at least 3 seconds
  useEffect(() => {
    if (!activeShort) return;
    const viewTimer = setTimeout(() => {
      recordView({
        shortId: activeShort.id,
        watchedSeconds: 3,
        completed: false
      });
    }, 3000);

    return () => clearTimeout(viewTimer);
  }, [activeShort?.id, recordView]);

  // Detect which video is in viewport using scroll event and IntersectionObserver
  const handleScroll = useCallback(() => {
    const container = feedContainerRef.current;
    if (!container) return;

    const itemHeight = container.clientHeight;
    if (itemHeight <= 0) return;

    const scrollTop = container.scrollTop;
    const newIndex = Math.round(scrollTop / itemHeight);

    if (newIndex >= 0 && newIndex < shorts.length && newIndex !== activeIndex) {
      setActiveIndex(newIndex);
      const newShort = shorts[newIndex];
      if (newShort) {
        window.history.replaceState(null, '', `/shorts/${newShort.id}`);
      }
    }

    // Trigger next page when near bottom
    if (newIndex >= shorts.length - 3 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [shorts, activeIndex, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Scroll to index
  const scrollToIndex = (index: number) => {
    const container = feedContainerRef.current;
    if (!container) return;
    const itemHeight = container.clientHeight;
    container.scrollTo({
      top: index * itemHeight,
      behavior: 'smooth'
    });
    setActiveIndex(index);
  };

  // Keyboard navigation (ArrowUp, ArrowDown)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in inputs or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeIndex < shorts.length - 1) {
          scrollToIndex(activeIndex + 1);
        } else if (hasNextPage) {
          fetchNextPage();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeIndex > 0) {
          scrollToIndex(activeIndex - 1);
        }
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, shorts.length, hasNextPage, fetchNextPage]);

  // Fetch comments when comments sheet opens
  const openCommentsSheet = async () => {
    if (!activeShort) return;
    setShowComments(true);
    setLoadingComments(true);
    try {
      const res = await axios.get(`/api/shorts/${activeShort.id}/comments`);
      setComments(Array.isArray(res.data) ? res.data : []);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  // Submit comment
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShort || !newCommentText.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const res = await axios.post(`/api/shorts/${activeShort.id}/comments`, {
        content: newCommentText.trim()
      });
      if (res.data?.comment) {
        setComments(prev => [res.data.comment, ...prev]);
        setNewCommentText('');
      }
    } catch (err: any) {
      console.error('Failed to post comment', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Copy share link
  const handleCopyLink = () => {
    if (!activeShort) return;
    const url = `${window.location.origin}/shorts/${activeShort.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Process MoMo Tip
  const handleSendTip = async () => {
    if (!activeShort || !tipPhone.trim()) return;
    setIsTipping(true);
    try {
      // Simulate real MoMo push notification
      await new Promise(r => setTimeout(r, 1200));
      setTipSuccess(true);
      setTimeout(() => {
        setTipSuccess(false);
        setShowTipModal(false);
        setTipPhone('');
      }, 2000);
    } finally {
      setIsTipping(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)] md:h-[calc(100vh-72px)] bg-[#0F0F0F] text-white overflow-hidden flex flex-col items-center">
      {/* Top Floating Filter Navigation Tabs */}
      <div className="absolute top-3 z-30 flex items-center justify-center gap-1 sm:gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
        <button
          onClick={() => setSortTab('trending')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            sortTab === 'trending'
              ? 'bg-amber-400 text-black shadow-sm'
              : 'text-white/70 hover:text-white'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Trending</span>
        </button>

        <button
          onClick={() => setSortTab('new')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            sortTab === 'new'
              ? 'bg-amber-400 text-black shadow-sm'
              : 'text-white/70 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>New</span>
        </button>

        <button
          onClick={() => setSortTab('following')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            sortTab === 'following'
              ? 'bg-amber-400 text-black shadow-sm'
              : 'text-white/70 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Following</span>
        </button>
      </div>

      {/* Floating Desktop Navigation Buttons */}
      <div className="hidden lg:flex flex-col gap-3 absolute right-8 top-1/2 -translate-y-1/2 z-30">
        <button
          onClick={() => activeIndex > 0 && scrollToIndex(activeIndex - 1)}
          disabled={activeIndex === 0}
          className="p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed text-white border border-white/10 transition-all shadow-xl active:scale-95"
          aria-label="Previous Short"
        >
          <ChevronUp className="w-6 h-6" />
        </button>
        <button
          onClick={() => activeIndex < shorts.length - 1 && scrollToIndex(activeIndex + 1)}
          disabled={activeIndex === shorts.length - 1 && !hasNextPage}
          className="p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed text-white border border-white/10 transition-all shadow-xl active:scale-95"
          aria-label="Next Short"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
          <p className="text-sm text-neutral-400">Loading PAYTUNE Shorts...</p>
        </div>
      )}

      {/* Main Snap Feed Scroll Container */}
      {!isLoading && shorts.length > 0 && (
        <div
          ref={feedContainerRef}
          onScroll={handleScroll}
          className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          {shorts.map((short, index) => (
            <div
              key={short.id}
              className="w-full h-full snap-start snap-always flex items-center justify-center p-0 sm:p-2"
            >
              <ShortsPlayer
                short={short}
                isActive={index === activeIndex}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted(prev => !prev)}
                onLike={() => toggleLike(short.id)}
                onSubscribe={() => toggleSubscribe(short.id)}
                onOpenComments={openCommentsSheet}
                onOpenShare={() => setShowShareModal(true)}
                onOpenTip={() => setShowTipModal(true)}
                onVideoCompleted={() => {
                  recordView({
                    shortId: short.id,
                    watchedSeconds: short.duration || 30,
                    completed: true
                  });
                }}
              />
            </div>
          ))}

          {/* Infinite Scroll Fetching Indicator */}
          {isFetchingNextPage && (
            <div className="w-full h-24 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && shorts.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4">
          <Compass className="w-12 h-12 text-amber-400/80" />
          <h3 className="text-lg font-bold">No Shorts Found</h3>
          <p className="text-sm text-neutral-400 max-w-sm">
            {sortTab === 'following'
              ? "You haven't followed any artists with active shorts yet. Explore Trending to find new creators!"
              : "No vertical shorts uploaded yet. Check back soon for fresh music clips!"}
          </p>
          <button
            onClick={() => setSortTab('trending')}
            className="px-5 py-2.5 rounded-full bg-amber-400 text-black font-semibold text-sm hover:bg-amber-500 transition-colors"
          >
            Explore Trending
          </button>
        </div>
      )}

      {/* Slide-Up Comments Drawer */}
      <AnimatePresence>
        {showComments && activeShort && (
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-end sm:items-center"
            onClick={() => setShowComments(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-neutral-900 border border-white/10 rounded-t-3xl sm:rounded-2xl h-[70vh] sm:h-[600px] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-white">Comments</h3>
                  <p className="text-xs text-neutral-400">{comments.length} comments</p>
                </div>
                <button
                  onClick={() => setShowComments(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingComments ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-12 text-neutral-400 text-sm">
                    No comments yet. Be the first to start the conversation!
                  </div>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="flex gap-3 text-sm">
                      {c.user_avatar ? (
                        <img
                          src={c.user_avatar}
                          alt={c.user_name}
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/10"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                          {(c.user_name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-white/90">{c.user_name}</span>
                          <span className="text-[10px] text-neutral-500">{c.created_at || 'Just now'}</span>
                        </div>
                        <p className="text-neutral-200 text-xs leading-relaxed">{c.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input Form */}
              <form onSubmit={handleSubmitComment} className="p-3 border-t border-white/10 bg-neutral-950 flex items-center gap-2">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Add a comment on this short..."
                  className="flex-1 bg-neutral-800 border border-white/10 rounded-full px-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={!newCommentText.trim() || submittingComment}
                  className="p-2 rounded-full bg-amber-400 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-black transition-colors"
                >
                  {submittingComment ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && activeShort && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-neutral-900 border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-white">Share Short</h3>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-neutral-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Copy Link input */}
              <div className="flex items-center gap-2 bg-neutral-950 p-2 rounded-xl border border-white/10">
                <input
                  readOnly
                  value={`${window.location.origin}/shorts/${activeShort.id}`}
                  className="flex-1 bg-transparent text-xs text-neutral-300 outline-none px-2 truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-black text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Quick Social Shares */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Watch "${activeShort.title}" by ${activeShort.artist_name} on PAYTUNE: ${window.location.origin}/shorts/${activeShort.id}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-600/30 transition-colors"
                >
                  WhatsApp
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out "${activeShort.title}" by ${activeShort.artist_name} on @PAYTUNE!`)}&url=${encodeURIComponent(`${window.location.origin}/shorts/${activeShort.id}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-sky-600/20 text-sky-400 border border-sky-500/30 text-xs font-semibold hover:bg-sky-600/30 transition-colors"
                >
                  X / Twitter
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MoMo Tip Modal */}
      <AnimatePresence>
        {showTipModal && activeShort && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowTipModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-neutral-900 border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-base text-white">Support {activeShort.artist_name}</h3>
                </div>
                <button
                  onClick={() => setShowTipModal(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-neutral-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {tipSuccess ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-white">Tip Sent Successfully!</h4>
                  <p className="text-xs text-neutral-400">Thank you for supporting Rwandan artists directly.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-neutral-400">
                    Direct Mobile Money support. 100% of this tip goes to {activeShort.artist_name}.
                  </p>

                  {/* Amounts selection */}
                  <div className="grid grid-cols-4 gap-2">
                    {[500, 1000, 2000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTipAmount(amt)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all ${
                          tipAmount === amt
                            ? 'bg-amber-400 text-black shadow-md'
                            : 'bg-neutral-800 text-white/80 hover:bg-neutral-700'
                        }`}
                      >
                        {amt} RWF
                      </button>
                    ))}
                  </div>

                  {/* Mobile Money Provider selection */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTipProvider('MTN')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        tipProvider === 'MTN'
                          ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                          : 'border-white/10 bg-neutral-800 text-white/70'
                      }`}
                    >
                      MTN MoMo (*182#)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipProvider('Airtel')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        tipProvider === 'Airtel'
                          ? 'border-red-500 bg-red-500/10 text-red-400'
                          : 'border-white/10 bg-neutral-800 text-white/70'
                      }`}
                    >
                      Airtel Money
                    </button>
                  </div>

                  {/* Phone input */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-neutral-400">Phone Number (078...)</label>
                    <div className="flex items-center gap-2 bg-neutral-950 border border-white/10 rounded-xl px-3 py-2">
                      <Phone className="w-4 h-4 text-neutral-500" />
                      <input
                        type="tel"
                        value={tipPhone}
                        onChange={(e) => setTipPhone(e.target.value)}
                        placeholder="0788 123 456"
                        className="bg-transparent text-xs text-white outline-none flex-1"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSendTip}
                    disabled={!tipPhone.trim() || isTipping}
                    className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/20"
                  >
                    {isTipping ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Authorizing MoMo Prompt...
                      </>
                    ) : (
                      <>Send {tipAmount} RWF Tip</>
                    )}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShortsFeed;
