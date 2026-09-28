import React, { useState, useMemo } from "react";
import {
  Search,
  Download,
  RotateCcw,
  CreditCard,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Receipt,
  Calendar,
  Filter,
  ShieldCheck,
  Percent
} from "lucide-react";
import { MasterPayment } from "../hooks/useMasterPayments";

interface PaymentManagementProps {
  payments: MasterPayment[];
  total: number;
  loading: boolean;
  error: string | null;
  methodFilter: string;
  setMethodFilter: (m: string) => void;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
  onRefund: (id: string) => void;
  onExportCSV: () => void;
}

export const PaymentManagement: React.FC<PaymentManagementProps> = ({
  payments,
  total,
  loading,
  error,
  methodFilter,
  setMethodFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onRefund,
  onExportCSV
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Aggregate summary metrics
  const totalGross = useMemo(() => payments.reduce((acc, p) => acc + (p.amount_rwf || 0), 0), [payments]);
  const totalVat = useMemo(() => payments.reduce((acc, p) => acc + (p.vat_rwf || 0), 0), [payments]);
  const totalOwner = useMemo(() => payments.reduce((acc, p) => acc + (p.owner_share_rwf || 0), 0), [payments]);
  const totalArtist = useMemo(() => payments.reduce((acc, p) => acc + (p.artist_share_rwf || 0), 0), [payments]);

  // Provider breakdown calculations
  const providerStats = useMemo(() => {
    let mtnTotal = 0;
    let mtnCount = 0;
    let airtelTotal = 0;
    let airtelCount = 0;
    let stripeTotal = 0;
    let stripeCount = 0;

    payments.forEach(p => {
      const m = (p.method || "").toLowerCase();
      const amt = p.amount_rwf || 0;
      if (m.includes("mtn") || m.includes("momo")) {
        mtnTotal += amt;
        mtnCount++;
      } else if (m.includes("airtel")) {
        airtelTotal += amt;
        airtelCount++;
      } else {
        stripeTotal += amt;
        stripeCount++;
      }
    });

    const sum = totalGross || 1;
    return {
      mtn: { total: mtnTotal, count: mtnCount, pct: ((mtnTotal / sum) * 100).toFixed(1) },
      airtel: { total: airtelTotal, count: airtelCount, pct: ((airtelTotal / sum) * 100).toFixed(1) },
      stripe: { total: stripeTotal, count: stripeCount, pct: ((stripeTotal / sum) * 100).toFixed(1) }
    };
  }, [payments, totalGross]);

  // Success rate
  const completedCount = useMemo(() => {
    return payments.filter(p => p.status === "completed" || (p as any).status === "paid").length;
  }, [payments]);

  const successRate = payments.length > 0
    ? ((completedCount / payments.length) * 100).toFixed(1)
    : "100.0";

  // Filtered payments by search & status
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) {
        return false;
      }
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        p.id.toLowerCase().includes(term) ||
        (p.user_name || "").toLowerCase().includes(term) ||
        (p.artist_name || "").toLowerCase().includes(term) ||
        (p.video_title || "").toLowerCase().includes(term)
      );
    });
  }, [payments, statusFilter, searchTerm]);

  // Export CSV handler
  const handleExportCSV = () => {
    const headers = ["Transaction ID", "Customer", "Video Track", "Artist", "Base Amount RWF", "VAT 5%", "Artist Share 70%", "Platform 30%", "Provider", "Status", "Date"];
    const rows = filteredPayments.map(p => [
      p.id,
      `"${p.user_name || ''}"`,
      `"${p.video_title || ''}"`,
      `"${p.artist_name || ''}"`,
      p.amount_rwf,
      p.vat_rwf,
      p.artist_share_rwf,
      p.owner_share_rwf,
      p.method,
      p.status,
      new Date(p.date).toISOString()
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `paytune_payments_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="payment-management-module" className="space-y-6">
      {/* 4 Financial Split Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#141416] border border-neutral-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Revenue</span>
            <DollarSign className="w-4 h-4 text-[#FFB300]" />
          </div>
          <p className="text-2xl font-black text-white">
            {totalGross.toLocaleString()} <span className="text-xs font-bold text-[#FFB300]">RWF</span>
          </p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400">
            <span>{payments.length} transactions</span>
            <span className="text-emerald-400 font-bold">{successRate}% success</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#141416] border border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Platform Net (30%)</span>
            <TrendingUp className="w-4 h-4 text-[#FFB300]" />
          </div>
          <p className="text-2xl font-black text-[#FFB300]">
            {totalOwner.toLocaleString()} <span className="text-xs font-bold text-[#FFB300]">RWF</span>
          </p>
          <span className="mt-2 block text-[11px] text-neutral-500">PAYTUNE platform retained commission</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#141416] border border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Artist Payouts (70%)</span>
            <Receipt className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">
            {totalArtist.toLocaleString()} <span className="text-xs font-bold text-emerald-400">RWF</span>
          </p>
          <span className="mt-2 block text-[11px] text-neutral-500">Credited to Rwandan creator wallets</span>
        </div>

        <div className="p-5 rounded-2xl bg-[#141416] border border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">VAT Collected (5%)</span>
            <Percent className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-blue-400">
            {totalVat.toLocaleString()} <span className="text-xs font-bold text-blue-400">RWF</span>
          </p>
          <span className="mt-2 block text-[11px] text-neutral-500">Automated Rwanda Revenue Authority pool</span>
        </div>
      </div>

      {/* Payment Provider Breakdown */}
      <div className="p-5 rounded-2xl bg-[#141416] border border-neutral-800 space-y-4">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center justify-between">
          <span>Payment Provider Volume & Share</span>
          <span className="text-xs font-medium text-neutral-400 lowercase">3 gateways active</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* MTN MoMo */}
          <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#FFB300]" />
                <span className="font-black text-xs text-white">MTN Mobile Money</span>
              </div>
              <span className="text-xs font-black text-[#FFB300]">{providerStats.mtn.pct}%</span>
            </div>
            <p className="text-lg font-bold text-white">
              {providerStats.mtn.total.toLocaleString()} <span className="text-xs text-neutral-400">RWF</span>
            </p>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#FFB300] h-full rounded-full" style={{ width: `${providerStats.mtn.pct}%` }} />
            </div>
            <span className="text-[10px] text-neutral-400">{providerStats.mtn.count} transactions</span>
          </div>

          {/* Airtel Money */}
          <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-red-400" />
                <span className="font-black text-xs text-white">Airtel Money</span>
              </div>
              <span className="text-xs font-black text-red-400">{providerStats.airtel.pct}%</span>
            </div>
            <p className="text-lg font-bold text-white">
              {providerStats.airtel.total.toLocaleString()} <span className="text-xs text-neutral-400">RWF</span>
            </p>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-red-500 h-full rounded-full" style={{ width: `${providerStats.airtel.pct}%` }} />
            </div>
            <span className="text-[10px] text-neutral-400">{providerStats.airtel.count} transactions</span>
          </div>

          {/* Stripe */}
          <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-400" />
                <span className="font-black text-xs text-white">Stripe / Card</span>
              </div>
              <span className="text-xs font-black text-indigo-400">{providerStats.stripe.pct}%</span>
            </div>
            <p className="text-lg font-bold text-white">
              {providerStats.stripe.total.toLocaleString()} <span className="text-xs text-neutral-400">RWF</span>
            </p>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${providerStats.stripe.pct}%` }} />
            </div>
            <span className="text-[10px] text-neutral-400">{providerStats.stripe.count} transactions</span>
          </div>
        </div>
      </div>

      {/* Filter and Export Header */}
      <div className="p-5 rounded-2xl bg-[#141416] border border-neutral-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span>Financial Ledger & Purchases</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-normal">
                {filteredPayments.length} records
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Audit granular payment splits, carrier webhooks, and refund operations.
            </p>
          </div>

          <button
            id="btn-export-payments-csv"
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#FFB300] hover:bg-[#FFA000] text-black font-black text-xs transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-black" />
            <span>Export CSV Report</span>
          </button>
        </div>

        {/* Search and Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-800">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Tx ID, customer, artist..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white focus:outline-none focus:border-[#FFB300]"
              />
            </div>

            {/* Provider Filter */}
            <div className="flex items-center space-x-1 p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
              {(["all", "MTN", "Airtel", "Stripe"] as const).map(m => (
                <button
                  key={m}
                  id={`btn-payment-method-${m}`}
                  onClick={() => setMethodFilter(m)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                    methodFilter === m
                      ? "bg-[#FFB300] text-black font-black shadow-xs"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {m === "all" ? "All Methods" : m}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 focus:outline-none focus:border-[#FFB300]"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed / Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>

            {/* Date Range */}
            <div className="flex items-center space-x-1.5 text-xs text-neutral-400">
              <Calendar className="w-3.5 h-3.5 text-neutral-500" />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-[#FFB300]"
              />
              <span>-</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-[#FFB300]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-2xl bg-[#141416] border border-neutral-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400 font-medium">
                <th className="p-3.5">Tx ID</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Track / Service</th>
                <th className="p-3.5">Artist</th>
                <th className="p-3.5">Gross (RWF)</th>
                <th className="p-3.5">VAT 5%</th>
                <th className="p-3.5">Artist (70%)</th>
                <th className="p-3.5">Platform (30%)</th>
                <th className="p-3.5">Provider</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-neutral-400">
                    Loading financial records...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-neutral-500">
                    No transactions matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredPayments.map(p => (
                  <tr key={p.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="p-3.5 font-mono text-neutral-400">{p.id.slice(0, 8)}...</td>
                    <td className="p-3.5 font-medium text-white">
                      <div className="flex items-center gap-1.5">
                        <span>{p.user_name || "Guest"}</span>
                        {p.country_code && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-800 font-mono text-[#FFB300]">
                            {p.country_code}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-neutral-300 max-w-[140px] truncate">{p.video_title || "Direct Payment"}</td>
                    <td className="p-3.5 text-neutral-300">{p.artist_name || "—"}</td>
                    <td className="p-3.5 font-black text-white">{p.amount_rwf?.toLocaleString()}</td>
                    <td className="p-3.5 text-blue-400 font-medium">{p.vat_rwf?.toLocaleString()}</td>
                    <td className="p-3.5 font-bold text-emerald-400">{p.artist_share_rwf?.toLocaleString()}</td>
                    <td className="p-3.5 font-bold text-[#FFB300]">{p.owner_share_rwf?.toLocaleString()}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[10px] font-mono">
                        {p.method}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        p.status === "completed" || (p as any).status === "paid"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : p.status === "failed"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}>
                        {p.status || "completed"}
                      </span>
                    </td>
                    <td className="p-3.5 text-neutral-400 whitespace-nowrap">
                      {new Date(p.date).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right">
                      {p.status === "completed" || (p as any).status === "paid" ? (
                        <button
                          id={`btn-refund-${p.id}`}
                          onClick={() => {
                            if (window.confirm(`Issue refund of ${p.amount_rwf} RWF for customer ${p.user_name}?`)) {
                              onRefund(p.id);
                            }
                          }}
                          className="px-2 py-1 rounded bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 text-[11px] font-medium transition-colors cursor-pointer"
                          title="Refund Transaction"
                        >
                          Refund
                        </button>
                      ) : (
                        <span className="text-[11px] text-neutral-600">—</span>
                      )}
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
