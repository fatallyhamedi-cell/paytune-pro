const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  console.log(`[MULTER] field="${file.fieldname}" type="${file.mimetype}"`);

  if (file.fieldname === 'video' || file.fieldname === 'audio') {
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) return cb(null, true);
    return cb(new Error('Only video or audio allowed'), false);
  }

  if (['thumbnail', 'avatar', 'banner'].includes(file.fieldname)) {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    return cb(new Error('Only images allowed'), false);
  }

  return cb(new Error('Unexpected field: ' + file.fieldname), false);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024, files: 3 },
});
