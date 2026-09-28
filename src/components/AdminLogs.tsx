import React from "react";
import {
  FileText,
  Download,
  Search,
  Filter,
  Shield,
  Activity,
  UserCheck
} from "lucide-react";
import { useMasterLogs } from "../hooks/useMasterLogs";

export const AdminLogs: React.FC = () => {
  const {
    logs,
    total,
    loading,
    error,
    actionFilter,
    setActionFilter,
    adminFilter,
    setAdminFilter,
    refreshLogs,
    exportCSV
  } = useMasterLogs();

  return (
    <div id="admin-logs-module" className="space-y-5">
      {/* Controls Header */}
      <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <span>Administrative Audit Trail</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-normal">
                {total} logged events
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Immutable record of all super-admin modifications, financial disbursements, and creator status changes.
            </p>
          </div>

          <button
            id="btn-export-audit-logs"
            onClick={exportCSV}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs border border-neutral-700 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export Audit CSV</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/80">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Action Filter */}
            <div className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-400">
              <Filter className="w-3.5 h-3.5 text-neutral-500" />
              <span>Action:</span>
              <select
                id="select-log-action"
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-neutral-900">All Operations</option>
                <option value="approve_artist" className="bg-neutral-900">Artist Approvals</option>
                <option value="process_withdrawal" className="bg-neutral-900">Disbursements</option>
                <option value="update_settings" className="bg-neutral-900">Settings Updates</option>
                <option value="block_artist" className="bg-neutral-900">Creator Blocks</option>
                <option value="delete_video" className="bg-neutral-900">Video Deletions</option>
              </select>
            </div>

            {/* Admin Filter */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
              <input
                id="input-log-admin-search"
                type="text"
                value={adminFilter}
                onChange={e => setAdminFilter(e.target.value)}
                placeholder="Filter by admin email..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl bg-[#161616] border border-neutral-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400 font-medium">
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Administrator</th>
                <th className="p-3.5">Action Executed</th>
                <th className="p-3.5">Target Entity</th>
                <th className="p-3.5">IP Address</th>
                <th className="p-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-500">
                    No log events recorded.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="p-3.5 font-mono text-neutral-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-semibold text-white">{log.admin}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono text-[10px] font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 text-neutral-300 font-mono text-[11px]">{log.target}</td>
                    <td className="p-3.5 text-neutral-400 font-mono text-[11px]">{log.ip}</td>
                    <td className="p-3.5 text-neutral-300 max-w-[280px] truncate">{log.details}</td>
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
