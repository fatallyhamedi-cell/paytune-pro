import { Router } from 'express';
import { optionalAuthenticate, authenticate } from '../middleware/auth';
import {
  getShortsFeed,
  getShortById,
  toggleShortLike,
  recordShortView,
  toggleShortSubscribe,
  getShortComments,
  postShortComment
} from '../controllers/shortsController';

const router = Router();

// Feed endpoint
router.get('/feed', optionalAuthenticate, getShortsFeed);

// Individual short details
router.get('/:id', optionalAuthenticate, getShortById);

// Like toggle (uses optionalAuthenticate to support both logged in and guest sessions)
router.post('/:id/like', optionalAuthenticate, toggleShortLike);

// View tracking
router.post('/:id/view', optionalAuthenticate, recordShortView);

// Follow / Subscribe toggle
router.post('/:id/subscribe', optionalAuthenticate, toggleShortSubscribe);
router.post('/:id/follow', optionalAuthenticate, toggleShortSubscribe);

// Comments
router.get('/:id/comments', getShortComments);
router.post('/:id/comments', optionalAuthenticate, postShortComment);

export default router;
