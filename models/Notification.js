const mongoose = require('mongoose');

const Notification = mongoose.model(
  'Notification',
  new mongoose.Schema(
    {
      userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      type: { type: String },
      title: { type: String, required: true },
      body: { type: String, required: true },
      link: { type: String, default: '' },
      read: { type: Boolean, default: false },
      meta: { type: Object, default: {} },
    },
    { timestamps: true }
  )
);
// FIX (perf audit): notification bell always queries {userID} sorted by date.
Notification.schema.index({ userID: 1, createdAt: -1 });

module.exports = Notification;
