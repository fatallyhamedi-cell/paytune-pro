import express from 'express';
import {
  getClaims,
  getMyClaims,
  getDisputes,
  updateClaimPolicy,
  registerCatalogWork,
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
import { authenticate, optionalAuthenticate, checkRole } from '../middleware/auth';

const router = express.Router();
const masterAuth = [authenticate, checkRole('master')];

// Admin & Authenticated Claims endpoints
router.get('/claims', masterAuth, getClaims);
router.get('/claims/my', authenticate, getMyClaims);
router.patch('/claims/:claimId/policy', masterAuth, updateClaimPolicy);
router.post('/claims/dispute', authenticate, disputeClaim);
router.post('/claims/accept', authenticate, acceptClaim);
router.get('/disputes', masterAuth, getDisputes);
router.post('/disputes/respond', authenticate, respondToDispute);

// Reference catalog registration
router.post('/catalog/register', authenticate, registerCatalogWork);

// Watermark embedding & tracing
router.post('/watermark/embed', optionalAuthenticate, embedWatermark);
router.get('/watermark/trace', masterAuth, traceWatermark);
router.post('/watermark/trace', masterAuth, traceWatermark);

// Strikes and repeat infringers
router.get('/strikes', authenticate, getStrikes);
router.post('/strikes', masterAuth, issueStrike);
router.post('/strikes/issue', masterAuth, issueStrike);
router.post('/strikes/ban', masterAuth, toggleBan);
router.post('/strikes/:artistId/ban-toggle', masterAuth, toggleBan);

// Rights holder dashboard & analytics
router.get('/holder/dashboard', authenticate, getRightsHolderDashboard);
router.get('/analytics', masterAuth, getCopyrightAnalytics);

export const dmcaRouter = express.Router();

// Public DMCA Takedown submission, admin review/action, and authenticated counter-notice
dmcaRouter.post('/takedown', optionalAuthenticate, submitDMCATakedown);
dmcaRouter.get('/requests', masterAuth, getDMCARequests);
dmcaRouter.post('/requests/:id/action', masterAuth, handleDMCAAction);
dmcaRouter.post('/requests/:id/counter-notice', authenticate, submitDMCACounterNotice);

export default router;
