import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Radio,
  Calendar,
  Users,
  Play,
  Clock,
  Ticket,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export default function LiveStreams() {
  const [activeTab, setActiveTab] = useState<"live" | "upcoming">("live");
  const [liveStreamers, setLiveStreamers] = useState<any[]>([]);
  const [upcomingStreams, setUpcomingStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStreams();
  }, []);

  const fetchStreams = async () => {
    setLoading(true);
    try {
      const [liveRes, upRes] = await Promise.all([
        fetch("/api/live/now"),
        fetch("/api/live/upcoming"),
      ]);

      if (!liveRes.ok || !upRes.ok) {
        const errBody = await (liveRes.ok ? upRes : liveRes).json().catch(() => ({}));
        throw new Error(errBody.error || "Unable to load live broadcast catalog from database.");
      }

      const [liveData, upData] = await Promise.all([liveRes.json(), upRes.json()]);
      setLiveStreamers(Array.isArray(liveData) ? liveData : []);
      setUpcomingStreams(Array.isArray(upData) ? upData : []);
      setError(null);
    } catch (err: any) {
      console.error("Error loading live streams:", err);
      setLiveStreamers([]);
      setUpcomingStreams([]);
      setError(err.message || "Failed to fetch live broadcasts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600" />
        <p className="text-gray-500 dark:text-gray-400 mt-4 text-xs font-mono">
          LOADING LIVE BROADCASTS...
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8"
    >
      {/* Banner Billboard */}
      <div className="relative h-64 md:h-80 rounded-3xl overflow-hidden bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 p-8 md:p-12 flex flex-col justify-end text-white shadow-lg shadow-purple-600/10">
        <div className="absolute inset-0 bg-black/25 pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black tracking-widest bg-black text-purple-400 rounded-md uppercase">
            <Radio className="w-3.5 h-3.5" /> PAYTUNE LIVE BROADCASTS
          </span>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-none text-white">
            Live Concerts & Exclusive Showcases
          </h1>
          <p className="text-white/85 text-xs md:text-sm font-semibold leading-relaxed">
            Connect directly with verified creators through live performances, Super Thanks, and ticketed events.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-red-700 dark:text-red-400 text-xs font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchStreams}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Tabs Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 dark:border-[#222222] pb-4 gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("live")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all duration-200 cursor-pointer ${
              activeTab === "live"
                ? "bg-purple-600 text-white"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Radio className="w-4 h-4" />
            Live Shows Now ({liveStreamers.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("upcoming")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all duration-200 cursor-pointer ${
              activeTab === "upcoming"
                ? "bg-purple-600 text-white"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Upcoming Scheduled ({upcomingStreams.length})
          </button>
        </div>

        <button
          type="button"
          onClick={fetchStreams}
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-400 hover:underline cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Feeds
        </button>
      </div>

      {/* Streams list representation */}
      {activeTab === "live" ? (
        <div className="space-y-6">
          {liveStreamers.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-3xl space-y-3">
              <Radio className="w-12 h-12 text-gray-400 mx-auto" />
              <h3 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
                No Active Streams Currently
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                No creators are actively broadcasting right now. Switch to Upcoming Scheduled to view scheduled events.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveStreamers.map((stream) => {
                const creatorName =
                  stream.artists?.full_name || stream.artist_name || "Verified Creator";
                const avatar = stream.artists?.profile_image || stream.artist_avatar || null;
                const thumb = stream.thumbnail_url || avatar;
                const viewerCount = Number(stream.total_viewers ?? stream.current_viewers ?? 0);

                return (
                  <Link
                    to={`/live/${stream.id}`}
                    key={stream.id}
                    className="group bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#202020] rounded-3xl overflow-hidden hover:shadow-xl hover:shadow-purple-600/5 transition-all duration-300 flex flex-col justify-between"
                  >
                    <div className="relative aspect-video bg-gray-900 flex items-center justify-center overflow-hidden">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={stream.title}
                          className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-neutral-900 via-neutral-800 to-purple-950/70 flex items-center justify-center">
                          <Play className="w-12 h-12 text-purple-400 opacity-70" />
                        </div>
                      )}
                      <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white font-black uppercase text-[10px] rounded-md tracking-wider shadow">
                        LIVE NOW
                      </span>
                      <span className="absolute bottom-4 right-4 inline-flex items-center gap-1 px-2.5 py-1 bg-black/70 backdrop-blur-md text-white font-black text-[10px] rounded-lg">
                        <Users className="w-3.5 h-3.5 text-purple-400" />
                        {viewerCount.toLocaleString()} VIEWERS
                      </span>
                    </div>

                    <div className="p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={creatorName}
                            className="w-10 h-10 rounded-full border border-purple-600 object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-black text-sm flex items-center justify-center border border-purple-500">
                            {creatorName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className="text-xs font-black uppercase text-purple-600 leading-snug">
                            {creatorName}
                          </h4>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold">
                            Creator Broadcast
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-base font-black text-gray-900 dark:text-white uppercase leading-tight line-clamp-1">
                          {stream.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {stream.description || "No description provided."}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-gray-50 dark:border-zinc-900/40 pt-4">
                        <span className="inline-flex items-center gap-1 text-xs font-black uppercase">
                          {stream.is_paid ? (
                            <>
                              <Ticket className="w-4 h-4 text-purple-600" />
                              <span className="text-purple-600">
                                RWF {Number(stream.price_rwf || 0).toLocaleString()}
                              </span>
                            </>
                          ) : (
                            <span className="text-green-500">FREE SHOW</span>
                          )}
                        </span>

                        <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-purple-600 group-hover:translate-x-1 transition-transform">
                          Watch Live <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {upcomingStreams.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-3xl space-y-3">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto" />
              <h3 className="font-mono text-xs text-gray-500 uppercase tracking-widest">
                No Upcoming Live Events Scheduled
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                There are no scheduled live events in the database right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingStreams.map((stream) => {
                const creatorName =
                  stream.artists?.full_name || stream.artist_name || "Verified Creator";
                const avatar = stream.artists?.profile_image || stream.artist_avatar || null;
                const thumb = stream.thumbnail_url || avatar;

                return (
                  <div
                    key={stream.id}
                    className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#202020] rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between"
                  >
                    <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={stream.title}
                          className="w-full h-full object-cover opacity-80"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-neutral-900 via-neutral-800 to-purple-950/70 flex items-center justify-center">
                          <Clock className="w-10 h-10 text-purple-400 opacity-70" />
                        </div>
                      )}
                      <div className="absolute top-4 left-4 inline-flex items-center gap-1 px-3 py-1 bg-purple-600 text-white font-black uppercase text-[9px] rounded-md tracking-wider">
                        <Clock className="w-3.5 h-3.5" />
                        SCHEDULED SHOW
                      </div>

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 flex flex-col justify-end text-white">
                        <span className="text-[10px] font-black uppercase text-purple-300">
                          START DATE:
                        </span>
                        <span className="text-xs font-black uppercase">
                          {stream.scheduled_start
                            ? new Date(stream.scheduled_start).toLocaleString()
                            : "To be announced"}
                        </span>
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      <div className="flex items-center gap-3">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={creatorName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-black text-sm flex items-center justify-center">
                            {creatorName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className="text-xs font-black uppercase text-purple-600 leading-snug">
                            {creatorName}
                          </h4>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold">
                            Creator Event
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-base font-black text-gray-900 dark:text-white uppercase leading-tight line-clamp-1">
                          {stream.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {stream.description || "No description provided."}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-gray-50 dark:border-zinc-900/40 pt-4">
                        <span className="inline-flex items-center gap-1 text-xs font-black uppercase">
                          {stream.is_paid ? (
                            <>
                              <Ticket className="w-4 h-4 text-purple-600" />
                              <span className="text-purple-600">
                                RWF {Number(stream.price_rwf || 0).toLocaleString()}
                              </span>
                            </>
                          ) : (
                            <span className="text-green-500">FREE ENTRY</span>
                          )}
                        </span>

                        <Link
                          to={`/live/${stream.id}`}
                          className="px-4 py-1.5 bg-gray-100 dark:bg-[#1E1E22] text-gray-800 dark:text-gray-200 hover:bg-purple-600 hover:text-white font-black uppercase text-[10px] rounded-lg transition-colors"
                        >
                          Event Details
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
