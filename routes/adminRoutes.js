const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth } = require('../middlewares/authMiddleware');
const { requireAdmin } = require('../middlewares/adminMiddleware');

router.get('/farmers', auth, requireAdmin, adminController.listFarmers);
router.patch('/farmers/:id/deactivate', auth, requireAdmin, adminController.deactivateFarmer);
router.patch('/farmers/:id/reactivate', auth, requireAdmin, adminController.reactivateFarmer);

module.exports = router;
