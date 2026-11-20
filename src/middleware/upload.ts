import multer from 'multer';

// Store in memory so we can pipe directly to Supabase and FFmpeg processing
const storage = multer.memoryStorage();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.fieldname === 'video' || file.fieldname === 'media' || file.fieldname === 'file') {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (
      allowed.includes(file.mimetype) ||
      file.mimetype.startsWith('video/') ||
      file.mimetype.startsWith('audio/') ||
      (file.fieldname === 'file' && file.mimetype.startsWith('image/'))
    ) {
      return cb(null, true);
    }
    return cb(new Error('Only MP4, WebM, MOV, AVI videos or supported media files are allowed'));
  }
  if (file.fieldname === 'thumbnail' || file.fieldname === 'image' || file.fieldname === 'avatar' || file.fieldname === 'banner' || file.fieldname === 'artwork') {
    if (file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    return cb(new Error('Only image files are allowed for thumbnails and images'));
  }
  if (file.fieldname === 'audio') {
    if (file.mimetype.startsWith('audio/')) {
      return cb(null, true);
    }
    return cb(new Error('Only audio files are allowed'));
  }
  cb(new Error(`Unexpected field: ${file.fieldname}`));
};

export const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB max file limit
  fileFilter
});
