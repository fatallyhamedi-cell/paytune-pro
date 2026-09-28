import React from "react";
import {
  ArrowDownCircle,
  CheckCircle,
  Clock,
  Smartphone,
  Check,
  Download,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { MasterWithdrawal } from "../hooks/useMasterWithdrawals";

interface WithdrawalManagementProps {
  withdrawals: MasterWithdrawal[];
  total: number;
  loading: boolean;
  error: string | null;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  selectedIds: string[];
  processingId: string | null;
  toggleSelectWithdrawal: (id: string) => void;
  selectAllPending: () => void;
  onProcessWithdrawal: (id: string) => Promise<any>;
  onBatchProcess: () => Promise<any>;
}

export const WithdrawalManagement: React.FC<WithdrawalManagementProps> = ({
  withdrawals,
  total,
  loading,
  error,
  statusFilter,
  setStatusFilter,
  selectedIds,
  processingId,
  toggleSelectWithdrawal,
  selectAllPending,
  onProcessWithdrawal,
  onBatchProcess
}) => {
  const pendingRequests = withdrawals.filter(w => (w.status || "pending") === "pending");
  const completedRequests = withdrawals.filter(w => w.status === "completed");

  const totalPendingAmount = pendingRequests.reduce((acc, cur) => acc + cur.amount, 0);
  const totalCompletedAmount = completedRequests.reduce((acc, cur) => acc + cur.amount, 0);

  return (
    <div id="withdrawal-management-module" className="space-y-5">
      {/* 2 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-[#161616] border border-amber-500/30 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-neutral-400">Pending Creator Payouts</span>
            <p className="mt-1 text-2xl font-black text-amber-400">
              {totalPendingAmount.toLocaleString()} <span className="text-xs text-amber-400">RWF</span>
            </p>
            <span className="text-xs text-neutral-500">
              {pendingRequests.length} artists awaiting mobile money disbursement
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#161616] border border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-neutral-400">Total Payouts Settled</span>
            <p className="mt-1 text-2xl font-black text-emerald-400">
              {totalCompletedAmount.toLocaleString()} <span className="text-xs text-emerald-400">RWF</span>
            </p>
            <span className="text-xs text-neutral-500">
              {completedRequests.length} transactions completed via MoMo API
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control Header */}
      <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          {/* Status Filter */}
          <div className="flex items-center space-x-1 p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
            {(["all", "pending", "completed"] as const).map(st => (
              <button
                key={st}
                id={`btn-withdrawal-filter-${st}`}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                  statusFilter === st
                    ? "bg-amber-500 text-neutral-950 font-bold shadow"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {pendingRequests.length > 0 && (
            <button
              onClick={selectAllPending}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-xs font-medium transition-colors cursor-pointer"
            >
              {selectedIds.length === pendingRequests.length ? "Deselect All" : "Select All Pending"}
            </button>
          )}
        </div>

        {/* Batch Action */}
        {selectedIds.length > 0 && (
          <button
            id="btn-batch-process-withdrawals"
            onClick={onBatchProcess}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Process {selectedIds.length} Selected Payouts</span>
          </button>
        )}
      </div>

      {/* Withdrawals Table */}
      <div className="rounded-2xl bg-[#161616] border border-neutral-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400 font-medium">
                <th className="p-3.5 w-10 text-center">Select</th>
                <th className="p-3.5">Artist</th>
                <th className="p-3.5">Amount (RWF)</th>
                <th className="p-3.5">MoMo Destination</th>
                <th className="p-3.5">Provider</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Requested At</th>
                <th className="p-3.5">Reference / Notes</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-neutral-400">
                    Loading withdrawal requests...
                  </td>
                </tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-neutral-500">
                    No withdrawal requests found.
                  </td>
                </tr>
              ) : (
                withdrawals.map(w => {
                  const isPending = (w.status || "pending") === "pending";
                  const isSelected = selectedIds.includes(w.id);
                  const isProcessing = processingId === w.id;

                  return (
                    <tr
                      key={w.id}
                      className={`hover:bg-neutral-800/40 transition-colors ${
                        isSelected ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        {isPending ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectWithdrawal(w.id)}
                            className="rounded accent-amber-500 cursor-pointer"
                          />
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="p-3.5 font-bold text-white text-sm">{w.artist_name}</td>
                      <td className="p-3.5">
                        <span className="font-bold text-amber-400 text-sm">
                          {Number(w.amount).toLocaleString()} RWF
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-neutral-300 flex items-center gap-1">
                        <Smartphone className="w-3.5 h-3.5 text-neutral-500 inline" />
                        {w.phone}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            w.provider === "MTN"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-red-500/20 text-red-400 border border-red-500/30"
                          }`}
                        >
                          {w.provider || "MTN"}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize inline-flex items-center gap-1 ${
                            w.status === "completed"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-400 animate-pulse"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${w.status === "completed" ? "bg-emerald-400" : "bg-amber-400"}`} />
                          {w.status || "pending"}
                        </span>
                      </td>
                      <td className="p-3.5 text-neutral-400 whitespace-nowrap">
                        {new Date(w.requested_at).toLocaleString()}
                      </td>
                      <td className="p-3.5 font-mono text-[10px] text-neutral-500 truncate max-w-[140px]">
                        {w.transaction_ref || (isPending ? "Awaiting release" : "MTN-GATEWAY-OK")}
                      </td>
                      <td className="p-3.5 text-right">
                        {isPending ? (
                          <button
                            id={`btn-process-withdrawal-${w.id}`}
                            onClick={() => onProcessWithdrawal(w.id)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isProcessing ? "Processing..." : "Process Payout"}
                          </button>
                        ) : (
                          <span className="text-emerald-400 text-xs font-semibold flex items-center justify-end gap-1">
                            <Check className="w-3.5 h-3.5" /> Disbursed
                          </span>
                        )}
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
};
