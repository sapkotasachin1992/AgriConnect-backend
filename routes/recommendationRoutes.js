const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');
const { auth } = require('../middlewares/authMiddleware');

router.post('/recommendations/event', auth, recommendationController.recordEvent);
router.post('/products/recommend', recommendationController.recommendProducts);

module.exports = router;
