import { Router } from 'express';
import { 
  initiatePurchase, 
  handlePurchaseWebhook, 
  giftPurchase 
} from '../controllers/purchaseController';
import { authenticate } from '../middleware/auth';

const router = Router();

// 1. Payment initiation (MTN MoMo, Airtel Money, Stripe)
router.post('/initiate', authenticate, initiatePurchase);

// 2. Webhook / payment callback
router.post('/webhook', handlePurchaseWebhook);

// 3. Gift video to a friend
router.post('/gift', authenticate, giftPurchase);

export default router;
