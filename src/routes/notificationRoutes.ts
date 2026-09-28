import { Router } from 'express';
import { optionalAuthenticate } from '../middleware/auth';
import * as notificationController from '../controllers/notificationController';

const router = Router();

router.get('/', optionalAuthenticate, notificationController.getNotifications);
router.put('/read', optionalAuthenticate, notificationController.markAllAsRead);
router.put('/:id/read', optionalAuthenticate, notificationController.markAsRead);
router.get('/preferences', optionalAuthenticate, notificationController.getPreferences);
router.put('/preferences', optionalAuthenticate, notificationController.updatePreferences);

export default router;
