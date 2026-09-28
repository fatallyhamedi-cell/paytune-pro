import { useState } from 'react';
import axios from 'axios';

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
    setProgress(0);
    setError(null);
    setSuccess(false);

    try {
      // 1. Validation
      if (!payload.title?.trim()) {
        throw new Error('Please provide a title for your release.');
      }

      // 2. Shorts Validation: max 50 seconds, 9:16 aspect ratio
      if (payload.is_short) {
        if (payload.duration && payload.duration > 50) {
          throw new Error('Shorts must be 50 seconds or less in duration.');
        }
        if (payload.aspect_ratio && payload.aspect_ratio !== '9:16' && payload.aspect_ratio !== 'vertical') {
          throw new Error('Shorts must have a vertical 9:16 aspect ratio.');
        }
      }

      // 3. Price validation
      if (!payload.is_free && (!payload.price_rwf || payload.price_rwf < 100)) {
        throw new Error('Paid releases must have a minimum price of 100 RWF.');
      }

      // 4. Prepare FormData or JSON
      const formData = new FormData();
      formData.append('title', payload.title);
      formData.append('description', payload.description || '');
      formData.append('category', payload.category || 'Afrobeat');
      formData.append('is_free', String(payload.is_free));
      formData.append('price_rwf', String(payload.is_free ? 0 : payload.price_rwf));
      formData.append('price_usd', String(payload.is_free ? 0 : (payload.price_usd || Math.round(payload.price_rwf / 1400))));
      formData.append('visibility', payload.visibility || 'public');
      formData.append('is_short', String(payload.is_short));
      formData.append('duration', String(payload.duration || (payload.is_short ? 45 : 240)));
      if (payload.tags && payload.tags.length > 0) {
        formData.append('tags', payload.tags.join(','));
      }

      if (payload.videoFile) {
        formData.append('video', payload.videoFile);
      }
      if (payload.thumbnailFile) {
        formData.append('thumbnail', payload.thumbnailFile);
      }
      if (payload.video_url) {
        formData.append('video_url', payload.video_url);
      }
      if (payload.thumbnail_url) {
        formData.append('thumbnail_url', payload.thumbnail_url);
      }

      // 5. Send with upload progress tracking
      const res = await axios.post('/api/artist/video/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(Math.min(95, percentCompleted));
          } else {
            setProgress((prev) => Math.min(prev + 15, 90));
          }
        }
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

  return {
    uploadVideo,
    uploading,
    progress,
    error,
    success,
    reset
  };
}
