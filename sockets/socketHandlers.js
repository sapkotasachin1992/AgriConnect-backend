const jwt = require('jsonwebtoken');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { SECRET } = require('../utils/generateToken');
const { sendNotification } = require('../services/notificationService');

/** Registers Socket.IO auth + all connection/event handlers on the given io instance. */
function registerSocketHandlers(io) {
  io.use((socket, next) => {
    try {
      socket.user = jwt.verify(socket.handshake.auth?.token, SECRET);
      next();
    } catch {
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', socket => {
    const uid = socket.user.id;
    socket.join(`user_${uid}`); // personal room for notifications

    /* JOIN conversation — verify membership first */
    socket.on('join_conversation', async convId => {
      try {
        const conv = await Conversation.findById(convId);
        if (!conv) return;
        // Only join if this user is actually a participant
        const isParticipant = conv.participants.some(p => p.toString() === uid);
        if (!isParticipant) {
          console.warn(`[CHAT] User ${uid} tried to join conv ${convId} — NOT a participant`);
          return;
        }
        socket.join(`conv_${convId}`);
      } catch (e) {
        console.error('join_conversation error:', e.message);
      }
    });

    /* SEND MESSAGE — verify sender is a participant */
    socket.on('send_message', async ({ conversationID, text, fileURL, fileType, fileName }) => {
      if (!text?.trim() && !fileURL) return;
      try {
        const conv = await Conversation.findById(conversationID);
        if (!conv) return;
        const isParticipant = conv.participants.some(p => p.toString() === uid);
        if (!isParticipant) {
          console.warn(`[CHAT] User ${uid} tried to send to conv ${conversationID} — NOT a participant`);
          socket.emit('error_msg', { message: 'You are not part of this conversation' });
          return;
        }
        const msgData = {
          conversationID,
          senderID: uid,
          text: (text || '').trim(),
          fileURL: fileURL || '',
          fileType: fileType || '',
          fileName: fileName || '',
        };
        const msg = await Message.create(msgData);
        const other = conv.participants.find(p => p.toString() !== uid);
        const lastMsg = fileURL
          ? fileType === 'image'
            ? '📷 Image'
            : `📎 ${fileName || 'File'}`
          : (text || '').trim().slice(0, 80);

        // Update conversation metadata
        const unreadUpdate = { lastMessage: lastMsg, lastMessageAt: new Date() };
        if (other) unreadUpdate[`unreadCount.${other}`] = (conv.unreadCount?.get(other.toString()) || 0) + 1;
        await Conversation.findByIdAndUpdate(conversationID, unreadUpdate);

        const populated = await Message.findById(msg._id).populate('senderID', 'name avatar');
        // Broadcast to conversation room — client deduplicates by _id
        io.to(`conv_${conversationID}`).emit('new_message', populated);

        // Notify ONLY the OTHER participant — never the sender
        if (other && other.toString() !== uid) {
          const sender = await User.findById(uid).select('name');
          const preview = fileURL
            ? `${sender?.name} sent ${fileType === 'image' ? 'an image' : 'a file'}`
            : text?.trim().slice(0, 60) || '';
          sendNotification(
            other,
            'chat_message',
            `💬 Message from ${sender?.name}`,
            preview,
            '/dashboard/chat'
          );
          // Real-time unread badge update for the other user only
          io.to(`user_${other}`).emit('conv_update', { conversationID, lastMessage: lastMsg });
        }
      } catch (e) {
        console.error('send_message error:', e.message);
      }
    });

    // Edit message text (only sender can edit)
    socket.on('edit_message', async ({ messageID, text }) => {
      try {
        if (!text?.trim()) return;
        const msg = await Message.findById(messageID);
        if (!msg || msg.senderID.toString() !== uid || msg.deleted) return;
        msg.text = text.trim();
        msg.edited = true;
        await msg.save();
        const populated = await Message.findById(msg._id).populate('senderID', 'name avatar');
        io.to(`conv_${msg.conversationID}`).emit('message_edited', populated);
      } catch (e) {
        console.error('edit_message error:', e.message);
      }
    });

    // Soft-delete message (only sender can delete)
    socket.on('delete_message', async ({ messageID }) => {
      try {
        const msg = await Message.findById(messageID);
        if (!msg || msg.senderID.toString() !== uid) return;
        msg.deleted = true;
        msg.text = '';
        msg.fileURL = '';
        msg.fileName = '';
        await msg.save();
        io.to(`conv_${msg.conversationID}`).emit('message_deleted', {
          messageID,
          conversationID: msg.conversationID.toString(),
        });
      } catch (e) {
        console.error('delete_message error:', e.message);
      }
    });

    socket.on('mark_read', async ({ conversationID }) => {
      try {
        // Verify participant before marking read
        const conv = await Conversation.findById(conversationID);
        if (!conv) return;
        if (!conv.participants.some(p => p.toString() === uid)) return;
        await Message.updateMany({ conversationID, senderID: { $ne: uid }, read: false }, { read: true });
        await Conversation.findByIdAndUpdate(conversationID, { [`unreadCount.${uid}`]: 0 });
        // Notify other participant their messages are read
        const other = conv.participants.find(p => p.toString() !== uid);
        if (other) io.to(`user_${other}`).emit('messages_read', { conversationID });
      } catch (e) {
        console.error('mark_read error:', e.message);
      }
    });

    socket.on('disconnect', () => {});
  });
}

module.exports = registerSocketHandlers;
