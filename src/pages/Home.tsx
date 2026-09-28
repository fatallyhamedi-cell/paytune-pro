import React, { useState, useEffect, useMemo } from "react";
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
  TrendingUp,
  Clock,
  ThumbsUp,
  Film
} from "lucide-react";
import VideoCard, { VideoItem } from "../components/VideoCard";
import { useAuth } from "../hooks/useAuth";
import { useShorts } from "../hooks/useShorts";
import { Button } from "@/components/ui/button";

const CATEGORIES = [
  "All",
  "Gospel",
  "Afrobeat",
  "R&B",
  "Traditional",
  "Hip Hop",
  "Other"
];

// Skeleton loading component matching VideoCard geometry
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
  const [activeCategory, setActiveCategory] = useState("All");

  // Pagination for the Main Catalog Grid
  const [catalogVideos, setCatalogVideos] = useState<VideoItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PAGE_LIMIT = 10;

  // React Query: Fetch Trending (Top 10)
  const {
    data: trendingVideos = [],
    isLoading: isTrendingLoading,
    isError: isTrendingError,
    refetch: refetchTrending
  } = useQuery<VideoItem[]>({
    queryKey: ["videos", "trending"],
    queryFn: async () => {
      const res = await axios.get("/api/videos/trending");
      return res.data?.videos || (Array.isArray(res.data) ? res.data : []);
    }
  });

  // React Query: Fetch New Releases (Top 10)
  const {
    data: newVideos = [],
    isLoading: isNewLoading,
    isError: isNewError,
    refetch: refetchNew
  } = useQuery<VideoItem[]>({
    queryKey: ["videos", "new"],
    queryFn: async () => {
      const res = await axios.get("/api/videos/new");
      return res.data?.videos || (Array.isArray(res.data) ? res.data : []);
    }
  });

  // React Query: Fetch Recommended For You (Top 10)
  const {
    data: recommendedVideos = [],
    isLoading: isRecommendedLoading,
    isError: isRecommendedError,
    refetch: refetchRecommended
  } = useQuery<VideoItem[]>({
    queryKey: ["videos", "recommended"],
    queryFn: async () => {
      const res = await axios.get("/api/videos/recommended");
      return res.data?.videos || (Array.isArray(res.data) ? res.data : []);
    }
  });

  // Initial & Filtered Catalog Query
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
      const list = Array.isArray(res.data) ? res.data : (res.data.videos || []);
      return list as VideoItem[];
    }
  });

  // Reset pagination when category or search changes
  useEffect(() => {
    if (initialCatalogData) {
      setCatalogVideos(initialCatalogData);
      setPage(0);
      setHasMore(initialCatalogData.length >= PAGE_LIMIT);
    }
  }, [initialCatalogData]);

  // Load More function
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
      const nextItems: VideoItem[] = Array.isArray(res.data) ? res.data : (res.data.videos || []);

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

  const isBrowsingAll = activeCategory === "All" && !q;

  return (
    <div
      id="home-page-container"
      className="bg-white dark:bg-[#0F0F0F] text-gray-900 dark:text-white min-h-screen pb-24 transition-colors"
    >
      {/* PayTune Category Filter Chips Bar */}
      <div
        id="category-chips-bar"
        className="sticky top-14 z-30 bg-white/95 dark:bg-[#0F0F0F]/95 backdrop-blur-md pt-2.5 pb-2.5 px-3 sm:px-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-xs"
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              id={`category-chip-${cat.toLowerCase().replace(/\s+/g, "-")}`}
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                if (q) {
                  searchParams.delete("q");
                  setSearchParams(searchParams);
                }
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 flex-shrink-0 cursor-pointer ${
                isActive
                  ? "bg-amber-500 text-black font-extrabold shadow-sm"
                  : "bg-gray-100 dark:bg-[#272727] hover:bg-gray-200 dark:hover:bg-[#383838] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div className="max-w-[1800px] mx-auto px-3 sm:px-6 py-5 space-y-8 sm:space-y-10">
        
        {/* Search Query Indicator (if filtering by search) */}
        {q && (
          <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 px-4 py-3 rounded-2xl">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                Search results for: <span className="text-amber-500">"{q}"</span>
              </span>
            </div>
            <button
              onClick={() => {
                searchParams.delete("q");
                setSearchParams(searchParams);
              }}
              className="text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white hover:underline"
            >
              Clear Search
            </button>
          </div>
        )}

        {/* PayTune Shorts Shelf */}
        {isBrowsingAll && (realShorts.length > 0 || catalogVideos.some(v => v.is_short)) && (
          <section id="shorts-shelf" className="border-b border-gray-200 dark:border-gray-800 pb-8">
            <div className="flex items-center justify-between mb-4 px-0.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-red-500 flex items-center justify-center text-white shadow-xs">
                  <Zap className="w-3.5 h-3.5 fill-white" />
                </div>
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
                  Shorts
                </h2>
              </div>
              <Link
                to="/shorts"
                className="text-xs sm:text-sm font-bold text-red-500 hover:underline flex items-center gap-0.5"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 overflow-x-auto sm:overflow-x-visible no-scrollbar pb-2 sm:pb-0 scroll-smooth snap-x snap-mandatory">
              {(realShorts.length > 0
                ? realShorts.slice(0, 5)
                : catalogVideos.filter(v => v.is_short).slice(0, 5)
              ).map((item: any) => (
                <Link
                  key={item.id}
                  to={`/shorts?id=${item.id}`}
                  className="group relative aspect-[9/16] rounded-xl overflow-hidden bg-gray-200 dark:bg-[#212121] shadow-sm hover:scale-[1.02] transition-all duration-200 block flex-shrink-0 w-[140px] xs:w-[160px] sm:w-auto snap-start"
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent flex flex-col justify-end p-3 text-left">
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

        {/* SECTION 1: 🔥 Trending This Week (Top 10) */}
        {isBrowsingAll && (
          <section id="trending-section" className="space-y-4">
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

            {isTrendingLoading ? (
              <div className="grid grid-cols-1 min-[540px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-4 lg:gap-5">
                {[...Array(5)].map((_, i) => (
                  <VideoCardSkeleton key={`trend-skel-${i}`} />
                ))}
              </div>
            ) : isTrendingError ? (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4" /> Failed to load trending videos
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchTrending()}
                  className="h-7 text-xs font-bold"
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Retry
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 min-[540px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-4 lg:gap-5">
                {trendingVideos.slice(0, 10).map((video) => (
                  <VideoCard key={`trend-${video.id}`} video={video} trending />
                ))}
              </div>
            )}
          </section>
        )}

        {/* SECTION 2: 🆕 New Releases (Top 10) */}
        {isBrowsingAll && (
          <section id="new-releases-section" className="space-y-4">
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

            {isNewLoading ? (
              <div className="grid grid-cols-1 min-[540px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-4 lg:gap-5">
                {[...Array(5)].map((_, i) => (
                  <VideoCardSkeleton key={`new-skel-${i}`} />
                ))}
              </div>
            ) : isNewError ? (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4" /> Failed to load new releases
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchNew()}
                  className="h-7 text-xs font-bold"
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Retry
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 min-[540px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-4 lg:gap-5">
                {newVideos.slice(0, 10).map((video) => (
                  <VideoCard key={`new-${video.id}`} video={video} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* SECTION 3: 🎯 Recommended For You (Top 10) */}
        {isBrowsingAll && (
          <section id="recommended-section" className="space-y-4">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xl" role="img" aria-label="target">🎯</span>
                <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white tracking-tight">
                  Recommended For You
                </h2>
              </div>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Curated by Rwandan Taste
              </span>
            </div>

            {isRecommendedLoading ? (
              <div className="grid grid-cols-1 min-[540px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-4 lg:gap-5">
                {[...Array(5)].map((_, i) => (
                  <VideoCardSkeleton key={`rec-skel-${i}`} />
                ))}
              </div>
            ) : isRecommendedError ? (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4" /> Failed to load recommendations
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetchRecommended()}
                  className="h-7 text-xs font-bold"
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> Retry
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 min-[540px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-4 lg:gap-5">
                {recommendedVideos.slice(0, 10).map((video) => (
                  <VideoCard key={`rec-${video.id}`} video={video} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* SECTION 4: Explore Catalog & Filtered Video Grid */}
        <section id="main-catalog-section" className="space-y-4 pt-2">
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
            <div className="grid grid-cols-1 min-[540px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-4 lg:gap-5">
              {[...Array(10)].map((_, i) => (
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
                className="bg-[#FFB300] hover:bg-amber-500 text-black font-extrabold text-xs uppercase px-5 rounded-full shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          ) : catalogVideos.length > 0 ? (
            <div className="space-y-8">
              {/* Responsive Grid: 1-col small phone, 2-col large phone/tablet, 3-col tablet, 4-col laptop, 5-col desktop */}
              <div className="grid grid-cols-1 min-[540px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-4 lg:gap-5">
                {catalogVideos.map((video) => (
                  <VideoCard key={`cat-vid-${video.id}`} video={video} />
                ))}
              </div>

              {/* Load More Pagination */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    id="home-load-more-btn"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="bg-gray-100 hover:bg-gray-200 dark:bg-[#181818] dark:hover:bg-[#272727] text-gray-900 dark:text-white font-bold text-xs uppercase tracking-wider px-8 h-10 rounded-full border border-gray-200 dark:border-gray-800 shadow-sm transition-all"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin text-amber-500" />
                        Loading more tracks...
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
                No videos found
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-4">
                Try selecting a different category or adjusting your search term.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveCategory("All");
                  searchParams.delete("q");
                  setSearchParams(searchParams);
                }}
                className="rounded-full text-xs font-bold"
              >
                Reset to All Videos
              </Button>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
