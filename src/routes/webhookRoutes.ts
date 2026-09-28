import { Router } from 'express';
import { mtnWebhook, airtelWebhook, stripeWebhook } from '../controllers/webhookController';

const router = Router();

router.post('/mtn', mtnWebhook);
router.post('/airtel', airtelWebhook);
router.post('/stripe', stripeWebhook);

export default router;
