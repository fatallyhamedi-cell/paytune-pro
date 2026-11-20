import express from 'express';
import {
  registerArtist,
  loginArtist,
  detectArtistCountry,
  getArtistMe
} from '../controllers/artistAuthController';
import { authenticate, optionalAuthenticate } from '../middleware/auth';

const router = express.Router();

router.post('/register', optionalAuthenticate, registerArtist);
router.post('/login', loginArtist);
router.get('/geo/detect', detectArtistCountry);
router.get('/me', authenticate, getArtistMe);

export default router;
