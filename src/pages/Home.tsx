import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  Play,
  Flame,
  Search,
  Sparkles,
  Zap,
  RotateCcw,
  Compass,
  AlertCircle,
  Loader2,
  ChevronRight,
  Clock,
  Radio,
  Tv,
  CheckCircle,
  ThumbsUp,
  UserCheck,
  ShoppingBag
} from "lucide-react";
import VideoCard, { VideoItem } from "../components/VideoCard";
import DynamicCategoryBar from "../components/DynamicCategoryBar";
import UpcomingLiveCard, { UpcomingLiveStream } from "../components/UpcomingLiveCard";
import UserPreferencesModal from "../components/UserPreferencesModal";
import { useAuth } from "../hooks/useAuth";
import { useShorts } from "../hooks/useShorts";
import { Button } from "@/components/ui/button";

// Skeleton matching VideoCard geometry
function VideoCardSkeleton() {
  return (
    <div className="flex flex-col w-full animate-pulse">
      <div className="relative aspect-video rounded-xl bg-gray-200 dark:bg-[#181818] mb-2.5" />
      <div className="flex gap-2.5 items-start px-0.5">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#181818] flex-shrink-0" />
        <div className="flex-1 space-y-2 py-0.5">
          <div className="h-3.5 bg-gray-200 dark:bg-[#181818] rounded w-11/12" />
          <div className="h-3 bg-gray-200 dark:bg-[#181818] rounded w-3/5" />
          <div className="h-2.5 bg-gray-200 dark:bg-[#181818] rounded w-2/5" />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { shorts: realShorts = [] } = useShorts("trending");
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const initialCat = searchParams.get("category") || "All";
  const [activeCategory, setActiveCategory] = useState(initialCat);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [dismissedLocalIds, setDismissedLocalIds] = useState<string[]>([]);

  // Sync category state with URL search param
  useEffect(() => {
    const catFromUrl = searchParams.get("category");
    if (catFromUrl && catFromUrl !== activeCategory) {
      setActiveCategory(catFromUrl);
    }
  }, [searchParams]);

  const handleCategorySelect = (categoryName: string) => {
    setActiveCategory(categoryName);
    const updated = new URLSearchParams(searchParams);
    if (categoryName === "All") {
      updated.delete("category");
    } else {
      updated.set("category", categoryName);
    }
    if (q) {
      updated.delete("q");
    }
    setSearchParams(updated);
  };

  // 1. React Query: Fetch Multi-signal Personalized Feed
  const {
    data: personalizedData,
    isLoading: isPersonalizedLoading,
    refetch: refetchPersonalized
  } = useQuery({
    queryKey: ["videos", "personalized-feed", user?.id],
    queryFn: async () => {
      try {
        const res = await axios.get("/api/videos/feed/personalized");
        return res.data;
      } catch (err) {
        console.warn("Failed to fetch personalized feed:", err);
        return null;
      }
    },
    staleTime: 30 * 1000
  });

  // Extract feed sections
  const feed = personalizedData?.feed || {};
  const forYouVideos: VideoItem[] = (feed.forYou || []).filter(
    (v: any) => !dismissedLocalIds.includes(String(v.id))
  );
  const continueWatchingVideos: VideoItem[] = feed.continueWatching || [];
  const fromYourChannelsVideos: VideoItem[] = feed.fromYourChannels || [];
  const upcomingLiveStreams: UpcomingLiveStream[] = feed.upcomingLive || [];
  const liveNowStreams: any[] = feed.liveNow || [];
  const trendingVideos: VideoItem[] = feed.trending || [];
  const newVideos: VideoItem[] = feed.newReleases || [];
  const purchasedVideos: VideoItem[] = feed.purchasedVideos || [];

  // 2. React Query: Main Catalog Grid with Pagination & Filtering
  const [catalogVideos, setCatalogVideos] = useState<VideoItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PAGE_LIMIT = 12;

  const {
    data: initialCatalogData,
    isLoading: isCatalogLoading,
    isError: isCatalogError,
    error: catalogError,
    refetch: refetchCatalog
  } = useQuery({
    queryKey: ["videos", "catalog", activeCategory, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeCategory !== "All") {
        params.append("category", activeCategory);
      }
      if (q) {
        params.append("q", q);
      }
      params.append("limit", String(PAGE_LIMIT));
      params.append("offset", "0");

      const res = await axios.get(`/api/videos?${params.toString()}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.videos || []);
      return list as VideoItem[];
    }
  });

  useEffect(() => {
    if (initialCatalogData) {
      setCatalogVideos(initialCatalogData);
      setPage(0);
      setHasMore(initialCatalogData.length >= PAGE_LIMIT);
    }
  }, [initialCatalogData]);

  // Load More pagination
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextOffset = (page + 1) * PAGE_LIMIT;
      const params = new URLSearchParams();
      if (activeCategory !== "All") {
        params.append("category", activeCategory);
      }
      if (q) {
        params.append("q", q);
      }
      params.append("limit", String(PAGE_LIMIT));
      params.append("offset", String(nextOffset));

      const res = await axios.get(`/api/videos?${params.toString()}`);
      const nextItems: VideoItem[] = Array.isArray(res.data) ? res.data : (res.data?.videos || []);

      if (nextItems.length === 0) {
        setHasMore(false);
      } else {
        setCatalogVideos((prev) => [...prev, ...nextItems]);
        setPage((prev) => prev + 1);
        if (nextItems.length < PAGE_LIMIT) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error("Load more failed", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Dismiss video handler
  const handleDismissVideo = async (videoId: string | number) => {
    setDismissedLocalIds((prev) => [...prev, String(videoId)]);
    try {
      await axios.post("/api/user/dismiss-video", { video_id: videoId });
    } catch {}
  };

  const isBrowsingAll = activeCategory === "All" && !q;
  const isInitialLoading = isCatalogLoading && (!personalizedData && isPersonalizedLoading);

  return (
    <div
      id="home-page-container"
      className="bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white min-h-screen pb-24 transition-colors"
    >
      {/* 1. Dynamic Category Bar */}
      <DynamicCategoryBar
        activeCategory={activeCategory}
        onSelectCategory={handleCategorySelect}
        onOpenPreferences={() => setIsPreferencesOpen(true)}
      />

      {/* Main Rumble-Proportioned Container */}
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 md:px-5 py-4 space-y-6 sm:space-y-8">
        
        {/* Search Query Indicator if active */}
        {q && (
          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 px-4 py-3 rounded-xl">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                Results for: <span className="text-amber-500 font-extrabold">"{q}"</span>
              </span>
            </div>
            <button
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete("q");
                setSearchParams(next);
              }}
              className="text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white hover:underline cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        )}

        {/* Live Now Broadcast Alert Banner (if streams are active) */}
        {isBrowsingAll && liveNowStreams.length > 0 && (
          <section id="live-now-section" className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <h2 className="text-sm sm:text-base font-black text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-4 h-4" /> Live Now on PAYTUNE
                </h2>
              </div>
              <Link to="/live" className="text-xs font-bold text-red-500 hover:underline flex items-center gap-0.5">
                All Broadcasts <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {liveNowStreams.slice(0, 3).map((stream: any) => (
                <Link
                  key={stream.id}
                  to={`/live/${stream.id}`}
                  className="group flex gap-3 p-2.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-red-500/20 hover:border-red-500 transition-all shadow-xs"
                >
                  <div className="relative aspect-video w-32 flex-shrink-0 rounded-lg overflow-hidden bg-black">
                    {stream.thumbnail_url ? (
                      <img src={stream.thumbnail_url} alt={stream.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-red-950/40 text-red-400">
                        <Radio className="w-6 h-6 animate-pulse" />
                      </div>
                    )}
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-black uppercase tracking-wider">
                      LIVE
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-red-500 transition-colors">
                      {stream.title}
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                      {stream.artist_name || "PAYTUNE Creator"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* SECTION: 📅 Upcoming Livestreams Shelf with Interactive "Notify Me" */}
        {isBrowsingAll && upcomingLiveStreams.length > 0 && (
          <section id="upcoming-livestreams-shelf" className="space-y-3 pt-1 border-b border-gray-200 dark:border-gray-800 pb-7">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                    Upcoming Livestreams
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Get reminders so you don't miss live performances and VIP sessions
                  </p>
                </div>
              </div>
              <Link to="/live" className="text-xs font-bold text-amber-500 hover:underline flex items-center gap-0.5">
                View all live <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {upcomingLiveStreams.map((stream) => (
                <UpcomingLiveCard key={stream.id} stream={stream} />
              ))}
            </div>
          </section>
        )}

        {/* SECTION: 🔄 Continue Watching (if user has active watch progress) */}
        {isBrowsingAll && continueWatchingVideos.length > 0 && (
          <section id="continue-watching-shelf" className="space-y-3 pb-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">▶️</span>
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                  Continue Watching
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {continueWatchingVideos.map((video) => (
                <VideoCard key={`cw-${video.id}`} video={video} />
              ))}
            </div>
          </section>
        )}

        {/* SECTION: ✨ For You (Personalized Recommendations) */}
        {isBrowsingAll && forYouVideos.length > 0 && (
          <section id="for-you-section" className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xl" role="img" aria-label="sparkles">✨</span>
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                  For You
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                  Personalized
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreferencesOpen(true)}
                className="text-xs font-semibold text-gray-500 hover:text-amber-500 dark:text-gray-400 dark:hover:text-amber-400 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Customize feed</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {forYouVideos.slice(0, 8).map((video) => (
                <VideoCard
                  key={`fy-${video.id}`}
                  video={video}
                  onDismiss={handleDismissVideo}
                />
              ))}
            </div>
          </section>
        )}

        {/* SECTION: 📱 PayTune Shorts Shelf */}
        {isBrowsingAll && (realShorts.length > 0 || catalogVideos.some((v) => v.is_short)) && (
          <section id="shorts-shelf" className="border-b border-gray-200 dark:border-gray-800 pb-7 pt-1">
            <div className="flex items-center justify-between mb-3 px-0.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-red-500 flex items-center justify-center text-white shadow-xs">
                  <Zap className="w-3.5 h-3.5 fill-white" />
                </div>
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                  Shorts
                </h2>
              </div>
              <Link to="/shorts" className="text-xs sm:text-sm font-bold text-red-500 hover:underline flex items-center gap-0.5">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-3.5 overflow-x-auto sm:overflow-x-visible no-scrollbar pb-2 sm:pb-0 scroll-smooth snap-x">
              {(realShorts.length > 0
                ? realShorts.slice(0, 6)
                : catalogVideos.filter((v) => v.is_short).slice(0, 6)
              ).map((item: any) => (
                <Link
                  key={item.id}
                  to={`/shorts?id=${item.id}`}
                  className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-gray-200 dark:bg-[#212121] shadow-xs hover:scale-[1.02] transition-all duration-200 block flex-shrink-0 w-[140px] xs:w-[155px] sm:w-auto snap-start"
                >
                  {item.thumbnail_url || item.thumbnail ? (
                    <img
                      src={item.thumbnail_url || item.thumbnail}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      alt={item.title}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                      <Zap className="w-8 h-8 text-red-500 opacity-80" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent flex flex-col justify-end p-2.5 text-left">
                    <p className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug drop-shadow-xs">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-gray-300 font-medium mt-1">
                      {(item.views || 0).toLocaleString()} views
                    </p>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white">
                      <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* SECTION: 👥 From Your Channels / Followed Creators */}
        {isBrowsingAll && fromYourChannelsVideos.length > 0 && (
          <section id="from-channels-section" className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                  From Artists You Follow
                </h2>
              </div>
              <Link to="/dashboard/following" className="text-xs font-semibold text-gray-500 hover:text-amber-500">
                Manage Subscriptions
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {fromYourChannelsVideos.slice(0, 4).map((video) => (
                <VideoCard key={`chan-${video.id}`} video={video} />
              ))}
            </div>
          </section>
        )}

        {/* SECTION: 🔥 Trending This Week */}
        {isBrowsingAll && trendingVideos.length > 0 && (
          <section id="trending-section" className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xl" role="img" aria-label="fire">🔥</span>
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                  Trending This Week
                </h2>
              </div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Top 10 Most Purchased
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {trendingVideos.slice(0, 8).map((video) => (
                <VideoCard key={`trend-${video.id}`} video={video} trending />
              ))}
            </div>
          </section>
        )}

        {/* SECTION: 🆕 New Releases */}
        {isBrowsingAll && newVideos.length > 0 && (
          <section id="new-releases-section" className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xl" role="img" aria-label="new">🆕</span>
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                  New Releases
                </h2>
              </div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Fresh Rwandan Drops
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {newVideos.slice(0, 8).map((video) => (
                <VideoCard key={`new-${video.id}`} video={video} />
              ))}
            </div>
          </section>
        )}

        {/* SECTION: 🛒 Purchased Videos (Permanent Entitlements) */}
        {isBrowsingAll && purchasedVideos.length > 0 && (
          <section id="purchased-videos-section" className="space-y-3 border-t border-gray-200 dark:border-gray-800 pt-6">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-500" />
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                  Your Purchased Videos
                </h2>
              </div>
              <Link to="/dashboard/purchased" className="text-xs font-bold text-emerald-500 hover:underline">
                View Library
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {purchasedVideos.slice(0, 4).map((video) => (
                <VideoCard key={`purchased-${video.id}`} video={video} />
              ))}
            </div>
          </section>
        )}

        {/* SECTION: 🧭 Main Catalog Grid with Load More & Category Filter */}
        <section id="main-catalog-section" className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-amber-500" />
              <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                {activeCategory === "All"
                  ? q
                    ? `Results for "${q}"`
                    : "Explore All Music"
                  : `${activeCategory} Collection`}
              </h2>
            </div>
            {catalogVideos.length > 0 && (
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Showing {catalogVideos.length} videos
              </span>
            )}
          </div>

          {/* Skeletons on initial load */}
          {isCatalogLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {[...Array(8)].map((_, i) => (
                <VideoCardSkeleton key={`cat-skel-${i}`} />
              ))}
            </div>
          ) : isCatalogError ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-gray-50 dark:bg-[#181818] border border-gray-200 dark:border-[#272727] max-w-md mx-auto">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                Unable to load videos
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {String((catalogError as any)?.message || "Please check your network and retry.")}
              </p>
              <Button
                onClick={() => refetchCatalog()}
                className="bg-[#FFB300] hover:bg-amber-500 text-black font-extrabold text-xs uppercase px-5 rounded-full shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          ) : catalogVideos.length > 0 ? (
            <div className="space-y-6">
              {/* Responsive Rumble-Style Grid: 1-col mobile, 2-col tablet/small, 3-col mid, 4-col desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
                {catalogVideos.map((video) => (
                  <VideoCard key={`cat-vid-${video.id}`} video={video} />
                ))}
              </div>

              {/* Load More Pagination */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    id="home-load-more-btn"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="bg-gray-100 hover:bg-gray-200 dark:bg-[#181818] dark:hover:bg-[#272727] text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wider px-8 h-10 rounded-full border border-gray-200 dark:border-gray-800 shadow-xs transition-all cursor-pointer"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin text-amber-500" />
                        Loading more videos...
                      </>
                    ) : (
                      "Load More Videos"
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-50 dark:bg-[#181818] rounded-2xl border border-gray-200 dark:border-[#272727]">
              <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                No videos found in {activeCategory}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-4">
                Try selecting a different category or adjusting your search filter.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCategorySelect("All")}
                className="rounded-full text-xs font-bold cursor-pointer"
              >
                Reset to All Categories
              </Button>
            </div>
          )}
        </section>

      </div>

      {/* User Preferences / Discovery Personalization Modal */}
      <UserPreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        onPreferencesUpdated={() => {
          refetchPersonalized();
          refetchCatalog();
        }}
      />
    </div>
  );
}
