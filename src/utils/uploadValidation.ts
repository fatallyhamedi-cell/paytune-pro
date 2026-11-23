import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';

export type MediaCategory = 'video' | 'audio' | 'image' | 'caption';

export interface MediaValidationResult {
  valid: boolean;
  error?: string;
  normalizedExt: string;
  detectedType: string;
}

const MAX_BYTES: Record<MediaCategory, number> = {
  image: 15 * 1024 * 1024,
  audio: 150 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  caption: 2 * 1024 * 1024,
};

const ALLOWED_EXTS: Record<MediaCategory, Set<string>> = {
  image: new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']),
  audio: new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus', '.webm']),
  video: new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv']),
  caption: new Set(['.vtt', '.srt']),
};

function hasPrefixBytes(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

function hasAscii(buf: Buffer, text: string, offset = 0): boolean {
  if (buf.length < offset + text.length) return false;
  return buf.subarray(offset, offset + text.length).toString('ascii') === text;
}

function detectMagicType(buf: Buffer, category: MediaCategory, ext: string): string | null {
  if (!buf || buf.length < 4) return null;

  if (category === 'image') {
    if (hasPrefixBytes(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
    if (hasPrefixBytes(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
    if (hasAscii(buf, 'GIF87a') || hasAscii(buf, 'GIF89a')) return 'image/gif';
    if (hasAscii(buf, 'RIFF', 0) && hasAscii(buf, 'WEBP', 8)) return 'image/webp';
    if (hasAscii(buf, 'ftyp', 4)) {
      const brand = buf.subarray(8, 12).toString('ascii').toLowerCase();
      if (brand.startsWith('avif') || brand.startsWith('avis') || brand.startsWith('heic') || brand.startsWith('mif1')) {
        return 'image/avif';
      }
    }
    return null;
  }

  if (category === 'video') {
    // ISO Base Media (MP4 / MOV / M4V)
    if (hasAscii(buf, 'ftyp', 4) || hasAscii(buf, 'moov', 4) || hasAscii(buf, 'mdat', 4) || hasAscii(buf, 'wide', 4) || hasAscii(buf, 'free', 4)) {
      return ext === '.mov' ? 'video/quicktime' : 'video/mp4';
    }
    // EBML header (WebM / Matroska)
    if (hasPrefixBytes(buf, [0x1a, 0x45, 0xdf, 0xa3])) {
      return ext === '.mkv' ? 'video/x-matroska' : 'video/webm';
    }
    return null;
  }

  if (category === 'audio') {
    if (hasAscii(buf, 'ID3')) return 'audio/mpeg';
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'audio/mpeg'; // MP3 / ADTS AAC sync word
    if (hasAscii(buf, 'RIFF', 0) && hasAscii(buf, 'WAVE', 8)) return 'audio/wav';
    if (hasAscii(buf, 'OggS')) return 'audio/ogg';
    if (hasAscii(buf, 'fLaC')) return 'audio/flac';
    if (hasAscii(buf, 'ftyp', 4)) return 'audio/mp4'; // M4A
    if (hasPrefixBytes(buf, [0x1a, 0x45, 0xdf, 0xa3])) return 'audio/webm';
    return null;
  }

  if (category === 'caption') {
    // Reject binary files containing NUL bytes
    const sample = buf.subarray(0, Math.min(buf.length, 2048));
    if (sample.includes(0x00)) return null;
    const text = buf.toString('utf8', 0, Math.min(buf.length, 4096)).replace(/^\uFEFF/, '').trimStart();
    if (ext === '.vtt' || /^WEBVTT\b/i.test(text)) return 'text/vtt';
    if (ext === '.srt' || /\d{2}:\d{2}:\d{2}[,.]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(text)) {
      return 'application/x-subrip';
    }
    return null;
  }

  return null;
}

export function validateUploadedMedia(
  file: Pick<Express.Multer.File, 'originalname' | 'mimetype' | 'size' | 'buffer'>,
  category: MediaCategory
): MediaValidationResult {
  if (!file || !file.buffer || file.buffer.length === 0) {
    return { valid: false, error: 'Uploaded file is empty.', normalizedExt: '', detectedType: '' };
  }

  const maxSize = MAX_BYTES[category];
  if (file.size > maxSize) {
    const mb = Math.round(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `File exceeds maximum allowed ${category} size of ${mb} MB.`,
      normalizedExt: '',
      detectedType: '',
    };
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase();

  if (ext && !ALLOWED_EXTS[category].has(ext)) {
    return {
      valid: false,
      error: `Unsupported ${category} file extension "${ext}".`,
      normalizedExt: ext,
      detectedType: mime,
    };
  }

  // Allow application/octet-stream from mobile browsers as long as magic bytes pass
  if (
    mime &&
    mime !== 'application/octet-stream' &&
    category !== 'caption' &&
    !mime.startsWith(`${category}/`)
  ) {
    return {
      valid: false,
      error: `Invalid MIME type "${mime}" for ${category} upload.`,
      normalizedExt: ext,
      detectedType: mime,
    };
  }

  const detectedType = detectMagicType(file.buffer, category, ext);
  if (!detectedType) {
    return {
      valid: false,
      error: `Uploaded ${category} file failed binary signature verification. Please upload a valid uncorrupted file.`,
      normalizedExt: ext,
      detectedType: mime || 'unknown',
    };
  }

  const fallbackExt: Record<MediaCategory, string> = {
    image: '.jpg',
    audio: '.mp3',
    video: '.mp4',
    caption: detectedType === 'text/vtt' ? '.vtt' : '.srt',
  };

  return {
    valid: true,
    normalizedExt: ext || fallbackExt[category],
    detectedType,
  };
}

export function extractStorageLocation(
  urlOrPath?: string | null,
  fallbackBucket?: string
): { bucket: string; path: string } | null {
  if (!urlOrPath || typeof urlOrPath !== 'string') return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  const marker = '/object/public/';
  const idx = trimmed.indexOf(marker);
  if (idx >= 0) {
    const remainder = trimmed.slice(idx + marker.length).split('?')[0];
    const slashIdx = remainder.indexOf('/');
    if (slashIdx > 0) {
      return {
        bucket: remainder.slice(0, slashIdx),
        path: decodeURIComponent(remainder.slice(slashIdx + 1)),
      };
    }
  }

  if (fallbackBucket && !/^https?:\/\//i.test(trimmed)) {
    return {
      bucket: fallbackBucket,
      path: trimmed.replace(/^\/+/, ''),
    };
  }

  return null;
}

export async function deleteStorageObject(
  client: SupabaseClient | null | undefined,
  urlOrPath?: string | null,
  fallbackBucket?: string
): Promise<boolean> {
  if (!client) return false;
  const loc = extractStorageLocation(urlOrPath, fallbackBucket);
  if (!loc || !loc.bucket || !loc.path) return false;
  try {
    const { error } = await client.storage.from(loc.bucket).remove([loc.path]);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteStorageObjects(
  client: SupabaseClient | null | undefined,
  items: Array<{ bucket?: string; path?: string | null; url?: string | null }>
): Promise<void> {
  if (!client || items.length === 0) return;
  const byBucket = new Map<string, Set<string>>();

  for (const item of items) {
    const loc =
      item.path && item.bucket && !/^https?:\/\//i.test(item.path)
        ? { bucket: item.bucket, path: item.path }
        : extractStorageLocation(item.url || item.path, item.bucket);
    if (loc && loc.bucket && loc.path) {
      if (!byBucket.has(loc.bucket)) byBucket.set(loc.bucket, new Set());
      byBucket.get(loc.bucket)!.add(loc.path);
    }
  }

  await Promise.allSettled(
    Array.from(byBucket.entries()).map(([bucket, paths]) =>
      client.storage.from(bucket).remove(Array.from(paths))
    )
  );
}
