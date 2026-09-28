import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Play, Trash2, ShoppingBag, Clock, Compass } from 'lucide-react';
import { useWishlist } from '../../hooks/useWishlist';

export const Wishlist: React.FC = () => {
  const navigate = useNavigate();
  const { wishlist, loading, removeFromWishlist } = useWishlist();
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRemove = async (videoId: string, title: string) => {
    await removeFromWishlist(videoId);
    showToast(`Removed "${title}" from Watch Later`);
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '3:45';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6" id="watch-later-wishlist-section">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-[#FFB300] text-black font-semibold text-xs rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-3">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Bookmark className="w-6 h-6 text-[#FFB300]" />
          Watch Later / Wishlist
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
            {wishlist.length} saved
          </span>
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Saved music videos you want to watch or purchase later.
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-64 bg-[#141414] border border-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : wishlist.length === 0 ? (
        <div className="p-12 text-center bg-[#141414] border border-white/5 rounded-3xl space-y-3">
          <Bookmark className="w-12 h-12 mx-auto text-gray-600" />
          <h3 className="text-base font-semibold text-white">Your Watch Later list is empty</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Click the bookmark icon on any video across PAYTUNE to save it here for later listening.
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-5 py-2 bg-[#FFB300] text-black font-semibold text-xs rounded-xl hover:bg-[#ffc107] transition-all"
          >
            <Compass className="w-3.5 h-3.5" />
            Explore Catalog
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" id="wishlist-video-grid">
          {wishlist.map((item) => (
            <div
              key={item.id}
              id={`wishlist-item-${item.video_id}`}
              className="group bg-[#161616] hover:bg-[#1B1B1B] border border-white/5 hover:border-[#FFB300]/30 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col justify-between shadow-md"
            >
              {/* Thumbnail */}
              <div
                className="relative aspect-video bg-black cursor-pointer overflow-hidden flex items-center justify-center"
                onClick={() => navigate(`/watch/${item.video_id}`)}
              >
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-amber-950/70 via-neutral-900 to-black flex items-center justify-center">
                    <Play className="w-8 h-8 text-[#FFB300] opacity-60" />
                  </div>
                )}
                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] font-mono text-white">
                  {formatDuration(item.duration)}
                </span>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#FFB300] text-black flex items-center justify-center shadow-lg">
                    <Play className="w-5 h-5 fill-black translate-x-0.5" />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h4
                    onClick={() => navigate(`/watch/${item.video_id}`)}
                    className="text-sm font-semibold text-white group-hover:text-[#FFB300] line-clamp-1 transition-colors cursor-pointer"
                    title={item.title}
                  >
                    {item.title}
                  </h4>
                  <p
                    onClick={() => item.artist_id && navigate(`/artist/${item.artist_id}`)}
                    className="text-xs text-gray-400 mt-0.5 hover:text-white cursor-pointer truncate"
                  >
                    {item.artist_name || 'Rwandan Artist'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#FFB300]">
                    {item.price_rwf ? `${item.price_rwf.toLocaleString()} RWF` : '$1.00'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      id={`wishlist-watch-btn-${item.video_id}`}
                      onClick={() => navigate(`/watch/${item.video_id}`)}
                      className="px-2.5 py-1.5 bg-[#FFB300] text-black font-bold text-xs rounded-lg hover:bg-[#ffc107] transition-colors flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-black" />
                      Play
                    </button>
                    <button
                      id={`wishlist-remove-btn-${item.video_id}`}
                      onClick={() => handleRemove(item.video_id, item.title)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                      title="Remove from Watch Later"
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
    </div>
  );
};
