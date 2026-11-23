const jwt = require('jsonwebtoken');

const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes('your_'));

// Short-lived pending token (10 min) — carries Google profile until user picks a role
const PENDING_SECRET = (process.env.JWT_SECRET || 'agri_secret') + '_pending';
function signPending(profile) {
  return jwt.sign({ pending: true, ...profile }, PENDING_SECRET, { expiresIn: '10m' });
}
function verifyPending(token) {
  try {
    return jwt.verify(token, PENDING_SECRET);
  } catch {
    return null;
  }
}

module.exports = { googleConfigured, PENDING_SECRET, signPending, verifyPending };
