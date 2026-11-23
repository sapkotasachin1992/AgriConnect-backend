const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { makePairKey } = require('../utils/chatUtils');

const CHAT_PAGE_SIZE = 30;

exports.getConversations = async (req, res) => {
  try {
    // Only return conversations where this user is a participant
    const convs = await Conversation.find({ participants: req.user.id })
      .populate('participants', 'name avatar role')
      .populate('productID', 'cropName imageURL')
      .sort({ lastMessageAt: -1 });
    res.json(convs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.createConversation = async (req, res) => {
  try {
    const { otherUserID, productID } = req.body;
    if (!otherUserID) return res.status(400).json({ message: 'otherUserID required' });
    if (otherUserID === req.user.id)
      return res.status(400).json({ message: 'Cannot start a conversation with yourself' });

    const pairKey = makePairKey(req.user.id, otherUserID);
    const conv = await Conversation.findOneAndUpdate(
      { pairKey },
      { $setOnInsert: { participants: [req.user.id, otherUserID], pairKey, productID: productID || null } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await conv.populate('participants', 'name avatar role');
    if (conv.productID) await conv.populate('productID', 'cropName imageURL');
    res.json(conv);
  } catch (e) {
    if (e.code === 11000) {
      try {
        const pairKey = makePairKey(req.user.id, req.body.otherUserID);
        const conv = await Conversation.findOne({ pairKey }).populate('participants', 'name avatar role');
        if (conv) return res.json(conv);
      } catch {}
    }
    res.status(500).json({ message: e.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });
    // Strict: only participants can read messages
    if (!conv.participants.some(p => p.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Access denied — you are not part of this conversation' });
    }

    const filter = { conversationID: req.params.id };
    if (req.query.before) {
      const cursorMsg = await Message.findById(req.query.before).select('createdAt');
      if (cursorMsg) filter.createdAt = { $lt: cursorMsg.createdAt };
    }

    // Fetch newest-first for pagination, then reverse to chronological order for display
    const page = await Message.find(filter)
      .populate('senderID', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(CHAT_PAGE_SIZE);
    const msgs = page.reverse();
    const hasMore = page.length === CHAT_PAGE_SIZE;

    // Mark messages as read (only relevant on the initial/latest page load)
    if (!req.query.before) {
      await Message.updateMany(
        { conversationID: req.params.id, senderID: { $ne: req.user.id }, read: false },
        { read: true }
      );
      await Conversation.findByIdAndUpdate(req.params.id, { [`unreadCount.${req.user.id}`]: 0 });
    }

    res.json({ messages: msgs, hasMore });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
