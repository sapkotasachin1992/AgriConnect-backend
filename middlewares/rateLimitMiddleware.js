const rateLimit = require('express-rate-limit');

const rateLimitMessage = (req, res) =>
  res.status(429).json({ message: 'Too many attempts. Please wait a few minutes and try again.' });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitMessage,
}); // login, register, password-change
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 4,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitMessage,
}); // sends a real email — stricter
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitMessage,
}); // checking a code — per-account limit does the heavy lifting

module.exports = { authLimiter, otpSendLimiter, otpVerifyLimiter };
