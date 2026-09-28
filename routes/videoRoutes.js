const express = require('express');
const { 
  listVideos, 
  getTrendingVideos, 
  getNewVideos, 
  getRecommendedVideos, 
  getVideoDetails 
} = require('../controllers/videoController');

const router = express.Router();

router.get('/trending', getTrendingVideos);
router.get('/new', getNewVideos);
router.get('/recommended', getRecommendedVideos);
router.get('/', listVideos);
router.get('/:id', getVideoDetails);

module.exports = router;
