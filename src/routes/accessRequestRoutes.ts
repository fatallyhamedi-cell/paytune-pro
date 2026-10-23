import { Router } from 'express';
import { optionalAuthenticate, authenticate, checkRole } from '../middleware/auth';
import {
  submitAccessRequest,
  checkAccessRequestStatus,
  listAccessRequests,
  approveAccessRequest,
  rejectAccessRequest
} from '../controllers/accessRequestController';

const router = Router();

// Public / Viewer endpoints
router.post('/submit', optionalAuthenticate, submitAccessRequest);
router.get('/status', checkAccessRequestStatus);

// Admin review endpoints
router.get('/list', listAccessRequests);
router.post('/:id/approve', approveAccessRequest);
router.post('/:id/reject', rejectAccessRequest);

export default router;
