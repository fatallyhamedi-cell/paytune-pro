import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History as HistoryIcon, Play, Trash2, PauseCircle, PlayCircle, Search, Clock, AlertTriangle } from 'lucide-react';
import { useHistory } from '../../hooks/useHistory';

export const History: React.FC = () => {
  const navigate = useNavigate();
  const {
    history,
    total,
    isPaused,
    loading,
    searchQuery,
    setSearchQuery,
    removeFromHistory,
    clearAllHistory,
    togglePauseHistory
  } = useHistory();

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleClear = async () => {
    await clearAllHistory();
    setConfirmClearOpen(false);
    showToast('Watch history cleared');
  };

  const handleTogglePause = async () => {
    await togglePauseHistory();
    showToast(isPaused ? 'History recording resumed' : 'History recording paused');
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffHrs < 1) return 'Just now';
      if (diffHrs < 24) return `${diffHrs}h ago`;
      if (diffHrs < 48) return 'Yesterday';
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const formatSeconds = (sec?: number) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6" id="watch-history-section">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-[#FFB300] text-black font-semibold text-xs rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-3">
          {toastMessage}
        </div>
      )}

      {/* Header & Control Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <HistoryIcon className="w-6 h-6 text-[#FFB300]" />
            Watch History
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
              {total} items
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Videos you have watched. Pick up exactly where you left off anytime.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pause Toggle */}
          <button
            id="toggle-pause-history-btn"
            onClick={handleTogglePause}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isPaused
                ? 'bg-amber-500/10 border-amber-500/30 text-[#FFB300]'
                : 'bg-[#181818] border-white/5 text-gray-300 hover:text-white hover:bg-[#222]'
            }`}
          >
            {isPaused ? (
              <>
                <PlayCircle className="w-4 h-4 text-[#FFB300]" />
                Resume History
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4 text-gray-400" />
                Pause History
              </>
            )}
          </button>

          {/* Clear All */}
          {history.length > 0 && (
            <button
              id="clear-all-history-btn"
              onClick={() => setConfirmClearOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#181818] border border-white/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Clear All History
            </button>
          )}

          {/* Search History */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="history-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              className="w-full pl-8 pr-3 py-2 bg-[#161616] border border-white/5 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFB300]"
            />
          </div>
        </div>
      </div>

      {/* Paused Notification Banner */}
      {isPaused && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-[#FFB300] flex items-center gap-2">
          <PauseCircle className="w-4 h-4 shrink-0" />
          <span>Watch history recording is currently paused. Newly watched videos won't appear here.</span>
        </div>
      )}

      {/* History List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 bg-[#141414] border border-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="p-12 text-center bg-[#141414] border border-white/5 rounded-3xl space-y-3">
          <HistoryIcon className="w-12 h-12 mx-auto text-gray-600" />
          <h3 className="text-base font-semibold text-white">No watch history yet</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {searchQuery
              ? 'No videos in your history match that search query.'
              : 'Start watching videos and your playback progress will automatically appear here.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-5 py-2 bg-[#FFB300] text-black font-semibold text-xs rounded-xl hover:bg-[#ffc107] transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            Explore Videos
          </button>
        </div>
      ) : (
        <div className="space-y-3" id="history-items-list">
          {history.map((item) => {
            const hasPosition = item.position_seconds > 0;
            const progressPercent = item.duration
              ? Math.min(100, Math.round((item.position_seconds / item.duration) * 100))
              : 0;

            return (
              <div
                key={item.id}
                id={`history-row-${item.video_id}`}
                className="group p-3 sm:p-4 bg-[#161616] hover:bg-[#1B1B1B] border border-white/5 hover:border-white/10 rounded-2xl transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                {/* Left Thumbnail & Info */}
                <div className="flex items-center gap-3.5 w-full sm:w-auto">
                  <div
                    className="relative w-32 sm:w-40 aspect-video rounded-xl overflow-hidden bg-black shrink-0 cursor-pointer"
                    onClick={() => navigate(`/watch/${item.video_id}`)}
                  >
                    <img
                      src={item.thumbnail_url || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600"}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                    {hasPosition && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                        <div
                          className="h-full bg-[#FFB300]"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-white">
                      {formatSeconds(item.duration)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4
                      onClick={() => navigate(`/watch/${item.video_id}`)}
                      className="text-sm font-semibold text-white truncate hover:text-[#FFB300] cursor-pointer"
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

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(item.last_watched_at)}
                      </span>
                      {hasPosition && !item.completed && (
                        <span className="text-[#FFB300] font-medium">
                          Stopped at {formatSeconds(item.position_seconds)}
                        </span>
                      )}
                      {item.completed && (
                        <span className="text-emerald-400 font-medium">Completed</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action Controls */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    id={`history-resume-btn-${item.video_id}`}
                    onClick={() => navigate(`/watch/${item.video_id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFB300] hover:bg-[#ffc107] text-black font-bold text-xs rounded-xl transition-all shadow-sm"
                  >
                    <Play className="w-3 h-3 fill-black" />
                    {hasPosition && !item.completed
                      ? `Resume (${formatSeconds(item.position_seconds)})`
                      : 'Watch Again'}
                  </button>

                  <button
                    id={`history-remove-btn-${item.video_id}`}
                    onClick={() => removeFromHistory(item.video_id)}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-xl transition-colors"
                    title="Remove from history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Clear Watch History?</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to clear your entire watch history? Your playback resume progress on all videos will be reset. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                id="confirm-clear-history-submit"
                onClick={handleClear}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold text-xs rounded-xl shadow-md transition-all"
              >
                Clear Entire History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
