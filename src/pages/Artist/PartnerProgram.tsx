import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Sparkles,
  Users,
  Eye,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  DollarSign,
  Loader2,
  Lock,
  Award,
  FileText,
  CreditCard,
  Check,
  ChevronRight,
  Infinity
} from 'lucide-react';
import { useArtistAuth } from '../../contexts/ArtistAuthContext';

export default function PartnerProgram() {
  const { artist } = useArtistAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Identity Verification Form State
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [idType, setIdType] = useState('National ID');
  const [idNumber, setIdNumber] = useState('');
  const [legalName, setLegalName] = useState('');
  const [idSubmitting, setIdSubmitting] = useState(false);

  // Payout Verification Form State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState('MTN MoMo');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/artist/partner-program/status', {
        params: { artist_id: artist?.id }
      });
      if (res.data?.success) {
        setData(res.data.qualification);
        if (res.data.qualification?.artist?.full_name) {
          setLegalName(res.data.qualification.artist.full_name);
          setAccountName(res.data.qualification.artist.full_name);
        }
        if (res.data.qualification?.artist?.momo_code || res.data.qualification?.artist?.phone) {
          setAccountNumber(res.data.qualification.artist.momo_code || res.data.qualification.artist.phone);
        }
      }
    } catch (err: any) {
      console.error('Failed to load partner program status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [artist?.id]);

  const handleApply = async () => {
    setApplying(true);
    setApplyError(null);
    setApplySuccess(null);
    try {
      const res = await axios.post('/api/artist/partner-program/apply', {
        artist_id: artist?.id
      });
      if (res.data?.success) {
        setApplySuccess('Application submitted! Master Admin is reviewing your channel metrics.');
        await fetchStatus();
      } else {
        setApplyError(res.data?.message || 'Failed to submit application');
      }
    } catch (err: any) {
      setApplyError(err.response?.data?.message || 'Failed to apply. Please ensure requirements are met.');
    } finally {
      setApplying(false);
    }
  };

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdSubmitting(true);
    setApplyError(null);
    try {
      const res = await axios.post('/api/artist/partner-program/verify-identity', {
        artist_id: artist?.id,
        document_type: idType,
        document_number: idNumber,
        full_legal_name: legalName,
      });
      if (res.data?.success) {
        setApplySuccess('Government identity details registered successfully!');
        setShowIdentityModal(false);
        await fetchStatus();
      }
    } catch (err: any) {
      setApplyError(err.response?.data?.message || 'Failed to verify identity.');
    } finally {
      setIdSubmitting(false);
    }
  };

  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutSubmitting(true);
    setApplyError(null);
    try {
      const res = await axios.post('/api/artist/partner-program/verify-payout', {
        artist_id: artist?.id,
        payout_method: payoutMethod,
        account_number: accountNumber,
        account_name: accountName,
      });
      if (res.data?.success) {
        setApplySuccess('Payout destination verified successfully!');
        setShowPayoutModal(false);
        await fetchStatus();
      }
    } catch (err: any) {
      setApplyError(err.response?.data?.message || 'Failed to verify payout method.');
    } finally {
      setPayoutSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 space-y-3">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Loading Monetization Data...
        </p>
      </div>
    );
  }

  const req = data?.requirements || {};
  const status = data?.status || 'in_progress';
  const level = data?.level || (status === 'approved_monetized' ? 3 : data?.isAllEligible ? 2 : 1);
  const isLifetimeApproved = Boolean(data?.monetizationLifetime || status === 'approved_monetized');

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
      {/* 1. Hero Header */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-purple-800">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-purple-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>PayTune Partner Program (PPP)</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
            Permanent Lifetime Ad Monetization
          </h1>

          <p className="text-purple-100/90 text-sm sm:text-base leading-relaxed">
            Once approved for the PayTune Partner Program, your monetization status is permanent for the lifetime of your channel. You earn 40% of advertising revenue on all qualifying free videos with no annual re-application.
          </p>

          {/* Current Status Pill */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            {isLifetimeApproved && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-200 font-bold text-xs uppercase tracking-wider">
                <Infinity className="w-4 h-4 text-emerald-300" />
                Level 3: PayTune Lifetime Partner
              </span>
            )}
            {!isLifetimeApproved && level === 2 && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-200 font-bold text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4 text-amber-300" />
                Level 2: Monetization Eligible (Verification)
              </span>
            )}
            {!isLifetimeApproved && level === 1 && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-xs uppercase tracking-wider">
                <Lock className="w-4 h-4 text-gray-300" />
                Level 1: Standard Creator (In Progress)
              </span>
            )}
            {status === 'suspended' && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-400 text-rose-200 font-bold text-xs uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-rose-300" />
                Monetization Suspended
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Three-Level Tier Journey Progression Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
          Creator Monetization Tier Workflow
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Level 1 Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            level >= 1 ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
                Level 1
              </span>
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Standard Creator</h3>
            <p className="text-xs text-gray-500 mt-1">
              Direct video & music sales with 70% artist revenue split and ticketed live streaming.
            </p>
          </div>

          {/* Level 2 Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            level >= 2 ? 'border-amber-300 bg-amber-50/60' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                Level 2
              </span>
              {level >= 2 ? (
                <Check className="w-4 h-4 text-amber-600" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-gray-400" />
              )}
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Monetization Eligible</h3>
            <p className="text-xs text-gray-500 mt-1">
              Metrics reached. Channel review, identity (KYC), and payout destination verification.
            </p>
          </div>

          {/* Level 3 Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            level >= 3 ? 'border-emerald-300 bg-emerald-50/60' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Level 3 • Lifetime
              </span>
              {level >= 3 ? (
                <Infinity className="w-4 h-4 text-emerald-600" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-gray-400" />
              )}
            </div>
            <h3 className="font-bold text-gray-900 text-sm">PayTune Partner</h3>
            <p className="text-xs text-gray-500 mt-1">
              Permanent lifetime approval. Earn 40% ad share on all eligible free videos automatically.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Partner Monetized Stats (if Approved Lifetime) */}
      {isLifetimeApproved && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Advertising Revenue Summary (Lifetime Partner)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Permanent 40% creator revenue share on all verified video ad impressions
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 flex items-center gap-1.5">
              <Infinity className="w-3.5 h-3.5" /> Lifetime Monetized
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ad Revenue Earned</span>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {(data?.adEarningsRwf || 0).toLocaleString()} RWF
              </p>
              <span className="text-[11px] text-emerald-600 font-medium">Credited to your main wallet</span>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Monetized Ad Impressions</span>
              <p className="text-2xl font-black text-gray-900 mt-1">
                {(data?.adImpressionsCount || 0).toLocaleString()}
              </p>
              <span className="text-[11px] text-gray-500 font-medium">Verified viewer plays</span>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Approval Duration</span>
              <p className="text-2xl font-black text-purple-600 mt-1">Lifetime</p>
              <span className="text-[11px] text-gray-500 font-medium">No annual re-qualification required</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Verification Action Center (Level 2) */}
      {level >= 2 && !isLifetimeApproved && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            Partner Onboarding & Verification Center
          </h2>
          <p className="text-xs text-gray-500">
            Submit your identity document and verified payout number for Master Admin final sign-off.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Identity Card */}
            <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  {data?.identityVerified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <Check className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      Action Required
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-gray-900 text-sm mt-3">Government Identity (KYC)</h3>
                <p className="text-xs text-gray-500 mt-1">
                  National ID, Passport, or Driver's License to guarantee account ownership.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowIdentityModal(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-purple-600 text-purple-700 hover:bg-purple-50 font-bold text-xs transition-colors cursor-pointer"
              >
                <span>{data?.identityVerified ? 'Update ID Details' : 'Submit Identity ID'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Payout Card */}
            <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50/50 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  {data?.payoutVerified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <Check className="w-3.5 h-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      Action Required
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-gray-900 text-sm mt-3">Payout Destination</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Mobile Money (MTN / Airtel / M-Pesa) destination for automated payments.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPayoutModal(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-purple-600 text-purple-700 hover:bg-purple-50 font-bold text-xs transition-colors cursor-pointer"
              >
                <span>{data?.payoutVerified ? 'Update Payout Destination' : 'Confirm Payout Number'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Real Progress Toward Qualification */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            Monetization Eligibility Meter
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Measured across all public free videos on your account.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Followers Card */}
          <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              {req.followers?.passed ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Met
                </span>
              ) : (
                <span className="text-xs font-semibold text-gray-500">
                  {req.followers?.percentage || 0}%
                </span>
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Followers</p>
              <p className="text-2xl font-black text-gray-900 mt-0.5">
                {(req.followers?.current || 0).toLocaleString()}
                <span className="text-sm font-semibold text-gray-400"> / {(req.followers?.target || 1000).toLocaleString()}</span>
              </p>
            </div>

            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  req.followers?.passed ? 'bg-emerald-500' : 'bg-purple-600'
                }`}
                style={{ width: `${req.followers?.percentage || 0}%` }}
              />
            </div>
          </div>

          {/* Free Views Card */}
          <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Eye className="w-5 h-5" />
              </div>
              {req.views?.passed ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Met
                </span>
              ) : (
                <span className="text-xs font-semibold text-gray-500">
                  {req.views?.percentage || 0}%
                </span>
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Free Video Views</p>
              <p className="text-2xl font-black text-gray-900 mt-0.5">
                {(req.views?.current || 0).toLocaleString()}
                <span className="text-sm font-semibold text-gray-400"> / {(req.views?.target || 10000).toLocaleString()}</span>
              </p>
            </div>

            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  req.views?.passed ? 'bg-emerald-500' : 'bg-purple-600'
                }`}
                style={{ width: `${req.views?.percentage || 0}%` }}
              />
            </div>
          </div>

          {/* Watch Hours Card */}
          <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              {req.watchHours?.passed ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Met
                </span>
              ) : (
                <span className="text-xs font-semibold text-gray-500">
                  {req.watchHours?.percentage || 0}%
                </span>
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Public Watch Hours</p>
              <p className="text-2xl font-black text-gray-900 mt-0.5">
                {(req.watchHours?.current || 0).toLocaleString()} hrs
                <span className="text-sm font-semibold text-gray-400"> / {(req.watchHours?.target || 1000).toLocaleString()} hrs</span>
              </p>
            </div>

            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  req.watchHours?.passed ? 'bg-emerald-500' : 'bg-purple-600'
                }`}
                style={{ width: `${req.watchHours?.percentage || 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Verification & Standing Badges */}
        <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">Account & Policy Standing</p>
              <p className="text-[11px] text-gray-500">
                Phone Verified: <span className="font-semibold text-purple-700">{req.verification?.phone_verified ? 'Yes' : 'Pending'}</span> • 
                Active Strikes: <span className="font-semibold text-purple-700">{req.policy?.active_strikes || 0}</span> (Maximum allowed: 0)
              </p>
            </div>
          </div>

          {/* Action Trigger */}
          <div>
            {status === 'eligible' && (
              <button
                onClick={handleApply}
                disabled={applying}
                className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                Apply for Partner Program
              </button>
            )}

            {status === 'in_progress' && (
              <span className="text-xs font-semibold text-gray-500 italic">
                Reach requirements above to unlock Level 2
              </span>
            )}

            {status === 'applied' && (
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                Application Received — Under Review
              </span>
            )}

            {isLifetimeApproved && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Lifetime Partner Program Enrolled
              </span>
            )}
          </div>
        </div>

        {applySuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {applySuccess}
          </div>
        )}

        {applyError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            {applyError}
          </div>
        )}
      </div>

      {/* 6. Educational Rules & Policies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-purple-600" />
            Lifetime Monetization Guarantee
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Unlike other platforms that revoke ad monetization if view hours dip after 12 months, PayTune believes in lasting creator partnerships. Once you earn Level 3 PayTune Partner status, your monetization approval is permanent for the lifetime of your channel.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-600" />
            100% Ad-Free Paid Videos
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            All premium paid videos on PayTune remain 100% ad-free forever. Ads only appear on qualified free public music videos and shorts, ensuring paying fans enjoy an uninterrupted cinema experience.
          </p>
        </div>
      </div>

      {/* Identity Verification Modal */}
      {showIdentityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Submit Identity Verification (KYC)
              </h3>
              <button 
                onClick={() => setShowIdentityModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleIdentitySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Legal Name</label>
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="As written on your government ID"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:border-purple-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ID Document Type</label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:border-purple-600 focus:outline-none"
                >
                  <option value="National ID">Rwanda / East Africa National ID</option>
                  <option value="Passport">International Passport</option>
                  <option value="Driving License">Driving License</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ID / Document Number</label>
                <input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g. 1 1990 8 0012345 0 12"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-mono focus:border-purple-600 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIdentityModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-xs font-bold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={idSubmitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  {idSubmitting ? 'Submitting...' : 'Submit ID Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payout Verification Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-600" />
                Confirm Payout Destination
              </h3>
              <button 
                onClick={() => setShowPayoutModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePayoutSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Payout Method</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:border-purple-600 focus:outline-none"
                >
                  <option value="MTN MoMo">MTN Mobile Money</option>
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="M-Pesa">Safaricom M-Pesa</option>
                  <option value="Bank Transfer">Commercial Bank Account</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Account / Phone Number</label>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="0788123456"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm font-mono focus:border-purple-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Account Holder Full Name</label>
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Name registered on phone or bank"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:border-purple-600 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 text-xs font-bold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payoutSubmitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  {payoutSubmitting ? 'Verifying...' : 'Confirm Payout Number'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
