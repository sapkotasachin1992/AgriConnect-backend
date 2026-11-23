const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { auth } = require('../middlewares/authMiddleware');

router.get('/:productId', reviewController.getProductReviews);
router.get('/farmer/:farmerId', reviewController.getFarmerReviews);
router.post('/', auth, reviewController.createReview);

module.exports = router;
