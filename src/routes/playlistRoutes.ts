import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import * as playlistController from '../controllers/playlistController';

const router = Router();

router.get('/', authenticate, playlistController.getUserPlaylists);
router.post('/', authenticate, playlistController.createPlaylist);
router.get('/:id', optionalAuthenticate, playlistController.getPlaylistDetails);
router.put('/:id', authenticate, playlistController.updatePlaylist);
router.delete('/:id', authenticate, playlistController.deletePlaylist);
router.post('/:id/videos', authenticate, playlistController.addVideoToPlaylist);
router.delete('/:id/videos/:videoId', authenticate, playlistController.removeVideoFromPlaylist);
router.put('/:id/reorder', authenticate, playlistController.reorderVideos);
router.get('/:id/share', optionalAuthenticate, playlistController.getShareLink);

export default router;
