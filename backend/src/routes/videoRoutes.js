const express = require('express');
const router = express.Router();
const {
  listVideos,
  getTrendingVideos,
  getNewVideos,
  getRecommendedVideos,
  getVideoById,
  recordView,
} = require('../controllers/videoController');

router.get('/trending', getTrendingVideos);
router.get('/new', getNewVideos);
router.get('/recommended', getRecommendedVideos);
router.get('/:id', getVideoById);
router.post('/:id/view', recordView);
router.get('/', listVideos);

module.exports = router;
