import React, { useState } from "react";
import {
  Search,
  Filter,
  Eye,
  Trash2,
  Edit2,
  DollarSign,
  TrendingUp,
  Sparkles,
  ArrowUpDown,
  Check,
  X
} from "lucide-react";
import { MasterVideo } from "../hooks/useMasterVideos";

interface VideoManagementProps {
  videos: MasterVideo[];
  total: number;
  loading: boolean;
  error: string | null;
  visibilityFilter: string;
  setVisibilityFilter: (v: string) => void;
  typeFilter: string;
  setTypeFilter: (t: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  onUpdateVideo: (id: string, updates: Partial<MasterVideo>) => Promise<any>;
  onDeleteVideo: (id: string) => Promise<any>;
}

export const VideoManagement: React.FC<VideoManagementProps> = ({
  videos,
  total,
  loading,
  error,
  visibilityFilter,
  setVisibilityFilter,
  typeFilter,
  setTypeFilter,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  onUpdateVideo,
  onDeleteVideo
}) => {
  const [editingVideo, setEditingVideo] = useState<MasterVideo | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    price_rwf: number;
    visibility: "public" | "unlisted" | "private";
    is_featured: boolean;
    category: string;
  }>({
    title: "",
    price_rwf: 0,
    visibility: "public",
    is_featured: false,
    category: "Music"
  });

  const handleOpenEdit = (v: MasterVideo) => {
    setEditingVideo(v);
    setEditForm({
      title: v.title,
      price_rwf: v.price_rwf,
      visibility: v.visibility,
      is_featured: !!v.is_featured,
      category: v.category || "Music"
    });
  };

  const handleSaveEdit = async () => {
    if (!editingVideo) return;
    await onUpdateVideo(editingVideo.id, editForm);
    setEditingVideo(null);
  };

  return (
    <div id="video-management-module" className="space-y-5">
      {/* Top Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#161616] border border-neutral-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Video Catalog</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-normal">
                {total} tracks & videos
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Audit media visibility, pricing tiers, and Rwandan artist uploads.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/80">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
              <input
                id="input-video-search"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search title, artist..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Visibility Filter */}
            <div className="flex items-center space-x-1 p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
              {(["all", "public", "unlisted", "private"] as const).map(vis => (
                <button
                  key={vis}
                  id={`btn-video-visibility-${vis}`}
                  onClick={() => setVisibilityFilter(vis)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                    visibilityFilter === vis
                      ? "bg-amber-500 text-neutral-950 font-bold shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {vis}
                </button>
              ))}
            </div>

            {/* Type Filter */}
            <div className="flex items-center space-x-1 p-1 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
              {(["all", "video", "short"] as const).map(tp => (
                <button
                  key={tp}
                  id={`btn-video-type-${tp}`}
                  onClick={() => setTypeFilter(tp)}
                  className={`px-3 py-1 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                    typeFilter === tp
                      ? "bg-amber-500 text-neutral-950 font-bold shadow"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {tp === "all" ? "All Types" : tp === "short" ? "Shorts" : "Longform"}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-400">
              <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
              <span>Sort:</span>
              <select
                id="select-video-sort"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
              >
                <option value="uploaded_at" className="bg-neutral-900">Newest Uploaded</option>
                <option value="views" className="bg-neutral-900">Most Views</option>
                <option value="earnings" className="bg-neutral-900">Highest Earnings</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Video Table */}
      <div className="rounded-2xl bg-[#161616] border border-neutral-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400 font-medium">
                <th className="p-3.5">Video Details</th>
                <th className="p-3.5">Artist</th>
                <th className="p-3.5">Price (RWF)</th>
                <th className="p-3.5">Views</th>
                <th className="p-3.5">Est. Earnings</th>
                <th className="p-3.5">Visibility</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">Uploaded</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-neutral-400">
                    Loading catalog videos...
                  </td>
                </tr>
              ) : videos.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-neutral-500">
                    No videos found matching your filters.
                  </td>
                </tr>
              ) : (
                videos.map(video => (
                  <tr key={video.id} className="hover:bg-neutral-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center space-x-3">
                        <img
                          src={video.thumbnail_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600"}
                          alt={video.title}
                          className="w-14 h-9 object-cover rounded-lg border border-neutral-700 shadow"
                          referrerPolicy="no-referrer"
                        />
                        <div className="max-w-[200px]">
                          <div className="font-bold text-white text-xs truncate flex items-center gap-1">
                            <span>{video.title}</span>
                            {video.is_featured && (
                              <span title="Featured Video" className="inline-flex">
                                <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-neutral-400 block truncate">
                            {video.category} • {Math.floor(video.duration / 60)}m {video.duration % 60}s
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 text-neutral-300 font-medium">{video.artist_name}</td>
                    <td className="p-3.5">
                      <span className="font-bold text-white">
                        {video.price_rwf > 0 ? `${video.price_rwf.toLocaleString()} RWF` : "Free"}
                      </span>
                    </td>
                    <td className="p-3.5 text-neutral-300 font-mono">
                      {Number(video.views).toLocaleString()}
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-amber-400">
                        {Number(video.earnings || video.views * 300).toLocaleString()} RWF
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          video.visibility === "public"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : video.visibility === "unlisted"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-neutral-700/60 text-neutral-400"
                        }`}
                      >
                        {video.visibility}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
                        {video.is_short ? "SHORT" : "VIDEO"}
                      </span>
                    </td>
                    <td className="p-3.5 text-neutral-400 whitespace-nowrap">
                      {new Date(video.uploaded_at).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          id={`btn-edit-video-${video.id}`}
                          onClick={() => handleOpenEdit(video)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                          title="Edit Video Properties"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          id={`btn-delete-video-${video.id}`}
                          onClick={() => {
                            if (window.confirm(`Delete video "${video.title}"?`)) {
                              onDeleteVideo(video.id);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete Video"
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

      {/* Edit Video Modal */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-[#1A1A1A] border border-neutral-800 p-6 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white">Edit Video Properties</h3>
              <button
                onClick={() => setEditingVideo(null)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-neutral-400 mb-1">Video Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 mb-1">Price (RWF)</label>
                  <input
                    type="number"
                    value={editForm.price_rwf}
                    onChange={e => setEditForm({ ...editForm, price_rwf: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1">Visibility</label>
                  <select
                    value={editForm.visibility}
                    onChange={e => setEditForm({ ...editForm, visibility: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={editForm.is_featured}
                    onChange={e => setEditForm({ ...editForm, is_featured: e.target.checked })}
                    className="rounded accent-amber-500"
                  />
                  <span className="text-white font-medium">Pin to Homepage Featured Banner</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-neutral-800">
              <button
                onClick={() => setEditingVideo(null)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-save-video-edit"
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
