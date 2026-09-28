import express from 'express';
import {
  getClaims,
  getMyClaims,
  disputeClaim,
  acceptClaim,
  respondToDispute,
  submitDMCATakedown,
  getDMCARequests,
  handleDMCAAction,
  submitDMCACounterNotice,
  embedWatermark,
  traceWatermark,
  getStrikes,
  issueStrike,
  toggleBan,
  getRightsHolderDashboard,
  getCopyrightAnalytics
} from '../controllers/copyrightController';
import { authenticate, optionalAuthenticate } from '../middleware/auth';

const router = express.Router();

// Public / Authenticated Claims endpoints
router.get('/claims', optionalAuthenticate, getClaims);
router.get('/claims/my', authenticate, getMyClaims);
router.post('/claims/dispute', authenticate, disputeClaim);
router.post('/claims/accept', authenticate, acceptClaim);
router.post('/disputes/respond', authenticate, respondToDispute);

// Watermark embedding & tracing
router.post('/watermark/embed', optionalAuthenticate, embedWatermark);
router.post('/watermark/trace', optionalAuthenticate, traceWatermark);

// Strikes and repeat infringers
router.get('/strikes', optionalAuthenticate, getStrikes);
router.post('/strikes/issue', optionalAuthenticate, issueStrike);
router.post('/strikes/ban', optionalAuthenticate, toggleBan);

// Rights holder dashboard & analytics
router.get('/holder/dashboard', optionalAuthenticate, getRightsHolderDashboard);
router.get('/analytics', optionalAuthenticate, getCopyrightAnalytics);

export const dmcaRouter = express.Router();

// Public DMCA Takedown submission
dmcaRouter.post('/takedown', submitDMCATakedown);
dmcaRouter.get('/requests', optionalAuthenticate, getDMCARequests);
dmcaRouter.post('/requests/:id/action', optionalAuthenticate, handleDMCAAction);
dmcaRouter.post('/requests/:id/counter-notice', optionalAuthenticate, submitDMCACounterNotice);

export default router;
