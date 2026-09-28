import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart } from 'lucide-react';

interface ShortsLikeAnimationProps {
  show: boolean;
  onAnimationComplete?: () => void;
  x?: number;
  y?: number;
}

export const ShortsLikeAnimation: React.FC<ShortsLikeAnimationProps> = ({
  show,
  onAnimationComplete,
  x,
  y
}) => {
  return (
    <AnimatePresence>
      {show && (
        <div 
          className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center overflow-hidden"
          style={x !== undefined && y !== undefined ? { position: 'absolute' } : undefined}
        >
          <motion.div
            initial={{ scale: 0.2, opacity: 0, rotate: -15 }}
            animate={{
              scale: [0.2, 1.4, 1.1, 1.25],
              opacity: [0, 1, 1, 0],
              rotate: [ -15, 0, 8, 0 ],
              y: [0, -10, -30, -50]
            }}
            transition={{
              duration: 0.85,
              ease: [0.175, 0.885, 0.32, 1.275]
            }}
            onAnimationComplete={onAnimationComplete}
            className="flex items-center justify-center filter drop-shadow-[0_4px_16px_rgba(239,68,68,0.7)]"
          >
            <div className="relative">
              <Heart className="w-28 h-28 text-red-500 fill-red-500 animate-pulse" />
              <motion.div
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-20 h-20 rounded-full border-4 border-amber-400/80" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ShortsLikeAnimation;
