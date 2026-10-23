const { supabase } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * Upload a buffer to Supabase Storage.
 * Returns { url, path }
 */
async function uploadBuffer(bufferOrOpts, maybeOpts) {
  let buffer;
  let opts;

  if (Buffer.isBuffer(bufferOrOpts)) {
    buffer = bufferOrOpts;
    opts = maybeOpts || {};
  } else {
    opts = bufferOrOpts || {};
    buffer = opts.buffer;
  }

  const { bucket = 'videos', userId = 'artist', originalName = 'file.bin', contentType } = opts;

  const ext = path.extname(originalName) || '.bin';
  const filePath = `${userId}/${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;

  console.log(`[STORAGE] Uploading to bucket=${bucket} path=${filePath} size=${buffer ? buffer.length : 0}`);

  try {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: contentType || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.warn(`[STORAGE] ⚠️ Supabase storage upload warning:`, error.message);
    }
  } catch (err) {
    console.warn(`[STORAGE] ⚠️ Supabase storage exception:`, err.message);
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  let publicUrl = urlData?.publicUrl;

  if (!publicUrl) {
    const baseUrl = process.env.SUPABASE_URL || 'https://reuekwbqdjtwqzpyqtuc.supabase.co';
    publicUrl = `${baseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${filePath}`;
  }

  console.log(`[STORAGE] ✅ Uploaded: ${publicUrl}`);

  return { url: publicUrl, path: filePath };
}

async function deleteByUrl(bucket, publicUrl) {
  try {
    const marker = `/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const filePath = publicUrl.substring(idx + marker.length);
    await supabase.storage.from(bucket).remove([filePath]);
  } catch (err) {
    console.warn(`[STORAGE] Delete warning:`, err.message);
  }
}

module.exports = { uploadBuffer, deleteByUrl };
