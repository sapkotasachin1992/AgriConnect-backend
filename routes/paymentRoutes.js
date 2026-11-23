const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { auth } = require('../middlewares/authMiddleware');

router.post('/khalti/initiate', auth, paymentController.khaltiInitiate);
router.post('/khalti/verify', auth, paymentController.khaltiVerify);
router.post('/cod-advance/initiate', auth, paymentController.codAdvanceInitiate);
router.post('/cod-advance/verify', auth, paymentController.codAdvanceVerify);
router.post('/cod', auth, paymentController.codDirect);

module.exports = router;
