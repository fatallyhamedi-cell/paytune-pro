import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, 
  Edit3, 
  Trash2, 
  Share2, 
  Check, 
  ExternalLink, 
  Search, 
  Filter, 
  Plus, 
  X, 
  Save, 
  Music, 
  Video as VideoIcon, 
  Eye, 
  DollarSign,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';

interface ArtistVideo {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  video_url?: string;
  audio_url?: string;
  media_type?: string;
  category?: string;
  price_rwf?: number;
  price_usd?: number;
  is_free?: boolean;
  visibility?: string;
  views?: number;
  likes?: number;
  uploaded_at?: string;
  created_at?: string;
}

export default function ArtistVideos() {
  const [videos, setVideos] = useState<ArtistVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'free' | 'paid' | 'audio' | 'video'>('all');

  // Edit Modal State
  const [editingVideo, setEditingVideo] = useState<ArtistVideo | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('Afrobeat');
  const [editIsFree, setEditIsFree] = useState(false);
  const [editPriceRwf, setEditPriceRwf] = useState('500');
  const [editPriceUsd, setEditPriceUsd] = useState('0.50');
  const [editVisibility, setEditVisibility] = useState('public');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Copy Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadVideos = () => {
    setLoading(true);
    api.get('/artist/videos')
      .then(r => setVideos(r.data.videos || []))
      .catch(err => {
        console.error('Failed to load videos:', err);
        setError(err.response?.data?.error || 'Failed to load videos');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const handleOpenEdit = (v: ArtistVideo) => {
    setEditingVideo(v);
    setEditTitle(v.title || '');
    setEditDescription(v.description || '');
    setEditCategory(v.category || 'Afrobeat');
    setEditIsFree(Boolean(v.is_free));
    setEditPriceRwf(String(v.price_rwf ?? 500));
    setEditPriceUsd(String(v.price_usd ?? 0.5));
    setEditVisibility(v.visibility || 'public');
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo) return;
    if (!editTitle.trim()) {
      return setEditError('Track title is required');
    }

    setSavingEdit(true);
    setEditError('');
    try {
      const res = await api.put(`/artist/videos/${editingVideo.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        category: editCategory,
        is_free: editIsFree,
        price_rwf: editIsFree ? 0 : Number(editPriceRwf) || 500,
        price_usd: editIsFree ? 0 : Number(editPriceUsd) || 0.5,
        visibility: editVisibility,
      });

      if (res.data?.video) {
        setVideos(prev => prev.map(v => v.id === editingVideo.id ? { ...v, ...res.data.video } : v));
        setEditingVideo(null);
      }
    } catch (err: any) {
      setEditError(err.response?.data?.error || err.message || 'Failed to update video');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      await api.delete(`/artist/videos/${id}`);
      setVideos(prev => prev.filter(v => v.id !== id));
      setDeletingId(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete video');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCopyLink = (id: string) => {
    const url = `${window.location.origin}/watch/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered List
  const filteredVideos = videos.filter(v => {
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.category && v.category.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;

    if (filterType === 'free') return v.is_free;
    if (filterType === 'paid') return !v.is_free;
    if (filterType === 'audio') return v.media_type === 'audio';
    if (filterType === 'video') return v.media_type === 'video' || !v.media_type;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Loading catalog...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight">Your Releases & Catalog</h1>
            <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
              {videos.length} {videos.length === 1 ? 'Track' : 'Tracks'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Manage, edit pricing, or monitor performance of all your releases</p>
        </div>
        <Link
          to="/artist/dashboard/upload"
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Media</span>
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-400 p-4 rounded-xl text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title or genre..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#161616] border border-gray-800 focus:border-amber-500 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none transition-all placeholder:text-gray-500"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'paid', 'free', 'video', 'audio'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                filterType === tab
                  ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                  : 'bg-[#161616] text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700'
              }`}
            >
              {tab === 'paid' ? 'Pay-Per-View' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Videos List / Grid */}
      {filteredVideos.length === 0 ? (
        <div className="bg-[#161616] rounded-2xl p-12 text-center border border-gray-800 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#222] border border-gray-800 flex items-center justify-center text-amber-500">
            {filterType === 'audio' ? <Music className="w-8 h-8" /> : <VideoIcon className="w-8 h-8" />}
          </div>
          <div>
            <h3 className="text-white font-bold text-base">
              {searchQuery ? 'No releases match your query' : 'No releases found in this category'}
            </h3>
            <p className="text-gray-400 text-xs mt-1">
              {searchQuery ? 'Try clearing your search filters' : 'Upload your first audio track or music video to start earning.'}
            </p>
          </div>
          <Link
            to="/artist/dashboard/upload"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 rounded-xl font-bold text-xs"
          >
            <Plus className="w-4 h-4" />
            Upload New Media
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredVideos.map(v => (
            <div
              key={v.id}
              className="bg-[#161616] border border-gray-800 hover:border-gray-700 rounded-2xl overflow-hidden flex flex-col justify-between transition-all group"
            >
              {/* Media Thumbnail Container */}
              <div className="relative aspect-video bg-[#202020] overflow-hidden">
                {v.thumbnail_url ? (
                  <img
                    src={v.thumbnail_url}
                    alt={v.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gradient-to-br from-[#1a1a1a] to-[#0e0e0e]">
                    {v.media_type === 'audio' ? (
                      <Music className="w-8 h-8 text-amber-500/60 mb-1" />
                    ) : (
                      <VideoIcon className="w-8 h-8 text-gray-600 mb-1" />
                    )}
                    <span className="text-[11px] font-medium text-gray-500">Audio / Video</span>
                  </div>
                )}

                {/* Badges Overlay */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                  {(v as any).upload_status === 'review' || (v as any).copyright_status === 'review' ? (
                    <span className="bg-amber-500 text-black px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1 border border-amber-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                      Under review
                    </span>
                  ) : (
                    <span className="bg-emerald-500/90 text-white px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shadow-sm">
                      Public
                    </span>
                  )}
                  <span className="bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold text-gray-300 uppercase">
                    {v.media_type || 'video'}
                  </span>
                  {v.visibility && v.visibility !== 'public' && (
                    <span className="bg-orange-500/80 backdrop-blur-md px-2 py-0.5 rounded-md text-[10px] font-bold text-white uppercase">
                      {v.visibility}
                    </span>
                  )}
                </div>

                <div className="absolute top-2 right-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold shadow-md backdrop-blur-md ${
                    v.is_free
                      ? 'bg-emerald-500/90 text-white'
                      : 'bg-amber-500 text-black border border-amber-400'
                  }`}>
                    {v.is_free ? 'FREE' : `${Number(v.price_rwf || 500).toLocaleString()} RWF`}
                  </span>
                </div>

                {/* Hover Play Button */}
                <Link
                  to={`/watch/${v.id}`}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  title="Watch / Preview Release"
                >
                  <div className="w-12 h-12 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </Link>
              </div>

              {/* Content Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-bold text-white text-sm line-clamp-1 group-hover:text-amber-400 transition-colors" title={v.title}>
                    {v.title}
                  </h3>
                  <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                    <span className="bg-gray-800/80 px-2 py-0.5 rounded text-gray-300 font-medium">
                      {v.category || 'Afrobeat'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-gray-500" />
                      {(v.views || 0).toLocaleString()} views
                    </span>
                  </div>
                </div>

                {/* Action Toolbar */}
                <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between gap-1 text-gray-400">
                  <Link
                    to={`/watch/${v.id}`}
                    className="p-1.5 rounded-lg hover:bg-gray-800 hover:text-amber-400 transition-colors cursor-pointer"
                    title="Watch Release"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>

                  <button
                    onClick={() => handleCopyLink(v.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-800 hover:text-white transition-colors cursor-pointer"
                    title="Copy Share Link"
                  >
                    {copiedId === v.id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Share2 className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={() => handleOpenEdit(v)}
                    className="p-1.5 rounded-lg hover:bg-gray-800 hover:text-amber-400 transition-colors cursor-pointer"
                    title="Edit Metadata & Pricing"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setDeletingId(v.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer"
                    title="Delete Release"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Video Modal */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Edit Release Details</h2>
              <button
                onClick={() => setEditingVideo(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-400 p-3 rounded-xl text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Track / Video Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full bg-[#202020] border border-gray-800 focus:border-amber-500 text-white rounded-xl px-3.5 py-2.5 text-sm outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-[#202020] border border-gray-800 focus:border-amber-500 text-white rounded-xl px-3.5 py-2 text-sm outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Genre / Category</label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    className="w-full bg-[#202020] border border-gray-800 focus:border-amber-500 text-white rounded-xl px-3 py-2 text-sm outline-none"
                  >
                    <option value="Afrobeat">Afrobeat</option>
                    <option value="Amapiano">Amapiano</option>
                    <option value="Hip Hop">Hip Hop / Drill</option>
                    <option value="R&B">R&B / Soul</option>
                    <option value="Gospel">Gospel</option>
                    <option value="Traditional">Traditional / Inanga</option>
                    <option value="Pop">Pop</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">Visibility</label>
                  <select
                    value={editVisibility}
                    onChange={e => setEditVisibility(e.target.value)}
                    className="w-full bg-[#202020] border border-gray-800 focus:border-amber-500 text-white rounded-xl px-3 py-2 text-sm outline-none"
                  >
                    <option value="public">Public (Everyone)</option>
                    <option value="unlisted">Unlisted (Direct Link)</option>
                    <option value="private">Private (Only You)</option>
                  </select>
                </div>
              </div>

              {/* Pricing & Free Toggle */}
              <div className="bg-[#202020] p-4 rounded-xl border border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Monetization Model</span>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsFree}
                      onChange={e => setEditIsFree(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 relative"></div>
                    <span className="text-xs text-gray-300 font-medium">Free Access</span>
                  </label>
                </div>

                {!editIsFree && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-800">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 mb-1">Price (RWF)</label>
                      <input
                        type="number"
                        min="100"
                        step="50"
                        value={editPriceRwf}
                        onChange={e => setEditPriceRwf(e.target.value)}
                        className="w-full bg-[#161616] border border-gray-700 focus:border-amber-500 text-white rounded-xl px-3 py-2 text-sm outline-none font-bold"
                        required={!editIsFree}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-400 mb-1">Price (USD)</label>
                      <input
                        type="number"
                        min="0.10"
                        step="0.05"
                        value={editPriceUsd}
                        onChange={e => setEditPriceUsd(e.target.value)}
                        className="w-full bg-[#161616] border border-gray-700 focus:border-amber-500 text-white rounded-xl px-3 py-2 text-sm outline-none font-bold"
                        required={!editIsFree}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingVideo(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-5 py-2 rounded-xl font-bold text-xs shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingEdit ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Delete this release?</h3>
              <p className="text-xs text-gray-400 mt-1">
                This action is permanent and will remove the media file from your catalog and public listings.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                disabled={deleteLoading}
                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
