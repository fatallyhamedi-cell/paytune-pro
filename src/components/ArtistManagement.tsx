import React, { useState } from "react";
import {
  Search,
  Filter,
  CheckCircle,
  Ban,
  Trash2,
  LogIn,
  Eye,
  ShieldCheck,
  Zap,
  ArrowUpDown,
  MoreVertical,
  Check,
  AlertCircle
} from "lucide-react";
import { MasterArtist } from "../hooks/useMasterArtists";

interface ArtistManagementProps {
  artists: MasterArtist[];
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
  toggleSelectArtist: (id: string) => void;
  selectAll: () => void;
  autoApproveActive: boolean;
  onApprove: (id: string) => void;
  onBlock: (id: string) => void;
  onUnblock: (id: string) => void;
  onDelete: (id: string) => void;
  onImpersonate: (id: string) => void;
  onBulkAction: (action: "approve" | "block" | "delete") => void;
  onToggleAutoApprove: (approveExisting?: boolean) => void;
}

export const ArtistManagement: React.FC<ArtistManagementProps> = ({
  artists,
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
  toggleSelectArtist,
  selectAll,
  autoApproveActive,
  onApprove,
  onBlock,
  onUnblock,
  onDelete,
  onImpersonate,
  onBulkAction,
  onToggleAutoApprove
}) => {
  const [selectedArtistForDetails, setSelectedArtistForDetails] = useState<MasterArtist | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const pendingCount = artists.filter(a => a.status === "pending").length;

  return (
    <div id="artist-management-module" className="space-y-5">
      {/* Top Filter & Action Bar */}
      <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Artist Directory</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-normal">
                {total} registered
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Manage Rwandan creator identities, approval states, and monetization payouts.
            </p>
          </div>

          {/* Automatic Approval Toggle Feature */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800">
              <Zap className="w-4 h-4 text-amber-400" />
              <div className="text-xs">
                <span className="text-neutral-400 mr-1.5 font-medium">Automatic Approval:</span>
                <span className={`font-bold ${autoApproveActive ? "text-emerald-400" : "text-neutral-400"}`}>
                  {autoApproveActive ? "ENABLED" : "DISABLED"}
                </span>
              </div>
              <button
                id="btn-toggle-auto-approve"
                onClick={() => {
                  if (!autoApproveActive && pendingCount > 0) {
                    setConfirmModal({
                      open: true,
                      title: "Enable Automatic Artist Approval",
                      message: `Automatic approval will instantly approve any new registering artists. Do you also want to approve the ${pendingCount} currently pending artists?`,
                      onConfirm: () => {
                        onToggleAutoApprove(true);
                        setConfirmModal(prev => ({ ...prev, open: false }));
                      }
                    });
                  } else {
                    onToggleAutoApprove(false);
                  }
                }}
                className={`ml-2 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  autoApproveActive
                    ? "bg-emerald-500 text-neutral-950 hover:bg-emerald-400"
                    : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                }`}
              >
                {autoApproveActive ? "Turn Off" : "Turn On"}
              </button>
            </div>

            {/* Quick Approve All Pending Button */}
            {pendingCount > 0 && (
              <button
                id="btn-approve-all-pending"
                onClick={() => {
                  const pendingIds = artists.filter(a => a.status === "pending").map(a => a.id);
                  onBulkAction("approve");
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Approve All Pending ({pendingCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Search, Filter, and Sort Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/80">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
              <input
                id="input-artist-search"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by artist name, email, phone..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-1 p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
              {(["all", "approved", "pending", "blocked"] as const).map(st => (
                <button
                  key={st}
                  id={`btn-artist-filter-${st}`}
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
                id="select-artist-sort"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="joined" className="bg-neutral-900">Newest Joined</option>
                <option value="name" className="bg-neutral-900">Name (A-Z)</option>
                <option value="earnings" className="bg-neutral-900">Highest Earnings</option>
                <option value="videos" className="bg-neutral-900">Most Videos</option>
              </select>
            </div>
          </div>

          {/* Bulk Action Controls if items selected */}
          {selectedIds.length > 0 && (
            <div className="flex items-center space-x-2 bg-neutral-900 px-3 py-1.5 rounded-xl border border-amber-500/40">
              <span className="text-xs text-amber-400 font-semibold">{selectedIds.length} selected</span>
              <button
                id="btn-bulk-approve"
                onClick={() => onBulkAction("approve")}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 cursor-pointer"
              >
                Approve Selected
              </button>
              <button
                id="btn-bulk-block"
                onClick={() => onBulkAction("block")}
                className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30 cursor-pointer"
              >
                Block Selected
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Artist Table Container */}
      <div className="rounded-2xl bg-[#161616] border border-neutral-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400 font-medium">
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={artists.length > 0 && selectedIds.length === artists.length}
                    onChange={selectAll}
                    className="rounded accent-amber-500 cursor-pointer"
                  />
                </th>
                <th className="p-3.5">Artist</th>
                <th className="p-3.5">Contact</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Videos</th>
                <th className="p-3.5">Followers</th>
                <th className="p-3.5">Total Earnings</th>
                <th className="p-3.5">Joined</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-neutral-400">
                    Loading artists data...
                  </td>
                </tr>
              ) : artists.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-neutral-500">
                    No artists found matching your criteria.
                  </td>
                </tr>
              ) : (
                artists.map(artist => {
                  const isSelected = selectedIds.includes(artist.id);
                  return (
                    <tr
                      key={artist.id}
                      className={`hover:bg-neutral-800/40 transition-colors ${
                        isSelected ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectArtist(artist.id)}
                          className="rounded accent-amber-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center space-x-3">
                          <img
                            src={artist.profile_image || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120"}
                            alt={artist.name}
                            className="w-9 h-9 rounded-full object-cover border border-neutral-700 shadow"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="flex items-center space-x-1.5 font-bold text-white text-sm">
                              <span>{artist.name}</span>
                              {artist.is_verified && (
                                <span title="Verified Artist" className="inline-flex">
                                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 inline" />
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-neutral-400 font-mono">
                              ID: {artist.id.slice(0, 10)}...
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="text-neutral-300">{artist.email}</div>
                        <div className="text-[11px] text-neutral-500">{artist.phone}</div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize inline-flex items-center gap-1 ${
                            artist.status === "approved"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : artist.status === "pending"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                              : "bg-red-500/20 text-red-400 border border-red-500/30"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            artist.status === "approved" ? "bg-emerald-400" : artist.status === "pending" ? "bg-amber-400" : "bg-red-400"
                          }`} />
                          {artist.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-neutral-300 font-semibold">{artist.video_count}</td>
                      <td className="p-3.5 text-neutral-300">
                        {artist.subscribers ? Number(artist.subscribers).toLocaleString() : 0}
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-amber-400">
                          {Number(artist.total_earnings || 0).toLocaleString()} RWF
                        </span>
                      </td>
                      <td className="p-3.5 text-neutral-400 whitespace-nowrap">
                        {new Date(artist.join_date).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Impersonate Button */}
                          <button
                            id={`btn-impersonate-${artist.id}`}
                            onClick={() => onImpersonate(artist.id)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-300 transition-colors cursor-pointer"
                            title="Impersonate Artist (Login as this creator)"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                          </button>

                          {/* Details Button */}
                          <button
                            id={`btn-view-artist-${artist.id}`}
                            onClick={() => setSelectedArtistForDetails(artist)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                            title="View Profile Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Approval / Status Action */}
                          {artist.status === "pending" ? (
                            <button
                              id={`btn-approve-artist-${artist.id}`}
                              onClick={() => onApprove(artist.id)}
                              className="px-2 py-1 rounded-lg bg-emerald-500 text-neutral-950 font-bold hover:bg-emerald-400 text-[11px] transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                          ) : artist.status === "approved" ? (
                            <button
                              id={`btn-block-artist-${artist.id}`}
                              onClick={() => onBlock(artist.id)}
                              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                              title="Block Artist"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              id={`btn-unblock-artist-${artist.id}`}
                              onClick={() => onUnblock(artist.id)}
                              className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-semibold hover:bg-amber-500/30 text-[11px] transition-colors cursor-pointer"
                            >
                              Unblock
                            </button>
                          )}

                          {/* Delete Button */}
                          <button
                            id={`btn-delete-artist-${artist.id}`}
                            onClick={() => {
                              setConfirmModal({
                                open: true,
                                title: `Delete Artist ${artist.name}`,
                                message: `Are you sure you want to permanently delete ${artist.name}? All their uploaded videos and catalog items will also be removed.`,
                                onConfirm: () => {
                                  onDelete(artist.id);
                                  setConfirmModal(prev => ({ ...prev, open: false }));
                                }
                              });
                            }}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete Artist"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* Artist Profile Details Modal */}
      {selectedArtistForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-[#1A1A1A] border border-neutral-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center space-x-4 border-b border-neutral-800 pb-4">
              <img
                src={selectedArtistForDetails.profile_image || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120"}
                alt={selectedArtistForDetails.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-amber-500"
                referrerPolicy="no-referrer"
              />
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  <span>{selectedArtistForDetails.name}</span>
                  {selectedArtistForDetails.is_verified && (
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                  )}
                </h3>
                <p className="text-neutral-400">{selectedArtistForDetails.email}</p>
                <p className="text-[11px] text-neutral-500 font-mono">{selectedArtistForDetails.phone}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-400 block text-[10px]">Total Videos</span>
                <span className="text-sm font-bold text-white">{selectedArtistForDetails.video_count}</span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-400 block text-[10px]">Followers</span>
                <span className="text-sm font-bold text-white">{selectedArtistForDetails.subscribers}</span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-400 block text-[10px]">Lifetime Earnings</span>
                <span className="text-sm font-bold text-amber-400">
                  {Number(selectedArtistForDetails.total_earnings).toLocaleString()} RWF
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-neutral-800">
              <button
                onClick={() => {
                  onImpersonate(selectedArtistForDetails.id);
                  setSelectedArtistForDetails(null);
                }}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition-colors cursor-pointer"
              >
                Impersonate & Open Studio
              </button>
              <button
                onClick={() => setSelectedArtistForDetails(null)}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[#1A1A1A] border border-neutral-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-sm font-bold text-white">{confirmModal.title}</h3>
            </div>
            <p className="text-neutral-300 text-sm leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end space-x-2 pt-3 border-t border-neutral-800">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
