import React from 'react';

interface ShortsProgressBarProps {
  progress: number; // 0 to 100
  className?: string;
}

export const ShortsProgressBar: React.FC<ShortsProgressBarProps> = ({
  progress,
  className = ''
}) => {
  const safeProgress = Math.min(100, Math.max(0, isNaN(progress) ? 0 : progress));

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30 overflow-hidden select-none pointer-events-none ${className}`}
    >
      <div
        className="h-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] transition-all duration-100 ease-linear rounded-r-full"
        style={{ width: `${safeProgress}%` }}
      />
    </div>
  );
};

export default ShortsProgressBar;
