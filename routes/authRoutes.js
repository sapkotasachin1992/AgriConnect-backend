const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter, otpSendLimiter, otpVerifyLimiter } = require('../middlewares/rateLimitMiddleware');

router.get('/check-email', authController.checkEmail);
router.post('/register', authLimiter, authController.register);
router.post('/verify-email', otpVerifyLimiter, authController.verifyEmail);
router.post('/resend-otp', otpSendLimiter, authController.resendOtp);
router.post('/login', authLimiter, authController.login);
router.post('/forgot-password', otpSendLimiter, authController.forgotPassword);
router.post('/verify-reset-otp', otpVerifyLimiter, authController.verifyResetOtp);
router.post('/reset-password', authController.resetPassword);
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);
router.post('/google/complete', authController.googleComplete);
router.get('/config-status', authController.configStatus);

module.exports = router;
