import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Play, 
  Crown, 
  Share2, 
  Flag, 
  Radio, 
  ListMusic, 
  Flame, 
  Check, 
  AlertCircle, 
  X, 
  Smartphone, 
  CreditCard, 
  Sparkles,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useArtist } from '../hooks/useArtist';
import { useChannelTabs, ChannelTabType } from '../hooks/useChannelTabs';
import ChannelHeader from '../components/ChannelHeader';
import ChannelTabs from '../components/ChannelTabs';
import ChannelVideoGrid from '../components/ChannelVideoGrid';
import ChannelVideoCard from '../components/ChannelVideoCard';
import MembershipTiers from '../components/MembershipTiers';
import AboutSection from '../components/AboutSection';

export default function ArtistChannel() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Load Artist Profile
  const {
    artist,
    loading: artistLoading,
    error: artistError,
    subscribed,
    subscriberCount,
    isSubscribing,
    toggleSubscribe,
    reportArtist
  } = useArtist(id);

  // Load Channel Tabs Content
  const {
    activeTab,
    setActiveTab,
    sort,
    setSort,
    tabData,
    loading: tabLoading
  } = useChannelTabs(artist?.id, 'videos');

  // Active user's membership tier check
  const [activeTierId, setActiveTierId] = useState<string | null>(null);

  // Modal States
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("Inappropriate content");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const [selectedMembershipTier, setSelectedMembershipTier] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"momo" | "card">("momo");
  const [momoProvider, setMomoProvider] = useState<"MTN" | "Airtel">("MTN");
  const [momoPhone, setMomoPhone] = useState("");
  const [joiningTier, setJoiningTier] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync document title
  useEffect(() => {
    if (artist?.full_name) {
      document.title = `${artist.full_name} – PAYTUNE Official Channel`;
    }
  }, [artist]);

  // Check active membership for logged-in user
  useEffect(() => {
    async function checkUserMembership() {
      if (user && artist?.id) {
        try {
          const res = await axios.get('/api/user/membership/active');
          const activeSubs = Array.isArray(res.data) ? res.data : [];
          const match = activeSubs.find((s: any) => s.artist_id === artist.id);
          if (match) {
            setActiveTierId(match.membership_tier_id);
          }
        } catch {
          // ignore
        }
      }
    }
    checkUserMembership();
  }, [user, artist?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle subscribe action
  const handleToggleSubscribe = async () => {
    const res = await toggleSubscribe();
    if (res.requiresAuth) {
      navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    if (res.success) {
      showToast(res.subscribed ? `Now following ${artist?.full_name}!` : `Unfollowed ${artist?.full_name}`);
    }
  };

  // Handle Share Channel
  const handleShareChannel = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${artist?.full_name} on PAYTUNE`,
          text: `Check out ${artist?.full_name}'s official music videos and exclusive content on PAYTUNE:`,
          url
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("Channel link copied to clipboard!");
    } catch {
      showToast("Link: " + url);
    }
  };

  // Handle Report Submission
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    setReportSubmitting(true);
    try {
      await reportArtist(reportReason, reportDetails);
      setReportSuccess(true);
      setTimeout(() => {
        setReportSuccess(false);
        setShowReportModal(false);
        setReportDetails("");
        showToast("Report submitted for moderation.");
      }, 1500);
    } catch (err: any) {
      console.error(err);
      showToast("Failed to submit report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

  // Handle Join Membership
  const handleConfirmJoinMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    if (paymentMethod === 'momo' && !momoPhone) {
      showToast("Please enter your Mobile Money phone number.");
      return;
    }

    setJoiningTier(true);
    try {
      // Simulate/call tier subscription
      await new Promise(r => setTimeout(r, 1200));
      setActiveTierId(selectedMembershipTier.id);
      setJoinSuccess(true);
      setTimeout(() => {
        setJoinSuccess(false);
        setSelectedMembershipTier(null);
        showToast(`Welcome! You are now a ${selectedMembershipTier.name} member.`);
      }, 1500);
    } catch (err) {
      showToast("Payment processing error. Please try again.");
    } finally {
      setJoiningTier(false);
    }
  };

  // Featured video for top of channel
  const featuredVideo = tabData.videos.find((v: any) => v.id === artist?.featured_video_id) || tabData.videos[0];

  if (artistLoading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] text-white">
        {/* Banner Skeleton */}
        <div className="w-full h-56 md:h-72 bg-neutral-900 animate-pulse" />
        <div className="max-w-7xl mx-auto px-4 -mt-12 space-y-4">
          <div className="w-28 h-28 rounded-full bg-neutral-800 border-4 border-[#FFB300]/40 animate-pulse" />
          <div className="h-8 bg-neutral-800 w-64 rounded animate-pulse" />
          <div className="h-4 bg-neutral-800 w-48 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (artistError || !artist) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#161616] p-8 rounded-2xl border border-neutral-800 text-center space-y-4">
          <div className="w-16 h-16 bg-red-950/40 text-red-400 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Artist Channel Not Found</h2>
          <p className="text-sm text-neutral-400">
            {artistError || "The artist channel you are looking for does not exist or may have been moved."}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FFB300] hover:bg-[#FFA000] text-black font-bold text-sm transition-colors"
          >
            Return to Explore
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div id="artist-channel-page" className="min-h-screen bg-[#0F0F0F] text-white pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1F1F1F] text-white px-5 py-3 rounded-xl border border-[#FFB300]/40 shadow-2xl shadow-black flex items-center gap-3 animate-fade-in">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFB300]" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* 1. Channel Header (Hero Section) */}
      <ChannelHeader
        artist={artist}
        subscribed={subscribed}
        subscriberCount={subscriberCount}
        isSubscribing={isSubscribing}
        onToggleSubscribe={handleToggleSubscribe}
        onOpenReportModal={() => setShowReportModal(true)}
        onShare={handleShareChannel}
      />

      {/* 2. Channel Navigation Tabs */}
      <ChannelTabs
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        videoCount={artist.video_count}
        shortsCount={tabData.shorts.length}
        playlistCount={tabData.playlists.length}
        tierCount={artist.membership_tiers?.length}
      />

      {/* 3. Main Tab Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* VIDEOS TAB */}
        {activeTab === 'videos' && (
          <div className="space-y-10">
            {/* Featured Trailer / Pinned Video Banner */}
            {featuredVideo && (
              <div 
                id="channel-featured-video" 
                className="bg-[#161616] rounded-2xl border border-neutral-800/80 p-4 sm:p-6 overflow-hidden transition-all hover:border-neutral-700"
              >
                <div className="flex flex-col lg:flex-row items-center gap-6">
                  {/* 16:9 Trailer Thumbnail */}
                  <Link 
                    to={`/watch/${featuredVideo.id}`}
                    className="relative aspect-video w-full lg:w-[480px] shrink-0 rounded-xl overflow-hidden bg-neutral-900 group"
                  >
                    {featuredVideo.thumbnail_url ? (
                      <img
                        src={featuredVideo.thumbnail_url}
                        alt={featuredVideo.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-neutral-900 via-neutral-800 to-amber-950/60 flex items-center justify-center">
                        <Play className="w-12 h-12 text-[#FFB300] opacity-70" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-[#FFB300] text-black flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 fill-black ml-1" />
                      </div>
                    </div>
                    <div className="absolute top-3 left-3 bg-[#FFB300] text-black font-extrabold text-xs px-2.5 py-1 rounded shadow">
                      FEATURED RELEASE
                    </div>
                  </Link>

                  {/* Trailer Info & CTA */}
                  <div className="flex flex-col justify-between flex-1 space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#FFB300] uppercase tracking-wider">
                          Official Spotlight
                        </span>
                        <span className="text-neutral-600">•</span>
                        <span className="text-xs text-neutral-400">
                          {(featuredVideo.views || 0).toLocaleString()} views
                        </span>
                      </div>
                      <Link to={`/watch/${featuredVideo.id}`}>
                        <h2 className="text-xl sm:text-2xl font-bold text-white hover:text-[#FFB300] transition-colors line-clamp-2">
                          {featuredVideo.title}
                        </h2>
                      </Link>
                      <p className="text-sm text-neutral-300 line-clamp-3 leading-relaxed">
                        {featuredVideo.description || `${artist.full_name}'s highlighted music video on PAYTUNE. Stream in full master audio with instant artist payout.`}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <Link
                        to={`/watch/${featuredVideo.id}`}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#FFB300] hover:bg-[#FFA000] text-black font-bold text-sm transition-all shadow-md active:scale-95"
                      >
                        <Play className="w-4 h-4 fill-black" />
                        <span>Watch Now</span>
                      </Link>

                      <span className="text-xs text-neutral-400">
                        {featuredVideo.is_free ? "Included Free" : `${featuredVideo.price_rwf?.toLocaleString() || 1500} RWF`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Video Grid with Newest, Most Popular, Oldest sorting */}
            <ChannelVideoGrid
              videos={tabData.videos}
              loading={tabLoading}
              sort={sort}
              onSortChange={setSort}
              title="All Music Videos & Uploads"
              emptyMessage={`No videos published yet by ${artist.full_name}.`}
            />
          </div>
        )}

        {/* SHORTS TAB */}
        {activeTab === 'shorts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-[#FFB300]" />
                Artist Shorts
                <span className="text-xs font-normal text-neutral-400">
                  ({tabData.shorts.length})
                </span>
              </h2>
            </div>

            {/* Vertical Video Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {tabData.shorts.map((short: any) => (
                <Link
                  key={short.id}
                  to={`/shorts?v=${short.id}`}
                  className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-[#FFB300] transition-all duration-300 hover:shadow-xl hover:shadow-black/70"
                >
                  {short.thumbnail_url ? (
                    <img
                      src={short.thumbnail_url}
                      alt={short.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-neutral-900 via-neutral-800 to-amber-950/60 flex items-center justify-center">
                      <Play className="w-8 h-8 text-[#FFB300] opacity-60" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

                  {/* Title and Views on Bottom */}
                  <div className="absolute bottom-3 left-3 right-3 space-y-1">
                    <p className="text-xs font-bold text-white line-clamp-2 leading-tight group-hover:text-[#FFB300] transition-colors">
                      {short.title}
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      {(short.views || 0).toLocaleString()} views
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {tabData.shorts.length === 0 && !tabLoading && (
              <div className="py-16 text-center text-neutral-400">
                No vertical shorts available for this artist yet.
              </div>
            )}
          </div>
        )}

        {/* PLAYLISTS TAB */}
        {activeTab === 'playlists' && (
          <div className="space-y-6">
            <div className="pb-2 border-b border-neutral-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ListMusic className="w-5 h-5 text-[#FFB300]" />
                Created Playlists
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {tabData.playlists.map((pl: any) => (
                <div
                  key={pl.id}
                  className="group bg-[#161616] rounded-xl overflow-hidden border border-neutral-800 hover:border-neutral-700 transition-all hover:shadow-xl"
                >
                  <div className="relative aspect-video bg-neutral-900">
                    <img
                      src={pl.thumbnail_url || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600"}
                      alt={pl.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {/* Overlay with playlist count */}
                    <div className="absolute inset-y-0 right-0 w-1/3 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-1">
                      <ListMusic className="w-5 h-5 text-[#FFB300]" />
                      <span className="text-xs font-bold">{pl.video_count}</span>
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider">videos</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <h3 className="text-sm font-bold text-white group-hover:text-[#FFB300] transition-colors">
                      {pl.title}
                    </h3>
                    <p className="text-xs text-neutral-400 line-clamp-2">
                      {pl.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LIVE STREAMS TAB */}
        {activeTab === 'live' && (
          <div className="space-y-6">
            <div className="pb-2 border-b border-neutral-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-500" />
                Live Streams & Concert Replays
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {tabData.live.map((stream: any) => (
                <div
                  key={stream.id}
                  className="group bg-[#161616] rounded-xl overflow-hidden border border-neutral-800 hover:border-neutral-700 transition-all"
                >
                  <div className="relative aspect-video bg-neutral-900">
                    <img
                      src={stream.thumbnail_url || "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600"}
                      alt={stream.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded tracking-wider uppercase">
                      STREAM REPLAY
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-semibold px-2 py-0.5 rounded">
                      {stream.duration}
                    </div>
                  </div>

                  <div className="p-4 space-y-1.5">
                    <h3 className="text-sm font-bold text-white group-hover:text-[#FFB300] transition-colors line-clamp-2">
                      {stream.title}
                    </h3>
                    <p className="text-xs text-neutral-400 line-clamp-2">
                      {stream.description}
                    </p>
                    <p className="text-xs text-neutral-500 pt-1">
                      {stream.viewer_count.toLocaleString()} past viewers
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MEMBERSHIP TAB */}
        {activeTab === 'membership' && (
          <MembershipTiers
            tiers={artist.membership_tiers || []}
            artistName={artist.full_name}
            activeTierId={activeTierId}
            onSelectTier={(tier) => setSelectedMembershipTier(tier)}
          />
        )}

        {/* ABOUT TAB */}
        {activeTab === 'about' && (
          <AboutSection
            artist={artist}
            onOpenReportModal={() => setShowReportModal(true)}
          />
        )}
      </main>

      {/* 4. MODAL: Report Channel */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#181818] border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowReportModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 text-red-400">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-lg font-bold text-white">Report Channel</h3>
            </div>

            {reportSuccess ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-white">Report Submitted</p>
                <p className="text-xs text-neutral-400">
                  Thank you for helping keep PAYTUNE safe. Our trust & safety team will review this channel.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                <p className="text-xs text-neutral-400">
                  Report <strong className="text-white">{artist.full_name}</strong> for violations of PAYTUNE Community Guidelines.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">Reason</label>
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-[#121212] border border-neutral-700 text-neutral-200 text-xs rounded-xl p-3 focus:outline-none focus:border-[#FFB300]"
                  >
                    <option value="Inappropriate content">Inappropriate or explicit content</option>
                    <option value="Copyright infringement">Copyright or intellectual property infringement</option>
                    <option value="Impersonation">Impersonation or misinformation</option>
                    <option value="Harassment">Harassment or hateful conduct</option>
                    <option value="Spam or scams">Spam or misleading promotions</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">Additional Details</label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Provide specific video titles or timestamps if applicable..."
                    className="w-full bg-[#121212] border border-neutral-700 text-neutral-200 text-xs rounded-xl p-3 focus:outline-none focus:border-[#FFB300]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reportSubmitting}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors shadow"
                  >
                    {reportSubmitting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL: Join Channel Membership */}
      {selectedMembershipTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="bg-[#181818] border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setSelectedMembershipTier(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <Crown className="w-6 h-6 text-[#FFB300]" />
              <div>
                <h3 className="text-lg font-bold text-white">
                  Join {selectedMembershipTier.name}
                </h3>
                <p className="text-xs text-neutral-400">
                  Channel Membership for {artist.full_name}
                </p>
              </div>
            </div>

            {joinSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-14 h-14 bg-[#FFB300]/20 text-[#FFB300] rounded-full flex items-center justify-center mx-auto">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-white">Membership Activated!</h4>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                  Your VIP badge is now active across all videos, live chats, and community releases.
                </p>
              </div>
            ) : (
              <form onSubmit={handleConfirmJoinMembership} className="space-y-4">
                {/* Tier Price & Perks summary */}
                <div className="bg-[#121212] p-4 rounded-xl border border-neutral-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-neutral-400">Monthly Membership</p>
                    <p className="text-lg font-black text-white">
                      {selectedMembershipTier.price_rwf.toLocaleString()} RWF
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#FFB300]/10 text-[#FFB300] border border-[#FFB300]/30">
                    Billed Monthly
                  </span>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-300">
                    Select Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("momo")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                        paymentMethod === "momo"
                          ? "bg-[#FFB300]/10 border-[#FFB300] text-[#FFB300]"
                          : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Mobile Money</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("card")}
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                        paymentMethod === "card"
                          ? "bg-[#FFB300]/10 border-[#FFB300] text-[#FFB300]"
                          : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Card / Stripe</span>
                    </button>
                  </div>
                </div>

                {/* MoMo Provider & Phone */}
                {paymentMethod === "momo" ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMomoProvider("MTN")}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                          momoProvider === "MTN"
                            ? "bg-amber-400 text-black border-amber-400 font-extrabold"
                            : "bg-neutral-900 text-neutral-400 border-neutral-800"
                        }`}
                      >
                        MTN MoMo (*182#)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMomoProvider("Airtel")}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                          momoProvider === "Airtel"
                            ? "bg-red-600 text-white border-red-600 font-extrabold"
                            : "bg-neutral-900 text-neutral-400 border-neutral-800"
                        }`}
                      >
                        Airtel Money
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-neutral-400">Phone Number (Rwanda)</label>
                      <input
                        type="tel"
                        placeholder="078... or 073..."
                        value={momoPhone}
                        onChange={(e) => setMomoPhone(e.target.value)}
                        className="w-full bg-[#121212] border border-neutral-700 text-white text-sm rounded-xl p-3 focus:outline-none focus:border-[#FFB300]"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-[#121212] rounded-xl border border-neutral-800 text-xs text-neutral-400">
                    You will be prompted to enter your payment card details securely via Stripe.
                  </div>
                )}

                {/* Submit button */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={joiningTier}
                    className="w-full py-3 rounded-xl bg-[#FFB300] hover:bg-[#FFA000] text-black font-extrabold text-sm tracking-wide transition-all shadow-lg shadow-[#FFB300]/20 active:scale-98"
                  >
                    {joiningTier ? "Processing Activation..." : `Authorize ${selectedMembershipTier.price_rwf.toLocaleString()} RWF / Month`}
                  </button>
                  <p className="text-[11px] text-center text-neutral-500 pt-2">
                    Cancel anytime from your Account Settings. Auto-renews monthly.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
