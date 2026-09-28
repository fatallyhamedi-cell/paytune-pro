import { useState } from 'react';
import api from '../services/api';
import { uploadDirect } from '../services/uploadDirect';

export interface VideoUploadPayload {
  title: string;
  description: string;
  videoFile: File | null;
  thumbnailFile: File | null;
  category: string;
  price_rwf: number;
  price_usd?: number;
  is_free: boolean;
  visibility: 'public' | 'unlisted' | 'private';
  tags: string[];
  is_short: boolean;
  duration?: number;
  aspect_ratio?: string;
  video_url?: string;
  thumbnail_url?: string;
}

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const uploadVideo = async (payload: VideoUploadPayload) => {
    setUploading(true);
    setProgress(5);
    setError(null);
    setSuccess(false);

    try {
      if (!payload.title?.trim()) {
        throw new Error('Please provide a title for your release.');
      }

      if (payload.is_short) {
        if (payload.duration && payload.duration > 50) {
          throw new Error('Shorts must be 50 seconds or less in duration.');
        }
      }

      let videoUrl = payload.video_url || '';
      if (payload.videoFile) {
        setProgress(15);
        videoUrl = await uploadDirect('videos', payload.videoFile, (p) => {
          setProgress(15 + Math.round(p * 0.65));
        });
      }

      if (!videoUrl) {
        throw new Error('Please select a video file to upload.');
      }

      let thumbnailUrl = payload.thumbnail_url || null;
      if (payload.thumbnailFile) {
        thumbnailUrl = await uploadDirect('thumbnails', payload.thumbnailFile);
      }

      setProgress(90);

      const res = await api.post('/artist/video/complete', {
        videoUrl,
        thumbnailUrl,
        title: payload.title.trim(),
        description: payload.description || '',
        category: payload.category || 'Afrobeat',
        price_rwf: payload.is_free ? 0 : payload.price_rwf,
        price_usd: payload.is_free ? 0 : (payload.price_usd || Math.round((payload.price_rwf || 0) / 1400)),
        is_free: payload.is_free,
        is_short: payload.is_short,
        visibility: payload.visibility || 'public',
        media_type: payload.is_short ? 'short' : 'video',
        ownership_declared: true,
        no_ai_declared: true,
        no_copyright_declared: true,
      });

      setProgress(100);
      setSuccess(true);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Upload failed. Please try again.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setUploading(false);
    setProgress(0);
    setError(null);
    setSuccess(false);
  };

  return { uploadVideo, uploading, progress, error, success, reset };
}
