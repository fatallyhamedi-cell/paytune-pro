const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { authenticateArtist } = require('../middleware/auth');
const { uploadAvatar, uploadBanner, uploadThumbnail } = require('../controllers/uploadController');
const { uploadVideo, listMyVideos } = require('../controllers/artistVideoController');

router.post('/upload/avatar', authenticateArtist, upload.single('avatar'), uploadAvatar);
router.post('/upload/banner', authenticateArtist, upload.single('banner'), uploadBanner);
router.post('/upload/thumbnail', authenticateArtist, upload.single('thumbnail'), uploadThumbnail);

router.post(
  '/video/upload',
  authenticateArtist,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  uploadVideo
);

router.get('/videos', authenticateArtist, listMyVideos);

module.exports = router;
