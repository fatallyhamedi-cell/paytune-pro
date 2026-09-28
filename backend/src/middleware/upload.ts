import multer from 'multer';

const storage = multer.memoryStorage();

// 500 MB for video, 100 MB for audio, 10 MB for images
const MAX_VIDEO = 500 * 1024 * 1024;
const MAX_AUDIO = 100 * 1024 * 1024;
const MAX_IMAGE = 10 * 1024 * 1024;

export const uploadVideo = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO, // overall max; per-field checks below
    fieldSize: 10 * 1024 * 1024,
    fields: 50,
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'video') {
      const ok = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
      if (!ok.includes(file.mimetype) && !file.mimetype.startsWith('video/')) {
        return cb(new Error('Only MP4, WebM, MOV, AVI allowed'));
      }
      return cb(null, true);
    }
    if (file.fieldname === 'audio') {
      const ok = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/aac', 'audio/ogg'];
      if (!ok.includes(file.mimetype) && !file.mimetype.startsWith('audio/')) {
        return cb(new Error('Only MP3, WAV, M4A, AAC, OGG allowed'));
      }
      return cb(null, true);
    }
    if (['thumbnail', 'avatar', 'banner'].includes(file.fieldname)) {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files allowed'));
      }
      if (file.size && file.size > MAX_IMAGE) {
        return cb(new Error('Image must be under 10 MB'));
      }
      return cb(null, true);
    }
    cb(new Error('Unexpected field: ' + file.fieldname));
  },
});

export default uploadVideo;
