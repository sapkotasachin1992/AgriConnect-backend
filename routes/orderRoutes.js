const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { auth } = require('../middlewares/authMiddleware');

router.post('/', auth, orderController.createOrder);
router.get('/', auth, orderController.getOrders);
router.patch('/:id/status', auth, orderController.updateOrderStatus);
router.get('/history', auth, orderController.getOrderHistory);

module.exports = router;
