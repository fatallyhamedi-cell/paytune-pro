import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  ExternalLink,
  SkipForward,
  Info
} from "lucide-react";

export interface ActiveAd {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  click_url?: string;
  duration_seconds: number;
  advertiser_name: string;
  skip_offset_seconds: number;
}

interface PreRollAdProps {
  ad: ActiveAd;
  videoId: string;
  onAdEnded: () => void;
  onAdSkipped: () => void;
}

export const PreRollAd: React.FC<PreRollAdProps> = ({
  ad,
  videoId,
  onAdEnded,
  onAdSkipped
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(ad.duration_seconds || 15);
  const [skipCountdown, setSkipCountdown] = useState(ad.skip_offset_seconds || 5);
  const [canSkip, setCanSkip] = useState(false);
  const [impressionId, setImpressionId] = useState<string | null>(null);
  const lastReportedTime = useRef<number>(0);

  // Record impression on ad start
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    axios
      .post("/api/ads/impression", {
        ad_id: ad.id,
        video_id: videoId,
        country: "Rwanda",
        device: isMobile ? "mobile" : "desktop"
      })
      .then((res) => {
        if (res.data?.impression_id) {
          setImpressionId(res.data.impression_id);
        }
      })
      .catch((err) => {
        console.error("Failed to record ad impression:", err);
      });
  }, [ad.id, videoId]);

  // Attempt autoPlay with sound
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // If unmuted autoplay blocked by browser policy, fallback to muted autoplay
        if (videoRef.current) {
          videoRef.current.muted = true;
          setIsMuted(true);
          videoRef.current.play().catch(() => setIsPlaying(false));
        }
      });
    }
  }, [ad.video_url]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
      setDuration(videoRef.current.duration);
    }

    // Update 5-second skip countdown
    const skipOffset = ad.skip_offset_seconds || 5;
    const remaining = Math.max(0, Math.ceil(skipOffset - cur));
    setSkipCountdown(remaining);
    if (remaining === 0 && !canSkip) {
      setCanSkip(true);
    }

    // Report watch progress periodically (every 3 seconds)
    if (impressionId && Math.floor(cur) > lastReportedTime.current + 2) {
      lastReportedTime.current = Math.floor(cur);
      axios
        .post("/api/ads/progress", {
          impression_id: impressionId,
          watched_seconds: Math.floor(cur)
        })
        .catch(() => {});
    }
  };

  const handleEnded = () => {
    if (impressionId) {
      axios
        .post("/api/ads/progress", {
          impression_id: impressionId,
          watched_seconds: Math.floor(currentTime)
        })
        .catch(() => {});
    }
    onAdEnded();
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canSkip) return;

    if (impressionId) {
      axios
        .post("/api/ads/progress", {
          impression_id: impressionId,
          watched_seconds: Math.floor(currentTime)
        })
        .catch(() => {});
    }
    onAdSkipped();
  };

  const handleClickAd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ad.click_url) {
      axios
        .post("/api/ads/click", {
          impression_id: impressionId,
          ad_id: ad.id
        })
        .catch(() => {});
      window.open(ad.click_url, "_blank", "noopener,noreferrer");
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const secondsLeft = Math.max(0, Math.ceil(duration - currentTime));

  return (
    <div
      id="preroll-ad-overlay"
      className="absolute inset-0 z-30 bg-black flex items-center justify-center select-none overflow-hidden"
    >
      {/* Ad Video Stream */}
      <video
        ref={videoRef}
        src={ad.video_url}
        poster={ad.thumbnail_url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onClick={togglePlay}
        playsInline
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Top Banner: Ad identification */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500 text-neutral-950 font-black text-xs uppercase tracking-wider shadow-md">
          <span>Ad</span>
          <span className="text-neutral-900 font-normal opacity-80">• 1 of 1</span>
        </div>
        <div className="bg-black/70 backdrop-blur-md px-3 py-1 rounded-md border border-neutral-700/60 text-white text-xs font-medium flex items-center gap-2 shadow-md">
          <span className="font-semibold text-amber-400">{ad.advertiser_name}</span>
          <span className="text-neutral-400 text-[11px] hidden sm:inline">({secondsLeft}s)</span>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="absolute bottom-0 inset-x-0 z-40 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 flex flex-col gap-3">
        {/* Progress bar */}
        <div className="w-full bg-neutral-800/80 h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          {/* Left: Play/Pause, Mute & Advertiser Link */}
          <div className="flex items-center gap-3">
            <button
              id="btn-ad-play-pause"
              onClick={togglePlay}
              className="p-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-white transition-colors cursor-pointer"
              title={isPlaying ? "Pause Ad" : "Play Ad"}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            <button
              id="btn-ad-volume-toggle"
              onClick={toggleMute}
              className="p-2 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-white transition-colors cursor-pointer"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {ad.click_url && (
              <button
                id="btn-ad-visit-advertiser"
                onClick={handleClickAd}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/10 transition-all cursor-pointer"
              >
                <span>Visit Advertiser</span>
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              </button>
            )}
          </div>

          {/* Right: Skip Ad / Countdown Pill */}
          <div>
            {canSkip ? (
              <button
                id="btn-ad-skip"
                onClick={handleSkip}
                className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg transition-all transform active:scale-95 cursor-pointer"
              >
                <span>Skip Ad</span>
                <SkipForward className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            ) : (
              <div
                id="ad-skip-countdown-pill"
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-black/80 backdrop-blur-md border border-neutral-700/60 text-neutral-300 text-xs font-semibold shadow-md"
              >
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <span>Skip in {skipCountdown}s</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
