import express from 'express';
import { upload } from '../middleware/upload';
import { authenticateArtist } from '../middleware/artistAuth';
import { uploadVideo, deleteVideo } from '../controllers/artistVideoController';

const router = express.Router();

// Upload video directly from device (multipart/form-data)
router.post(
  '/video/upload',
  authenticateArtist,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  uploadVideo
);

// Delete video and remove storage bucket objects
router.delete('/video/:id', authenticateArtist, deleteVideo);

export default router;
