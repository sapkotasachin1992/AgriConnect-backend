const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { auth } = require('../middlewares/authMiddleware');

router.get('/', auth, cartController.getCart);
router.post('/', auth, cartController.addToCart);
router.patch('/:itemId', auth, cartController.updateCartItem);
router.delete('/:itemId', auth, cartController.removeCartItem);
router.delete('/', auth, cartController.clearCart);
router.post('/checkout', auth, cartController.checkout);

module.exports = router;
