const Notification = require('../models/Notification');
const { getIO } = require('../config/socket');

async function sendNotification(userID, type, title, body, link = '', meta = {}) {
  try {
    const n = await Notification.create({ userID, type, title, body, link, meta });
    getIO().to(`user_${userID}`).emit('notification', n);
    return n;
  } catch (e) {
    console.error('Notif:', e.message);
  }
}

module.exports = { sendNotification };
