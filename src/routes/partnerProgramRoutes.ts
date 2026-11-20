import { Router } from 'express';
import { authenticate, checkRole } from '../middleware/auth';
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

// Artist Routes (/api/partner-program/artist/* and /api/artist/partner-program/*)
router.get('/artist/status', authenticate, getArtistPartnerStatus);
router.post('/artist/apply', authenticate, applyForPartnerProgram);
router.post('/artist/verify-identity', authenticate, submitIdentityVerification);
router.post('/artist/verify-payout', authenticate, submitPayoutVerification);

router.get('/artist/partner-program/status', authenticate, getArtistPartnerStatus);
router.post('/artist/partner-program/apply', authenticate, applyForPartnerProgram);
router.post('/artist/partner-program/verify-identity', authenticate, submitIdentityVerification);
router.post('/artist/partner-program/verify-payout', authenticate, submitPayoutVerification);

// Master Admin Routes (/api/partner-program/master/* and /api/master/partner-program/*)
router.get('/master/rules', masterAuth, getMasterPartnerRules);
router.put('/master/rules', masterAuth, updateMasterPartnerRules);
router.get('/master/applications', masterAuth, getMasterPartnerApplications);
router.post('/master/applications/:artistId/decision', masterAuth, decidePartnerApplication);

router.get('/master/partner-program/rules', masterAuth, getMasterPartnerRules);
router.put('/master/partner-program/rules', masterAuth, updateMasterPartnerRules);
router.get('/master/partner-program/applications', masterAuth, getMasterPartnerApplications);
router.post('/master/partner-program/applications/:artistId/decision', masterAuth, decidePartnerApplication);

export default router;
