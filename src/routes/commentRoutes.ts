import { Router } from 'express';
import { 
  getComments, 
  createComment, 
  toggleCommentLike, 
  deleteComment, 
  pinComment 
} from '../controllers/commentController';
import { authenticate, optionalAuthenticate } from '../middleware/auth';

const router = Router();

// 1. Get comments for a video
router.get('/:videoId', optionalAuthenticate, getComments);

// 2. Post a comment on a video (requires purchase if paid)
router.post('/:videoId', authenticate, createComment);

// 3. Like a comment
router.put('/:commentId/like', authenticate, toggleCommentLike);
router.post('/:commentId/like', authenticate, toggleCommentLike);

// 4. Pin a comment (artist only)
router.put('/:commentId/pin', authenticate, pinComment);
router.post('/:commentId/pin', authenticate, pinComment);

// 5. Delete own comment (or artist/master)
router.delete('/:commentId', authenticate, deleteComment);

export default router;
