import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Upload, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  ExternalLink, 
  Eye, 
  ThumbsUp, 
  DollarSign, 
  AlertTriangle,
  Play,
  Film,
  BarChart2,
  Copy,
  Check,
  Zap
} from 'lucide-react';
import axios from 'axios';
import { VideoEditModal } from './VideoEditModal';
import { VideoAnalyticsModal } from './VideoAnalyticsModal';

interface VideosTabProps {
  videos: any[];
  onOpenUpload: () => void;
  onRefresh: () => void;
}

export const VideosTab: React.FC<VideosTabProps> = ({
  videos,
  onOpenUpload,
  onRefresh
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedVisibility, setSelectedVisibility] = useState('all');
  const [contentType, setContentType] = useState<'all' | 'videos' | 'shorts'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'views' | 'earned' | 'likes'>('newest');

  // Modals state
  const [editingVideo, setEditingVideo] = useState<any | null>(null);
  const [deletingVideo, setDeletingVideo] = useState<any | null>(null);
  const [analyticsVideo, setAnalyticsVideo] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filter & Sort
  const filteredVideos = (videos || [])
    .filter((v) => {
      const matchesSearch = v.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'all' || v.category === selectedCategory;
      const matchesVis = selectedVisibility === 'all' || 
        (selectedVisibility === 'free' ? v.is_free : v.visibility === selectedVisibility);
      const matchesType = contentType === 'all' || 
        (contentType === 'shorts' ? !!v.is_short : !v.is_short);
      return matchesSearch && matchesCat && matchesVis && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
      if (sortBy === 'earned') return (b.total_earned || 0) - (a.total_earned || 0);
      if (sortBy === 'likes') return (b.likes || 0) - (a.likes || 0);
      return new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime();
    });

  const handleCopyLink = (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/watch/${videoId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(videoId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDelete = async () => {
    if (!deletingVideo) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/artist/video/${deletingVideo.id}`);
      setDeletingVideo(null);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to delete video.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Search / Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Content Library</h2>
          <p className="text-xs text-gray-400">
            Manage, price, and monitor all your music videos, singles, and live concert replays
          </p>
        </div>

        <button
          onClick={onOpenUpload}
          className="px-5 py-2.5 rounded-xl bg-[#FFB300] text-black font-black text-xs hover:bg-[#ffc107] transition-all flex items-center gap-2 self-start md:self-auto shadow-lg shadow-amber-500/20 active:scale-95"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Release</span>
        </button>
      </div>

      {/* Control Bar: Search & Selectors */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or lyrics..."
            className="w-full bg-[#1F1F1F] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFB300]"
          />
        </div>

        {/* Content Type filter */}
        <select
          value={contentType}
          onChange={(e: any) => setContentType(e.target.value)}
          className="bg-[#1F1F1F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
        >
          <option value="all">All Formats</option>
          <option value="videos">Full Videos</option>
          <option value="shorts">Shorts (≤50s)</option>
        </select>

        {/* Category filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-[#1F1F1F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
        >
          <option value="all">All Genres</option>
          <option value="Afrobeat">Afrobeat</option>
          <option value="Gospel">Gospel</option>
          <option value="Traditional">Traditional</option>
          <option value="Hip Hop">Hip Hop</option>
          <option value="R&B">R&B</option>
          <option value="Shorts">Shorts</option>
        </select>

        {/* Visibility filter */}
        <select
          value={selectedVisibility}
          onChange={(e) => setSelectedVisibility(e.target.value)}
          className="bg-[#1F1F1F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
        >
          <option value="all">All Visibility</option>
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
          <option value="free">Free Access</option>
        </select>

        {/* Sort by */}
        <select
          value={sortBy}
          onChange={(e: any) => setSortBy(e.target.value)}
          className="bg-[#1F1F1F] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
        >
          <option value="newest">Sort: Newest First</option>
          <option value="views">Sort: Most Viewed</option>
          <option value="earned">Sort: Highest Earned</option>
          <option value="likes">Sort: Most Liked</option>
        </select>
      </div>

      {/* Videos Table */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#1A1A1A] border-b border-white/10 uppercase tracking-wider text-[11px] text-gray-400 font-bold">
              <tr>
                <th className="py-3.5 px-4">Release</th>
                <th className="py-3.5 px-4">Visibility</th>
                <th className="py-3.5 px-4">Monetization</th>
                <th className="py-3.5 px-4">Views</th>
                <th className="py-3.5 px-4">Purchases</th>
                <th className="py-3.5 px-4">Total Earned</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredVideos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <Film className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-gray-300">No releases found</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {searchQuery ? 'Try clearing your search query or filters.' : 'Upload your first track to begin earning.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredVideos.map((video) => (
                  <tr key={video.id} className="hover:bg-white/[0.02] transition-colors group">
                    {/* Release info */}
                    <td className="py-4 px-4 min-w-[260px]">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0 w-24 h-14 rounded-lg overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-amber-400 text-xs font-bold">▶</span>
                          )}
                          <span className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[9px] font-mono text-white">
                            {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '3:45'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-sm truncate group-hover:text-[#FFB300] transition-colors">
                            {video.title}
                          </h4>
                          <span className="inline-block px-1.5 py-0.5 mt-1 bg-white/5 rounded text-[10px] text-gray-400 font-semibold">
                            {video.category || 'Afrobeat'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Visibility */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        video.visibility === 'public'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : video.visibility === 'unlisted'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                      }`}>
                        {video.visibility || 'public'}
                      </span>
                    </td>

                    {/* Monetization */}
                    <td className="py-4 px-4 whitespace-nowrap font-bold">
                      {video.is_free ? (
                        <span className="text-emerald-400">Free Access</span>
                      ) : (
                        <span className="text-[#FFB300]">
                          {(video.price_rwf || 1000).toLocaleString()} RWF
                        </span>
                      )}
                    </td>

                    {/* Views */}
                    <td className="py-4 px-4 whitespace-nowrap font-semibold">
                      {(video.views || 0).toLocaleString()}
                    </td>

                    {/* Purchases / Buyers */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="font-bold text-white">
                        {(video.buyers_count || Math.floor((video.views || 0) * 0.08)).toLocaleString()}
                      </span>
                      <span className="text-gray-500 text-[10px] block">Fans paid</span>
                    </td>

                    {/* Total Earned */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className="font-black text-[#FFB300] text-sm">
                        {(video.total_earned || 0).toLocaleString()} RWF
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Video Analytics */}
                        <button
                          onClick={() => setAnalyticsVideo(video)}
                          title="View Release Analytics"
                          className="p-2 rounded-lg bg-white/5 hover:bg-amber-500/20 text-gray-300 hover:text-[#FFB300] transition-colors"
                        >
                          <BarChart2 className="w-4 h-4" />
                        </button>

                        {/* Copy Link */}
                        <button
                          onClick={(e) => handleCopyLink(video.id, e)}
                          title="Copy Share Link"
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                        >
                          {copiedId === video.id ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => setEditingVideo(video)}
                          title="Edit Metadata & Price"
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeletingVideo(video)}
                          title="Delete Video"
                          className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        {/* Watch Preview */}
                        <a
                          href={`/watch/${video.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Preview Fan View"
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
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
        <VideoEditModal
          isOpen={!!editingVideo}
          video={editingVideo}
          onClose={() => setEditingVideo(null)}
          onSuccess={() => {
            setEditingVideo(null);
            onRefresh();
          }}
        />
      )}

      {/* Video Analytics Modal */}
      {analyticsVideo && (
        <VideoAnalyticsModal
          isOpen={!!analyticsVideo}
          video={analyticsVideo}
          onClose={() => setAnalyticsVideo(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#161616] border border-white/10 rounded-2xl p-6 text-white shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="font-bold text-lg text-white">Delete this release?</h4>
              <p className="text-xs text-gray-400 mt-1">
                Are you sure you want to delete "{deletingVideo.title}"? This action cannot be undone. Existing buyers will lose direct access.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingVideo(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 font-bold text-xs hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-colors shadow-lg shadow-rose-600/20"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
