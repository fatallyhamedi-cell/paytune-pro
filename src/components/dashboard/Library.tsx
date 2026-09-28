import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Search, Filter, ArrowUpDown, Clock, CheckCircle, Compass, ListPlus, Share2 } from 'lucide-react';
import { useLibrary } from '../../hooks/useLibrary';
import { usePlaylists } from '../../hooks/usePlaylists';

export const Library: React.FC = () => {
  const navigate = useNavigate();
  const {
    videos,
    total,
    loading,
    searchQuery,
    setSearchQuery,
    sort,
    setSort,
    category,
    setCategory,
    artistFilter,
    setArtistFilter,
    page,
    setPage,
    limit
  } = useLibrary();

  const { playlists, addVideoToPlaylist } = usePlaylists();
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleShare = (videoId: string, title: string) => {
    const url = `${window.location.origin}/watch/${videoId}`;
    navigator.clipboard.writeText(url);
    showToast(`Copied link for "${title}"`);
    setActiveMenuId(null);
  };

  const handleAddToPlaylist = async (playlistId: string, videoId: string) => {
    try {
      const res = await addVideoToPlaylist(playlistId, videoId);
      if (res.alreadyIn) {
        showToast('Video is already in this playlist');
      } else {
        showToast('Added to playlist successfully!');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to add to playlist');
    }
    setActiveMenuId(null);
  };

  // Derive unique categories and artists for filter dropdowns
  const categories = ['all', 'Afrobeat', 'Hip-Hop', 'Traditional', 'Gospel', 'R&B'];

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '3:45';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-6" id="user-library-section">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-[#FFB300] text-black font-semibold text-xs rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-3">
          {toastMessage}
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Purchased Library
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#FFB300]/10 text-[#FFB300] border border-[#FFB300]/20 font-semibold">
                {total} {total === 1 ? 'Video' : 'Videos'}
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              All music videos you own. Instant lifetime streaming access anytime.
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="library-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search purchased videos..."
              className="w-full pl-9 pr-4 py-2 bg-[#161616] border border-white/5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFB300] transition-colors"
            />
          </div>
        </div>

        {/* Filter / Sort Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-white/5 text-xs">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0 mr-1" />
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all ${
                  category.toLowerCase() === cat.toLowerCase()
                    ? 'bg-[#FFB300] text-black font-semibold shadow-sm'
                    : 'bg-[#181818] text-gray-400 hover:text-white hover:bg-[#202020]'
                }`}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-500 text-[11px]">Sort:</span>
            <select
              id="library-sort-select"
              value={sort}
              onChange={(e: any) => setSort(e.target.value)}
              className="bg-[#181818] text-gray-300 border border-white/5 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#FFB300]"
            >
              <option value="newest">Recently Purchased</option>
              <option value="oldest">First Purchased</option>
              <option value="title">Title (A-Z)</option>
              <option value="artist">Artist Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-video bg-[#202020]" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-[#252525] rounded w-3/4" />
                <div className="h-3 bg-[#202020] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="p-12 text-center bg-[#141414] border border-white/5 rounded-3xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#FFB300]/10 flex items-center justify-center text-[#FFB300]">
            <Compass className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">
              {searchQuery ? 'No matching videos found' : "You haven't purchased any videos yet"}
            </h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
              {searchQuery
                ? 'Try a different search term or reset your category filter.'
                : 'Support your favorite Rwandan artists and unlock full, ad-free, lifetime music videos.'}
            </p>
          </div>
          <button
            id="library-browse-catalog-btn"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#FFB300] hover:bg-[#ffc107] text-black font-semibold text-xs rounded-xl shadow-lg transition-all"
          >
            <Compass className="w-4 h-4" />
            Browse Music Catalog
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" id="library-video-grid">
          {videos.map((video) => {
            const hasProgress = video.position_seconds && video.duration && video.position_seconds > 5;
            const progressPercent = hasProgress
              ? Math.min(100, Math.round((video.position_seconds! / video.duration!) * 100))
              : 0;

            return (
              <div
                key={video.id}
                id={`library-video-${video.id}`}
                className="group relative bg-[#161616] hover:bg-[#1B1B1B] border border-white/5 hover:border-[#FFB300]/30 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col justify-between shadow-md"
              >
                {/* Thumbnail Container */}
                <div
                  className="relative aspect-video bg-black cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/watch/${video.id}`)}
                >
                  <img
                    src={video.thumbnail_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600"}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Duration Badge */}
                  <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 backdrop-blur-md rounded text-[10px] font-mono text-white font-medium">
                    {formatDuration(video.duration)}
                  </span>

                  {/* Purchased Badge */}
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500/90 text-black text-[10px] font-bold rounded-full flex items-center gap-1 shadow">
                    <CheckCircle className="w-3 h-3" />
                    PURCHASED
                  </span>

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-[#FFB300] text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-6 h-6 fill-black translate-x-0.5" />
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {hasProgress && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div
                        className="h-full bg-[#FFB300]"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3
                      onClick={() => navigate(`/watch/${video.id}`)}
                      className="text-sm font-semibold text-white line-clamp-1 group-hover:text-[#FFB300] transition-colors cursor-pointer"
                      title={video.title}
                    >
                      {video.title}
                    </h3>

                    <p
                      onClick={() => video.artist_id && navigate(`/artist/${video.artist_id}`)}
                      className="text-xs text-gray-400 mt-1 hover:text-white cursor-pointer truncate"
                    >
                      {video.artist_name || 'Rwandan Artist'}
                    </p>

                    {video.purchased_at && (
                      <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Purchased{' '}
                        {new Date(video.purchased_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                    <button
                      id={`library-watch-btn-${video.id}`}
                      onClick={() => navigate(`/watch/${video.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFB300] text-black text-xs font-bold rounded-lg hover:bg-[#ffc107] transition-colors shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-black" />
                      {hasProgress && !video.completed ? 'Resume' : 'Watch'}
                    </button>

                    {/* Quick options */}
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenuId(activeMenuId === video.id ? null : video.id)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        title="Options"
                      >
                        <ListPlus className="w-4 h-4" />
                      </button>

                      {activeMenuId === video.id && (
                        <div className="absolute right-0 bottom-full mb-2 w-48 bg-[#1B1B1B] border border-white/10 rounded-xl shadow-2xl p-1.5 z-40 animate-in fade-in zoom-in-95">
                          <button
                            onClick={() => handleShare(video.id, video.title)}
                            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-white/5 rounded-lg flex items-center gap-2"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Share Video Link
                          </button>
                          {playlists.length > 0 && (
                            <div className="border-t border-white/5 my-1 pt-1">
                              <span className="px-3 text-[10px] text-gray-500 uppercase tracking-wider font-semibold block mb-1">
                                Add to Playlist
                              </span>
                              {playlists.map((pl) => (
                                <button
                                  key={pl.id}
                                  onClick={() => handleAddToPlaylist(pl.id, video.id)}
                                  className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:text-[#FFB300] hover:bg-white/5 rounded-lg truncate"
                                >
                                  + {pl.name || pl.title}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 bg-[#181818] border border-white/5 rounded-lg text-xs text-gray-300 disabled:opacity-40 hover:text-white"
          >
            Previous
          </button>
          <span className="text-xs text-gray-400 px-2">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 bg-[#181818] border border-white/5 rounded-lg text-xs text-gray-300 disabled:opacity-40 hover:text-white"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
