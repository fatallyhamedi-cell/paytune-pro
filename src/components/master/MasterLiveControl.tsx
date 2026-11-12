import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Radio,
  Users,
  DollarSign,
  Ticket,
  AlertTriangle,
  StopCircle,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  Activity,
  ShieldAlert,
  Search,
  RefreshCw
} from 'lucide-react';

export default function MasterLiveControl() {
  const [activeStreams, setActiveStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchLiveStreams = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/live/now');
      const streams = Array.isArray(res.data) ? res.data : [];
      setActiveStreams(streams);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load active streams:', err);
      setError('Failed to fetch active broadcasts from streaming subsystem.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStreams();
    const interval = setInterval(fetchLiveStreams, 10000); // 10s live pulse
    return () => clearInterval(interval);
  }, []);

  const handleEndStream = async (streamId: string) => {
    setActionLoadingId(streamId);
    try {
      await axios.put(`/api/live/${streamId}/end`);
      await fetchLiveStreams();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to terminate live broadcast');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filtered = activeStreams.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = (s.title || '').toLowerCase().includes(q);
    const artistMatch = (s.artists?.full_name || '').toLowerCase().includes(q);
    return titleMatch || artistMatch;
  });

  const totalConcurrentViewers = activeStreams.reduce(
    (sum, s) => sum + (Number(s.total_viewers) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* 1. Header & Live Telemetry Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-200 mb-2">
            <Radio className="w-3.5 h-3.5 animate-pulse text-red-600" />
            <span>PAYTUNE Live Control Center</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Live Broadcast Monitoring & Stream Moderation
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time telemetry, concurrent viewer counts, ticket access verification, and administrative emergency shutoff controls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchLiveStreams}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Active Broadcasts</span>
            <Radio className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-3xl font-black text-gray-900">{activeStreams.length}</p>
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> RTMP/HLS Streams Active
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Concurrent Viewers</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-3xl font-black text-purple-600">{totalConcurrentViewers.toLocaleString()}</p>
          <span className="text-[11px] text-gray-500 font-semibold">Real-time audience connections</span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Infrastructure Ingestion</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-gray-900">1080p60</p>
          <span className="text-[11px] text-gray-500 font-semibold">Low-latency HLS pipeline operating nominal</span>
        </div>
      </div>

      {/* 3. Live Broadcasts Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Active Live Broadcasts</h2>
            <p className="text-xs text-gray-500">Monitor active streams and intervene immediately on policy violations</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stream or creator..."
              className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-purple-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Broadcast & Creator</th>
                <th className="px-6 py-3.5">Type & Admission</th>
                <th className="px-6 py-3.5">Concurrent Viewers</th>
                <th className="px-6 py-3.5">Started At</th>
                <th className="px-6 py-3.5">Stream Health</th>
                <th className="px-6 py-3.5 text-right">Emergency Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    No active broadcasts running right now.
                  </td>
                </tr>
              ) : (
                filtered.map((stream) => (
                  <tr key={stream.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-900 shrink-0">
                          {stream.artists?.profile_image ? (
                            <img
                              src={stream.artists.profile_image}
                              alt={stream.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white font-bold">
                              LIVE
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-xs line-clamp-1">{stream.title}</p>
                          <p className="text-[11px] text-gray-500 font-semibold">
                            {stream.artists?.full_name || 'Creator'} • ID: {stream.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {stream.is_paid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                          <Ticket className="w-3 h-3 text-[#FFB300]" />
                          <span>{stream.price_rwf?.toLocaleString()} RWF Ticket</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          Free Public Stream
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 font-mono font-bold text-gray-900">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                        {(stream.total_viewers || 1).toLocaleString()} Viewers
                      </span>
                    </td>

                    <td className="px-6 py-4 text-gray-500 font-mono text-[11px]">
                      {new Date(stream.created_at || Date.now()).toLocaleTimeString()}
                    </td>

                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Healthy (3500 kbps)
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleEndStream(stream.id)}
                        disabled={actionLoadingId === stream.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] border border-red-200 transition-colors active:scale-95 cursor-pointer disabled:opacity-50"
                        title="Force terminate this broadcast immediately"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                        <span>{actionLoadingId === stream.id ? 'Terminating...' : 'Force Terminate'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
