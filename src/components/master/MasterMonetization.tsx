import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Sparkles,
  Users,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sliders,
  DollarSign,
  TrendingUp,
  Save,
  Loader2,
  Search,
  Infinity,
  FileCheck,
  CreditCard
} from 'lucide-react';

export default function MasterMonetization() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState({
    min_followers: 1000,
    min_free_views: 10000,
    min_watch_hours: 1000,
    artist_ad_share_pct: 40,
    measurement_period_days: 365,
    auto_ad_distribution: true,
  });
  const [applications, setApplications] = useState<any[]>([]);
  const [savingRules, setSavingRules] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'applied' | 'approved_monetized' | 'suspended'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rulesRes, appsRes] = await Promise.all([
        axios.get('/api/master/partner-program/rules'),
        axios.get('/api/master/partner-program/applications'),
      ]);

      if (rulesRes.data?.success && rulesRes.data.rules) {
        setRules(rulesRes.data.rules);
      }
      if (appsRes.data?.success && appsRes.data.applications) {
        setApplications(appsRes.data.applications);
      }
    } catch (err: any) {
      console.error('Failed to load monetization data:', err);
      setStatusMessage({ type: 'error', text: 'Failed to load partner program data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRules(true);
    setStatusMessage(null);
    try {
      const res = await axios.put('/api/master/partner-program/rules', rules);
      if (res.data?.success) {
        setStatusMessage({ type: 'success', text: 'Partner program qualification thresholds updated successfully!' });
        await fetchData();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update rules.' });
    } finally {
      setSavingRules(false);
    }
  };

  const handleDecision = async (
    artistId: string,
    action: 'approve' | 'reject' | 'suspend' | 'request_identity' | 'request_payout'
  ) => {
    setActionLoadingId(artistId);
    setStatusMessage(null);
    try {
      const res = await axios.post(`/api/master/partner-program/applications/${artistId}/decision`, {
        action,
        notes:
          action === 'approve'
            ? 'Channel approved for permanent lifetime advertising monetization.'
            : action === 'request_identity'
            ? 'Government ID document verification required before approval.'
            : action === 'request_payout'
            ? 'Please confirm valid Mobile Money or Bank payout account.'
            : 'Monetization status updated by Master Admin.',
      });
      if (res.data?.success) {
        setStatusMessage({
          type: 'success',
          text: `Artist monetization ${action === 'approve' ? 'approved for Lifetime' : action} successfully.`,
        });
        await fetchData();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || 'Action failed.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredApps = applications.filter((app) => {
    if (filterTab !== 'all') {
      if (filterTab === 'applied' && app.monetization_status !== 'applied') return false;
      if (filterTab === 'approved_monetized' && app.monetization_status !== 'approved_monetized') return false;
      if (filterTab === 'suspended' && app.monetization_status !== 'suspended') return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (app.full_name || '').toLowerCase().includes(q);
      const matchEmail = (app.email || '').toLowerCase().includes(q);
      const matchUser = (app.username || '').toLowerCase().includes(q);
      return matchName || matchEmail || matchUser;
    }
    return true;
  });

  const monetizedPartnersCount = applications.filter((a) => a.monetization_status === 'approved_monetized').length;
  const pendingAppsCount = applications.filter((a) => a.monetization_status === 'applied').length;
  const totalAdRevenueDistributed = applications.reduce((sum, a) => sum + (a.ad_earnings_rwf || 0), 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 space-y-3">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Loading Creator Monetization Engine...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-xs font-semibold text-purple-700 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>PayTune Partner Program (PPP) Engine</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Lifetime Monetization & Partner Approvals
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure partner thresholds and manage lifetime ad revenue qualification for African music creators.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200 flex items-center gap-1.5">
            <Infinity className="w-3.5 h-3.5" />
            {monetizedPartnersCount} Lifetime Partners
          </span>
          {pendingAppsCount > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 animate-pulse">
              {pendingAppsCount} Review Pending
            </span>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Lifetime Monetized Partners</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-3xl font-black text-gray-900">{monetizedPartnersCount}</p>
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <Infinity className="w-3 h-3" /> Permanent approval active
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Creator Ad Share Rate</span>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-3xl font-black text-purple-600">{rules.artist_ad_share_pct}%</p>
          <span className="text-[11px] text-gray-500 font-semibold">
            PayTune platform retains {100 - rules.artist_ad_share_pct}%
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Ad Revenue Distributed</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-gray-900">{totalAdRevenueDistributed.toLocaleString()} RWF</p>
          <span className="text-[11px] text-gray-500 font-semibold">Paid videos remain 100% ad-free</span>
        </div>
      </div>

      {/* 3. Threshold Configuration Form */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Partner Program Qualification Rules</h2>
              <p className="text-xs text-gray-500">
                Enforce minimum audience engagement before free video ad revenue is unlocked
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveRules} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Minimum Followers Required
            </label>
            <input
              type="number"
              min="0"
              value={rules.min_followers}
              onChange={(e) => setRules({ ...rules, min_followers: Number(e.target.value) })}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:border-purple-600 transition-colors"
              required
            />
            <p className="text-[11px] text-gray-400 mt-1">Default: 1,000 genuine followers</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Minimum Free Video Views
            </label>
            <input
              type="number"
              min="0"
              value={rules.min_free_views}
              onChange={(e) => setRules({ ...rules, min_free_views: Number(e.target.value) })}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:border-purple-600 transition-colors"
              required
            />
            <p className="text-[11px] text-gray-400 mt-1">Default: 10,000 public free views</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Minimum Watch Hours
            </label>
            <input
              type="number"
              min="0"
              value={rules.min_watch_hours}
              onChange={(e) => setRules({ ...rules, min_watch_hours: Number(e.target.value) })}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:border-purple-600 transition-colors"
              required
            />
            <p className="text-[11px] text-gray-400 mt-1">Default: 1,000 watch hours across free catalog</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Artist Ad Revenue Share (%)
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={rules.artist_ad_share_pct}
              onChange={(e) => setRules({ ...rules, artist_ad_share_pct: Number(e.target.value) })}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold focus:outline-none focus:border-purple-600 transition-colors"
              required
            />
            <p className="text-[11px] text-gray-400 mt-1">Default: 40% (PayTune retains 60%)</p>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingRules}
              className="px-5 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {savingRules ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Monetization Thresholds
            </button>
          </div>
        </form>
      </div>

      {/* 4. Partner Program Applications & Review Queue */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Creator Monetization Review Queue</h2>
            <p className="text-xs text-gray-500">
              Review channels, verify qualification metrics, and grant lifetime partner monetization
            </p>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search creator name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-purple-600 w-56"
              />
            </div>

            <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-semibold">
              <button
                onClick={() => setFilterTab('applied')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterTab === 'applied' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Pending ({pendingAppsCount})
              </button>
              <button
                onClick={() => setFilterTab('approved_monetized')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterTab === 'approved_monetized'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Lifetime Partners ({monetizedPartnersCount})
              </button>
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterTab === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                All Channels
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Artist & Channel</th>
                <th className="px-6 py-3.5">Level & Status</th>
                <th className="px-6 py-3.5">Followers</th>
                <th className="px-6 py-3.5">Free Views</th>
                <th className="px-6 py-3.5">Watch Hours</th>
                <th className="px-6 py-3.5">Account Standing</th>
                <th className="px-6 py-3.5 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    No partner applications found matching this view.
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => {
                  const m = app.metrics || {};
                  const isApproved = app.monetization_status === 'approved_monetized';
                  const isPending = ['applied', 'pending_review'].includes(app.monetization_status);
                  const isSuspended = app.monetization_status === 'suspended';

                  return (
                    <tr key={app.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0">
                            {app.profile_image ? (
                              <img src={app.profile_image} alt={app.full_name} className="w-full h-full object-cover" />
                            ) : (
                              (app.full_name || 'A').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{app.full_name}</p>
                            <p className="text-[11px] text-gray-400">@{app.username || 'creator'} • {app.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {isApproved && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                            <Infinity className="w-3.5 h-3.5" /> Level 3: Lifetime Partner
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200">
                            <Clock className="w-3.5 h-3.5" /> Level 2: Under Review
                          </span>
                        )}
                        {app.monetization_status === 'identity_verification_required' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
                            <FileCheck className="w-3.5 h-3.5" /> Awaiting KYC ID
                          </span>
                        )}
                        {app.monetization_status === 'payout_verification_required' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-bold text-[11px] border border-purple-200">
                            <CreditCard className="w-3.5 h-3.5" /> Awaiting Payout Info
                          </span>
                        )}
                        {isSuspended && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200">
                            <XCircle className="w-3.5 h-3.5" /> Suspended
                          </span>
                        )}
                        {!isApproved && !isPending && !isSuspended && !['identity_verification_required', 'payout_verification_required'].includes(app.monetization_status) && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium text-[11px]">
                            Level 1: In Progress
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 font-semibold">
                        <span className={m.followers >= rules.min_followers ? 'text-emerald-600' : 'text-gray-700'}>
                          {(m.followers || 0).toLocaleString()}
                        </span>
                        <span className="text-gray-400 text-[10px]"> / {rules.min_followers}</span>
                      </td>

                      <td className="px-6 py-4 font-semibold">
                        <span className={m.free_views >= rules.min_free_views ? 'text-emerald-600' : 'text-gray-700'}>
                          {(m.free_views || 0).toLocaleString()}
                        </span>
                        <span className="text-gray-400 text-[10px]"> / {rules.min_free_views}</span>
                      </td>

                      <td className="px-6 py-4 font-semibold">
                        <span className={m.watch_hours >= rules.min_watch_hours ? 'text-emerald-600' : 'text-gray-700'}>
                          {(m.watch_hours || 0).toLocaleString()} hrs
                        </span>
                        <span className="text-gray-400 text-[10px]"> / {rules.min_watch_hours} hrs</span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-gray-600">
                            Phone: <span className={m.phone_verified ? 'text-emerald-600 font-bold' : 'text-amber-600 font-semibold'}>{m.phone_verified ? 'Verified' : 'Pending'}</span>
                          </p>
                          <p className="text-[11px] text-gray-600">
                            Copyright Strikes: <span className={m.active_strikes === 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{m.active_strikes}</span>
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                          {!isApproved && (
                            <button
                              onClick={() => handleDecision(app.id, 'approve')}
                              disabled={actionLoadingId === app.id}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1"
                              title="Grant permanent lifetime monetization"
                            >
                              <Infinity className="w-3 h-3" />
                              <span>Approve Lifetime</span>
                            </button>
                          )}

                          {isPending && (
                            <>
                              <button
                                onClick={() => handleDecision(app.id, 'request_identity')}
                                disabled={actionLoadingId === app.id}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition-colors cursor-pointer"
                                title="Request ID proof"
                              >
                                Request ID
                              </button>

                              <button
                                onClick={() => handleDecision(app.id, 'reject')}
                                disabled={actionLoadingId === app.id}
                                className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                Decline
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <button
                              onClick={() => handleDecision(app.id, 'suspend')}
                              disabled={actionLoadingId === app.id}
                              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 transition-colors cursor-pointer"
                            >
                              Suspend
                            </button>
                          )}
                        </div>
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
