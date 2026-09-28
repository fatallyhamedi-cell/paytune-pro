import { Router } from 'express';
import { initiatePayment, getPaymentStatus, approvePayment } from '../controllers/paymentController';
import { optionalAuthenticate } from '../middleware/auth';
import { paymentLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/initiate', optionalAuthenticate, paymentLimiter, initiatePayment);
router.get('/:paymentId/status', optionalAuthenticate, getPaymentStatus);
router.post('/:paymentId/approve', optionalAuthenticate, approvePayment);

export default router;
