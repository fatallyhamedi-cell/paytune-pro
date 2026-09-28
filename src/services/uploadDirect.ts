import api from './api';
import { supabase } from './supabase';

export async function uploadDirect(
  bucket: 'videos' | 'audio' | 'thumbnails' | 'avatars' | 'banners' | 'previews',
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  console.log('[uploadDirect] Requesting signed URL for', bucket, file.name, file.size);

  // 1. Ask backend for signed URL
  const signRes = await api.post('/artist/upload/signed-url', {
    bucket,
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
  });

  console.log('[uploadDirect] Signed URL response:', signRes.data);

  const { token, path, publicUrl, signedUrl } = signRes.data;

  if (!path) {
    throw new Error('Backend did not return a valid upload path');
  }

  // 2. Upload file to Supabase Storage
  console.log('[uploadDirect] Uploading to Supabase...', path);

  let uploadSuccess = false;

  // Attempt A: Direct fetch PUT to signedUrl (Standard Supabase / S3 signed URL)
  if (signedUrl && typeof signedUrl === 'string' && signedUrl.startsWith('http')) {
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
        console.log('[uploadDirect] PUT to signedUrl succeeded');
      } else {
        console.warn('[uploadDirect] PUT to signedUrl returned status:', putRes.status);
      }
    } catch (err) {
      console.warn('[uploadDirect] PUT to signedUrl fetch error:', err);
    }
  }

  // Attempt B: Supabase SDK uploadToSignedUrl
  if (!uploadSuccess && token) {
    try {
      const bucketClient = supabase.storage?.from?.(bucket);
      if (bucketClient && typeof bucketClient.uploadToSignedUrl === 'function') {
        const { error, data } = await bucketClient.uploadToSignedUrl(path, token, file, {
          contentType: file.type || 'application/octet-stream',
          cacheControl: '3600',
          upsert: false,
        });

        if (!error && data) {
          uploadSuccess = true;
          console.log('[uploadDirect] uploadToSignedUrl succeeded:', data);
        } else if (error) {
          console.warn('[uploadDirect] uploadToSignedUrl error:', error.message);
        }
      }
    } catch (err) {
      console.warn('[uploadDirect] uploadToSignedUrl exception:', err);
    }
  }

  // Attempt C: Standard supabase storage bucket.upload
  if (!uploadSuccess) {
    try {
      const bucketClient = supabase.storage?.from?.(bucket);
      if (bucketClient && typeof bucketClient.upload === 'function') {
        const { error, data } = await bucketClient.upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: true,
        });
        if (!error) {
          uploadSuccess = true;
          console.log('[uploadDirect] Standard upload succeeded:', data);
        }
      }
    } catch (err) {
      console.warn('[uploadDirect] Standard upload exception:', err);
    }
  }

  if (onProgress) onProgress(100);
  return publicUrl;
}

export default uploadDirect;
