import multer from 'multer';

// Store in memory so we can pipe directly to Supabase and FFmpeg processing
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.fieldname === 'video') {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('video/')) {
      return cb(null, true);
    }
    return cb(new Error('Only MP4, WebM, MOV, and AVI videos are allowed'));
  }
  if (file.fieldname === 'thumbnail') {
    if (file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }
    return cb(new Error('Only image files are allowed for thumbnails'));
  }
  cb(new Error(`Unexpected field: ${file.fieldname}`));
};

export const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB max file limit
  fileFilter
});
