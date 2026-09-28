import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Share2, Trash2, Edit3, Lock, Globe, ChevronUp, ChevronDown, Check, Music, Music2 } from 'lucide-react';
import { Playlist, LibraryVideo } from '../../types/dashboard';
import { usePlaylists } from '../../hooks/usePlaylists';

interface PlaylistDetailProps {
  playlist: Playlist;
  onBack: () => void;
  onPlaylistUpdated: () => void;
}

export const PlaylistDetail: React.FC<PlaylistDetailProps> = ({ playlist, onBack, onPlaylistUpdated }) => {
  const navigate = useNavigate();
  const { removeVideoFromPlaylist, reorderVideos, updatePlaylist, deletePlaylist, getShareLink } = usePlaylists();

  const [videos, setVideos] = useState<LibraryVideo[]>(playlist.videos || []);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(playlist.name || playlist.title || '');
  const [editDesc, setEditDesc] = useState(playlist.description || '');
  const [editPublic, setEditPublic] = useState(playlist.is_public !== false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleShare = async () => {
    const url = await getShareLink(playlist.id);
    navigator.clipboard.writeText(url);
    showToast('Playlist share link copied to clipboard!');
  };

  const handleRemoveVideo = async (videoId: string) => {
    await removeVideoFromPlaylist(playlist.id, videoId);
    setVideos(prev => prev.filter(v => v.id !== videoId));
    showToast('Video removed from playlist');
    onPlaylistUpdated();
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= videos.length) return;

    const reordered = [...videos];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIdx, 0, moved);

    setVideos(reordered);
    await reorderVideos(playlist.id, reordered.map(v => v.id));
    showToast('Playlist order updated');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updatePlaylist(playlist.id, {
        name: editName,
        title: editName,
        description: editDesc,
        is_public: editPublic
      });
      setIsEditOpen(false);
      showToast('Playlist updated');
      onPlaylistUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to update playlist');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this playlist?')) return;
    await deletePlaylist(playlist.id);
    onBack();
    onPlaylistUpdated();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '3:45';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-6" id="playlist-detail-view">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-[#FFB300] text-black font-semibold text-xs rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-3">
          {toastMessage}
        </div>
      )}

      {/* Navigation & Header */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Playlists
      </button>

      {/* Playlist Hero Info */}
      <div className="p-6 bg-gradient-to-br from-[#221c10] via-[#161616] to-[#121212] border border-white/5 rounded-3xl flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-36 h-36 rounded-2xl overflow-hidden bg-black shadow-2xl shrink-0 border border-white/10 relative group flex items-center justify-center">
            {playlist.thumbnail_url ? (
              <img
                src={playlist.thumbnail_url}
                alt={playlist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-amber-950 via-neutral-900 to-black flex items-center justify-center">
                <Music2 className="w-12 h-12 text-[#FFB300] opacity-60" />
              </div>
            )}
            {videos.length > 0 && (
              <div
                onClick={() => navigate(`/watch/${videos[0].id}`)}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-[#FFB300] text-black flex items-center justify-center">
                  <Play className="w-5 h-5 fill-black translate-x-0.5" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-gray-300 flex items-center gap-1">
                {playlist.is_public !== false ? (
                  <>
                    <Globe className="w-3 h-3 text-[#FFB300]" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-gray-400" /> Private
                  </>
                )}
              </span>
              <span className="text-xs text-gray-400">
                {videos.length} {videos.length === 1 ? 'Track' : 'Tracks'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {playlist.name || playlist.title}
            </h1>

            {playlist.description && (
              <p className="text-xs text-gray-400 max-w-lg leading-relaxed">
                {playlist.description}
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              {videos.length > 0 && (
                <button
                  id="playlist-play-all-btn"
                  onClick={() => navigate(`/watch/${videos[0].id}`)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#FFB300] hover:bg-[#ffc107] text-black font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  <Play className="w-4 h-4 fill-black" />
                  Play All
                </button>
              )}

              <button
                id="playlist-share-btn"
                onClick={handleShare}
                className="p-2.5 bg-[#181818] hover:bg-[#222] border border-white/5 text-gray-300 hover:text-white rounded-xl transition-colors"
                title="Share Playlist"
              >
                <Share2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsEditOpen(true)}
                className="p-2.5 bg-[#181818] hover:bg-[#222] border border-white/5 text-gray-300 hover:text-white rounded-xl transition-colors"
                title="Edit Details"
              >
                <Edit3 className="w-4 h-4" />
              </button>

              <button
                onClick={handleDelete}
                className="p-2.5 bg-[#181818] hover:bg-red-500/10 border border-white/5 text-gray-400 hover:text-red-400 rounded-xl transition-colors"
                title="Delete Playlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Videos List */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-white px-1">Tracks in Playlist</h3>

        {videos.length === 0 ? (
          <div className="p-8 text-center bg-[#141414] border border-white/5 rounded-2xl space-y-2">
            <Music className="w-8 h-8 mx-auto text-gray-600" />
            <p className="text-xs text-gray-400">This playlist is currently empty.</p>
            <p className="text-[11px] text-gray-500">
              Browse videos in your Library or across PAYTUNE and select "Add to Playlist".
            </p>
          </div>
        ) : (
          <div className="space-y-1.5" id="playlist-tracks-container">
            {videos.map((vid, idx) => (
              <div
                key={vid.id}
                id={`playlist-track-${vid.id}`}
                className="group p-3 bg-[#151515] hover:bg-[#1A1A1A] border border-white/5 hover:border-white/10 rounded-xl transition-all flex items-center justify-between gap-3"
              >
                {/* Index + Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-center text-xs font-mono text-gray-500 group-hover:text-[#FFB300]">
                    {idx + 1}
                  </span>

                  <div
                    className="relative w-16 aspect-video bg-black rounded-lg overflow-hidden shrink-0 cursor-pointer"
                    onClick={() => navigate(`/watch/${vid.id}`)}
                  >
                    <img
                      src={vid.thumbnail_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600"}
                      alt={vid.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-3 h-3 fill-white text-white" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <h4
                      onClick={() => navigate(`/watch/${vid.id}`)}
                      className="text-xs font-semibold text-white truncate cursor-pointer hover:text-[#FFB300]"
                      title={vid.title}
                    >
                      {vid.title}
                    </h4>
                    <p className="text-[11px] text-gray-400 truncate">
                      {vid.artist_name || 'Rwandan Artist'}
                    </p>
                  </div>
                </div>

                {/* Right controls: Duration, Move, Remove */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono text-gray-500 mr-2">
                    {formatDuration(vid.duration)}
                  </span>

                  {/* Move Up/Down buttons */}
                  <div className="flex flex-col opacity-40 group-hover:opacity-100 transition-opacity">
                    <button
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, 'up')}
                      className="p-0.5 text-gray-400 hover:text-[#FFB300] disabled:opacity-20"
                      title="Move Up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={idx === videos.length - 1}
                      onClick={() => handleMove(idx, 'down')}
                      className="p-0.5 text-gray-400 hover:text-[#FFB300] disabled:opacity-20"
                      title="Move Down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleRemoveVideo(vid.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                    title="Remove from playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Details Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Edit Playlist</h3>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Title</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#111] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#FFB300]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-[#111] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#FFB300]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-public-toggle"
                  checked={editPublic}
                  onChange={(e) => setEditPublic(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FFB300] bg-black border-white/20"
                />
                <label htmlFor="edit-public-toggle" className="text-xs text-gray-300 cursor-pointer">
                  Public playlist (visible on your profile & shareable via link)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FFB300] text-black font-bold text-xs rounded-xl hover:bg-[#ffc107]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
