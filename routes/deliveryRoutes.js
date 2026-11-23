const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const { auth } = require('../middlewares/authMiddleware');

router.get('/nearest-farmers', auth, deliveryController.nearestFarmers);
router.post('/optimize-route/preview', auth, deliveryController.previewRoute);
router.get('/optimize-route/:orderId', auth, deliveryController.optimizeOrderRoute);

module.exports = router;
