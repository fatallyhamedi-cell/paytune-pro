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
  verifyArtistPhone,
  resendArtistOtp,
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

// Artist Authentication & Verification
artistStudioRouter.post('/register', registerArtist);
artistStudioRouter.post('/login', loginArtist);
artistStudioRouter.post('/verify-phone', optionalAuthenticate, verifyArtistPhone);
artistStudioRouter.post('/resend-otp', optionalAuthenticate, resendArtistOtp);
artistStudioRouter.get('/geo/detect', detectArtistCountry);

// Dashboard & Overview
artistStudioRouter.get('/dashboard', optionalAuthenticate, getArtistDashboard);
artistStudioRouter.get('/:artistId/dashboard', optionalAuthenticate, getArtistDashboard);

// Earnings & Breakdown
artistStudioRouter.get('/earnings', optionalAuthenticate, getArtistEarnings);
artistStudioRouter.get('/earnings/breakdown', optionalAuthenticate, getEarningsBreakdown);

// Videos Management
artistStudioRouter.get('/videos', optionalAuthenticate, getMyVideos);
artistStudioRouter.post(
  '/video/upload', 
  optionalAuthenticate, 
  upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), 
  uploadVideo
);
artistStudioRouter.post(
  '/short/upload', 
  optionalAuthenticate, 
  upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), 
  uploadVideo
);
artistStudioRouter.put('/video/:id', optionalAuthenticate, updateArtistVideo);
artistStudioRouter.delete('/video/:id', optionalAuthenticate, deleteArtistVideo);
artistStudioRouter.post('/video/:id/regenerate-link', optionalAuthenticate, regenerateVideoLink);
artistStudioRouter.get('/video/:id/analytics', optionalAuthenticate, getVideoAnalytics);

// Studio Analytics
artistStudioRouter.get('/analytics', optionalAuthenticate, getArtistAnalytics);

// Subscribers & Community
artistStudioRouter.get('/subscribers', optionalAuthenticate, getArtistSubscribers);
artistStudioRouter.get('/top-fans', optionalAuthenticate, getTopFans);
artistStudioRouter.get('/comments', optionalAuthenticate, getArtistComments);
artistStudioRouter.put('/comments/:id/hide', optionalAuthenticate, hideComment);

// Withdrawals & Payouts
artistStudioRouter.get('/withdrawals', authenticate, getArtistWithdrawals);
artistStudioRouter.post('/withdraw/request', authenticate, requestWithdrawal);
artistStudioRouter.post('/withdraw', authenticate, requestWithdrawal);

// Profile & Studio Settings
artistStudioRouter.get('/settings', optionalAuthenticate, getArtistSettings);
artistStudioRouter.put('/settings', optionalAuthenticate, updateArtistProfile);
artistStudioRouter.put('/profile', optionalAuthenticate, updateArtistProfile);
artistStudioRouter.put('/settings/notifications', optionalAuthenticate, updateNotificationSettings);
artistStudioRouter.post('/change-password', optionalAuthenticate, changePassword);

// Live Streaming
artistStudioRouter.get('/live', optionalAuthenticate, getArtistStreams);
artistStudioRouter.post('/live/create', optionalAuthenticate, createLiveStream);
artistStudioRouter.put('/live/:id/start', optionalAuthenticate, startLiveStream);
artistStudioRouter.put('/live/:id/end', optionalAuthenticate, endLiveStream);


// ==========================================
// 2. Public Channel Router (/api/artists/*)
// ==========================================
export const publicArtistRouter = Router();

publicArtistRouter.get('/', listArtists);
publicArtistRouter.get('/:id', getArtistById);
publicArtistRouter.get('/:id/videos', getArtistVideos);
publicArtistRouter.get('/:id/shorts', getArtistShorts);
publicArtistRouter.get('/:id/playlists', getArtistPlaylists);
publicArtistRouter.get('/:id/live', getArtistLiveStreams);
publicArtistRouter.get('/:id/membership', getArtistMembershipTiers);
publicArtistRouter.get('/:id/subscribe-status', optionalAuthenticate, getArtistSubscribeStatus);
publicArtistRouter.get('/:id/follow-status', optionalAuthenticate, getArtistSubscribeStatus);
publicArtistRouter.post('/:id/subscribe', authenticate, toggleArtistSubscribe);
publicArtistRouter.post('/:id/follow', authenticate, toggleArtistSubscribe);
publicArtistRouter.post('/:id/report', authenticate, reportArtist);

export default publicArtistRouter;

