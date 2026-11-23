const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const { auth } = require('../middlewares/authMiddleware');

router.get('/', auth, conversationController.getConversations);
router.post('/', auth, conversationController.createConversation);
router.get('/:id/messages', auth, conversationController.getMessages);

module.exports = router;
