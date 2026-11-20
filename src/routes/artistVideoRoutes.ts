import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { upload } from '../middleware/upload';
import { authenticateArtist } from '../middleware/artistAuth';
import {
  uploadVideo,
  deleteVideo,
  createSignedUploadUrl,
  completeVideoUpload,
} from '../controllers/artistVideoController';

const router = express.Router();

const handleVideoMulter = (req: Request, res: Response, next: NextFunction) => {
  const middleware = upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'media', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]);

  middleware(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message || 'Invalid upload payload', code: err.code });
    }
    return res.status(400).json({ error: err.message || 'Invalid upload file' });
  });
};

// Direct Supabase Storage signed URL generation
router.post('/upload/signed-url', authenticateArtist, createSignedUploadUrl);

// Finalize a direct-to-storage video upload
router.post('/video/complete', authenticateArtist, completeVideoUpload);

// Upload video directly from device (multipart/form-data)
router.post('/video/upload', authenticateArtist, handleVideoMulter, uploadVideo);

// Delete video and remove storage bucket objects
router.delete('/video/:id', authenticateArtist, deleteVideo);

export default router;
