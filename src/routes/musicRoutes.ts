import { Router } from 'express';
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
} from '../controllers/musicController';
import { optionalAuthenticate } from '../middleware/auth';

const router = Router();

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
router.post('/artists/:id/follow', optionalAuthenticate, followArtist);
router.delete('/artists/:id/follow', optionalAuthenticate, unfollowArtist);
router.get('/artists/:id/follow-status', optionalAuthenticate, getFollowStatus);

export default router;
