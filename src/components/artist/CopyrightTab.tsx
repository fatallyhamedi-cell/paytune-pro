import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  HelpCircle, 
  CheckCircle2, 
  X, 
  Send, 
  FileText, 
  Music, 
  ChevronRight, 
  AlertOctagon,
  Scale
} from 'lucide-react';
import { CopyrightClaim, DisputeReason } from '../../types/copyright';

export function CopyrightTab() {
  const [claims, setClaims] = useState<CopyrightClaim[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [strikes, setStrikes] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Dispute Modal State
  const [selectedClaimForDispute, setSelectedClaimForDispute] = useState<CopyrightClaim | null>(null);
  const [disputeReason, setDisputeReason] = useState<DisputeReason>('I have a license');
  const [disputeEvidence, setDisputeEvidence] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const fetchArtistCopyrightData = async () => {
    try {
      const [claimsRes, strikesRes] = await Promise.all([
        axios.get('/api/copyright/claims/my').catch(() => ({ data: { claims: [] } })),
        axios.get('/api/copyright/strikes').catch(() => ({ data: { strikes: [] } }))
      ]);

      const myClaims = claimsRes.data?.claims || [];
      setClaims(myClaims);

      // Find strike record for this artist if any
      const allStrikes = strikesRes.data?.strikes || [];
      if (allStrikes.length > 0) {
        setStrikes(allStrikes[0]);
      } else {
        setStrikes({ strike_count: 0, is_banned: false, reasons: [] });
      }
    } catch (err) {
      console.error("Error fetching copyright data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtistCopyrightData();
  }, []);

  const handleOpenDispute = (claim: CopyrightClaim) => {
    setSelectedClaimForDispute(claim);
    setDisputeReason('I have a license');
    setDisputeEvidence('');
    setFeedback(null);
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaimForDispute) return;

    setSubmittingDispute(true);
    try {
      const res = await axios.post('/api/copyright/claims/dispute', {
        claim_id: selectedClaimForDispute.id,
        reason: disputeReason,
        evidence: disputeEvidence
      });

      setFeedback('Dispute lodged successfully! A 7-day countdown has been started for the claimant.');
      setSelectedClaimForDispute(null);
      await fetchArtistCopyrightData();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to submit dispute');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleAcceptClaim = async (claimId: string) => {
    if (!window.confirm('Accept this claim? 70% of video purchase earnings will be routed to the copyright holder.')) return;

    try {
      await axios.post('/api/copyright/claims/accept', { claim_id: claimId });
      setFeedback('Claim accepted. Revenue routing updated.');
      await fetchArtistCopyrightData();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to accept claim');
    }
  };

  const currentStrikeCount = strikes?.strike_count || 0;

  return (
    <div className="space-y-6">

      {/* Header & Infringement Strikes Meter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Strikes Meter Card */}
        <div className="md:col-span-2 p-6 rounded-3xl bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-black text-gray-900 dark:text-white">
                Copyright Strikes & Account Standing
              </h3>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              currentStrikeCount === 0 
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                : currentStrikeCount < 3 
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                : 'bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse'
            }`}>
              {currentStrikeCount === 0 ? 'Good Standing' : currentStrikeCount < 3 ? 'Warning Active' : 'Channel Suspended'}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span>Strikes Received: {currentStrikeCount} of 3</span>
              <span className="text-gray-400">3 strikes results in channel termination</span>
            </div>
            <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex gap-1 p-0.5">
              <div className={`h-full flex-1 rounded-full transition-all ${currentStrikeCount >= 1 ? 'bg-amber-500' : 'bg-transparent'}`} />
              <div className={`h-full flex-1 rounded-full transition-all ${currentStrikeCount >= 2 ? 'bg-orange-500' : 'bg-transparent'}`} />
              <div className={`h-full flex-1 rounded-full transition-all ${currentStrikeCount >= 3 ? 'bg-red-500' : 'bg-transparent'}`} />
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Content ID claims (revenue sharing) do not generate strikes against your channel. Only valid, court-actionable DMCA takedown notices issue formal copyright strikes.
          </p>
        </div>

        {/* Quick Guidelines Card */}
        <div className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/20 space-y-3">
          <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
            Dispute Rights
          </h4>
          <p className="text-xs text-gray-650 dark:text-gray-300 leading-relaxed">
            If your video was mistakenly claimed by Content ID or another artist, you can dispute it under 4 legal grounds. The claimant must respond within <strong>7 days</strong> or the claim is dismissed.
          </p>
          <a
            href="/dmca"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
          >
            Read DMCA Policy →
          </a>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Claims List */}
      <div className="bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              Content ID Claims & Takedowns on Your Videos
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Review affected tracks, current revenue routing policies, and dispute status.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-amber-500">
            {claims.length} {claims.length === 1 ? 'Claim' : 'Claims'}
          </span>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
          {claims.length === 0 ? (
            <div className="text-center py-16 space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">No Copyright Claims Found</h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                All your uploaded videos are clean and receiving their normal 70% artist revenue share.
              </p>
            </div>
          ) : (
            claims.map((claim) => (
              <div key={claim.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-[#151518] transition-all">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-gray-900 dark:text-white">
                      {claim.video_title || 'Video'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      claim.status === 'active' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      claim.status === 'disputed' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      Status: {claim.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase">
                      Policy: {claim.policy}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Matched Track: <strong>"{claim.detected_track_title}"</strong> by {claim.detected_artist_name} • Match Confidence: <span className="font-mono text-amber-500 font-bold">{claim.match_confidence}%</span>
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-gray-400">
                    <span>Claimant: <strong className="text-gray-300">{claim.claimant_name}</strong></span>
                    <span>•</span>
                    <span>Revenue Routing: 70% Claimant / 30% PAYTUNE</span>
                  </div>

                  {claim.status === 'disputed' && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold mt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>7-Day Response Window Active (Claimant reviewing dispute)</span>
                    </div>
                  )}
                </div>

                {/* Dispute / Accept Buttons */}
                <div className="flex items-center gap-2 self-end md:self-center">
                  {claim.status === 'active' && (
                    <>
                      <button
                        onClick={() => handleAcceptClaim(claim.id)}
                        className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold transition-all cursor-pointer"
                      >
                        Accept Claim
                      </button>
                      <button
                        onClick={() => handleOpenDispute(claim)}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        Dispute Claim
                      </button>
                    </>
                  )}

                  {claim.status === 'disputed' && (
                    <span className="text-xs font-bold text-amber-500 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      Dispute Pending
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* YOUTUBE-STYLE DISPUTE MODAL */}
      {selectedClaimForDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-[#141417] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl animate-fadeIn">
            
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-bold text-amber-500">YOUTUBE-STYLE DISPUTE FLOW</span>
                <h3 className="text-lg font-black text-gray-950 dark:text-white">
                  Dispute Copyright Claim
                </h3>
              </div>
              <button
                onClick={() => setSelectedClaimForDispute(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs space-y-1">
              <p className="text-gray-400">Video: <strong className="text-gray-900 dark:text-white">{selectedClaimForDispute.video_title}</strong></p>
              <p className="text-gray-400">Claimant: <strong className="text-gray-900 dark:text-white">{selectedClaimForDispute.claimant_name}</strong></p>
              <p className="text-gray-400">Claimed Track: <strong className="text-amber-500">{selectedClaimForDispute.detected_track_title}</strong></p>
            </div>

            <form onSubmit={handleDisputeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Select Legal Ground for Dispute:
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'I own the copyright', desc: 'I am the sole original author and producer of this master recording.' },
                    { id: 'I have a license', desc: 'I hold a valid license, written permission, or sync agreement to use this music.' },
                    { id: 'Fair use', desc: 'The use is transformative (criticism, commentary, news reporting, or educational parody).' },
                    { id: 'Public domain', desc: 'The composition and recording are in the public domain.' }
                  ].map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                        disputeReason === opt.id
                          ? 'border-amber-500 bg-amber-500/10 text-gray-900 dark:text-white'
                          : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                      }`}
                    >
                      <input
                        type="radio"
                        name="disputeReason"
                        checked={disputeReason === opt.id}
                        onChange={() => setDisputeReason(opt.id as DisputeReason)}
                        className="mt-1 text-amber-500 focus:ring-amber-500"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold block">{opt.id}</span>
                        <span className="text-[11px] text-gray-400 leading-tight block">{opt.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Supporting Evidence / Explanation:
                </label>
                <textarea
                  required
                  rows={3}
                  value={disputeEvidence}
                  onChange={(e) => setDisputeEvidence(e.target.value)}
                  placeholder="Provide contract references, license numbers, stem details, or clear legal rationale..."
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-gray-650 dark:text-gray-300 leading-relaxed">
                <strong>7-Day Clock Rule:</strong> The claimant will be given 7 days to review and either release the claim or uphold it. If they do not respond within 7 days, the claim will automatically be released in your favor.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedClaimForDispute(null)}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute}
                  className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submittingDispute ? 'Transmitting...' : 'Submit Dispute'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}

export default CopyrightTab;
