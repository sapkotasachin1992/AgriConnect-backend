const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { auth } = require('../middlewares/authMiddleware');
const { chatUpload } = require('../middlewares/uploadMiddleware');

router.post('/upload/chat', auth, chatUpload.single('file'), messageController.uploadChatFile);
router.put('/messages/:id', auth, messageController.editMessage);
router.delete('/messages/:id', auth, messageController.deleteMessage);

module.exports = router;
