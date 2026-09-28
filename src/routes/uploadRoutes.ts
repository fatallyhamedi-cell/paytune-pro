import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { supabaseAdmin, isSupabaseConfigured } from '../config/supabase';
import { optionalAuthenticate } from '../middleware/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit for images
});

const ensureUploadsDir = () => {
  const baseDir = (typeof process !== 'undefined' && typeof process.cwd === 'function') ? process.cwd() : '.';
  const uploadsDir = path.join(baseDir, 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

/**
 * Common upload processor:
 * 1. Tries Supabase Storage bucket ('avatars' or 'banners')
 * 2. Falls back to local public directory /uploads/
 */
async function processImageUpload(file: Express.Multer.File, bucketName: string, prefix: string): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const fileName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}${ext}`;

  // 1. Try Supabase Storage
  if (isSupabaseConfigured()) {
    try {
      // Ensure bucket exists
      try {
        await supabaseAdmin.storage.createBucket(bucketName, { public: true });
      } catch {
        // Bucket may already exist
      }

      const { data, error } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(fileName, file.buffer, {
          contentType: file.mimetype || 'image/jpeg',
          upsert: true
        });

      if (!error && data) {
        const { data: publicData } = supabaseAdmin.storage
          .from(bucketName)
          .getPublicUrl(fileName);

        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      }
    } catch (sbError) {
      console.warn(`Supabase storage upload to '${bucketName}' notice:`, sbError);
    }
  }

  // 2. Fallback: Save to local public/uploads directory
  try {
    const uploadsDir = ensureUploadsDir();
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, file.buffer);
    return `/uploads/${fileName}`;
  } catch (fsErr) {
    console.warn("Local filesystem write notice, falling back to data URL:", fsErr);
    // 3. Fallback: Return base64 data URI
    return `data:${file.mimetype || 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
  }
}

// POST /api/upload/avatar
router.post(
  '/avatar',
  optionalAuthenticate,
  upload.single('avatar'),
  async (req: Request, res: Response) => {
    const file = req.file || (req as any).files?.file?.[0] || (req as any).files?.image?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    try {
      const url = await processImageUpload(file, 'avatars', 'avatar');
      res.json({ success: true, url });
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload avatar.' });
    }
  }
);

// POST /api/upload/banner
router.post(
  '/banner',
  optionalAuthenticate,
  upload.single('banner'),
  async (req: Request, res: Response) => {
    const file = req.file || (req as any).files?.file?.[0] || (req as any).files?.image?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No banner image file provided.' });
    }

    try {
      const url = await processImageUpload(file, 'avatars', 'banner');
      res.json({ success: true, url });
    } catch (err: any) {
      console.error('Banner upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload banner.' });
    }
  }
);

// POST /api/upload/image (generic)
router.post(
  '/image',
  optionalAuthenticate,
  upload.single('image'),
  async (req: Request, res: Response) => {
    const file = req.file || (req as any).files?.file?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    try {
      const url = await processImageUpload(file, 'avatars', 'img');
      res.json({ success: true, url });
    } catch (err: any) {
      console.error('Image upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload image.' });
    }
  }
);

export default router;
