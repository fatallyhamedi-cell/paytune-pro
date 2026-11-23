export type MediaInspectionCategory = 'video' | 'audio' | 'image' | 'caption';

const MAX_SIZE_BYTES: Record<MediaInspectionCategory, number> = {
  image: 15 * 1024 * 1024,
  audio: 150 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  caption: 2 * 1024 * 1024,
};

function resolveAuthToken(url: string): string | null {
  if (typeof window === 'undefined') return null;
  const isMaster = url.includes('/master') || window.location.pathname.startsWith('/master');
  let token = isMaster
    ? localStorage.getItem('master_token') ||
      localStorage.getItem('paytune_master_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('paytune_auth_token')
    : localStorage.getItem('artist_token') ||
      localStorage.getItem('paytune_artist_token') ||
      localStorage.getItem('paytune_auth_token') ||
      localStorage.getItem('token');

  if (!token) {
    try {
      const raw = localStorage.getItem('paytune_supabase_auth');
      if (raw) {
        const parsed = JSON.parse(raw);
        token = parsed?.access_token || parsed?.currentSession?.access_token || null;
      }
    } catch {}
  }

  if (!token) return null;
  token = String(token).replace(/^"|"$/g, '').replace(/\s/g, '');
  if (token.startsWith('Bearer ')) token = token.slice(7);
  return token;
}

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const isBrowser = typeof window !== 'undefined';
  const isRemotePreview =
    isBrowser && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const configuredUrl = (import.meta as any).env?.VITE_API_URL || '';
  const base = isRemotePreview ? '' : configuredUrl;
  const cleanPath = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  return base ? `${base}${cleanPath}` : cleanPath;
}

function startsWithBytes(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((b, idx) => bytes[idx] === b);
}

function matchesAsciiAt(bytes: Uint8Array, offset: number, ascii: string): boolean {
  if (bytes.length < offset + ascii.length) return false;
  for (let i = 0; i < ascii.length; i++) {
    if (bytes[offset + i] !== ascii.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Inspects file header magic bytes client-side so fake/corrupt files are caught immediately before upload.
 */
export async function inspectFileSignature(
  file: File,
  category: MediaInspectionCategory
): Promise<{ valid: boolean; error?: string }> {
  if (!file || file.size <= 0) {
    return { valid: false, error: 'Selected file is empty.' };
  }
  if (file.size > MAX_SIZE_BYTES[category]) {
    const mb = Math.round(MAX_SIZE_BYTES[category] / (1024 * 1024));
    return { valid: false, error: `File exceeds the ${mb} MB limit for ${category} uploads.` };
  }

  const sliceSize = category === 'caption' ? 256 : 32;
  const buf = await file.slice(0, sliceSize).arrayBuffer();
  const bytes = new Uint8Array(buf);

  if (category === 'image') {
    const isJpeg = startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
    const isPng = startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47]);
    const isGif = matchesAsciiAt(bytes, 0, 'GIF8');
    const isWebp = matchesAsciiAt(bytes, 0, 'RIFF') && matchesAsciiAt(bytes, 8, 'WEBP');
    const isAvif = matchesAsciiAt(bytes, 4, 'ftyp');
    if (!isJpeg && !isPng && !isGif && !isWebp && !isAvif) {
      return { valid: false, error: 'Invalid image signature. Upload a valid JPG, PNG, WebP, or GIF image.' };
    }
    return { valid: true };
  }

  if (category === 'audio') {
    const isId3 = matchesAsciiAt(bytes, 0, 'ID3');
    const isMp3Sync = bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
    const isWav = matchesAsciiAt(bytes, 0, 'RIFF') && matchesAsciiAt(bytes, 8, 'WAVE');
    const isOgg = matchesAsciiAt(bytes, 0, 'OggS');
    const isFlac = matchesAsciiAt(bytes, 0, 'fLaC');
    const isM4a = matchesAsciiAt(bytes, 4, 'ftyp');
    const isWebm = startsWithBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
    if (!isId3 && !isMp3Sync && !isWav && !isOgg && !isFlac && !isM4a && !isWebm) {
      return { valid: false, error: 'Unsupported or corrupted audio file. Upload MP3, WAV, M4A, OGG, or FLAC.' };
    }
    return { valid: true };
  }

  if (category === 'video') {
    const isMp4 = matchesAsciiAt(bytes, 4, 'ftyp');
    const isWebm = startsWithBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
    const isAvi = matchesAsciiAt(bytes, 0, 'RIFF') && matchesAsciiAt(bytes, 8, 'AVI ');
    const isOgg = matchesAsciiAt(bytes, 0, 'OggS');
    if (!isMp4 && !isWebm && !isAvi && !isOgg) {
      return { valid: false, error: 'Unsupported or corrupted video container. Upload MP4, MOV, or WebM.' };
    }
    return { valid: true };
  }

  // Captions (.vtt / .srt)
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext !== 'vtt' && ext !== 'srt') {
    return { valid: false, error: 'Subtitles must be .vtt (WebVTT) or .srt files.' };
  }
  const textSample = new TextDecoder().decode(bytes).replace(/^\uFEFF/, '').trim();
  const hasBinaryZero = bytes.includes(0);
  if (hasBinaryZero || (!textSample.toUpperCase().startsWith('WEBVTT') && !/^\d+\s*\r?\n/.test(textSample))) {
    return { valid: false, error: 'Invalid subtitle structure. Expected WEBVTT header or numbered SRT cues.' };
  }
  return { valid: true };
}

