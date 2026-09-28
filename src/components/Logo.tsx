import React, { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface LogoProps {
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showTagline?: boolean;
  variant?: "white" | "gradient" | "dual";
}

export default function Logo({
  showWordmark = true,
  size = "md",
  className = "",
  showTagline = true,
  variant = "white"
}: LogoProps) {
  const navigate = useNavigate();

  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100%

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const triggeredRef = useRef<boolean>(false);

  const HOLD_DURATION_MS = 10000; // Exactly 10 seconds

  const clearHoldTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPressing(false);
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      clearHoldTimers();
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;

    clearHoldTimers();
    triggeredRef.current = false;
    startTimeRef.current = Date.now();
    setIsPressing(true);
    setProgress(0);

    // 10s Master Admin Easter Egg hold
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      clearHoldTimers();

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([100, 50, 100]);
        } catch {
          // ignore
        }
      }

      navigate("/master-admin/login");
    }, HOLD_DURATION_MS);

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setProgress(pct);
    }, 50);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (triggeredRef.current) {
      clearHoldTimers();
      setTimeout(() => {
        triggeredRef.current = false;
      }, 300);
      return;
    }

    clearHoldTimers();
    navigate("/");
  };

  const handlePointerLeave = () => {
    if (!triggeredRef.current) {
      clearHoldTimers();
    }
  };

  const handlePointerCancel = () => {
    clearHoldTimers();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    clearHoldTimers();
    navigate("/");
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const iconSizes = {
    sm: "w-8 h-8",
    md: "w-9 h-9 sm:w-10 sm:h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16"
  };

  const wordmarkSizes = {
    sm: "text-[18px] sm:text-[20px]",
    md: "text-[22px] sm:text-[25px]",
    lg: "text-[28px] sm:text-[32px]",
    xl: "text-[38px] sm:text-[44px]"
  };

  const taglineSizes = {
    sm: "text-[7.5px] sm:text-[8px] tracking-[0.02em]",
    md: "text-[8.5px] sm:text-[9.5px] tracking-[0.03em]",
    lg: "text-[11px] sm:text-[12px] tracking-[0.04em]",
    xl: "text-[14px] sm:text-[15px] tracking-[0.05em]"
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="PayTune Logo"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerCancel}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate("/");
        }
      }}
      className={`relative inline-flex items-center gap-2.5 sm:gap-3 group select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 rounded-2xl px-1 py-0.5 transition-transform active:scale-[0.98] ${className}`}
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        touchAction: "none"
      }}
    >
      {/* Emblem Icon */}
      <div className={`relative flex items-center justify-center shrink-0 ${iconSizes[size]}`}>
        {/* Circular Countdown Dial active during 10s hold */}
        {isPressing && progress > 0 && (
          <svg
            className="absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] pointer-events-none -rotate-90 z-20"
            viewBox="0 0 52 52"
          >
            <defs>
              <linearGradient id="pt-hold-dial" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#D946EF" />
                <stop offset="100%" stopColor="#00F2FE" />
              </linearGradient>
            </defs>
            <circle
              cx="26"
              cy="26"
              r="23"
              fill="none"
              stroke="url(#pt-hold-dial)"
              strokeWidth="2.5"
              strokeDasharray={2 * Math.PI * 23}
              strokeDashoffset={2 * Math.PI * 23 * (1 - progress / 100)}
              strokeLinecap="round"
              className="transition-all duration-75 filter drop-shadow-[0_0_8px_rgba(217,70,239,0.9)]"
            />
          </svg>
        )}

        {/* Ambient Neon Glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-fuchsia-500/25 via-transparent to-cyan-400/25 rounded-full blur-md opacity-75 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* The Signature PayTune P-Play Emblem from reference image */}
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`w-full h-full transition-all duration-300 group-hover:scale-105 filter drop-shadow-[0_4px_14px_rgba(217,70,239,0.35)] group-hover:drop-shadow-[0_6px_20px_rgba(0,242,254,0.45)] ${
            isPressing ? "scale-95" : ""
          }`}
        >
          <defs>
            {/* Vivid Magenta / Fuchsia Vertical Gradient for the P Stem */}
            <linearGradient id="pt-p-magenta" x1="19" y1="8" x2="19" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF1493" />
              <stop offset="25%" stopColor="#E026D3" />
              <stop offset="65%" stopColor="#C026D3" />
              <stop offset="100%" stopColor="#9333EA" />
            </linearGradient>

            {/* Electric Cyan / Turquoise Gradient for the P Bowl & Waves */}
            <linearGradient id="pt-p-cyan" x1="24" y1="8" x2="52" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="40%" stopColor="#00F2FE" />
              <stop offset="85%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>

            {/* Inner Play Button Cyan Gradient */}
            <linearGradient id="pt-p-play" x1="29" y1="17" x2="38" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#00F2FE" />
            </linearGradient>
          </defs>

          {/* 1. Magenta Vertical Stem with Rounded Inner Channel (the Spine of the 'P') */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M 25 8 H 18.5 C 14.91 8 12 10.91 12 14.5 V 49.5 C 12 53.09 14.91 56 18.5 56 C 22.09 56 25 53.09 25 49.5 V 8 Z M 18.5 21 C 19.88 21 21 22.12 21 23.5 V 45 C 21 46.38 19.88 47.5 18.5 47.5 C 17.12 47.5 16 46.38 16 45 V 23.5 C 16 22.12 17.12 21 18.5 21 Z"
            fill="url(#pt-p-magenta)"
          />

          {/* 2. Electric Cyan Bowl of the 'P' */}
          <path
            d="M 24.5 8 H 37.5 C 45.51 8 52 14.49 52 22.5 C 52 30.51 45.51 37 37.5 37 H 24.5 V 30.8 H 37.5 C 42.08 30.8 45.8 27.08 45.8 22.5 C 45.8 17.92 42.08 14.2 37.5 14.2 H 24.5 V 8 Z"
            fill="url(#pt-p-cyan)"
          />

          {/* 3. Centered Play Triangle inside the Cyan Loop */}
          <path
            d="M 29.5 17.2 C 29.5 16.3 30.5 15.7 31.3 16.2 L 38.8 21.5 C 39.5 22.0 39.5 23.0 38.8 23.5 L 31.3 28.8 C 30.5 29.3 29.5 28.7 29.5 27.8 Z"
            fill="url(#pt-p-play)"
          />

          {/* 4. Radiating Broadcast Audio Waves */}
          {/* Inner Wave Arc */}
          <path
            d="M 40.8 17.5 C 43.4 19.0 43.4 26.0 40.8 27.5"
            stroke="url(#pt-p-cyan)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Outer Wave Arc */}
          <path
            d="M 44.8 14.8 C 48.6 17.2 48.6 27.8 44.8 30.2"
            stroke="url(#pt-p-cyan)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeOpacity="0.85"
          />
        </svg>
      </div>

      {/* Wordmark & Tagline Lockup matching image_9ac251db.jpg */}
      {showWordmark && (
        <div className="flex flex-col justify-center select-none text-left">
          <div className="flex items-baseline leading-none">
            {variant === "gradient" ? (
              <span
                className={`${wordmarkSizes[size]} font-black tracking-[-0.01em] uppercase leading-none bg-gradient-to-b from-[#FF1493] via-[#D946EF] to-[#00F2FE] bg-clip-text text-transparent filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-all`}
                style={{
                  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                PAYTUNE
              </span>
            ) : variant === "dual" ? (
              <>
                <span
                  className={`${wordmarkSizes[size]} font-black tracking-[-0.02em] text-black dark:text-white leading-none filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-colors`}
                  style={{
                    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  Pay
                </span>
                <span
                  className={`${wordmarkSizes[size]} font-black tracking-[-0.02em] bg-gradient-to-r from-cyan-600 via-cyan-500 to-sky-500 dark:from-cyan-300 dark:via-cyan-400 dark:to-sky-400 bg-clip-text text-transparent leading-none filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-all`}
                  style={{
                    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                  }}
                >
                  Tune
                </span>
              </>
            ) : (
              /* Default Exact Match to image_9ac251db.jpg: Black in Light Mode, White in Dark Mode */
              <span
                className={`${wordmarkSizes[size]} font-black tracking-[-0.02em] text-black dark:text-white leading-none filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-colors`}
                style={{
                  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                }}
              >
                PayTune
              </span>
            )}
          </div>

          {showTagline && (
            <span
              className={`${taglineSizes[size]} font-medium text-neutral-600 dark:text-neutral-300/90 mt-1 leading-none whitespace-nowrap hidden sm:inline-block transition-colors`}
            >
              The Future of Professional Music Monetization
            </span>
          )}
        </div>
      )}
    </div>
  );
}
