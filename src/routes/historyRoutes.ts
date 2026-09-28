import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as historyController from '../controllers/historyController';

const router = Router();

router.get('/', authenticate, historyController.getHistory);
router.delete('/clear', authenticate, historyController.clearHistory);
router.delete('/', authenticate, historyController.clearHistory);
router.post('/pause', authenticate, historyController.pauseHistory);
router.delete('/:videoId', authenticate, historyController.removeHistoryItem);

export default router;
