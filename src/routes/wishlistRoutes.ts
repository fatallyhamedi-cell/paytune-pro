import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as wishlistController from '../controllers/wishlistController';

const router = Router();

router.get('/', authenticate, wishlistController.getWishlist);
router.post('/:videoId', authenticate, wishlistController.addToWishlist);
router.delete('/:videoId', authenticate, wishlistController.removeFromWishlist);

export default router;