export interface VideoProbeResult {
  durationSeconds: number;
  width: number;
  height: number;
  aspectRatio: number;
  isVertical: boolean;
  frameBlob: Blob | null;
  frameDataUrl: string | null;
}

/**
 * Extracts real dimensions, duration, and a captured JPEG poster frame using HTMLVideoElement + Canvas.
 */
export async function extractVideoMetadataAndFrame(
  file: File,
  seekSeconds = 1
): Promise<VideoProbeResult> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not decode video metadata in browser.'));
    });

    const durationSeconds = Math.max(0, Math.round(video.duration || 0));
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    const aspectRatio = height > 0 ? width / height : 16 / 9;
    const isVertical = width > 0 && height > 0 ? aspectRatio <= 0.78 : false;

    let frameBlob: Blob | null = null;
    let frameDataUrl: string | null = null;

    try {
      const targetTime = Math.min(Math.max(0.1, seekSeconds), Math.max(0.1, (video.duration || 1) - 0.1));
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 1500);
        video.onseeked = () => {
          clearTimeout(timeout);
          resolve();
        };
        video.currentTime = targetTime;
      });

      if (width > 0 && height > 0) {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1280 / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frameDataUrl = canvas.toDataURL('image/jpeg', 0.88);
          frameBlob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
        }
      }
    } catch {
      // Frame capture optional if codec restricts seek draw
    }

    return { durationSeconds, width, height, aspectRatio, isVertical, frameBlob, frameDataUrl };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export interface AudioAnalysisResult {
  durationSeconds: number;
  waveformPeaks: number[];
}

/**
 * Computes exact duration and 48 normalized waveform amplitude bars using Web Audio API.
 */
export async function analyzeAudioFile(file: File): Promise<AudioAnalysisResult> {
  const barCount = 48;
  let durationSeconds = 0;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx && file.size <= 80 * 1024 * 1024) {
      const ctx = new AudioCtx();
      try {
        const arrayBuf = await file.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
        durationSeconds = Math.max(1, Math.round(audioBuf.duration || 0));
        const channelData = audioBuf.getChannelData(0);
        const blockSize = Math.max(1, Math.floor(channelData.length / barCount));
        const rawPeaks: number[] = [];
        let maxPeak = 0.001;
        for (let i = 0; i < barCount; i++) {
          const start = i * blockSize;
          let sum = 0;
          const end = Math.min(channelData.length, start + blockSize);
          for (let j = start; j < end; j += Math.max(1, Math.floor(blockSize / 64))) {
            const val = Math.abs(channelData[j]);
            if (val > sum) sum = val;
          }
          if (sum > maxPeak) maxPeak = sum;
          rawPeaks.push(sum);
        }
        const waveformPeaks = rawPeaks.map((p) => Math.max(0.12, Math.min(1, p / maxPeak)));
        return { durationSeconds, waveformPeaks };
      } finally {
        ctx.close().catch(() => {});
      }
    }
  } catch {
    // Fall back cleanly to HTMLAudioElement metadata below
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => reject(new Error('Could not read audio duration'));
    });
    durationSeconds = Math.max(1, Math.round(audio.duration || 0));
  } catch {
    durationSeconds = 0;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const fallbackPeaks = Array.from({ length: barCount }, (_, i) =>
    Number((0.25 + 0.55 * Math.abs(Math.sin(i * 0.45 + 0.7))).toFixed(2))
  );
  return { durationSeconds, waveformPeaks: fallbackPeaks };
}

export interface UploadProgressInfo {
  percent: number;
  loadedBytes: number;
  totalBytes: number;
}

export function uploadWithProgress<T = any>({
  url,
  formData,
  method = 'POST',
  onProgress,
  signal,
}: {
  url: string;
  formData: FormData;
  method?: 'POST' | 'PUT';
  onProgress?: (info: UploadProgressInfo) => void;
  signal?: AbortSignal;
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const targetUrl = resolveApiUrl(url);
    const xhr = new XMLHttpRequest();
    xhr.open(method, targetUrl, true);
    xhr.withCredentials = true;

    const token = resolveAuthToken(targetUrl);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    const abortHandler = () => {
      xhr.abort();
      reject(new DOMException('Upload cancelled by user', 'AbortError'));
    };

    if (signal) {
      if (signal.aborted) {
        return reject(new DOMException('Upload cancelled by user', 'AbortError'));
      }
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        const percent = Math.min(100, Math.round((ev.loaded / ev.total) * 100));
        onProgress({ percent, loadedBytes: ev.loaded, totalBytes: ev.total });
      }
    };

    xhr.onload = () => {
      if (signal) signal.removeEventListener('abort', abortHandler);
      let parsed: any = null;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        parsed = { message: xhr.responseText };
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed as T);
      } else {
        const msg = parsed?.error || parsed?.message || `Upload failed with status ${xhr.status}`;
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => {
      if (signal) signal.removeEventListener('abort', abortHandler);
      reject(new Error('Network error occurred while uploading media.'));
    };

    xhr.send(formData);
  });
}
