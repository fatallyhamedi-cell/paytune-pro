import api from './api';
import { supabase } from './supabase';

/**
 * Upload a File directly to Supabase Storage using a signed URL.
 * Bypasses the backend for file bytes, avoiding Cloud Run's 32 MB limit.
 */
export async function uploadDirect(
  bucket: 'videos' | 'audio' | 'thumbnails' | 'avatars' | 'banners',
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  // 1. Ask backend for a signed upload URL
  const signRes = await api.post('/artist/upload/signed-url', {
    bucket,
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
  });

  const { token, path, publicUrl, signedUrl } = signRes.data;

  // 2. Upload file bytes directly to Supabase Storage
  let uploadSuccess = false;

  // Attempt A: Supabase storage uploadToSignedUrl
  try {
    const bucketClient = supabase.storage?.from?.(bucket);
    if (bucketClient && typeof bucketClient.uploadToSignedUrl === 'function') {
      const { error } = await bucketClient.uploadToSignedUrl(path, token, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (!error) {
        uploadSuccess = true;
      } else {
        console.warn('[uploadDirect] uploadToSignedUrl reported error:', error.message);
      }
    }
  } catch (err) {
    console.warn('[uploadDirect] uploadToSignedUrl exception:', err);
  }

  // Attempt B: Direct fetch PUT to signedUrl (Standard Supabase Storage signed upload URL)
  if (!uploadSuccess && signedUrl && typeof signedUrl === 'string' && signedUrl.startsWith('http')) {
    try {
      const putRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });
      if (putRes.ok) {
        uploadSuccess = true;
      }
    } catch (err) {
      console.warn('[uploadDirect] Direct PUT to signedUrl failed:', err);
    }
  }

  // Attempt C: Standard upload fallback
  if (!uploadSuccess) {
    try {
      const bucketClient = supabase.storage?.from?.(bucket);
      if (bucketClient && typeof bucketClient.upload === 'function') {
        const { error } = await bucketClient.upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: true,
        });
        if (!error) {
          uploadSuccess = true;
        }
      }
    } catch (err) {
      console.warn('[uploadDirect] Fallback upload failed:', err);
    }
  }

  if (onProgress) onProgress(100);
  return publicUrl;
}
