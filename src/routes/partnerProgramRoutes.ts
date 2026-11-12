import { Router } from 'express';
import { authenticate, optionalAuthenticate, checkRole } from '../middleware/auth';
import {
  getArtistPartnerStatus,
  applyForPartnerProgram,
  getMasterPartnerRules,
  updateMasterPartnerRules,
  getMasterPartnerApplications,
  decidePartnerApplication,
  submitIdentityVerification,
  submitPayoutVerification,
} from '../controllers/partnerProgramController';

const router = Router();
const masterAuth = [authenticate, checkRole('master')];

// Artist Routes
router.get('/artist/status', optionalAuthenticate, getArtistPartnerStatus);
router.post('/artist/apply', optionalAuthenticate, applyForPartnerProgram);
router.post('/artist/verify-identity', optionalAuthenticate, submitIdentityVerification);
router.post('/artist/verify-payout', optionalAuthenticate, submitPayoutVerification);

// Master Admin Routes
router.get('/master/rules', masterAuth, getMasterPartnerRules);
router.put('/master/rules', masterAuth, updateMasterPartnerRules);
router.get('/master/applications', masterAuth, getMasterPartnerApplications);
router.post('/master/applications/:artistId/decision', masterAuth, decidePartnerApplication);

export default router;

