const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth } = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimitMiddleware');

router.get('/me', auth, userController.getMe);
router.put('/profile', auth, authLimiter, userController.updateProfile);
router.patch('/language', auth, userController.updateLanguage);

module.exports = router;
