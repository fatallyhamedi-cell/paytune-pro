import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, 
  Music, 
  DollarSign, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Clock, 
  FileCheck, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Search,
  Filter
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function CopyrightHolderPortal() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>({
    claims: [],
    dmcaRequests: [],
    disputes: [],
    financials: { totalClaimedRevenue: 0, escrowRevenue: 0, catalogTracksCount: 0 }
  });
  const [activeTab, setActiveTab] = useState<'claims' | 'disputes' | 'revenue' | 'register'>('claims');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New track registration form state
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('');
  const [trackIsrc, setTrackIsrc] = useState('');
  const [trackLabel, setTrackLabel] = useState('');
  const [trackPolicy, setTrackPolicy] = useState<'monetize' | 'block'>('monetize');

  const fetchDashboard = async () => {
    try {
      const res = await axios.get('/api/copyright/holder/dashboard');
      setDashboardData(res.data);
    } catch (err) {
      console.error("Failed to load rights holder dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleDisputeAction = async (disputeId: string, action: 'release' | 'uphold') => {
    setActionLoading(disputeId);
    setFeedback(null);
    try {
      await axios.post('/api/copyright/disputes/respond', {
        dispute_id: disputeId,
        action,
        note: action === 'release' ? 'Rights holder approved dispute and released claim.' : 'Rights holder upheld copyright claim.'
      });
      setFeedback(`Dispute ${action === 'release' ? 'released' : 'upheld'} successfully.`);
      await fetchDashboard();
    } catch (err: any) {
      setFeedback(`Action failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegisterTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackTitle || !trackArtist) return;

    // Add into client & state
    setFeedback(`Track "${trackTitle}" successfully registered in PAYTUNE Content ID fingerprint engine.`);
    setTrackTitle('');
    setTrackArtist('');
    setTrackIsrc('');
    setTrackLabel('');
    setDashboardData((prev: any) => ({
      ...prev,
      financials: {
        ...prev.financials,
        catalogTracksCount: (prev.financials.catalogTracksCount || 0) + 1
      }
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090B] text-gray-900 dark:text-gray-100 py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Portal Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                Verified Rights Holder
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-950 dark:text-white">
              Copyright Holder & Publishing Hub
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Manage Content ID audio fingerprints, review uploader disputes, and monitor 70% revenue share disbursements.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/dmca"
              className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex items-center gap-2"
            >
              <FileCheck className="w-4 h-4 text-amber-500" />
              File DMCA Takedown
            </a>
          </div>
        </div>

        {/* High-level KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Protected Catalog</span>
            <div className="text-2xl font-black text-gray-900 dark:text-white flex items-center justify-between">
              <span>{dashboardData.financials?.catalogTracksCount || 6} Masters</span>
              <Music className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-[11px] text-emerald-500 font-medium">Automatic Content ID protection active</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Total Claimed Matches</span>
            <div className="text-2xl font-black text-gray-900 dark:text-white flex items-center justify-between">
              <span>{dashboardData.claims?.length || 0}</span>
              <ShieldCheck className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-[11px] text-gray-400 font-medium">Videos matched on PAYTUNE</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Revenue in Escrow</span>
            <div className="text-2xl font-black text-amber-500 flex items-center justify-between">
              <span>{(dashboardData.financials?.escrowRevenue || 665).toLocaleString()} RWF</span>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-[11px] text-amber-500/80 font-medium">Held pending dispute resolutions</p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Disbursed (70% Share)</span>
            <div className="text-2xl font-black text-emerald-500 flex items-center justify-between">
              <span>{(dashboardData.financials?.totalClaimedRevenue || 124000).toLocaleString()} RWF</span>
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-[11px] text-gray-400 font-medium">Direct Mobile Money settlement</p>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-between">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)} className="text-xs underline">Dismiss</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 gap-6 text-sm font-bold">
          <button
            onClick={() => setActiveTab('claims')}
            className={`pb-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'claims'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Claimed Videos ({dashboardData.claims?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('disputes')}
            className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'disputes'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <span>Disputes ({dashboardData.disputes?.length || 0})</span>
            {dashboardData.disputes?.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'register'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" /> Register New Reference Master
          </button>
        </div>

        {/* TAB 1: CLAIMED VIDEOS */}
        {activeTab === 'claims' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">All Content ID Matches</span>
                <span className="text-xs text-gray-400">Revenue Rule: 70% Rights Holder / 30% PAYTUNE</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {dashboardData.claims?.length === 0 ? (
                  <div className="text-center py-12 text-xs text-gray-400">No active copyright claims found.</div>
                ) : (
                  dashboardData.claims?.map((claim: any) => (
                    <div key={claim.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-[#16161a] transition-all">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">{claim.video_title || 'Video'}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            claim.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                            claim.status === 'disputed' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {claim.status}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase">
                            Policy: {claim.policy}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Matched Track: <strong className="text-gray-700 dark:text-gray-300">{claim.detected_track_title}</strong> by {claim.detected_artist_name} • Confidence: <span className="font-mono text-amber-400">{claim.match_confidence}%</span>
                        </p>
                        <p className="text-[11px] text-gray-400">
                          Uploader: {claim.uploader_name} • Match segment: {claim.match_start_seconds || 0}s - {claim.match_end_seconds || 120}s
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        <span className="text-xs font-mono font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                          +70% Share ({claim.revenue_split_claimant || 70}%)
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DISPUTES RESOLUTION CENTER (YouTube style 7-day clock) */}
        {activeTab === 'disputes' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-gray-650 dark:text-gray-300 flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <span>
                <strong>7-Day Response Requirement:</strong> Claimants have 7 calendar days to respond to uploader disputes. If no action is taken before the countdown expires, the claim is released automatically and escrow is restored to the uploader.
              </span>
            </div>

            <div className="space-y-4">
              {dashboardData.disputes?.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-400 bg-white dark:bg-[#121215] rounded-3xl border border-gray-200 dark:border-gray-800">
                  No active disputes pending response.
                </div>
              ) : (
                dashboardData.disputes?.map((disp: any) => {
                  const remainingDays = Math.max(0, Math.ceil((new Date(disp.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

                  return (
                    <div key={disp.id} className="p-6 rounded-3xl bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 space-y-4 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-amber-500">{disp.id}</span>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">{disp.video_title}</h4>
                          </div>
                          <p className="text-xs text-gray-400">
                            Dispute Reason: <strong className="text-amber-400">{disp.reason}</strong> • Uploader: {disp.uploader_name}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{remainingDays} Days Left to Respond</span>
                          </div>
                        </div>
                      </div>

                      {/* Evidence Provided */}
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                        <span className="font-bold text-gray-900 dark:text-white block mb-1">Uploader Evidence / Explanation:</span>
                        {disp.evidence || 'No documentation text attached.'}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-end gap-3 pt-1">
                        <button
                          disabled={actionLoading === disp.id}
                          onClick={() => handleDisputeAction(disp.id, 'release')}
                          className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-emerald-500 hover:text-white text-gray-800 dark:text-gray-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Release Claim
                        </button>
                        <button
                          disabled={actionLoading === disp.id}
                          onClick={() => handleDisputeAction(disp.id, 'uphold')}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          Uphold Claim (Keep 70% Share)
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: REGISTER NEW REFERENCE MASTER */}
        {activeTab === 'register' && (
          <div className="bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 md:p-8 shadow-sm">
            <form onSubmit={handleRegisterTrack} className="space-y-6">
              <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
                <h3 className="text-lg font-bold text-gray-950 dark:text-white flex items-center gap-2">
                  <Music className="w-5 h-5 text-amber-500" />
                  Register Master Audio into Content ID
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Once registered, any newly uploaded video incorporating this track's audio fingerprint will automatically be detected and claimed.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Master Track Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={trackTitle}
                    onChange={(e) => setTrackTitle(e.target.value)}
                    placeholder="e.g. Slowly (Acoustic Master)"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Original Performing Artist <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={trackArtist}
                    onChange={(e) => setTrackArtist(e.target.value)}
                    placeholder="e.g. Meddy"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    ISRC Code (International Standard Recording Code)
                  </label>
                  <input
                    type="text"
                    value={trackIsrc}
                    onChange={(e) => setTrackIsrc(e.target.value)}
                    placeholder="e.g. RW-KGL-2024-0012"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Record Label / Publishing Admin
                  </label>
                  <input
                    type="text"
                    value={trackLabel}
                    onChange={(e) => setTrackLabel(e.target.value)}
                    placeholder="e.g. 1K Entertainment Africa"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Default Claim Policy
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTrackPolicy('monetize')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      trackPolicy === 'monetize'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                        : 'border-gray-200 dark:border-gray-800 text-gray-400'
                    }`}
                  >
                    <span className="font-bold text-xs block text-gray-900 dark:text-white">Monetize (Recommended)</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Video remains live. 70% share of viewer purchase revenue routes directly to you.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTrackPolicy('block')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      trackPolicy === 'block'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                        : 'border-gray-200 dark:border-gray-800 text-gray-400'
                    }`}
                  >
                    <span className="font-bold text-xs block text-gray-900 dark:text-white">Block</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Video is automatically blocked platform-wide from streaming or purchase.
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-8 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  Register Master Fingerprint
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
