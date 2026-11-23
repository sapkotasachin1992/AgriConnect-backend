const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { auth } = require('../middlewares/authMiddleware');

router.get('/', productController.listProducts);
router.post('/:id/view', auth, productController.viewProduct);
router.post('/', auth, productController.createProduct);
router.get('/farmer', auth, productController.getFarmerProducts);
router.get('/:id', productController.getProduct);
router.put('/:id', auth, productController.updateProduct);
router.delete('/:id', auth, productController.deleteProduct);

module.exports = router;
