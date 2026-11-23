const express = require('express');
const router = express.Router();
const marketController = require('../controllers/marketController');
const { auth } = require('../middlewares/authMiddleware');

router.get('/market-insights', auth, marketController.marketInsights);

module.exports = router;
