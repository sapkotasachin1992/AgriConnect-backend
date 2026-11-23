const Message = require('../models/Message');

exports.uploadChatFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const imageExts = /\.(jpg|jpeg|png|gif|webp)$/i;
    const fileType = imageExts.test(req.file.originalname) ? 'image' : 'file';
    const fileURL = `/uploads/${req.file.filename}`;
    res.json({ fileURL, fileType, fileName: req.file.originalname, size: req.file.size });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.editMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Text required' });
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (msg.senderID.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorised' });
    if (msg.deleted) return res.status(400).json({ message: 'Cannot edit deleted message' });
    msg.text = text.trim();
    msg.edited = true;
    await msg.save();
    const populated = await Message.findById(msg._id).populate('senderID', 'name avatar');
    res.json(populated);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (msg.senderID.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorised' });
    msg.deleted = true;
    msg.text = '';
    msg.fileURL = '';
    msg.fileName = '';
    await msg.save();
    res.json({ deleted: true, messageID: msg._id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
