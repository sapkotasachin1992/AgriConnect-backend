require('dotenv').config();

(function checkConfig() {
  const warn = (k, hint) => console.warn(`⚠️  ${k} not set — ${hint}`);
  if (!process.env.SMTP_USER || process.env.SMTP_USER.includes('your_'))
    warn('SMTP_USER', 'email OTPs will fail. See AUTH_SETUP_GUIDE.md');
  if (!process.env.SMTP_PASS || process.env.SMTP_PASS.includes('your_'))
    warn('SMTP_PASS', 'email OTPs will fail. Use a Gmail App Password.');
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID.includes('your_'))
    warn('GOOGLE_CLIENT_ID', 'Google sign-in disabled. See AUTH_SETUP_GUIDE.md');
  if (!process.env.KHALTI_SECRET_KEY || process.env.KHALTI_SECRET_KEY.includes('your_'))
    warn(
      'KHALTI_SECRET_KEY',
      'Khalti payments will fail. Get a key from https://test-admin.khalti.com (sandbox) or https://admin.khalti.com (live).'
    );
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change_in_production'))
    warn(
      'JWT_SECRET',
      'using the sample secret — set a unique random value before deploying, or all signed tokens are forgeable.'
    );
})();

// NOTE: dotenv must be loaded before the app/config modules below, because
// several of them read process.env at require time (JWT secret, mailer, Khalti).
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./config/socket');
const registerSocketHandlers = require('./sockets/socketHandlers');
const { dedupeConversations } = require('./services/conversationService');

const server = http.createServer(app);
const io = initSocket(server);
registerSocketHandlers(io);

connectDB()
  .then(async () => {
    await dedupeConversations();
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀  AgriConnect v6.1 on http://localhost:${PORT}`));
