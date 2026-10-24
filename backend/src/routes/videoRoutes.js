const express = require('express');
const router = express.Router();
const {
  listVideos,
  getTrendingVideos,
  getNewVideos,
  getRecommendedVideos,
  getVideoById,
  recordView,
  addLike,
  removeLike,
  rateVideo,
  followArtist,
  unfollowArtist,
  getComments,
  postComment
} = require('../controllers/videoController');

// Collection feeds
router.get('/trending', getTrendingVideos);
router.get('/new', getNewVideos);
router.get('/recommended', getRecommendedVideos);

// Single video endpoints
router.get('/:id', getVideoById);
router.post('/:id/view', recordView);

// Feature 3: Like & Unlike endpoints
router.post('/:id/like', addLike);
router.delete('/:id/like', removeLike);

// Feature 4: Follow & Unfollow artist via video ID
router.post('/:id/follow', followArtist);
router.delete('/:id/follow', unfollowArtist);

// Feature 6: Rating endpoint (body: { rating: 1-5 })
router.post('/:id/rate', rateVideo);

// Feature 7: Comments endpoints
router.get('/:id/comments', getComments);
router.post('/:id/comments', postComment);

// Catalog listing
router.get('/', listVideos);

module.exports = router;
