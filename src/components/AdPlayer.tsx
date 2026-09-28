import React from 'react';
import { PreRollAd, ActiveAd } from './PreRollAd';

export type { ActiveAd };

export interface AdPlayerProps {
  ad?: ActiveAd;
  videoId?: string;
  onAdEnded?: () => void;
  onAdSkipped?: () => void;
  [key: string]: any;
}

export const AdPlayer: React.FC<AdPlayerProps> = ({
  ad,
  videoId = '',
  onAdEnded = () => {},
  onAdSkipped = () => {},
  ...props
}) => {
  if (!ad) return null;
  return (
    <PreRollAd
      ad={ad}
      videoId={videoId}
      onAdEnded={onAdEnded}
      onAdSkipped={onAdSkipped}
      {...props}
    />
  );
};

export default AdPlayer;
