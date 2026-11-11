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
  ArrowRight,
  Loader2,
  Lock,
  Award
} from 'lucide-react';
import { useArtistAuth } from '../../contexts/ArtistAuthContext';

export default function PartnerProgram() {
  const { artist } = useArtistAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/artist/partner-program/status', {
        params: { artist_id: artist?.id }
      });
      if (res.data?.success) {
        setData(res.data.qualification);
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
        setApplySuccess('Application successfully submitted! Master Admin will review your channel.');
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

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
      {/* 1. Hero Header */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-purple-500/20 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-purple-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>PayTune Partner Program (PPP)</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
            Monetize Your Free African Content
          </h1>

          <p className="text-purple-100/90 text-sm sm:text-base leading-relaxed">
            Turn your growing audience into ongoing income. Qualifying African artists earn an agreed share (40%) of advertising revenue generated when viewers stream their free music videos and podcasts.
          </p>

          {/* Current Status Pill */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            {status === 'approved_monetized' && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-200 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Active Monetized Partner
              </span>
            )}
            {status === 'applied' && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400 text-amber-200 font-bold text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4 text-amber-400" />
                Application Pending Review
              </span>
            )}
            {status === 'eligible' && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/30 border border-purple-300 text-purple-100 font-bold text-xs uppercase tracking-wider">
                <Award className="w-4 h-4 text-purple-300" />
                Qualified to Apply
              </span>
            )}
            {status === 'in_progress' && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-bold text-xs uppercase tracking-wider">
                <Lock className="w-4 h-4 text-gray-300" />
                Monetization In Progress
              </span>
            )}
            {status === 'suspended' && (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-400 text-rose-200 font-bold text-xs uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                Monetization Suspended
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Partner Monetized Stats (if Approved) */}
      {status === 'approved_monetized' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Your Advertising Revenue Summary
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Calculated from verified advertising impressions played before your eligible free videos
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
              40% Artist Share Active
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
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ad-Free Guarantee</span>
              <p className="text-2xl font-black text-purple-600 mt-1">100%</p>
              <span className="text-[11px] text-gray-500 font-medium">Paid videos remain clean and ad-free</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Real Progress Toward Qualification */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            Monetization Eligibility Meter
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Requirements must be fulfilled across all eligible public free videos on your account within the last 12 months.
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
              <p className="text-xs font-bold text-gray-900">Account & Copyright Health</p>
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
                className="px-5 py-2.5 rounded-xl bg-[#8B5CF6] text-white font-bold text-xs hover:bg-purple-700 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                Apply for Partner Program
              </button>
            )}

            {status === 'in_progress' && (
              <span className="text-xs font-semibold text-gray-500 italic">
                Reach requirements above to unlock the application
              </span>
            )}

            {status === 'applied' && (
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                Application Received — Under Review
              </span>
            )}

            {status === 'approved_monetized' && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled in Partner Monetization
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

      {/* 4. Educational Rules & Policies */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-purple-600" />
            Why Ad Monetization Requires Qualification
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            On PayTune, advertising revenue is earned through audience engagement on free videos. Requiring artists to reach minimum followers, valid views, and watch hours prevents spam, rewards authentic African creators, and gives advertisers brand-safe placements.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-3">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-600" />
            Multiple Ways to Earn on PayTune
          </h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Even before qualifying for the Partner Program, you can sell paid videos and music directly to buyers worldwide with a 70% revenue share, receive Super Thanks fan tips, and host ticketed live streams.
          </p>
        </div>
      </div>
    </div>
  );
}
