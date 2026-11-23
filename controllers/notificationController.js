const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const n = await Notification.find({ userID: req.user.id }).sort({ createdAt: -1 }).limit(30);
    res.json({
      notifications: n,
      unread: await Notification.countDocuments({ userID: req.user.id, read: false }),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ userID: req.user.id, read: false }, { read: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
