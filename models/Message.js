const mongoose = require('mongoose');

const Message = mongoose.model(
  'Message',
  new mongoose.Schema(
    {
      conversationID: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
      senderID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      text: { type: String, default: '' },
      fileURL: { type: String, default: '' }, // hosted path for image/file
      fileType: { type: String, enum: ['image', 'file', ''], default: '' },
      fileName: { type: String, default: '' }, // original filename for display
      edited: { type: Boolean, default: false },
      deleted: { type: Boolean, default: false }, // soft-delete
      read: { type: Boolean, default: false },
    },
    { timestamps: true }
  )
);

Message.schema.index({ conversationID: 1, createdAt: 1 });

module.exports = Message;
