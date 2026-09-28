import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { 
  Radio, 
  Calendar, 
  Users, 
  DollarSign, 
  Play, 
  Clock, 
  Ticket,
  ChevronRight,
  Info 
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
      const liveRes = await fetch("/api/live/now");
      const liveData = await liveRes.json();
      setLiveStreamers(liveData);

      const upRes = await fetch("/api/live/upcoming");
      const upData = await upRes.json();
      setUpcomingStreams(upData);

      setError(null);
    } catch (err: any) {
      console.error("Error loading live streams:", err);
      // Fallback fallback if backend syncing
      setError("Failed to fetch current live spectrum. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
        <p className="text-gray-500 dark:text-gray-400 mt-4 text-xs font-mono">TUNING IN TO PAYTUNE LIVE...</p>
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
      <div className="relative h-64 md:h-80 rounded-3xl overflow-hidden bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 p-8 md:p-12 flex flex-col justify-end text-black shadow-lg shadow-amber-500/10">
        <div className="absolute inset-x-0 bottom-0 top-0 bg-black/20 pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="inline-flex items-center gap-1 px-3 py-1 text-[10px] font-black tracking-widest bg-black text-amber-500 rounded-full uppercase">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> PAYTUNE LIVE BROADCASTS
          </span>
          <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight leading-none text-white">Live Concerts & Exclusive Showcases</h1>
          <p className="text-white/85 text-xs md:text-sm font-semibold leading-relaxed">Connect directly with top Rwandan creators. Support them through ticket transactions, Super Chats, and interactive stream contributions.</p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 dark:border-[#222222] pb-4 gap-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("live")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black uppercase transition-all duration-300 ${
              activeTab === "live"
                ? "bg-amber-500 text-black font-black"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping" />
            Live Shows Now ({liveStreamers.length})
          </button>
          
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black uppercase transition-all duration-300 ${
              activeTab === "upcoming"
                ? "bg-amber-500 text-black font-black"
                : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Upcoming Scheduled ({upcomingStreams.length})
          </button>
        </div>

        <button 
          onClick={fetchStreams}
          className="text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-500 hover:underline"
        >
          Refresh Feeds
        </button>
      </div>

      {/* Streams list representation */}
      {activeTab === "live" ? (
        <div className="space-y-6">
          {liveStreamers.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-3xl space-y-3">
              <Radio className="w-12 h-12 text-gray-400 mx-auto" />
              <h3 className="font-mono text-xs text-gray-500 uppercase tracking-widest">No Active Streams Currently</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">None of the artists are live-broadcasting right now. Toggle to 'Upcoming' to buy tickets for scheduled virtual events!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {liveStreamers.map((stream) => (
                <Link 
                  to={`/live/${stream.id}`} 
                  key={stream.id}
                  className="group bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#202020] rounded-3xl overflow-hidden hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 flex flex-col justify-between"
                >
                  <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
                    {stream.artists?.profile_image ? (
                      <img 
                        src={stream.artists.profile_image} 
                        alt={stream.title} 
                        className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-neutral-900 via-neutral-800 to-amber-950/70 flex items-center justify-center">
                        <Play className="w-12 h-12 text-[#FFB300] opacity-60" />
                      </div>
                    )}
                    <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white font-black uppercase text-[10px] rounded-full tracking-wider shadow">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      LIVE NOW
                    </span>
                    <span className="absolute bottom-4 right-4 inline-flex items-center gap-1 px-2.5 py-1 bg-black/60 backdrop-blur-md text-white font-black text-[10px] rounded-lg">
                      <Users className="w-3.5 h-3.5 text-amber-500" />
                      {stream.total_viewers || 10} VIEWERS
                    </span>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      {stream.artists?.profile_image ? (
                        <img 
                          src={stream.artists.profile_image} 
                          alt={stream.artists?.full_name} 
                          className="w-10 h-10 rounded-full border border-amber-500 object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-500 text-black font-black text-sm flex items-center justify-center border border-amber-500">
                          {stream.artists?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-black uppercase text-amber-500 leading-snug">{stream.artists?.full_name}</h4>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold">Artist Creator</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base font-black text-gray-900 dark:text-white uppercase leading-tight line-clamp-1">{stream.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{stream.description || "No description provided."}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-50 dark:border-zinc-900/40 pt-4">
                      <span className="inline-flex items-center gap-1 text-xs font-black uppercase">
                        {stream.is_paid ? (
                          <>
                            <Ticket className="w-4 h-4 text-amber-500" />
                            <span className="text-amber-500">RWF {stream.price_rwf?.toLocaleString()}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-green-500">FREE SHOW</span>
                          </>
                        )}
                      </span>

                      <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-amber-500 group-hover:translate-x-1 transition-transform">
                        Watch Live <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {upcomingStreams.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-3xl space-y-3">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto" />
              <h3 className="font-mono text-xs text-gray-500 uppercase tracking-widest">No Upcoming Live Events Scheduled</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">There are no upcoming virtual concert schedules at the moment. Please revisit later!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingStreams.map((stream) => (
                <div 
                  key={stream.id}
                  className="bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#202020] rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between"
                >
                  <div className="relative aspect-video bg-gray-900 flex items-center justify-center">
                    {stream.artists?.profile_image ? (
                      <img 
                        src={stream.artists.profile_image} 
                        alt={stream.title} 
                        className="w-full h-full object-cover opacity-75"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-neutral-900 via-neutral-800 to-amber-950/70 flex items-center justify-center">
                        <Clock className="w-10 h-10 text-[#FFB300] opacity-60" />
                      </div>
                    )}
                    <div className="absolute top-4 left-4 inline-flex items-center gap-1 px-3 py-1 bg-amber-500 text-black font-black uppercase text-[9px] rounded-full tracking-wider">
                      <Clock className="w-3.5 h-3.5" />
                      SCHEDULED SHOW
                    </div>

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 flex flex-col justify-end text-white">
                      <span className="text-[10px] font-black uppercase text-amber-500">START DATE:</span>
                      <span className="text-xs font-black uppercase">{new Date(stream.scheduled_start).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      {stream.artists?.profile_image ? (
                        <img 
                          src={stream.artists.profile_image} 
                          alt={stream.artists?.full_name} 
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-500 text-black font-black text-sm flex items-center justify-center">
                          {stream.artists?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-black uppercase text-amber-500 leading-snug">{stream.artists?.full_name}</h4>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-widest font-bold">Artist Creator</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base font-black text-gray-900 dark:text-white uppercase leading-tight line-clamp-1">{stream.title}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{stream.description || "No description provided."}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-50 dark:border-zinc-900/40 pt-4">
                      <span className="inline-flex items-center gap-1 text-xs font-black uppercase">
                        {stream.is_paid ? (
                          <>
                            <Ticket className="w-4 h-4 text-amber-500" />
                            <span className="text-amber-500">RWF {stream.price_rwf?.toLocaleString()}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-green-500">FREE ENTRY</span>
                          </>
                        )}
                      </span>

                      <Link 
                        to={`/live/${stream.id}`}
                        className="px-4 py-1.5 bg-gray-100 dark:bg-[#1E1E22] text-gray-800 dark:text-gray-200 hover:bg-amber-500 hover:text-black font-black uppercase text-[10px] rounded-full transition-colors"
                      >
                        Event Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
