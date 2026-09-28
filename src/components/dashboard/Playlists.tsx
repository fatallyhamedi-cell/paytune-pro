import React, { useState } from 'react';
import { ListMusic, Plus, Share2, Trash2, Lock, Globe, Play, FolderPlus, Music2 } from 'lucide-react';
import { usePlaylists } from '../../hooks/usePlaylists';
import { Playlist } from '../../types/dashboard';
import { PlaylistDetail } from './PlaylistDetail';

export const Playlists: React.FC = () => {
  const { playlists, loading, createPlaylist, deletePlaylist, getShareLink, refreshPlaylists } = usePlaylists();
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPublic, setNewPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSubmitting(true);
    try {
      const pl = await createPlaylist(newName.trim(), newDesc.trim(), newPublic);
      setIsCreateOpen(false);
      setNewName('');
      setNewDesc('');
      setNewPublic(true);
      showToast('Playlist created successfully!');
      if (pl) setSelectedPlaylist(pl);
    } catch (err: any) {
      showToast(err.message || 'Failed to create playlist');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    await deletePlaylist(id);
    showToast('Playlist deleted');
  };

  const handleShare = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const url = await getShareLink(id);
    navigator.clipboard.writeText(url);
    showToast('Playlist link copied to clipboard!');
  };

  if (selectedPlaylist) {
    // Find up-to-date version of playlist from list
    const current = playlists.find(p => p.id === selectedPlaylist.id) || selectedPlaylist;
    return (
      <PlaylistDetail
        playlist={current}
        onBack={() => setSelectedPlaylist(null)}
        onPlaylistUpdated={refreshPlaylists}
      />
    );
  }

  return (
    <div className="space-y-6" id="playlists-overview-section">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-[#FFB300] text-black font-semibold text-xs rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-3">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ListMusic className="w-6 h-6 text-[#FFB300]" />
            Your Playlists
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
              {playlists.length}
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Organize your favorite music videos, concert sets, and mood collections.
          </p>
        </div>

        <button
          id="create-playlist-btn"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#FFB300] hover:bg-[#ffc107] text-black font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Playlist
        </button>
      </div>

      {/* Playlists Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-64 bg-[#141414] border border-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div className="p-12 text-center bg-[#141414] border border-white/5 rounded-3xl space-y-3">
          <FolderPlus className="w-12 h-12 mx-auto text-gray-600" />
          <h3 className="text-base font-semibold text-white">No playlists yet</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Create your first playlist to group together hits from Bruce Melodie, Meddy, The Ben, and more.
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2 bg-[#FFB300] text-black font-semibold text-xs rounded-xl hover:bg-[#ffc107] transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Your First Playlist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" id="playlists-cards-grid">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              id={`playlist-card-${pl.id}`}
              onClick={() => setSelectedPlaylist(pl)}
              className="group bg-[#161616] hover:bg-[#1B1B1B] border border-white/5 hover:border-[#FFB300]/30 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-md"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
                {pl.thumbnail_url ? (
                  <img
                    src={pl.thumbnail_url}
                    alt={pl.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-amber-950/70 via-neutral-900 to-black flex items-center justify-center">
                    <Music2 className="w-8 h-8 text-[#FFB300] opacity-60" />
                  </div>
                )}

                {/* Video Count Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 flex flex-col justify-between p-3">
                  <div className="self-end">
                    <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-medium text-gray-300 flex items-center gap-1 border border-white/10">
                      {pl.is_public !== false ? (
                        <>
                          <Globe className="w-2.5 h-2.5 text-[#FFB300]" /> Public
                        </>
                      ) : (
                        <>
                          <Lock className="w-2.5 h-2.5 text-gray-400" /> Private
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-white font-medium">
                    <span className="flex items-center gap-1 bg-black/70 px-2 py-0.5 rounded-md text-[11px]">
                      <ListMusic className="w-3 h-3 text-[#FFB300]" />
                      {pl.video_count ?? pl.videos?.length ?? 0} videos
                    </span>
                  </div>
                </div>

                {/* Play hover badge */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#FFB300] text-black flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 fill-black translate-x-0.5" />
                  </div>
                </div>
              </div>

              {/* Info & Footer */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-[#FFB300] transition-colors truncate">
                    {pl.name || pl.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                    {pl.description || 'No description added'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">
                    Updated {new Date(pl.updated_at || pl.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      id={`share-playlist-${pl.id}`}
                      onClick={(e) => handleShare(e, pl.id)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      title="Share link"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`delete-playlist-${pl.id}`}
                      onClick={(e) => handleDelete(e, pl.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                      title="Delete playlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Create New Playlist</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Playlist Name *
                </label>
                <input
                  type="text"
                  id="new-playlist-name-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Kigali Nights, Top Hits"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 text-xs focus:outline-none focus:border-[#FFB300]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  id="new-playlist-desc-input"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What is this playlist about?"
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-[#111] border border-white/10 rounded-xl text-white placeholder-gray-500 text-xs focus:outline-none focus:border-[#FFB300]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="new-playlist-public-checkbox"
                  checked={newPublic}
                  onChange={(e) => setNewPublic(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FFB300] bg-black border-white/20"
                />
                <label htmlFor="new-playlist-public-checkbox" className="text-xs text-gray-300 cursor-pointer">
                  Public playlist (shareable with friends & followers)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="create-playlist-submit-btn"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#FFB300] text-black font-bold text-xs rounded-xl hover:bg-[#ffc107] disabled:opacity-50 transition-all shadow-md"
                >
                  {submitting ? 'Creating...' : 'Create Playlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
