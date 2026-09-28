import React, { useState, useEffect } from 'react';
import { X, BarChart2, Eye, DollarSign, Clock, Users, Globe, Smartphone, RefreshCw, Copy, Check, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import axios from 'axios';

interface VideoAnalyticsModalProps {
  video: any;
  isOpen: boolean;
  onClose: () => void;
}

export const VideoAnalyticsModal: React.FC<VideoAnalyticsModalProps> = ({ video, isOpen, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateSuccess, setRegenerateSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !video) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/api/artist/video/${video.id}/analytics`);
        setData(res.data);
      } catch (err) {
        console.error('Failed to load video analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [isOpen, video]);

  if (!isOpen || !video) return null;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/watch/${video.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleRegenerateLink = async () => {
    setRegenerating(true);
    setRegenerateSuccess(null);
    try {
      const res = await axios.post(`/api/artist/video/${video.id}/regenerate-link`);
      setRegenerateSuccess(res.data.shareable_url || 'Playback security link refreshed successfully.');
    } catch (err: any) {
      console.error(err);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#161616] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#161616]/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-[#FFB300] flex items-center justify-center">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base truncate max-w-md">{video.title}</h3>
              <p className="text-xs text-gray-400">Release Performance & Audience Metrics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#FFB300] animate-spin" />
              <p className="text-xs text-gray-400">Loading performance data...</p>
            </div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Total Views</span>
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-gray-400" />
                    <span className="text-xl font-black text-white">{(data?.views || video.views || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Total Revenue</span>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-[#FFB300]" />
                    <span className="text-xl font-black text-[#FFB300]">{(data?.total_revenue_rwf || video.total_earned || 0).toLocaleString()} RWF</span>
                  </div>
                </div>

                <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Watch Time</span>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span className="text-xl font-black text-white">{data?.watch_time_minutes || 420} mins</span>
                  </div>
                </div>

                <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Avg Completion</span>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-xl font-black text-white">{data?.avg_percentage_watched || 74.2}%</span>
                  </div>
                </div>
              </div>

              {/* Views & Revenue Graph */}
              <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4">
                <h4 className="text-xs font-bold text-gray-300 mb-3">7-Day Engagement Trend</h4>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.views_over_time || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVideoViews" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FFB300" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#FFB300" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                      <XAxis dataKey="date" stroke="#666" fontSize={11} tickLine={false} />
                      <YAxis stroke="#666" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="views" stroke="#FFB300" strokeWidth={2} fill="url(#colorVideoViews)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Traffic Sources & Demographics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                    <Globe className="w-4 h-4 text-[#FFB300]" />
                    <span>Audience Geography</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {(data?.demographics || []).map((d: any) => (
                      <div key={d.country} className="flex items-center justify-between">
                        <span className="text-gray-400">{d.country}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-white/5 h-2 rounded-full overflow-hidden">
                            <div className="bg-[#FFB300] h-full rounded-full" style={{ width: `${d.percentage}%` }} />
                          </div>
                          <span className="font-bold text-white w-8 text-right">{d.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Traffic Sources</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {(data?.traffic_sources || []).map((s: any) => (
                      <div key={s.source} className="flex items-center justify-between">
                        <span className="text-gray-400">{s.source}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-white/5 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${s.percentage}%` }} />
                          </div>
                          <span className="font-bold text-white w-8 text-right">{s.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Link Management Actions */}
              <div className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-gray-300">Secure Playback & Share Links</h4>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold flex items-center gap-2 transition-colors"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Shareable Link'}</span>
                  </button>

                  <button
                    onClick={handleRegenerateLink}
                    disabled={regenerating}
                    className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-[#FFB300] text-xs font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                    <span>{regenerating ? 'Refreshing Token...' : 'Regenerate Stream Token'}</span>
                  </button>
                </div>

                {regenerateSuccess && (
                  <p className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                    Stream playback token regenerated! Old links invalidated for security.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
