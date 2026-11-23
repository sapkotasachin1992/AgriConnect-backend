const mongoose = require('mongoose');

const Conversation = mongoose.model(
  'Conversation',
  new mongoose.Schema(
    {
      participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

      pairKey: { type: String, unique: true, sparse: true },

      productID: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      lastMessage: { type: String, default: '' },
      lastMessageAt: { type: Date, default: Date.now },
      unreadCount: { type: Map, of: Number, default: {} },
    },
    { timestamps: true }
  )
);
Conversation.schema.index({ participants: 1 });

module.exports = Conversation;
