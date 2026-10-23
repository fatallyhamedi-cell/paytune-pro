import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  PhoneCall,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  ShieldCheck,
  User,
  Film,
  Calendar,
  AlertCircle,
  RefreshCw,
  Plus,
  Play,
  Lock,
  MessageSquare
} from 'lucide-react';
import { Button } from './ui/button';

interface AccessRequest {
  id: string;
  phone: string;
  video_id: string;
  video_title?: string;
  video_thumbnail?: string;
  user_id?: string | null;
  name?: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  decision_note?: string | null;
}

export const AccessRequestsManager: React.FC = () => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Quick grant modal state
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantPhone, setGrantPhone] = useState('');
  const [grantVideoId, setGrantVideoId] = useState('');
  const [grantName, setGrantName] = useState('');
  const [grantNote, setGrantNote] = useState('Granted by Master Administrator');
  const [granting, setGranting] = useState(false);
  const [videosList, setVideosList] = useState<{ id: string; title: string; price_rwf: number }[]>([]);

  // Decision note prompt modal
  const [decisionModal, setDecisionModal] = useState<{
    isOpen: boolean;
    type: 'approve' | 'reject';
    request: AccessRequest | null;
    note: string;
  }>({
    isOpen: false,
    type: 'approve',
    request: null,
    note: ''
  });

  const fetchRequests = async () => {
    try {
      setRefreshing(true);
      const res = await axios.get('/api/access-requests/list');
      if (res.data?.requests) {
        setRequests(res.data.requests);
      }
    } catch (err: any) {
      console.error('Failed to fetch access requests:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchVideos = async () => {
    try {
      const res = await axios.get('/api/videos?type=paid&limit=50');
      if (Array.isArray(res.data)) {
        setVideosList(res.data);
        if (res.data.length > 0 && !grantVideoId) {
          setGrantVideoId(res.data[0].id);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchRequests();
    fetchVideos();
  }, []);

  const handleApprove = async (id: string, decisionNote?: string) => {
    setProcessingId(id);
    setFeedback(null);
    try {
      const res = await axios.post(`/api/access-requests/${id}/approve`, {
        decisionNote: decisionNote || 'Approved by Master Administrator'
      });
      setFeedback({
        type: 'success',
        message: res.data?.message || 'Access granted! Video playback entitlement active for this phone.'
      });
      await fetchRequests();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Failed to approve request'
      });
    } finally {
      setProcessingId(null);
      setDecisionModal({ isOpen: false, type: 'approve', request: null, note: '' });
    }
  };

  const handleReject = async (id: string, decisionNote?: string) => {
    setProcessingId(id);
    setFeedback(null);
    try {
      const res = await axios.post(`/api/access-requests/${id}/reject`, {
        decisionNote: decisionNote || 'Declined by Master Administrator'
      });
      setFeedback({
        type: 'success',
        message: res.data?.message || 'Access request rejected.'
      });
      await fetchRequests();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Failed to reject request'
      });
    } finally {
      setProcessingId(null);
      setDecisionModal({ isOpen: false, type: 'reject', request: null, note: '' });
    }
  };

  const handleManualGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantPhone.trim() || !grantVideoId) return;

    setGranting(true);
    setFeedback(null);
    try {
      // 1. Submit request
      const submitRes = await axios.post('/api/access-requests/submit', {
        phone: grantPhone.trim(),
        videoId: grantVideoId,
        name: grantName.trim() || 'VIP Viewer',
        note: grantNote.trim()
      });

      const reqId = submitRes.data?.request?.id;
      if (reqId) {
        // 2. Immediately approve
        await axios.post(`/api/access-requests/${reqId}/approve`, {
          decisionNote: 'Granted directly by Master Administrator'
        });
      }

      setFeedback({
        type: 'success',
        message: `Phone access granted for ${grantPhone}! Playback privileges are now active for this release.`
      });

      setShowGrantModal(false);
      setGrantPhone('');
      setGrantName('');
      await fetchRequests();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Failed to grant access'
      });
    } finally {
      setGranting(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPhone = r.phone.toLowerCase().includes(q);
      const matchTitle = (r.video_title || '').toLowerCase().includes(q);
      const matchName = (r.name || '').toLowerCase().includes(q);
      return matchPhone || matchTitle || matchName;
    }
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;

  return (
    <div id="access-requests-manager" className="space-y-6 animate-fadeIn">
      {/* Header with Title and Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5">
            <PhoneCall className="w-6 h-6 text-amber-500" />
            Phone Access Request & Approval Workflow
          </h2>
          <p className="text-xs md:text-sm text-neutral-400 mt-1">
            Review viewer phone number requests for paid releases. Approved requests receive video-specific playback privileges without violating platform paywall rules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => fetchRequests()}
            variant="outline"
            size="sm"
            disabled={refreshing}
            className="border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={() => setShowGrantModal(true)}
            size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Grant Phone Access
          </Button>
        </div>
      </div>

      {/* Notification Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/15 border border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4">
          <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Total Requests</p>
          <p className="text-2xl font-black text-white mt-1">{requests.length}</p>
        </div>
        <div className="bg-[#141414] border border-amber-500/30 rounded-xl p-4">
          <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </p>
          <p className="text-2xl font-black text-amber-400 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-[#141414] border border-emerald-500/30 rounded-xl p-4">
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved / Watching
          </p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{approvedCount}</p>
        </div>
        <div className="bg-[#141414] border border-neutral-800 rounded-xl p-4">
          <p className="text-xs text-red-400 font-semibold uppercase tracking-wider flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </p>
          <p className="text-2xl font-black text-red-400 mt-1">{rejectedCount}</p>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by phone, requester name, or video title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#181818] border border-neutral-800 focus:border-amber-500 rounded-xl px-4 py-2 text-sm text-white placeholder-neutral-500 pl-10 outline-none transition-colors"
          />
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                statusFilter === filter
                  ? 'bg-amber-500 text-neutral-950 shadow-md'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {filter === 'all' ? `All (${requests.length})` : `${filter} (${requests.filter((r) => r.status === filter).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-[#141414] border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-neutral-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
            Loading phone access requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 text-sm space-y-2">
            <PhoneCall className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
            <p className="font-semibold text-neutral-300">No access requests found</p>
            <p className="text-xs text-neutral-500">
              {statusFilter !== 'all' || searchQuery
                ? 'Try adjusting your search query or status filter.'
                : 'When viewers request phone access to a paid release, they will appear here for administrator review.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1b1b1b] border-b border-neutral-800 text-neutral-400 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="py-3 px-4">Viewer & Phone</th>
                  <th className="py-3 px-4">Target Release</th>
                  <th className="py-3 px-4">Note / Justification</th>
                  <th className="py-3 px-4">Requested At</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-mono font-bold text-xs">
                          <PhoneCall className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-white font-mono">{req.phone}</p>
                          <p className="text-[11px] text-neutral-400">{req.name || 'Anonymous Viewer'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-center gap-2">
                        {req.video_thumbnail ? (
                          <img
                            src={req.video_thumbnail}
                            alt=""
                            className="w-9 h-6 object-cover rounded bg-neutral-800 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-6 rounded bg-neutral-800 flex items-center justify-center shrink-0">
                            <Film className="w-3.5 h-3.5 text-neutral-500" />
                          </div>
                        )}
                        <span className="font-semibold text-white line-clamp-1">{req.video_title}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="text-neutral-400 line-clamp-2 italic">
                        "{req.note || 'No custom note provided'}"
                      </p>
                      {req.decision_note && (
                        <p className="text-[11px] text-amber-400 mt-0.5">
                          Admin: {req.decision_note}
                        </p>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-neutral-400">
                      {new Date(req.created_at).toLocaleDateString()} {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {req.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Approved
                        </span>
                      ) : req.status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                          <XCircle className="w-3 h-3" /> Declined
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3 animate-pulse" /> Pending
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {req.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            disabled={processingId === req.id}
                            onClick={() =>
                              setDecisionModal({
                                isOpen: true,
                                type: 'approve',
                                request: req,
                                note: 'Approved by Master Administrator'
                              })
                            }
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-7 px-2.5 rounded-lg cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Approve
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            disabled={processingId === req.id}
                            onClick={() =>
                              setDecisionModal({
                                isOpen: true,
                                type: 'reject',
                                request: req,
                                note: 'Declined by Administrator'
                              })
                            }
                            className="border-red-900/40 bg-red-950/30 hover:bg-red-900/40 text-red-400 text-xs h-7 px-2.5 rounded-lg cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </Button>
                        </div>
                      ) : req.status === 'rejected' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={processingId === req.id}
                          onClick={() => handleApprove(req.id, 'Re-approved by Master Administrator')}
                          className="border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-amber-400 text-xs h-7 px-2.5 rounded-lg cursor-pointer"
                        >
                          Re-Approve
                        </Button>
                      ) : (
                        <span className="text-[11px] text-neutral-500">Access Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Grant Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#181818] border border-amber-500/40 rounded-2xl p-6 text-white shadow-2xl space-y-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" /> Direct Access Privilege
              </div>
              <h3 className="text-lg font-bold">Grant Phone Viewing Privilege</h3>
              <p className="text-xs text-neutral-400">
                Directly whitelist a viewer's mobile number for a specific paid release.
              </p>
            </div>

            <form onSubmit={handleManualGrantSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 0780000000 or +250 788 123 456"
                  value={grantPhone}
                  onChange={(e) => setGrantPhone(e.target.value)}
                  required
                  className="w-full bg-[#121212] border border-neutral-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder-neutral-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                  Target Paid Video *
                </label>
                <select
                  value={grantVideoId}
                  onChange={(e) => setGrantVideoId(e.target.value)}
                  required
                  className="w-full bg-[#121212] border border-neutral-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                >
                  {videosList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({v.price_rwf} RWF)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                  Viewer Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. VIP Partner or Press Reviewer"
                  value={grantName}
                  onChange={(e) => setGrantName(e.target.value)}
                  className="w-full bg-[#121212] border border-neutral-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder-neutral-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300 mb-1">
                  Administrative Note
                </label>
                <input
                  type="text"
                  value={grantNote}
                  onChange={(e) => setGrantNote(e.target.value)}
                  className="w-full bg-[#121212] border border-neutral-800 focus:border-amber-500 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowGrantModal(false)}
                  className="border-neutral-800 bg-neutral-900 text-neutral-300 text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={granting || !grantPhone.trim() || !grantVideoId}
                  className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs cursor-pointer"
                >
                  {granting ? 'Granting Access...' : 'Grant Playback Access'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decision Note Modal */}
      {decisionModal.isOpen && decisionModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm bg-[#181818] border border-neutral-800 rounded-2xl p-5 text-white shadow-2xl space-y-3">
            <h3 className="text-base font-bold flex items-center gap-2">
              {decisionModal.type === 'approve' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Approve Access Request
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-400" />
                  Reject Access Request
                </>
              )}
            </h3>

            <p className="text-xs text-neutral-400">
              {decisionModal.type === 'approve'
                ? `Grant ${decisionModal.request.phone} viewing access for "${decisionModal.request.video_title}".`
                : `Decline access request for ${decisionModal.request.phone}.`}
            </p>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                Decision Note
              </label>
              <textarea
                rows={2}
                value={decisionModal.note}
                onChange={(e) => setDecisionModal((prev) => ({ ...prev, note: e.target.value }))}
                className="w-full bg-[#121212] border border-neutral-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDecisionModal({ isOpen: false, type: 'approve', request: null, note: '' })}
                className="border-neutral-800 text-neutral-300 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (decisionModal.type === 'approve') {
                    handleApprove(decisionModal.request!.id, decisionModal.note);
                  } else {
                    handleReject(decisionModal.request!.id, decisionModal.note);
                  }
                }}
                className={
                  decisionModal.type === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer'
                    : 'bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer'
                }
              >
                Confirm {decisionModal.type === 'approve' ? 'Approval' : 'Rejection'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
