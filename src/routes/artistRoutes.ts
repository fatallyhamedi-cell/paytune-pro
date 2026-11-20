import { Router } from 'express';
import multer from 'multer';
import {
  getArtistDashboard,
  getMyVideos,
  uploadVideo,
  updateArtistVideo,
  deleteArtistVideo,
  getArtistEarnings,
  getEarningsBreakdown,
  getVideoAnalytics,
  regenerateVideoLink,
  getArtistAnalytics,
  getArtistSubscribers,
  getTopFans,
  getArtistComments,
  hideComment,
  getArtistSettings,
  updateArtistProfile,
  updateNotificationSettings,
  changePassword,
  getArtistById,
  getArtistVideos,
  getArtistShorts,
  getArtistPlaylists,
  getArtistLiveStreams,
  getArtistMembershipTiers,
  getArtistSubscribeStatus,
  toggleArtistSubscribe,
  reportArtist,
  listArtists
} from '../controllers/artistController';
import { requestWithdrawal, getArtistWithdrawals } from '../controllers/withdrawalController';
import {
  getArtistStreams,
  createLiveStream,
  startLiveStream,
  endLiveStream
} from '../controllers/liveController';
import {
  registerArtist,
  loginArtist,
  detectArtistCountry
} from '../controllers/artistAuthController';
import { optionalAuthenticate, authenticate } from '../middleware/auth';

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 } 
});

// ==========================================
// 1. Creator Studio Router (/api/artist/*)
// ==========================================
export const artistStudioRouter = Router();

// Artist Authentication
artistStudioRouter.post('/register', optionalAuthenticate, registerArtist);
artistStudioRouter.post('/login', loginArtist);
artistStudioRouter.get('/geo/detect', detectArtistCountry);

// Dashboard & Overview
artistStudioRouter.get('/dashboard', authenticate, getArtistDashboard);
artistStudioRouter.get('/:artistId/dashboard', authenticate, getArtistDashboard);

// Earnings & Breakdown
artistStudioRouter.get('/earnings', authenticate, getArtistEarnings);
artistStudioRouter.get('/earnings/breakdown', authenticate, getEarningsBreakdown);

// Videos Management
artistStudioRouter.get('/videos', authenticate, getMyVideos);
artistStudioRouter.post(
  '/video/upload',
  authenticate,
  upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
  uploadVideo
);
artistStudioRouter.post(
  '/short/upload',
  authenticate,
  upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
  uploadVideo
);
artistStudioRouter.put('/video/:id', authenticate, updateArtistVideo);
artistStudioRouter.put('/videos/:id', authenticate, updateArtistVideo);
artistStudioRouter.delete('/video/:id', authenticate, deleteArtistVideo);
artistStudioRouter.delete('/videos/:id', authenticate, deleteArtistVideo);
artistStudioRouter.post('/video/:id/regenerate-link', authenticate, regenerateVideoLink);
artistStudioRouter.get('/video/:id/analytics', authenticate, getVideoAnalytics);

// Studio Analytics
artistStudioRouter.get('/analytics', authenticate, getArtistAnalytics);

// Subscribers, Followers & Community
artistStudioRouter.get('/subscribers', authenticate, getArtistSubscribers);
artistStudioRouter.get('/followers', authenticate, getArtistSubscribers);
artistStudioRouter.get('/top-fans', authenticate, getTopFans);
artistStudioRouter.get('/comments', authenticate, getArtistComments);
artistStudioRouter.put('/comments/:id/hide', authenticate, hideComment);

// Withdrawals & Payouts
artistStudioRouter.get('/withdrawals', authenticate, getArtistWithdrawals);
artistStudioRouter.post('/withdraw/request', authenticate, requestWithdrawal);
artistStudioRouter.post('/withdraw', authenticate, requestWithdrawal);

// Profile & Studio Settings
artistStudioRouter.get('/settings', authenticate, getArtistSettings);
artistStudioRouter.get('/profile', authenticate, getArtistSettings);
artistStudioRouter.put('/settings', authenticate, updateArtistProfile);
artistStudioRouter.put('/profile', authenticate, updateArtistProfile);
artistStudioRouter.put('/settings/notifications', authenticate, updateNotificationSettings);
artistStudioRouter.post('/change-password', authenticate, changePassword);

// Live Streaming
artistStudioRouter.get('/live', authenticate, getArtistStreams);
artistStudioRouter.post('/live/create', authenticate, createLiveStream);
artistStudioRouter.put('/live/:id/start', authenticate, startLiveStream);
artistStudioRouter.put('/live/:id/end', authenticate, endLiveStream);


// ==========================================
// 2. Public Channel Router (/api/artists/*)
// ==========================================
export const publicArtistRouter = Router();

import { getArtistTracks } from '../controllers/musicController';

publicArtistRouter.get('/', listArtists);
publicArtistRouter.get('/:id', getArtistById);
publicArtistRouter.get('/:id/videos', getArtistVideos);
publicArtistRouter.get('/:id/shorts', getArtistShorts);
publicArtistRouter.get('/:id/tracks', getArtistTracks);
publicArtistRouter.get('/:id/playlists', getArtistPlaylists);
publicArtistRouter.get('/:id/live', getArtistLiveStreams);
publicArtistRouter.get('/:id/membership', getArtistMembershipTiers);
publicArtistRouter.get('/:id/subscribe-status', optionalAuthenticate, getArtistSubscribeStatus);
publicArtistRouter.get('/:id/follow-status', optionalAuthenticate, getArtistSubscribeStatus);
publicArtistRouter.post('/:id/subscribe', authenticate, toggleArtistSubscribe);
publicArtistRouter.delete('/:id/subscribe', authenticate, toggleArtistSubscribe);
publicArtistRouter.post('/:id/follow', authenticate, toggleArtistSubscribe);
publicArtistRouter.delete('/:id/follow', authenticate, toggleArtistSubscribe);
publicArtistRouter.post('/:id/report', authenticate, reportArtist);

export default publicArtistRouter;

