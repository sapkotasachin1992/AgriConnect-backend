const crypto = require('crypto');

function makeOTP() {
  return crypto.randomInt(100000, 1000000).toString(); // 6-digit
}

function hashOTP(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}
const MAX_OTP_ATTEMPTS = 5; // beyond this, the code is invalidated — user must request a new one

module.exports = { makeOTP, hashOTP, MAX_OTP_ATTEMPTS };
