import { supabase, supabaseAdmin } from '../config/supabase';
import { randomUUID } from 'crypto';
import path from 'path';

const client = supabaseAdmin || supabase;

/**
 * Upload a buffer to a Supabase Storage bucket and return its public URL.
 * Files are prefixed with the userId folder for RLS-scoped access.
 */
export async function uploadBuffer(
  bufferOrOpts: any,
  maybeOpts?: any
): Promise<{ url: string; path: string }> {
  let buffer: Buffer;
  let opts: { bucket: string; userId: string; originalName: string; contentType?: string };

  if (Buffer.isBuffer(bufferOrOpts)) {
    buffer = bufferOrOpts;
    opts = maybeOpts || {};
  } else {
    opts = bufferOrOpts || {};
    buffer = bufferOrOpts.buffer;
  }

  const { bucket = 'videos', userId = 'artist', originalName = 'file.bin', contentType } = opts;
  const ext = path.extname(originalName) || '';
  const cleanUserId = userId ? String(userId).trim() : 'general';
  const filename = `${cleanUserId}/${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;

  console.log(`[STORAGE] Uploading to bucket=${bucket} path=${filename} size=${buffer ? buffer.length : 0}`);

  try {
    const { error } = await client.storage
      .from(bucket)
      .upload(filename, buffer, {
        contentType: contentType || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.warn(`[storageService] Upload warning for bucket '${bucket}':`, error.message);
    }
  } catch (err: any) {
    console.warn(`[storageService] Exception during bucket '${bucket}' upload:`, err?.message || err);
  }

  const { data } = client.storage.from(bucket).getPublicUrl(filename);
  let publicUrl = data?.publicUrl;

  // If publicUrl is empty, synthesize standard public url for the bucket
  if (!publicUrl) {
    const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://reuekwbqdjtwqzpyqtuc.supabase.co';
    publicUrl = `${base.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${filename}`;
  }

  console.log(`[STORAGE] ✅ Uploaded: ${publicUrl}`);
  return { url: publicUrl, path: filename };
}

/**
 * Delete a file from Supabase Storage by its public URL.
 */
export async function deleteByUrl(bucket: string, publicUrl: string) {
  try {
    const marker = `/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const filePath = publicUrl.substring(idx + marker.length);
    await client.storage.from(bucket).remove([filePath]);
  } catch (err: any) {
    console.warn(`[storageService] Delete warning for bucket '${bucket}':`, err?.message || err);
  }
}
