import { supabase, supabaseAdmin } from '../config/supabase';
import { randomUUID } from 'crypto';
import path from 'path';

const client = supabaseAdmin || supabase;

/**
 * Upload a buffer to a Supabase Storage bucket and return its public URL.
 * Files are prefixed with the userId folder for RLS-scoped access.
 */
export async function uploadBuffer(opts: {
  bucket: string;
  userId: string;
  buffer: Buffer;
  originalName: string;
  contentType: string;
}): Promise<{ url: string; path: string }> {
  const ext = path.extname(opts.originalName) || '';
  const cleanUserId = opts.userId ? String(opts.userId).trim() : 'general';
  const filename = `${cleanUserId}/${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;

  try {
    const { error } = await client.storage
      .from(opts.bucket)
      .upload(filename, opts.buffer, {
        contentType: opts.contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.warn(`[storageService] Upload warning for bucket '${opts.bucket}':`, error.message);
    }
  } catch (err: any) {
    console.warn(`[storageService] Exception during bucket '${opts.bucket}' upload:`, err?.message || err);
  }

  const { data } = client.storage.from(opts.bucket).getPublicUrl(filename);
  let publicUrl = data?.publicUrl;

  // If publicUrl is empty, synthesize standard public url for the bucket
  if (!publicUrl) {
    const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://mock.supabase.co';
    publicUrl = `${base.replace(/\/+$/, '')}/storage/v1/object/public/${opts.bucket}/${filename}`;
  }

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
