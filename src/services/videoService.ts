import { supabaseAdmin } from '../config/supabase';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

/**
 * Write a buffer to a temp file
 */
export const bufferToTempFile = (buffer: Buffer, ext: string): string => {
  const filePath = path.join(os.tmpdir(), `${crypto.randomUUID()}${ext}`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
};

/**
 * Get video duration in seconds via ffprobe
 */
export const getVideoDuration = (filePath: string): Promise<number> => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata) {
        console.warn('ffprobe duration detection warning, defaulting:', err?.message);
        return resolve(0);
      }
      const dur = Math.round(metadata.format?.duration || 0);
      resolve(dur);
    });
  });
};

/**
 * Generate a 30-second preview clip via FFmpeg
 */
export const generatePreview = (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(0)
      .setDuration(30)
      .output(outputPath)
      .outputOptions('-c copy') // Fast copy when possible
      .on('end', () => resolve())
      .on('error', (err) => {
        // Retry with transcoding if copy fails due to container codecs
        ffmpeg(inputPath)
          .setStartTime(0)
          .setDuration(30)
          .videoCodec('libx264')
          .audioCodec('aac')
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', reject)
          .run();
      })
      .run();
  });
};

/**
 * Extract a thumbnail frame at 3 seconds via FFmpeg
 */
export const extractThumbnail = (inputPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: ['3'],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '1280x720'
      })
      .on('end', () => resolve())
      .on('error', (err) => {
        // Fallback to timestamp 0 if video is shorter than 3s
        ffmpeg(inputPath)
          .screenshots({
            timestamps: ['0.5'],
            filename: path.basename(outputPath),
            folder: path.dirname(outputPath),
            size: '1280x720'
          })
          .on('end', () => resolve())
          .on('error', reject);
      });
  });
};

/**
 * Validate Shorts: 9:16 vertical aspect ratio + <= 50 seconds
 */
export const validateShort = async (filePath: string): Promise<{ width: number; height: number; duration: number }> => {
  const metadata = await new Promise<ffmpeg.FfprobeData>((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  const videoStream = metadata.streams?.find((s) => s.codec_type === 'video');
  if (!videoStream) {
    throw new Error('No video stream found in uploaded file');
  }

  const width = videoStream.width || 0;
  const height = videoStream.height || 0;
  const duration = metadata.format?.duration || 0;

  if (duration > 50) {
    throw new Error('Shorts must be 50 seconds or less in duration');
  }

  if (height > 0 && width > 0) {
    const aspectRatio = width / height;
    // 9:16 is 0.5625; allow up to 0.75 for slight vertical variations
    if (aspectRatio > 0.75) {
      throw new Error('Shorts must be vertical (9:16 aspect ratio)');
    }
  }

  return { width, height, duration: Math.round(duration) };
};

/**
 * Upload a file buffer to Supabase Storage bucket
 */
export const uploadToStorage = async (
  bucket: string,
  fileName: string,
  buffer: Buffer,
  contentType: string
): Promise<string> => {
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(fileName, buffer, {
      contentType,
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.warn(`[Supabase Storage] Warning uploading to ${bucket}: ${error.message}`);
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(fileName);

  return urlData?.publicUrl || `/uploads/${path.basename(fileName)}`;
};

export interface ProcessVideoParams {
  videoBuffer: Buffer;
  thumbnailBuffer?: Buffer | null;
  originalName: string;
  artistId: string;
  metadata: {
    is_short?: boolean;
  };
}

/**
 * Full video processing pipeline:
 * 1. Validate Short requirements if applicable (9:16 aspect ratio & <=50s)
 * 2. Calculate true video duration
 * 3. Generate 30-second preview clip
 * 4. Generate or utilize thumbnail
 * 5. Upload all assets into Supabase Storage buckets (videos, previews, thumbnails)
 */
export const processAndUploadVideo = async ({
  videoBuffer,
  thumbnailBuffer,
  originalName,
  artistId,
  metadata
}: ProcessVideoParams): Promise<{
  video_url: string;
  preview_url: string;
  thumbnail_url: string;
  duration: number;
}> => {
  const ext = path.extname(originalName) || '.mp4';
  const videoTempPath = bufferToTempFile(videoBuffer, ext);

  let previewTempPath: string | null = null;
  let thumbTempPath: string | null = null;

  try {
    // 1. If Short, validate 9:16 + <=50s
    if (metadata.is_short === true) {
      await validateShort(videoTempPath);
    }

    // 2. Duration extraction
    let duration = await getVideoDuration(videoTempPath);
    if (!duration || duration <= 0) {
      duration = metadata.is_short ? 45 : 240;
    }

    // 3. Generate 30-second preview
    previewTempPath = path.join(os.tmpdir(), `${crypto.randomUUID()}-preview.mp4`);
    try {
      await generatePreview(videoTempPath, previewTempPath);
    } catch (previewErr) {
      console.warn('FFmpeg preview generation notice:', previewErr);
      // Fallback: write slice or original to preview temp
      fs.writeFileSync(previewTempPath, videoBuffer);
    }
    const previewBuffer = fs.existsSync(previewTempPath) 
      ? fs.readFileSync(previewTempPath) 
      : videoBuffer;

    // 4. Thumbnail: use provided or auto-extract via FFmpeg
    let thumbBuffer: Buffer;
    let thumbExt = '.jpg';
    if (thumbnailBuffer && thumbnailBuffer.length > 0) {
      thumbBuffer = thumbnailBuffer;
      thumbExt = '.jpg';
    } else {
      thumbTempPath = path.join(os.tmpdir(), `${crypto.randomUUID()}-thumb.jpg`);
      try {
        await extractThumbnail(videoTempPath, thumbTempPath);
        thumbBuffer = fs.readFileSync(thumbTempPath);
      } catch (thumbErr) {
        console.warn('FFmpeg thumbnail extraction notice:', thumbErr);
        thumbBuffer = Buffer.from('');
      }
    }

    // 5. Upload to Supabase Storage
    const stamp = Date.now();
    const safeName = crypto.randomUUID().slice(0, 8);

    const videoUrl = await uploadToStorage(
      'videos',
      `${artistId}/${stamp}-${safeName}${ext}`,
      videoBuffer,
      'video/mp4'
    );

    const previewUrl = await uploadToStorage(
      'previews',
      `${artistId}/${stamp}-${safeName}-preview.mp4`,
      previewBuffer,
      'video/mp4'
    );

    let thumbnailUrl = '';
    if (thumbBuffer && thumbBuffer.length > 0) {
      thumbnailUrl = await uploadToStorage(
        'thumbnails',
        `${artistId}/${stamp}-${safeName}-thumb${thumbExt}`,
        thumbBuffer,
        'image/jpeg'
      );
    } else {
      thumbnailUrl = videoUrl; // Fallback
    }

    return {
      video_url: videoUrl,
      preview_url: previewUrl,
      thumbnail_url: thumbnailUrl,
      duration
    };
  } finally {
    // Cleanup temporary files
    [videoTempPath, previewTempPath, thumbTempPath].forEach((p) => {
      try {
        if (p && fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
    });
  }
};
