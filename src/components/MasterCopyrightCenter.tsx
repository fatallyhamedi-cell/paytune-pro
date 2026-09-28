import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, 
  Scale, 
  AlertTriangle, 
  FileText, 
  Search, 
  Fingerprint, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  DollarSign, 
  UserX, 
  ExternalLink,
  Filter,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { CopyrightClaim, DMCARequest, CopyrightDispute, InfringementStrike } from '../types/copyright';

export function MasterCopyrightCenter() {
  const [activeSubTab, setActiveSubTab] = useState<'claims' | 'dmca' | 'strikes' | 'watermark'>('claims');
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<CopyrightClaim[]>([]);
  const [dmcaRequests, setDmcaRequests] = useState<DMCARequest[]>([]);
  const [disputes, setDisputes] = useState<CopyrightDispute[]>([]);
  const [strikes, setStrikes] = useState<InfringementStrike[]>([]);
  const [escrowTotal, setEscrowTotal] = useState<number>(665);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Forensic Watermark Trace State
  const [traceToken, setTraceToken] = useState('');
  const [tracing, setTracing] = useState(false);
  const [traceResult, setTraceResult] = useState<any | null>(null);

  // Manual strike modal / state
  const [strikeArtistId, setStrikeArtistId] = useState('');
  const [strikeReason, setStrikeReason] = useState('');
  const [strikeVideoId, setStrikeVideoId] = useState('');
  const [showStrikeModal, setShowStrikeModal] = useState(false);

  const fetchMasterCopyrightData = async () => {
    try {
      const [claimsRes, dmcaRes, disputesRes, strikesRes] = await Promise.all([
        axios.get('/api/copyright/claims').catch(() => ({ data: { claims: [] } })),
        axios.get('/api/dmca/requests').catch(() => ({ data: { requests: [] } })),
        axios.get('/api/copyright/disputes').catch(() => ({ data: { disputes: [] } })),
        axios.get('/api/copyright/strikes').catch(() => ({ data: { strikes: [] } }))
      ]);

      setClaims(claimsRes.data?.claims || []);
      setDmcaRequests(dmcaRes.data?.requests || []);
      setDisputes(disputesRes.data?.disputes || []);
      setStrikes(strikesRes.data?.strikes || []);
    } catch (err) {
      console.error("Failed to load master copyright data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterCopyrightData();
  }, []);

  const handleApproveDmca = async (requestId: string) => {
    if (!window.confirm("Approve this DMCA notice? The video will be blocked immediately and a copyright strike will be issued to the uploader.")) return;

    try {
      await axios.post(`/api/dmca/requests/${requestId}/action`, {
        action: 'approve',
        admin_notes: 'Approved by Master Admin. Video removed and strike recorded.'
      });
      setFeedback(`DMCA Notice ${requestId} approved. Video disabled and strike applied.`);
      await fetchMasterCopyrightData();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Action failed');
    }
  };

  const handleRejectDmca = async (requestId: string) => {
    const reason = prompt("Enter reason for rejecting DMCA notice:", "Insufficient proof of ownership / invalid claim");
    if (!reason) return;

    try {
      await axios.post(`/api/dmca/requests/${requestId}/action`, {
        action: 'reject',
        admin_notes: reason
      });
      setFeedback(`DMCA Notice ${requestId} rejected.`);
      await fetchMasterCopyrightData();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Action failed');
    }
  };

  const handlePolicyChange = async (claimId: string, newPolicy: 'monetize' | 'block') => {
    try {
      await axios.patch(`/api/copyright/claims/${claimId}/policy`, { policy: newPolicy });
      setFeedback(`Claim policy updated to ${newPolicy.toUpperCase()}`);
      await fetchMasterCopyrightData();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to update policy');
    }
  };

  const handleTraceWatermark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traceToken.trim()) return;

    setTracing(true);
    setTraceResult(null);
    try {
      const res = await axios.get(`/api/copyright/watermark/trace?token=${encodeURIComponent(traceToken.trim())}`);
      setTraceResult(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Forensic watermark not found in records.');
    } finally {
      setTracing(false);
    }
  };

  const handleIssueManualStrike = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!strikeArtistId || !strikeReason) return;

    try {
      await axios.post('/api/copyright/strikes', {
        artist_id: strikeArtistId,
        video_id: strikeVideoId || 'manual-flag',
        reason: strikeReason
      });
      setFeedback(`Strike issued to artist ${strikeArtistId}`);
      setShowStrikeModal(false);
      setStrikeArtistId('');
      setStrikeReason('');
      setStrikeVideoId('');
      await fetchMasterCopyrightData();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to issue strike');
    }
  };

  const handleToggleBanArtist = async (artistId: string, currentBanned: boolean) => {
    try {
      await axios.post(`/api/copyright/strikes/${artistId}/ban-toggle`, { is_banned: !currentBanned });
      setFeedback(`Artist ${artistId} ${!currentBanned ? 'banned' : 'unbanned'} successfully.`);
      await fetchMasterCopyrightData();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to toggle ban');
    }
  };

  return (
    <div className="space-y-6">

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Active Claims</span>
          <div className="text-2xl font-black text-gray-900 dark:text-white flex items-center justify-between">
            <span>{claims.length}</span>
            <ShieldCheck className="w-5 h-5 text-blue-500" />
          </div>
          <span className="text-[10px] text-gray-400">Content ID fingerprint matches</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Pending DMCA</span>
          <div className="text-2xl font-black text-amber-500 flex items-center justify-between">
            <span>{dmcaRequests.filter(d => d.status === 'pending').length}</span>
            <Scale className="w-5 h-5 text-amber-500" />
          </div>
          <span className="text-[10px] text-gray-400">Takedown requests under review</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Disputed Claims</span>
          <div className="text-2xl font-black text-purple-500 flex items-center justify-between">
            <span>{disputes.length}</span>
            <Clock className="w-5 h-5 text-purple-500" />
          </div>
          <span className="text-[10px] text-gray-400">7-Day timer active</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Escrow Vault</span>
          <div className="text-2xl font-black text-emerald-500 flex items-center justify-between">
            <span>{escrowTotal.toLocaleString()} RWF</span>
            <DollarSign className="w-5 h-5 text-emerald-500" />
          </div>
          <span className="text-[10px] text-gray-400">70% revenue held safely</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">Repeat Infringers</span>
          <div className="text-2xl font-black text-red-500 flex items-center justify-between">
            <span>{strikes.filter(s => s.strike_count >= 3 || s.is_banned).length}</span>
            <UserX className="w-5 h-5 text-red-500" />
          </div>
          <span className="text-[10px] text-gray-400">Banned channels (3 strikes)</span>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-6 text-sm font-bold">
        <button
          onClick={() => setActiveSubTab('claims')}
          className={`pb-3 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'claims'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Content ID Claims ({claims.length})
        </button>
        <button
          onClick={() => setActiveSubTab('dmca')}
          className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'dmca'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <span>DMCA Takedown Requests ({dmcaRequests.length})</span>
          {dmcaRequests.filter(d => d.status === 'pending').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('strikes')}
          className={`pb-3 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'strikes'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Strikes & Repeat Infringers ({strikes.length})
        </button>
        <button
          onClick={() => setActiveSubTab('watermark')}
          className={`pb-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'watermark'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <Fingerprint className="w-4 h-4" />
          Forensic Watermark Tracer
        </button>
      </div>

      {/* SUB-TAB 1: CONTENT ID CLAIMS */}
      {activeSubTab === 'claims' && (
        <div className="bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">All Flagged Videos & Fingerprint Matches</span>
            <span className="text-xs text-gray-400">Auto-detected via Audd / ACRCloud / Internal Catalog</span>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {claims.length === 0 ? (
              <div className="text-center py-12 text-xs text-gray-400">No active copyright claims.</div>
            ) : (
              claims.map((claim) => (
                <div key={claim.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-[#151518] transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-amber-500">{claim.id}</span>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white">{claim.video_title}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        claim.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                        claim.status === 'disputed' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {claim.status}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      Detected: <strong>"{claim.detected_track_title}"</strong> by {claim.detected_artist_name} ({claim.detected_label || 'Label'}) • Confidence: <span className="font-mono text-amber-500 font-bold">{claim.match_confidence}%</span>
                    </p>

                    <p className="text-[11px] text-gray-400">
                      Uploader: <span className="text-gray-300">{claim.uploader_name}</span> • Claimant: <span className="text-gray-300">{claim.claimant_name}</span> • Split: 70% Rights Holder / 30% Platform
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center">
                    {/* Policy Switcher */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                      <button
                        onClick={() => handlePolicyChange(claim.id, 'monetize')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          claim.policy === 'monetize'
                            ? 'bg-amber-500 text-black shadow-xs'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Monetize
                      </button>
                      <button
                        onClick={() => handlePolicyChange(claim.id, 'block')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          claim.policy === 'block'
                            ? 'bg-red-500 text-white shadow-xs'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Block Video
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: DMCA TAKEDOWN REQUESTS */}
      {activeSubTab === 'dmca' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Formal Notices & Counter-Notices</span>
              <a href="/dmca" target="_blank" className="text-xs text-amber-500 hover:underline flex items-center gap-1">
                Open Public Form <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {dmcaRequests.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-400">No DMCA takedown requests filed.</div>
              ) : (
                dmcaRequests.map((req) => (
                  <div key={req.id} className="p-5 space-y-4 hover:bg-gray-50 dark:hover:bg-[#151518] transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800/60 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-500">{req.id}</span>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Video: {req.video_id}</h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            req.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                            req.status === 'approved' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                            req.status === 'counter_notice' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {req.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Submitted by <strong>{req.claimant_name}</strong> ({req.claimant_email}) • Org: {req.claimant_company || 'Independent'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {req.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleRejectDmca(req.id)}
                              className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-white text-xs font-bold cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleApproveDmca(req.id)}
                              className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Approve Takedown & Strike
                            </button>
                          </>
                        )}
                        {req.status === 'approved' && (
                          <span className="text-xs font-bold text-red-500 px-3 py-1 rounded-xl bg-red-500/10 border border-red-500/20">
                            Takedown Executed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Notice Description */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
                        <span className="text-gray-400 font-bold block">Original Work & Proof:</span>
                        <a href={req.original_work_url} target="_blank" rel="noreferrer" className="text-amber-500 hover:underline break-all">
                          {req.original_work_url}
                        </a>
                        <p className="text-gray-600 dark:text-gray-300 mt-2">
                          <strong>Description:</strong> {req.infringement_description}
                        </p>
                      </div>

                      <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
                        <span className="text-gray-400 font-bold block">Digital Signature & Good Faith:</span>
                        <p className="font-mono text-gray-700 dark:text-gray-200">{req.digital_signature}</p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Sworn penalty of perjury: {req.sworn_statement_agreed ? 'YES (Affirmed)' : 'NO'}
                        </p>
                        {req.counter_notice_reason && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-purple-400">
                            <strong>Counter-Notice Lodged:</strong> {req.counter_notice_reason}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: STRIKES & REPEAT INFRINGERS */}
      {activeSubTab === 'strikes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
              3-Strike Enforcement Registry (3 Strikes = Permanent Account Ban)
            </span>
            <button
              onClick={() => setShowStrikeModal(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              Issue Manual Strike
            </button>
          </div>

          <div className="bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-gray-800/60">
            {strikes.length === 0 ? (
              <div className="text-center py-12 text-xs text-gray-400">No copyright strikes on file.</div>
            ) : (
              strikes.map((s) => (
                <div key={s.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">Artist ID: {s.artist_id}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        s.is_banned ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {s.is_banned ? 'BANNED' : `${s.strike_count} / 3 Strikes`}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Strike Reasons: {s.reasons?.join('; ') || 'DMCA Takedown Notice'}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      First Strike: {new Date(s.created_at).toLocaleDateString()} • Expiry: 90 days rolling window
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleBanArtist(s.artist_id, s.is_banned)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        s.is_banned
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white'
                      }`}
                    >
                      {s.is_banned ? 'Restore / Unban Artist' : 'Ban Channel Immediately'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: FORENSIC WATERMARK LEAK TRACER */}
      {activeSubTab === 'watermark' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-amber-500">
                <Fingerprint className="w-6 h-6" />
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  Forensic Watermark Leak Identifier
                </h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Every video session embeds a unique steganographic watermark token tied to the viewer's account, session timestamp, and IP address. Paste a recovered watermark token or fingerprint hash from an unauthorized leak to identify the source.
              </p>
            </div>

            <form onSubmit={handleTraceWatermark} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                value={traceToken}
                onChange={(e) => setTraceToken(e.target.value)}
                placeholder="e.g. wmk-1710000000000 or token string from leaked clip..."
                className="flex-1 px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-mono focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={tracing}
                className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Search className="w-4 h-4" />
                {tracing ? 'Tracing...' : 'Trace Leaker'}
              </button>
            </form>

            {/* Trace Result Output */}
            {traceResult && (
              <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-4">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                  <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Forensic Watermark Match Confirmed</span>
                  </div>
                  <span className="font-mono text-xs text-amber-500">{traceResult.watermark?.id}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-gray-400 font-bold block">Identified Viewer:</span>
                    <p className="text-gray-900 dark:text-white font-bold">{traceResult.user?.name || 'Authorized Purchaser'}</p>
                    <p className="text-gray-500">{traceResult.user?.email || 'N/A'}</p>
                  </div>

                  <div>
                    <span className="text-gray-400 font-bold block">User ID:</span>
                    <p className="font-mono text-amber-500">{traceResult.watermark?.user_id}</p>
                  </div>

                  <div>
                    <span className="text-gray-400 font-bold block">Target Video ID:</span>
                    <p className="font-mono text-gray-300">{traceResult.watermark?.video_id}</p>
                  </div>

                  <div>
                    <span className="text-gray-400 font-bold block">Streaming IP Address:</span>
                    <p className="font-mono text-gray-300">{traceResult.watermark?.ip_address || '197.243.22.84 (Rwanda)'}</p>
                  </div>

                  <div>
                    <span className="text-gray-400 font-bold block">Device / User-Agent:</span>
                    <p className="text-gray-300 truncate">{traceResult.watermark?.user_agent || 'Mozilla/5.0 (Macintosh; Intel)'}</p>
                  </div>

                  <div>
                    <span className="text-gray-400 font-bold block">Embedded Timestamp:</span>
                    <p className="text-gray-300">{new Date(traceResult.watermark?.created_at).toLocaleString()}</p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setStrikeArtistId(traceResult.watermark?.user_id);
                      setStrikeVideoId(traceResult.watermark?.video_id);
                      setStrikeReason(`Leaked protected video content identified via forensic watermark ${traceResult.watermark?.id}`);
                      setShowStrikeModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Enforce Immediate Sanction / Strike
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Strike Modal */}
      {showStrikeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#141417] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-gray-950 dark:text-white">
              Issue Copyright Strike
            </h3>
            <form onSubmit={handleIssueManualStrike} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Artist / User ID</label>
                <input
                  type="text"
                  required
                  value={strikeArtistId}
                  onChange={(e) => setStrikeArtistId(e.target.value)}
                  placeholder="e.g. artist-1"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Associated Video ID</label>
                <input
                  type="text"
                  value={strikeVideoId}
                  onChange={(e) => setStrikeVideoId(e.target.value)}
                  placeholder="e.g. video-1"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Violation Reason</label>
                <textarea
                  required
                  rows={3}
                  value={strikeReason}
                  onChange={(e) => setStrikeReason(e.target.value)}
                  placeholder="e.g. Verified unauthorized distribution or DMCA notice"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStrikeModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                >
                  Issue Strike
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default MasterCopyrightCenter;
