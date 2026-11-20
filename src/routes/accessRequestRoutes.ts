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
router.get('/list', authenticate, checkRole('master'), listAccessRequests);
router.post('/:id/approve', authenticate, checkRole('master'), approveAccessRequest);
router.post('/:id/reject', authenticate, checkRole('master'), rejectAccessRequest);

export default router;
