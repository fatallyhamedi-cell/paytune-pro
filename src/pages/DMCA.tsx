import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ShieldCheck, 
  Scale, 
  AlertTriangle, 
  FileText, 
  Send, 
  CheckCircle2, 
  ArrowRight, 
  Lock,
  ExternalLink,
  Search
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function DMCA() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'takedown' | 'counter-notice' | 'policy'>('takedown');
  
  // Takedown Form State
  const [videos, setVideos] = useState<any[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [claimantName, setClaimantName] = useState((user as any)?.full_name || (user as any)?.name || '');
  const [claimantEmail, setClaimantEmail] = useState(user?.email || '');
  const [claimantPhone, setClaimantPhone] = useState('');
  const [claimantCompany, setClaimantCompany] = useState('');
  const [originalWorkUrl, setOriginalWorkUrl] = useState('');
  const [infringementDescription, setInfringementDescription] = useState('');
  const [digitalSignature, setDigitalSignature] = useState('');
  const [swornAgreed, setSwornAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedNotice, setSubmittedNotice] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Counter Notice Form State
  const [counterDmcaId, setCounterDmcaId] = useState('');
  const [counterReason, setCounterReason] = useState('');
  const [counterSignature, setCounterSignature] = useState('');
  const [counterAgreed, setCounterAgreed] = useState(false);
  const [counterSuccess, setCounterSuccess] = useState(false);

  // Fetch videos for selector helper
  useEffect(() => {
    axios.get('/api/videos?limit=50')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.videos || []);
        setVideos(list);
      })
      .catch(() => {});
  }, []);

  const handleTakedownSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    const targetVideoId = selectedVideoId || (customVideoUrl.includes('video/') ? customVideoUrl.split('video/')[1] : customVideoUrl);

    if (!targetVideoId) {
      setErrorMessage('Please select or specify the infringing video on PAYTUNE.');
      return;
    }
    if (!swornAgreed) {
      setErrorMessage('You must agree to the statement under penalty of perjury.');
      return;
    }
    if (!digitalSignature.trim()) {
      setErrorMessage('Digital signature (full legal name) is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/dmca/takedown', {
        video_id: targetVideoId,
        claimant_name: claimantName,
        claimant_email: claimantEmail,
        claimant_phone: claimantPhone,
        claimant_company: claimantCompany,
        original_work_url: originalWorkUrl,
        infringement_description: infringementDescription,
        digital_signature: digitalSignature,
        sworn_statement_agreed: swornAgreed
      });

      setSubmittedNotice(res.data.dmcaRequest);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to submit DMCA takedown request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!counterDmcaId || !counterReason || !counterSignature || !counterAgreed) {
      setErrorMessage('All counter-notice fields and legal declarations must be completed.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`/api/dmca/requests/${counterDmcaId}/counter-notice`, {
        counter_notice_reason: counterReason,
        digital_signature: counterSignature
      });
      setCounterSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to submit counter-notice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0C] text-gray-900 dark:text-gray-100 py-10 px-4 md:px-8 transition-colors">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Scale className="w-3.5 h-3.5" /> Intellectual Property & Copyright Compliance
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-950 dark:text-white">
            DMCA Notice & Takedown Portal
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            PAYTUNE strictly respects the intellectual property rights of artists and copyright holders. 
            Use this official portal to submit formal takedown notices or counter-notices under the Digital Millennium Copyright Act.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex justify-center">
          <div className="inline-flex p-1.5 rounded-2xl bg-white dark:bg-[#141417] border border-gray-200 dark:border-gray-800 shadow-sm gap-1">
            <button
              onClick={() => setActiveTab('takedown')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'takedown'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" /> Submit DMCA Takedown
            </button>
            <button
              onClick={() => setActiveTab('counter-notice')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'counter-notice'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <AlertTriangle className="w-4 h-4" /> Counter-Notice
            </button>
            <button
              onClick={() => setActiveTab('policy')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'policy'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Copyright Policy
            </button>
          </div>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* TAB 1: SUBMIT TAKEDOWN NOTICE */}
        {activeTab === 'takedown' && (
          <div className="bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 md:p-8 shadow-sm">
            {submittedNotice ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                  DMCA Notice Filed Successfully
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Your formal copyright takedown notice has been logged under Request ID <strong className="font-mono text-amber-500">{submittedNotice.id}</strong>. 
                  PAYTUNE's legal review desk will review and execute takedown within 24 hours.
                </p>
                <div className="pt-4">
                  <button
                    onClick={() => {
                      setSubmittedNotice(null);
                      setSelectedVideoId('');
                      setInfringementDescription('');
                    }}
                    className="px-6 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black font-bold text-xs"
                  >
                    Submit Another Notice
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleTakedownSubmit} className="space-y-6">
                <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
                  <h2 className="text-lg font-bold text-gray-950 dark:text-white flex items-center gap-2">
                    <Scale className="w-5 h-5 text-amber-500" /> Formal Notice of Infringement
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Please provide complete and accurate information. Filing false DMCA takedown claims carries civil liability.
                  </p>
                </div>

                {/* Rights Holder Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Full Legal Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={claimantName}
                      onChange={(e) => setClaimantName(e.target.value)}
                      placeholder="e.g. Eric Mugisha"
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={claimantEmail}
                      onChange={(e) => setClaimantEmail(e.target.value)}
                      placeholder="legal@rights-holder.com"
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Phone Number (with country code)
                    </label>
                    <input
                      type="tel"
                      value={claimantPhone}
                      onChange={(e) => setClaimantPhone(e.target.value)}
                      placeholder="+250 788 000 000"
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Company / Record Label (Optional)
                    </label>
                    <input
                      type="text"
                      value={claimantCompany}
                      onChange={(e) => setClaimantCompany(e.target.value)}
                      placeholder="e.g. 1K Entertainment / Sony Music"
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Infringing Work Identification */}
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Select Infringing Video on PAYTUNE <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedVideoId}
                      onChange={(e) => setSelectedVideoId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                    >
                      <option value="">-- Choose video from platform --</option>
                      {videos.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.title} — by {v.artist_name || 'Artist'} ({v.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {!selectedVideoId && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                        Or specify PAYTUNE Video URL / ID
                      </label>
                      <input
                        type="text"
                        value={customVideoUrl}
                        onChange={(e) => setCustomVideoUrl(e.target.value)}
                        placeholder="https://paytune.rw/video/video-123 or video-123"
                        className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Link / Proof of Original Copyrighted Work <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      required
                      value={originalWorkUrl}
                      onChange={(e) => setOriginalWorkUrl(e.target.value)}
                      placeholder="https://open.spotify.com/track/... or copyright office registration URL"
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Detailed Description of Infringement <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={infringementDescription}
                      onChange={(e) => setInfringementDescription(e.target.value)}
                      placeholder="Specify the timestamps, stems, lyrics, or master recording used without authorization..."
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Sworn Statement & Digital Signature */}
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="sworn"
                      checked={swornAgreed}
                      onChange={(e) => setSwornAgreed(e.target.checked)}
                      className="mt-1 w-4 h-4 text-amber-500 rounded border-gray-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="sworn" className="text-xs text-gray-650 dark:text-gray-300 leading-relaxed cursor-pointer">
                      <strong>Sworn Statement under Penalty of Perjury:</strong> I have a good faith belief that the use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law. The information in this notification is accurate, and under penalty of perjury, I state that I am the copyright owner or authorized to act on behalf of the owner.
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Digital Signature (Type your full legal name) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={digitalSignature}
                      onChange={(e) => setDigitalSignature(e.target.value)}
                      placeholder="e.g. /s/ Eric Mugisha"
                      className="w-full px-4 py-2 rounded-xl bg-white dark:bg-black/60 border border-gray-200 dark:border-gray-700 text-sm font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? 'Transmitting Notice...' : 'Submit Takedown Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: COUNTER-NOTICE PORTAL */}
        {activeTab === 'counter-notice' && (
          <div className="bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 md:p-8 shadow-sm">
            {counterSuccess ? (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                  Counter-Notice Successfully Lodged
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Your formal counter-notice has been delivered to the copyright claimant. Under 17 U.S.C. § 512(g), the claimant has 14 business days to provide proof of court action, or the content will be restored.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCounterSubmit} className="space-y-6">
                <div className="border-b border-gray-100 dark:border-gray-800 pb-4">
                  <h2 className="text-lg font-bold text-gray-950 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" /> DMCA Counter-Notice Submission
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    If your video was disabled due to mistake or misidentification, you may file a formal counter-notice.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    DMCA Request ID or Video ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={counterDmcaId}
                    onChange={(e) => setCounterDmcaId(e.target.value)}
                    placeholder="e.g. dmca-1 or video-2"
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Explanation of Mistake or License Rights <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={counterReason}
                    onChange={(e) => setCounterReason(e.target.value)}
                    placeholder="Explain why the takedown was wrongful (e.g. valid licensing contract, original master stems, public domain)..."
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="consent"
                      checked={counterAgreed}
                      onChange={(e) => setCounterAgreed(e.target.checked)}
                      className="mt-1 w-4 h-4 text-amber-500 rounded border-gray-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor="consent" className="text-xs text-gray-650 dark:text-gray-300 leading-relaxed cursor-pointer">
                      I consent to the jurisdiction of the relevant court in Rwanda or my residential district, and I will accept service of process from the person who provided the takedown notice. I swear under penalty of perjury that I have a good faith belief that the material was removed as a result of mistake or misidentification.
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Digital Signature <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={counterSignature}
                      onChange={(e) => setCounterSignature(e.target.value)}
                      placeholder="/s/ Full Legal Name"
                      className="w-full px-4 py-2 rounded-xl bg-white dark:bg-black/60 border border-gray-200 dark:border-gray-700 text-sm font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {submitting ? 'Submitting...' : 'Dispatch Counter-Notice'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 3: COPYRIGHT POLICY & REVENUE EXPLANATION */}
        {activeTab === 'policy' && (
          <div className="bg-white dark:bg-[#121215] border border-gray-200 dark:border-gray-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">
              PAYTUNE Intellectual Property & Escrow Rules
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-2">
                <span className="text-xs font-mono font-bold text-amber-500">CONTENT ID</span>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Automated Audio Fingerprinting</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Uploads are analyzed against the Audd/ACRCloud database and PAYTUNE master catalogs. Matches flag videos with monetization routing.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-2">
                <span className="text-xs font-mono font-bold text-amber-500">ESCROW SYSTEM</span>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Claim Revenue Escrow</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  For claimed or disputed videos, the 70% share is safely held in escrow until dispute resolution (or disbursed directly to verified copyright owners).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-2">
                <span className="text-xs font-mono font-bold text-amber-500">3-STRIKE POLICY</span>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Repeat Infringers</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Channels receiving 3 confirmed copyright strikes are automatically banned from monetizing and uploading on PAYTUNE.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 pt-4 text-xs text-gray-500 dark:text-gray-400 leading-relaxed space-y-2">
              <p>
                Designated DMCA Agent: PAYTUNE Legal & Rights Operations, KG 7 Ave, Kigali, Rwanda. Email: dmca@paytune.rw.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
