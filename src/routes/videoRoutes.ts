import { Router } from 'express';
import { 
  listVideos, 
  getTrendingVideos, 
  getNewVideos, 
  getRecommendedVideos, 
  getVideoDetails,
  getRelatedVideos,
  toggleVideoLike,
  recordVideoView,
  saveVideoProgress,
  getVideoProgress,
  toggleArtistSubscribe
} from '../controllers/videoController';
import { getComments, createComment } from '../controllers/commentController';
import { authenticate, optionalAuthenticate } from '../middleware/auth';

const router = Router();

// 1. Specific collection endpoints must precede :id parameter
router.get('/trending', getTrendingVideos);
router.get('/new', getNewVideos);
router.get('/recommended', optionalAuthenticate, getRecommendedVideos);

// 2. Listing with filters & pagination
router.get('/', listVideos);

// 3. Single video details & sub-resources
router.get('/:id', optionalAuthenticate, getVideoDetails);
router.get('/:id/related', getRelatedVideos);
router.post('/:id/like', authenticate, toggleVideoLike);
router.post('/:id/view', optionalAuthenticate, recordVideoView);
router.post('/:id/progress', optionalAuthenticate, saveVideoProgress);
router.get('/:id/progress', optionalAuthenticate, getVideoProgress);
router.post('/:id/subscribe', authenticate, toggleArtistSubscribe);
router.post('/:id/follow', authenticate, toggleArtistSubscribe);

// 4. Video-nested comments routes for compatibility
router.get('/:id/comments', optionalAuthenticate, getComments);
router.post('/:id/comments', authenticate, createComment);

export default router;
