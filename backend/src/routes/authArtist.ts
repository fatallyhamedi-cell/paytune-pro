import express from 'express';
import {
  registerArtist,
  loginArtist,
  detectArtistCountry,
  getArtistMe
} from '../../../src/controllers/artistAuthController';
import { authenticate } from '../../../src/middleware/auth';

const router = express.Router();

router.post('/register', registerArtist);
router.post('/login', loginArtist);
router.get('/geo/detect', detectArtistCountry);
router.get('/me', authenticate, getArtistMe);

export default router;
