const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { auth } = require('../middlewares/authMiddleware');

router.get('/ml/demand-forecast/:productId', auth, analyticsController.demandForecast);
router.get('/analytics', auth, analyticsController.getAnalytics);

module.exports = router;
