import React, { useState } from 'react';
import { 
  Wallet, 
  ArrowDownCircle, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Phone, 
  Calendar, 
  DollarSign, 
  HelpCircle,
  FileText,
  PieChart as PieIcon,
  Download
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface EarningsTabProps {
  summary: any;
  earningsGraph: any;
  videos: any[];
  withdrawals: any[];
  onOpenWithdraw: () => void;
}

export const EarningsTab: React.FC<EarningsTabProps> = ({
  summary,
  earningsGraph,
  videos,
  withdrawals,
  onOpenWithdraw
}) => {
  const [filterPeriod, setFilterPeriod] = useState<'7D' | '30D' | '90D' | '1Y' | 'ALL'>('30D');

  // Interactive graph data based on selected period
  const getGraphData = () => {
    if (filterPeriod === '7D') return earningsGraph?.daily?.slice(-7) || [];
    if (filterPeriod === '30D') return earningsGraph?.daily || [];
    if (filterPeriod === '90D') return earningsGraph?.weekly || [];
    if (filterPeriod === '1Y') return earningsGraph?.monthly || [];
    return earningsGraph?.yearly || [];
  };

  const chartData = getGraphData();

  // Total withdrawn calculation
  const totalWithdrawn = (withdrawals || [])
    .filter((w) => w.status === 'completed' || w.status === 'processed')
    .reduce((sum, w) => sum + Number(w.amount || 0), 0);

  return (
    <div className="space-y-8">
      {/* 1. Header & Quick Payout Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Earnings & Financial Settlement</h2>
          <p className="text-xs text-gray-400">
            Transparent revenue distribution: 70% artist royalty after standard Rwandan 5% VAT
          </p>
        </div>

        <button
          onClick={onOpenWithdraw}
          className="px-5 py-2.5 rounded-xl bg-[#FFB300] text-black font-black text-xs hover:bg-[#ffc107] transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 self-start sm:self-auto"
        >
          <ArrowDownCircle className="w-4 h-4" />
          <span>Request Payout</span>
        </button>
      </div>

      {/* 2. Financial Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Earnings */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Lifetime Net Earnings
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-white">
            {(summary?.total_earnings || 0).toLocaleString()}{' '}
            <span className="text-xs font-semibold text-gray-400">RWF</span>
          </h3>
          <p className="text-[11px] text-gray-400 mt-2">
            70% net revenue after VAT deductions
          </p>
        </div>

        {/* Current Available Balance */}
        <div className="bg-[#161616] border border-amber-500/40 rounded-2xl p-5 bg-gradient-to-br from-amber-500/5 to-transparent">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-[#FFB300] uppercase tracking-wider">
              Available Balance
            </span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              Ready to cashout
            </span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#FFB300]">
            {(summary?.current_balance || 0).toLocaleString()}{' '}
            <span className="text-xs font-semibold text-gray-400">RWF</span>
          </h3>
          <p className="text-[11px] text-gray-400 mt-2">
            Minimum threshold: 5,000 RWF via MoMo
          </p>
        </div>

        {/* Pending Clearance */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Pending Settlement
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-white">
            {(summary?.pending_balance || 0).toLocaleString()}{' '}
            <span className="text-xs font-semibold text-gray-400">RWF</span>
          </h3>
          <p className="text-[11px] text-gray-400 mt-2">
            Transactions under 24hr settlement hold
          </p>
        </div>

        {/* Total Withdrawn to Date */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
            Total Withdrawn
          </span>
          <h3 className="text-2xl sm:text-3xl font-black text-gray-200">
            {totalWithdrawn.toLocaleString()}{' '}
            <span className="text-xs font-semibold text-gray-400">RWF</span>
          </h3>
          <p className="text-[11px] text-gray-400 mt-2">
            Paid directly to MTN MoMo / Bank accounts
          </p>
        </div>
      </div>

      {/* 3. Interactive Earnings Trend Graph */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-lg text-white">Revenue Flow Analytics</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Visual breakdown of daily and aggregate earnings over selected time horizons
            </p>
          </div>

          {/* Time range filters */}
          <div className="bg-[#1F1F1F] p-1 rounded-xl flex items-center border border-white/5 self-start sm:self-auto">
            {(['7D', '30D', '90D', '1Y', 'ALL'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setFilterPeriod(period)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterPeriod === period
                    ? 'bg-[#FFB300] text-black shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEarningsTab" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFB300" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#FFB300" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis dataKey="label" stroke="#666666" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                stroke="#666666" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1A1A1A',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#FFFFFF'
                }}
                formatter={(val: any) => [`${Number(val).toLocaleString()} RWF`, 'Net Earnings']}
              />
              <Area
                type="monotone"
                dataKey="earned"
                stroke="#FFB300"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorEarningsTab)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Earnings Breakdown Per Video */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base text-white">Earnings Breakdown by Content</h3>
            <p className="text-xs text-gray-400">Detailed accounting of purchases, revenue share, and platform fees</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#1A1A1A] border-b border-white/10 uppercase tracking-wider text-[11px] text-gray-400 font-bold">
              <tr>
                <th className="py-3 px-4">Release Title</th>
                <th className="py-3 px-4">Unit Price</th>
                <th className="py-3 px-4">Paid Views</th>
                <th className="py-3 px-4">Gross Sales</th>
                <th className="py-3 px-4 text-[#FFB300]">Your 70% Share</th>
                <th className="py-3 px-4 text-gray-500">Platform 30%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(videos || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 text-xs">
                    No release sales recorded yet.
                  </td>
                </tr>
              ) : (
                (videos || []).map((v) => {
                  const buyers = v.buyers_count || Math.floor((v.views || 0) * 0.08);
                  const gross = buyers * (v.price_rwf || 0);
                  const artistCut = v.total_earned || Math.round(gross * 0.95 * 0.70);
                  const platformCut = Math.round(gross * 0.95 * 0.30);

                  return (
                    <tr key={v.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-bold text-white min-w-[200px]">
                        {v.title}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {v.is_free ? 'Free' : `${(v.price_rwf || 0).toLocaleString()} RWF`}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-semibold">
                        {buyers.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-semibold">
                        {gross.toLocaleString()} RWF
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-black text-[#FFB300]">
                        {artistCut.toLocaleString()} RWF
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-gray-500">
                        {platformCut.toLocaleString()} RWF
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Payout History Table */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base text-white">Payout History</h3>
            <p className="text-xs text-gray-400">Records of all previous withdrawal requests and MoMo transactions</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#1A1A1A] border-b border-white/10 uppercase tracking-wider text-[11px] text-gray-400 font-bold">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Method & Account</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(withdrawals || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500 text-xs">
                    No withdrawals requested yet. When you request a payout, it will show here.
                  </td>
                </tr>
              ) : (
                (withdrawals || []).map((w) => (
                  <tr key={w.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-gray-400">
                      {new Date(w.created_at || Date.now()).toLocaleDateString('default', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-gray-300">
                      {w.reference_code || `PAYTUNE-WD-${w.id.slice(0, 8)}`}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-bold text-white">
                      {Number(w.amount).toLocaleString()} RWF
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-gray-200">{w.payment_method || 'MTN Mobile Money'}</span>
                      <span className="block text-[11px] text-gray-500">{w.phone || w.account_number}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        w.status === 'completed' || w.status === 'processed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : w.status === 'rejected'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {w.status || 'Pending'}
                      </span>
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
};
