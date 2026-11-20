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
    <progress
      value={safeProgress}
      max={100}
      className={`absolute bottom-0 left-0 right-0 w-full h-1 z-30 overflow-hidden select-none pointer-events-none appearance-none [&::-webkit-progress-bar]:bg-white/20 [&::-webkit-progress-value]:bg-purple-400 [&::-moz-progress-bar]:bg-purple-400 ${className}`}
    />
  );
};

export default ShortsProgressBar;
