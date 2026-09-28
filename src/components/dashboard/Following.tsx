import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, Play, CheckCircle2, Video, Compass, Sparkles } from 'lucide-react';
import { useFollowing } from '../../hooks/useFollowing';

export const Following: React.FC = () => {
  const navigate = useNavigate();
  const {
    artists,
    feedVideos,
    selectedArtistId,
    setSelectedArtistId,
    loadingArtists,
    loadingFeed,
    unfollowArtist
  } = useFollowing();

  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUnfollow = async (e: React.MouseEvent, artistId: string, name: string) => {
    e.stopPropagation();
    if (!confirm(`Unfollow ${name}?`)) return;
    const ok = await unfollowArtist(artistId);
    if (ok) showToast(`Unfollowed ${name}`);
  };

  const formatFollowers = (num?: number) => {
    if (!num) return '0 followers';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M followers`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K followers`;
    return `${num} followers`;
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '3:45';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-8" id="following-artists-section">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-[#FFB300] text-black font-semibold text-xs rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-3">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-[#FFB300]" />
          Followed Artists & Releases
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
            {artists.length} followed
          </span>
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Stay up to date with new music drops, exclusive performances, and backstage videos from your favorite creators.
        </p>
      </div>

      {/* Artists Row */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Channels You Follow
          </h3>
          {selectedArtistId && (
            <button
              onClick={() => setSelectedArtistId(null)}
              className="text-xs text-[#FFB300] hover:underline font-medium"
            >
              Show All Releases
            </button>
          )}
        </div>

        {loadingArtists ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="w-40 h-44 bg-[#161616] rounded-2xl animate-pulse shrink-0" />
            ))}
          </div>
        ) : artists.length === 0 ? (
          <div className="p-8 text-center bg-[#141414] border border-white/5 rounded-2xl space-y-3">
            <Users className="w-10 h-10 mx-auto text-gray-600" />
            <h4 className="text-sm font-semibold text-white">Not following any artists yet</h4>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Follow Rwandan artists to see their latest video releases and exclusive channel drops right here.
            </p>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFB300] text-black font-semibold text-xs rounded-xl hover:bg-[#ffc107]"
            >
              <Compass className="w-3.5 h-3.5" />
              Discover Artists
            </button>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none" id="followed-artists-horizontal-list">
            {artists.map((artist) => {
              const isSelected = selectedArtistId === artist.artist_id;
              return (
                <div
                  key={artist.id}
                  id={`followed-artist-card-${artist.artist_id}`}
                  onClick={() => setSelectedArtistId(isSelected ? null : artist.artist_id)}
                  className={`w-44 p-4 rounded-2xl border transition-all cursor-pointer flex flex-col items-center text-center justify-between shrink-0 ${
                    isSelected
                      ? 'bg-[#221C12] border-[#FFB300] shadow-lg shadow-[#FFB300]/5'
                      : 'bg-[#161616] hover:bg-[#1B1B1B] border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="relative">
                    {artist.profile_image ? (
                      <img
                        src={artist.profile_image}
                        alt={artist.full_name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white/10"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-black font-black text-xl border-2 border-white/10">
                        {artist.full_name ? artist.full_name.charAt(0).toUpperCase() : 'A'}
                      </div>
                    )}
                    {artist.is_verified && (
                      <CheckCircle2 className="w-4 h-4 text-[#FFB300] fill-black absolute bottom-0 right-0" />
                    )}
                  </div>

                  <div className="mt-2.5 w-full">
                    <h4 className="text-xs font-bold text-white truncate hover:text-[#FFB300]">
                      {artist.full_name}
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {formatFollowers(artist.subscriber_count)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-3 w-full pt-2 border-t border-white/5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/artist/${artist.artist_id}`);
                      }}
                      className="flex-1 py-1 px-2 text-[10px] bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg font-medium transition-colors"
                    >
                      Channel
                    </button>
                    <button
                      onClick={(e) => handleUnfollow(e, artist.artist_id, artist.full_name)}
                      className="py-1 px-2 text-[10px] text-gray-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                      title="Unfollow"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-[#FFB300]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Videos Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Video className="w-4 h-4 text-[#FFB300]" />
            {selectedArtistId ? 'Selected Artist Releases' : 'Latest Following Feed'}
          </h3>
        </div>

        {loadingFeed ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-60 bg-[#161616] border border-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : feedVideos.length === 0 ? (
          <div className="p-10 text-center bg-[#141414] border border-white/5 rounded-2xl">
            <Sparkles className="w-8 h-8 mx-auto text-gray-600 mb-2" />
            <p className="text-xs text-gray-400">No recent releases from this artist.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" id="following-video-feed-grid">
            {feedVideos.map((video) => (
              <div
                key={video.id}
                id={`following-feed-video-${video.id}`}
                onClick={() => navigate(`/watch/${video.id}`)}
                className="group bg-[#161616] hover:bg-[#1B1B1B] border border-white/5 hover:border-[#FFB300]/30 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer flex flex-col justify-between shadow-md"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-black overflow-hidden">
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] font-mono text-white">
                    {formatDuration(video.duration)}
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
                    <h4 className="text-xs font-semibold text-white group-hover:text-[#FFB300] line-clamp-1 transition-colors">
                      {video.title}
                    </h4>

                    <div className="flex items-center gap-2 mt-2">
                      {video.artist_avatar && (
                        <img
                          src={video.artist_avatar}
                          alt={video.artist_name}
                          className="w-5 h-5 rounded-full object-cover shrink-0"
                        />
                      )}
                      <p className="text-[11px] text-gray-400 truncate">
                        {video.artist_name}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
                    <span>
                      {new Date(video.uploaded_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    <span className="font-semibold text-white">
                      {video.is_free ? (
                        <span className="text-emerald-400">FREE</span>
                      ) : video.price_rwf ? (
                        `${video.price_rwf.toLocaleString()} RWF`
                      ) : (
                        '$1.00'
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
