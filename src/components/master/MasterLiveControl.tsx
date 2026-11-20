import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import {
  Radio,
  Users,
  Ticket,
  AlertTriangle,
  StopCircle,
  Activity,
  Search,
  RefreshCw,
  X,
} from 'lucide-react';

export default function MasterLiveControl() {
  const [activeStreams, setActiveStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmEndId, setConfirmEndId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchLiveStreams = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/live/now');
      const streams = Array.isArray(res.data) ? res.data : [];
      setActiveStreams(streams);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load active streams:', err);
      setError(err.response?.data?.error || 'Failed to fetch active broadcasts from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStreams();
    const interval = setInterval(fetchLiveStreams, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleEndStream = async (streamId: string) => {
    setActionLoadingId(streamId);
    setConfirmEndId(null);
    try {
      await api.put(`/api/live/${streamId}/end`, {});
      setFeedback('Live broadcast terminated successfully.');
      await fetchLiveStreams();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to terminate live broadcast');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filtered = activeStreams.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = (s.title || '').toLowerCase().includes(q);
    const artistMatch = (s.artists?.full_name || s.artist_name || '').toLowerCase().includes(q);
    return titleMatch || artistMatch;
  });

  const totalConcurrentViewers = activeStreams.reduce(
    (sum, s) => sum + Number(s.current_viewers ?? s.total_viewers ?? 0),
    0
  );
  const providerConfiguredCount = activeStreams.filter((s) => Boolean(s.provider_configured)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-red-50 text-red-700 text-xs font-bold border border-red-200 mb-2">
            <Radio className="w-3.5 h-3.5 text-red-600" />
            <span>PAYTUNE Live Control Center</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Live Broadcast Monitoring & Moderation
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Live database telemetry, active viewer counts, ticket settings, and administrative shutoff controls.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLiveStreams}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            {error}
          </span>
          <button type="button" onClick={() => setError(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Active Broadcasts</span>
            <Radio className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-3xl font-black text-gray-900">{activeStreams.length}</p>
          <span className="text-[11px] text-gray-500 font-semibold block">
            Queried live from livestreams table
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Concurrent Viewers</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-3xl font-black text-purple-600">
            {totalConcurrentViewers.toLocaleString()}
          </p>
          <span className="text-[11px] text-gray-500 font-semibold">
            Sum of active room sessions
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Ingest Status</span>
            <Activity className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl font-black text-gray-900">
            {providerConfiguredCount > 0
              ? `${providerConfiguredCount} External Feed(s)`
              : 'Provider Unconfigured'}
          </p>
          <span className="text-[11px] text-gray-500 font-semibold">
            {providerConfiguredCount > 0
              ? 'External ingest URLs configured'
              : 'Requires external RTMP/HLS service keys'}
          </span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Active Live Broadcasts</h2>
            <p className="text-xs text-gray-500">
              Monitor live streams and terminate policy-violating broadcasts
            </p>
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
                <th className="px-6 py-3.5">Admission</th>
                <th className="px-6 py-3.5">Viewers</th>
                <th className="px-6 py-3.5">Started At</th>
                <th className="px-6 py-3.5">Ingest Feed</th>
                <th className="px-6 py-3.5 text-right">Action</th>
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
                filtered.map((stream) => {
                  const creatorName =
                    stream.artists?.full_name || stream.artist_name || 'Creator';
                  const avatar = stream.artists?.profile_image || stream.artist_avatar || null;
                  const viewers = Number(stream.current_viewers ?? stream.total_viewers ?? 0);

                  return (
                    <tr key={stream.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-900 shrink-0">
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={stream.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold">
                                LIVE
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-xs line-clamp-1">
                              {stream.title}
                            </p>
                            <p className="text-[11px] text-gray-500 font-semibold">
                              {creatorName} • ID: {String(stream.id).slice(0, 8)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {stream.is_paid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200">
                            <Ticket className="w-3 h-3" />
                            <span>{Number(stream.price_rwf || 0).toLocaleString()} RWF</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                            Free Public Stream
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 font-mono font-bold text-gray-900">
                        {viewers.toLocaleString()} Viewers
                      </td>

                      <td className="px-6 py-4 text-gray-500 font-mono text-[11px]">
                        {stream.actual_start_at || stream.created_at
                          ? new Date(stream.actual_start_at || stream.created_at).toLocaleTimeString()
                          : '—'}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`text-[11px] font-semibold ${
                            stream.provider_configured ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {stream.provider_configured ? 'Configured' : 'Unconfigured'}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        {confirmEndId === stream.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEndStream(stream.id)}
                              disabled={actionLoadingId === stream.id}
                              className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Confirm End
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmEndId(null)}
                              className="px-2.5 py-1 rounded-lg bg-gray-200 text-gray-700 font-bold text-[11px] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmEndId(stream.id)}
                            disabled={actionLoadingId === stream.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] border border-red-200 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <StopCircle className="w-3.5 h-3.5" />
                            <span>
                              {actionLoadingId === stream.id ? 'Terminating...' : 'Force Terminate'}
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
