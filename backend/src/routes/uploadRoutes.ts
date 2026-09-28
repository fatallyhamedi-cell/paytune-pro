import express from 'express';
import { authenticateArtist } from '../middleware/authArtist';
import { uploadVideo } from '../middleware/upload';
import { uploadAvatar, uploadBanner, uploadThumbnail } from '../controllers/uploadController';
import { uploadVideo as uploadVideoCtrl } from '../controllers/artistVideoController';
import { createSignedUploadUrl } from '../controllers/signedUploadController';
import { completeUpload } from '../controllers/completeUploadController';

const router = express.Router();
router.use(authenticateArtist);

router.post('/upload/avatar', uploadVideo.single('avatar'), uploadAvatar);
router.post('/upload/banner', uploadVideo.single('banner'), uploadBanner);
router.post('/upload/thumbnail', uploadVideo.single('thumbnail'), uploadThumbnail);

router.post('/upload/signed-url', createSignedUploadUrl);

router.post(
  '/video/upload',
  uploadVideo.fields([
    { name: 'video', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  uploadVideoCtrl
);

router.post('/video/complete', completeUpload);

export default router;
