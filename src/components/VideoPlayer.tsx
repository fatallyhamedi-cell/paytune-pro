import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize, 
  PictureInPicture2, 
  RotateCcw, 
  Settings, 
  Clock, 
  Sparkles,
  Keyboard,
  Check,
  ShieldAlert,
  Fingerprint
} from 'lucide-react';
import { usePlayer } from '../hooks/usePlayer';
import { useAuth } from '../hooks/useAuth';
import { PaywallOverlay } from './PaywallOverlay';
import { PreRollAd, ActiveAd } from './PreRollAd';

interface VideoPlayerProps {
  video: {
    id: string;
    title: string;
    artist_name: string;
    video_url: string;
    preview_url?: string;
    thumbnail_url?: string;
    price_rwf: number;
    price_usd: number;
    is_free: boolean;
    duration: number;
    userOwns: boolean;
    visibility?: string;
    is_active?: boolean;
    is_short?: boolean;
    category?: string;
    dmca_request_id?: string;
  };
  savedProgress?: number;
  onOpenPaymentModal: () => void;
  onProgressUpdate?: (seconds: number) => void;
  onEnded?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  video,
  savedProgress = 0,
  onOpenPaymentModal,
  onProgressUpdate,
  onEnded
}) => {
  const { user } = useAuth();
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [watermarkToken, setWatermarkToken] = useState<string>('');
  const [watermarkPosIndex, setWatermarkPosIndex] = useState(0);

  // Pre-roll Ad State (CRITICAL: Paid videos and Shorts NEVER show ads)
  const [adState, setAdState] = useState<{
    active: boolean;
    ad: ActiveAd | null;
  }>({ active: false, ad: null });

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const isDmcaBlocked = video.visibility === 'dmca_blocked' || 
                        video.visibility === 'copyright_blocked' || 
                        (video.is_active === false && Boolean(video.dmca_request_id));

  // Check for pre-roll ad on free videos
  useEffect(() => {
    // RULE 1: PAID VIDEOS NEVER SHOW ADS
    const isPaid = !video.is_free && Number(video.price_rwf || 0) > 0;
    // RULE 2: SHORTS NEVER SHOW ADS
    const isShort = Boolean(
      video.is_short || 
      video.category === 'Shorts' || 
      video.category === 'Reels'
    );

    if (isPaid || isShort || !video.id || isDmcaBlocked) {
      setAdState({ active: false, ad: null });
      return;
    }

    // RULE 3: FREE videos can show ads
    axios
      .get(`/api/ads/video/${video.id}`)
      .then((res) => {
        if (res.data?.has_ad && res.data.ad) {
          setAdState({ active: true, ad: res.data.ad });
        } else {
          setAdState({ active: false, ad: null });
        }
      })
      .catch(() => {
        setAdState({ active: false, ad: null });
      });
  }, [video.id, video.is_free, video.price_rwf, video.is_short, video.category, isDmcaBlocked]);

  // 1. Embed Forensic Watermark session
  useEffect(() => {
    if (video.id && !isDmcaBlocked) {
      axios.post('/api/copyright/watermark/embed', { video_id: video.id })
        .then(res => {
          if (res.data?.watermarkToken) {
            setWatermarkToken(res.data.watermarkToken);
          }
        })
        .catch(() => {});
    }
  }, [video.id, isDmcaBlocked]);

  // Periodic shifting of watermark corner every 20s to ensure forensic trace is screen-recorder resilient
  useEffect(() => {
    const timer = setInterval(() => {
      setWatermarkPosIndex(prev => (prev + 1) % 4);
    }, 20000);
    return () => clearInterval(timer);
  }, []);

  // 2. Global Keyboard Shortcut Prevention for saving/inspecting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+S, Ctrl+U, Cmd+S, Cmd+U, F12
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const mediaSource = video.video_url || (video as any).audio_url || video.preview_url;
  const effectiveSrc = video.userOwns || video.is_free 
    ? mediaSource
    : (video.preview_url || mediaSource);

  const {
    videoRef,
    containerRef,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    isFullscreen,
    isPiP,
    isPaywallTriggered,
    quality,
    qualities,
    buffered,
    showResumePrompt,
    videoProps,
    togglePlay,
    seek,
    changeVolume,
    toggleMute,
    changeSpeed,
    toggleFullscreen,
    togglePiP,
    changeQuality,
    resumeFromSavedProgress,
    dismissResumePrompt
  } = usePlayer({
    src: effectiveSrc,
    userOwns: video.userOwns || video.is_free,
    savedProgress,
    onProgressUpdate,
    onEnded
  });

  // Auto-hide controls after inactivity
  const handleMouseMove = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !showSettingsMenu && !showShortcutsHelp) {
        setControlsVisible(false);
      }
    }, 2800);
  };

  const handleMouseLeave = () => {
    if (isPlaying && !showSettingsMenu && !showShortcutsHelp) {
      setControlsVisible(false);
    }
  };

  // Timeline hover calculation
  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetDur = duration || video.duration || 1;
    setHoverPosition(pos * targetDur);
    setHoverX(e.clientX - rect.left);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetDur = duration || video.duration || 1;
    seek(pos * targetDur);
  };

  // Format time mm:ss
  const formatTime = (timeInSeconds: number) => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // 3. DMCA / Copyright Blocked Screen
  if (isDmcaBlocked) {
    return (
      <div 
        id="video-player-dmca-blocked"
        className="relative w-full aspect-video bg-[#0c0c0e] rounded-2xl overflow-hidden border border-red-900/40 shadow-2xl flex flex-col items-center justify-center p-8 text-center select-none"
      >
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mb-4 shadow-lg shadow-red-500/5">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
          DMCA / Copyright Notice
        </span>
        <h3 className="text-xl font-bold text-white mb-2 max-w-md">
          Video Unavailable
        </h3>
        <p className="text-sm text-gray-400 max-w-lg leading-relaxed mb-6">
          This video has been disabled following an approved Digital Millennium Copyright Act (DMCA) takedown notice or Content ID policy enforcement.
        </p>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Protected by PAYTUNE Intellectual Property System</span>
          <span>•</span>
          <a href="/dmca" className="text-amber-500 hover:underline">Submit Counter-Notice</a>
        </div>
      </div>
    );
  }

  // Remaining preview countdown for unpaid videos
  const previewRemaining = Math.max(0, Math.ceil(30 - currentTime));
  const isPreviewMode = !video.userOwns && !video.is_free;
  const currentDuration = duration || video.duration || 210;
  const progressPercent = currentDuration > 0 ? (currentTime / currentDuration) * 100 : 0;

  // Corner positions for moving forensic watermark
  const watermarkPositions = [
    "top-4 right-4 text-right",
    "bottom-16 right-4 text-right",
    "bottom-16 left-4 text-left",
    "top-4 left-4 text-left"
  ];

  return (
    <div
      id="video-player-container"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onContextMenu={(e) => { e.preventDefault(); return false; }}
      className="group relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl select-none"
    >
      {/* HTML5 Video Element with anti-theft controlsList */}
      <video
        {...videoProps}
        poster={video.thumbnail_url}
        onClick={togglePlay}
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture={false}
        className="w-full h-full object-contain cursor-pointer select-none"
      />

      {/* Pre-roll Ad Overlay for Free Videos */}
      {adState.active && adState.ad && (
        <PreRollAd
          ad={adState.ad}
          videoId={video.id}
          onAdEnded={() => {
            setAdState({ active: false, ad: null });
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
          }}
          onAdSkipped={() => {
            setAdState({ active: false, ad: null });
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
          }}
        />
      )}

      {/* Forensic Invisible & Steganographic Watermark Layer */}
      <div 
        id="forensic-watermark-overlay"
        className={`absolute z-10 pointer-events-none select-none transition-all duration-1000 ${watermarkPositions[watermarkPosIndex]} opacity-25`}
      >
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-white/70 bg-black/40 px-2 py-0.5 rounded backdrop-blur-[2px] border border-white/10">
          <Fingerprint className="w-2.5 h-2.5 text-amber-400" />
          <span>PT-FORENSIC • {user?.id ? user.id.substring(0, 8) : 'SES'}-{video.id.substring(0, 6)}</span>
        </div>
      </div>

      {/* 30-Second Free Preview Floating Tag */}
      {isPreviewMode && !isPaywallTriggered && (
        <div 
          id="preview-badge"
          className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-amber-500/40 text-white text-xs font-semibold shadow-lg animate-pulse"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 shadow-xs"></span>
          <span>Free Preview: {previewRemaining}s left</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenPaymentModal();
            }}
            className="ml-1 px-2.5 py-0.5 rounded-full bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-black transition-all cursor-pointer"
          >
            Unlock Full
          </button>
        </div>
      )}

      {/* Resume from Saved Progress Prompt */}
      {showResumePrompt && (
        <div 
          id="resume-progress-prompt"
          className="absolute top-4 right-4 z-20 flex items-center gap-3 p-3 rounded-xl bg-black/90 backdrop-blur-md border border-amber-500/30 text-white text-xs shadow-xl animate-fadeIn"
        >
          <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>Resume where you left off at <strong>{formatTime(savedProgress)}</strong>?</span>
          <div className="flex items-center gap-1.5 ml-1">
            <button
              onClick={resumeFromSavedProgress}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold transition-all cursor-pointer"
            >
              Resume
            </button>
            <button
              onClick={dismissResumePrompt}
              className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-300 transition-all cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Paywall Overlay triggered at 30 seconds */}
      {isPaywallTriggered && isPreviewMode && (
        <PaywallOverlay
          title={video.title}
          artistName={video.artist_name}
          priceRwf={video.price_rwf}
          priceUsd={video.price_usd}
          onBuyNow={onOpenPaymentModal}
        />
      )}

      {/* Center Play Button Overlay on Pause */}
      {!isPlaying && !isPaywallTriggered && (
        <div 
          onClick={togglePlay}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 cursor-pointer transition-opacity"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#FFB300] hover:bg-amber-400 text-black flex items-center justify-center shadow-2xl hover:scale-105 transition-transform">
            <Play className="w-8 h-8 sm:w-9 sm:h-9 fill-black ml-1" />
          </div>
        </div>
      )}

      {/* YouTube-Style Controls Overlay */}
      <div 
        id="player-controls-overlay"
        className={`absolute inset-x-0 bottom-0 z-20 pt-16 pb-3 px-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 ${
          controlsVisible || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Seekable Progress Bar */}
        <div 
          ref={progressBarRef}
          onMouseMove={handleProgressBarMouseMove}
          onMouseLeave={() => setHoverPosition(null)}
          onClick={handleProgressBarClick}
          className="relative h-2 w-full bg-neutral-800 rounded-full cursor-pointer group/progress mb-3 transition-all hover:h-3"
        >
          {/* Buffered Progress */}
          <div 
            className="absolute top-0 left-0 h-full bg-neutral-600/70 rounded-full"
            style={{ width: `${buffered}%` }}
          />

          {/* 30s Preview marker for unpaid videos */}
          {isPreviewMode && (
            <div 
              className="absolute top-0 h-full bg-red-500/40 border-r-2 border-red-500 z-10"
              style={{ width: `${Math.min(100, (30 / currentDuration) * 100)}%` }}
              title="30-Second Free Preview Limit"
            />
          )}

          {/* Current Played Progress */}
          <div 
            className="absolute top-0 left-0 h-full bg-amber-500 rounded-full flex items-center justify-end"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-md transform scale-0 group-hover/progress:scale-100 transition-transform" />
          </div>

          {/* Hover Time Tooltip */}
          {hoverPosition !== null && (
            <div 
              className="absolute bottom-4 -translate-x-1/2 px-2 py-1 rounded bg-black/95 text-amber-400 text-[11px] font-mono border border-amber-500/30 pointer-events-none shadow-lg"
              style={{ left: `${hoverX}px` }}
            >
              {formatTime(hoverPosition)}
            </div>
          )}
        </div>

        {/* Control Bar Actions */}
        <div className="flex items-center justify-between text-white">
          {/* Left Actions */}
          <div className="flex items-center gap-3">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              id="player-play-pause-btn"
              className="p-1.5 rounded-lg hover:bg-white/15 text-white transition-colors cursor-pointer"
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white" />}
            </button>

            {/* Quick 10s Rewind */}
            <button
              onClick={() => seek(currentTime - 10)}
              className="p-1.5 rounded-lg hover:bg-white/15 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Rewind 10s (J)"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Volume & Mute */}
            <div className="flex items-center gap-1.5 group/volume">
              <button
                onClick={toggleMute}
                id="player-mute-btn"
                className="p-1.5 rounded-lg hover:bg-white/15 text-gray-300 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? "Unmute (M)" : "Mute (M)"}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                className="w-16 sm:w-20 h-1.5 accent-amber-500 bg-neutral-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Time Stamp */}
            <div className="text-xs font-mono text-gray-300 ml-1">
              <span className="text-white font-semibold">{formatTime(currentTime)}</span>
              <span className="mx-1 text-gray-500">/</span>
              <span>{formatTime(currentDuration)}</span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 relative">
            {/* Keyboard Shortcuts Helper Button */}
            <button
              onClick={() => setShowShortcutsHelp(prev => !prev)}
              className="p-2 rounded-lg hover:bg-white/15 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Keyboard Shortcuts"
            >
              <Keyboard className="w-5 h-5" />
            </button>

            {/* Quality & Speed Settings Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSettingsMenu(prev => !prev);
                  setShowSpeedMenu(false);
                  setShowQualityMenu(false);
                }}
                id="player-settings-btn"
                className="p-2 rounded-lg hover:bg-white/15 text-gray-300 hover:text-white transition-colors cursor-pointer"
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* Settings Dropdown */}
              {showSettingsMenu && (
                <div 
                  id="player-settings-menu"
                  className="absolute right-0 bottom-12 w-48 py-2 rounded-xl bg-[#181818] border border-gray-800 text-sm text-gray-200 shadow-2xl z-30 animate-fadeIn"
                >
                  {!showSpeedMenu && !showQualityMenu ? (
                    <div className="space-y-1">
                      <button
                        onClick={() => setShowSpeedMenu(true)}
                        className="w-full px-4 py-2 flex items-center justify-between hover:bg-neutral-800 text-left cursor-pointer"
                      >
                        <span>Playback Speed</span>
                        <span className="text-xs text-amber-500 font-mono">{playbackRate}x</span>
                      </button>
                      <button
                        onClick={() => setShowQualityMenu(true)}
                        className="w-full px-4 py-2 flex items-center justify-between hover:bg-neutral-800 text-left cursor-pointer"
                      >
                        <span>Quality</span>
                        <span className="text-xs text-amber-500 font-mono">{quality}</span>
                      </button>
                    </div>
                  ) : showSpeedMenu ? (
                    <div>
                      <div className="px-4 py-1.5 text-xs text-gray-400 font-bold border-b border-gray-800 flex items-center justify-between">
                        <span>Speed</span>
                        <button onClick={() => setShowSpeedMenu(false)} className="text-amber-500 cursor-pointer">Back</button>
                      </div>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            changeSpeed(s);
                            setShowSettingsMenu(false);
                          }}
                          className="w-full px-4 py-2 flex items-center justify-between hover:bg-neutral-800 text-left text-xs cursor-pointer"
                        >
                          <span>{s === 1 ? 'Normal (1x)' : `${s}x`}</span>
                          {playbackRate === s && <Check className="w-3.5 h-3.5 text-amber-500" />}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <div className="px-4 py-1.5 text-xs text-gray-400 font-bold border-b border-gray-800 flex items-center justify-between">
                        <span>Quality</span>
                        <button onClick={() => setShowQualityMenu(false)} className="text-amber-500 cursor-pointer">Back</button>
                      </div>
                      {qualities.map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            changeQuality(q);
                            setShowSettingsMenu(false);
                          }}
                          className="w-full px-4 py-2 flex items-center justify-between hover:bg-neutral-800 text-left text-xs cursor-pointer"
                        >
                          <span>{q}</span>
                          {quality === q && <Check className="w-3.5 h-3.5 text-amber-500" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              className={`p-2 rounded-lg hover:bg-white/15 ${isPiP ? "text-amber-400 bg-white/15" : "text-gray-300 hover:text-white"} transition-colors cursor-pointer hidden sm:block`}
              title={isPiP ? "Exit Picture in Picture" : "Picture in Picture"}
            >
              <PictureInPicture2 className="w-5 h-5" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              id="player-fullscreen-btn"
              className="p-2 rounded-lg hover:bg-white/15 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsHelp && (
        <div 
          onClick={() => setShowShortcutsHelp(false)}
          className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#181818] border border-gray-800 rounded-xl p-5 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
              <h4 className="text-sm font-bold flex items-center gap-2 text-amber-500">
                <Keyboard className="w-4 h-4" /> Keyboard Shortcuts
              </h4>
              <button 
                onClick={() => setShowShortcutsHelp(false)}
                className="text-gray-400 hover:text-white text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between p-1.5 rounded bg-neutral-900 border border-gray-800"><kbd className="font-mono text-amber-400">Space</kbd> <span>Play / Pause</span></div>
              <div className="flex justify-between p-1.5 rounded bg-neutral-900 border border-gray-800"><kbd className="font-mono text-amber-400">F</kbd> <span>Fullscreen</span></div>
              <div className="flex justify-between p-1.5 rounded bg-neutral-900 border border-gray-800"><kbd className="font-mono text-amber-400">J</kbd> <span>Rewind 10s</span></div>
              <div className="flex justify-between p-1.5 rounded bg-neutral-900 border border-gray-800"><kbd className="font-mono text-amber-400">L</kbd> <span>Forward 10s</span></div>
              <div className="flex justify-between p-1.5 rounded bg-neutral-900 border border-gray-800"><kbd className="font-mono text-amber-400">← / →</kbd> <span>Seek 5s</span></div>
              <div className="flex justify-between p-1.5 rounded bg-neutral-900 border border-gray-800"><kbd className="font-mono text-amber-400">↑ / ↓</kbd> <span>Volume</span></div>
              <div className="flex justify-between p-1.5 rounded bg-neutral-900 border border-gray-800"><kbd className="font-mono text-amber-400">M</kbd> <span>Mute</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
