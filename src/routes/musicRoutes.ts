import { Router } from 'express';
import multer from 'multer';
import {
  getMusicHome,
  getTracks,
  getTrackById,
  getArtistTracks,
  recordListeningEvent,
  likeTrack,
  unlikeTrack,
  followArtist,
  unfollowArtist,
  getFollowStatus,
  getCreatorMusicTracks,
  createCreatorMusicTrack,
  updateCreatorMusicTrack,
  replaceCreatorTrackAudio,
  deleteCreatorMusicTrack,
} from '../controllers/musicController';
import { authenticate, optionalAuthenticate } from '../middleware/auth';

const router = Router();
const audioMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 },
});

// Creator Studio Music / Albums / Podcasts Management
router.get('/creator/tracks', authenticate, getCreatorMusicTracks);
router.post('/creator/tracks', authenticate, createCreatorMusicTrack);
router.put('/creator/tracks/:id', authenticate, updateCreatorMusicTrack);
router.put(
  '/creator/tracks/:id/replace-media',
  authenticate,
  audioMulter.fields([{ name: 'audio', maxCount: 1 }, { name: 'file', maxCount: 1 }]),
  replaceCreatorTrackAudio
);
router.delete('/creator/tracks/:id', authenticate, deleteCreatorMusicTrack);

// Public discovery
router.get('/home', optionalAuthenticate, getMusicHome);
router.get('/tracks', optionalAuthenticate, getTracks);
router.get('/tracks/:id', optionalAuthenticate, getTrackById);
router.get('/artists/:id/tracks', optionalAuthenticate, getArtistTracks);

// Listening & Engagement
router.post('/tracks/:id/play', optionalAuthenticate, recordListeningEvent);
router.post('/tracks/:id/like', optionalAuthenticate, likeTrack);
router.delete('/tracks/:id/like', optionalAuthenticate, unlikeTrack);

// In-place Artist Following from Music Tracks
router.post('/artists/:id/follow', authenticate, followArtist);
router.delete('/artists/:id/follow', authenticate, unfollowArtist);
router.get('/artists/:id/follow-status', optionalAuthenticate, getFollowStatus);

export default router;
