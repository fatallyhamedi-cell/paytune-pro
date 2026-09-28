import React, { useState } from "react";
import {
  Search,
  Ban,
  Trash2,
  Eye,
  CheckCircle,
  ArrowUpDown,
  ShoppingBag,
  Clock,
  UserCheck
} from "lucide-react";
import { MasterUser } from "../hooks/useMasterUsers";

interface UserManagementProps {
  users: MasterUser[];
  total: number;
  loading: boolean;
  error: string | null;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  selectedIds: string[];
  toggleSelectUser: (id: string) => void;
  onBlock: (id: string) => void;
  onUnblock: (id: string) => void;
  onDelete: (id: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({
  users,
  total,
  loading,
  error,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  selectedIds,
  toggleSelectUser,
  onBlock,
  onUnblock,
  onDelete
}) => {
  const [selectedUser, setSelectedUser] = useState<MasterUser | null>(null);

  return (
    <div id="user-management-module" className="space-y-5">
      {/* Search & Filter Header */}
      <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Consumer & Audience Accounts</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-normal">
                {total} users
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Oversee fan registrations, spending activity, and account standing.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/80">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
              <input
                id="input-user-search"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by user name or email..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-1 p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
              {(["all", "active", "blocked"] as const).map(st => (
                <button
                  key={st}
                  id={`btn-user-filter-${st}`}
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

            {/* Sort */}
            <div className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-400">
              <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
              <span>Sort:</span>
              <select
                id="select-user-sort"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="joined" className="bg-neutral-900">Newest Joined</option>
                <option value="spent" className="bg-neutral-900">Highest Spent</option>
                <option value="name" className="bg-neutral-900">Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* User Table */}
      <div className="rounded-2xl bg-[#161616] border border-neutral-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400 font-medium">
                <th className="p-3.5">User</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Phone</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Purchases</th>
                <th className="p-3.5">Total Spent</th>
                <th className="p-3.5">Registered</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-400">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-500">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center space-x-3">
                        <img
                          src={u.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"}
                          alt={u.name}
                          className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700"
                          referrerPolicy="no-referrer"
                        />
                        <div>
                          <div className="font-bold text-white text-sm">{u.name}</div>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {u.id.slice(0, 10)}...
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 text-neutral-300">{u.email}</td>
                    <td className="p-3.5 text-neutral-400">{u.phone || "—"}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize inline-flex items-center gap-1 ${
                          u.status === "active"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.status === "active" ? "bg-emerald-400" : "bg-red-400"}`} />
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-neutral-300 font-semibold">{u.purchases_count} videos</td>
                    <td className="p-3.5">
                      <span className="font-bold text-amber-400">
                        {Number(u.total_spent).toLocaleString()} RWF
                      </span>
                    </td>
                    <td className="p-3.5 text-neutral-400 whitespace-nowrap">
                      {new Date(u.join_date).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          id={`btn-view-user-${u.id}`}
                          onClick={() => setSelectedUser(u)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                          title="View User Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {u.status === "active" ? (
                          <button
                            id={`btn-block-user-${u.id}`}
                            onClick={() => onBlock(u.id)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="Block User"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            id={`btn-unblock-user-${u.id}`}
                            onClick={() => onUnblock(u.id)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-emerald-500/20 text-neutral-400 hover:text-emerald-400 transition-colors cursor-pointer"
                            title="Unblock User"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          id={`btn-delete-user-${u.id}`}
                          onClick={() => {
                            if (window.confirm(`Delete user ${u.name}?`)) {
                              onDelete(u.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete User Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[#1A1A1A] border border-neutral-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center space-x-3 border-b border-neutral-800 pb-4">
              <img
                src={selectedUser.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"}
                alt={selectedUser.name}
                className="w-12 h-12 rounded-full border border-neutral-700"
                referrerPolicy="no-referrer"
              />
              <div>
                <h3 className="text-base font-bold text-white">{selectedUser.name}</h3>
                <p className="text-neutral-400">{selectedUser.email}</p>
                <span className="text-[10px] text-neutral-500 font-mono">User ID: {selectedUser.id}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-400 block text-[10px]">Purchases</span>
                <span className="text-sm font-bold text-white">{selectedUser.purchases_count}</span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-400 block text-[10px]">Total Spent</span>
                <span className="text-sm font-bold text-amber-400">
                  {Number(selectedUser.total_spent).toLocaleString()} RWF
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-neutral-800">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
