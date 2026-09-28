import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import * as userController from '../controllers/userController';

const router = Router();

// Profile endpoints
router.get('/me', authenticate, userController.getMe);
router.put('/me', authenticate, userController.updateMe);
router.get('/settings', authenticate, userController.getMe);
router.put('/settings', authenticate, userController.updateMe);
router.post('/change-password', authenticate, userController.changePassword);
router.delete('/account', authenticate, userController.deleteAccount);
router.post('/delete-account', authenticate, userController.deleteAccount);

// Library endpoints
router.get('/library', authenticate, userController.getLibrary);
router.get('/library/search', authenticate, userController.searchLibrary);

// Following endpoints
router.get('/following', optionalAuthenticate, userController.getFollowingFeed);
router.get('/following/artists', optionalAuthenticate, userController.getFollowingArtists);

// Payment phones endpoints
router.get('/payment-phones', authenticate, userController.getPaymentPhones);
router.post('/payment-phones', authenticate, userController.addPaymentPhone);
router.delete('/payment-phones/:id', authenticate, userController.deletePaymentPhone);

// Gifts endpoints
router.get('/gifts', authenticate, userController.getGifts);

export default router;
