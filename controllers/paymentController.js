const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { khaltiRequest, CLIENT_BASE } = require('../services/paymentService');
const { sendNotification } = require('../services/notificationService');

exports.khaltiInitiate = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId)
      .populate('productID', 'cropName')
      .populate('consumerID', 'name email phone');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.consumerID._id.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not authorised' });
    if (['Paid', 'AdvancePaid'].includes(order.paymentStatus))
      return res.status(400).json({ message: 'Order already paid' });

    const amountPaisa = Math.round(order.totalPrice * 100); // Khalti uses paisa
    const txnRef = `agri-full-${order._id}-${Date.now()}`;

    const payload = {
      return_url: `${CLIENT_BASE}/payment/callback?method=khalti&type=full&orderId=${orderId}`,
      website_url: CLIENT_BASE,
      amount: amountPaisa,
      purchase_order_id: txnRef,
      purchase_order_name: `AgriConnect - ${order.productID?.cropName || 'Order'}`,
      customer_info: {
        name: order.consumerID?.name || 'Customer',
        email: order.consumerID?.email || '',
        phone: order.consumerID?.phone || '',
      },
    };

    const khaltiResp = await khaltiRequest('/api/v2/epayment/initiate/', payload);
    // khaltiResp: { pidx, payment_url, expires_at, expires_in }

    await Payment.create({
      orderID: order._id,
      userID: req.user.id,
      method: 'Khalti',
      amount: order.totalPrice,
      status: 'Initiated',
      refId: khaltiResp.pidx,
    });
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: 'Initiated',
      paymentMethod: 'Khalti',
      paymentRef: txnRef,
    });

    res.json({ paymentUrl: khaltiResp.payment_url, pidx: khaltiResp.pidx });
  } catch (e) {
    console.error('[Khalti initiate]', e.response?.data || e.message);
    res.status(502).json({ message: 'Could not start Khalti payment right now. Please try again shortly.' });
  }
};

exports.khaltiVerify = async (req, res) => {
  try {
    const { pidx, orderId } = req.body;
    if (!pidx || !orderId) return res.status(400).json({ message: 'pidx and orderId are required' });

    // Prevent duplicate processing
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.consumerID.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not authorised' });
    if (order.paymentStatus === 'Paid')
      return res.json({ success: true, message: 'Already paid', alreadyVerified: true });

    // Server-to-server verification with Khalti
    const lookup = await khaltiRequest('/api/v2/epayment/lookup/', { pidx });
    // lookup: { pidx, total_amount, status, transaction_id, fee, refunded }

    if (lookup.status !== 'Completed') {
      await Order.findByIdAndUpdate(orderId, { paymentStatus: 'Failed' });
      return res.json({ success: false, message: `Payment status: ${lookup.status}` });
    }

    // Validate amount (Khalti returns paisa)
    const expectedPaisa = Math.round(order.totalPrice * 100);
    if (lookup.total_amount !== expectedPaisa) {
      console.error(`[Khalti] Amount mismatch: expected ${expectedPaisa}, got ${lookup.total_amount}`);
      return res
        .status(400)
        .json({ success: false, message: 'Payment amount mismatch. Please contact support.' });
    }

    await Payment.findOneAndUpdate(
      { refId: pidx },
      { status: 'Completed', transactionId: lookup.transaction_id, rawResponse: lookup }
    );
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: 'Paid',
      paymentMethod: 'Khalti',
      paymentRef: lookup.transaction_id,
    });

    const populated = await Order.findById(orderId)
      .populate('productID', 'cropName')
      .populate('consumerID', 'name');
    if (populated) {
      await sendNotification(
        populated.farmerID,
        'order_placed',
        '💜 Khalti Payment Received',
        `NPR ${populated.totalPrice} from ${populated.consumerID?.name} for ${populated.productID?.cropName}`,
        '/dashboard/logistics'
      );
    }
    res.json({ success: true, message: 'Khalti payment verified!', transactionId: lookup.transaction_id });
  } catch (e) {
    console.error('[Khalti verify]', e.response?.data || e.message);
    res
      .status(502)
      .json({
        message:
          'Could not verify Khalti payment right now. If you were charged, contact support with your order ID.',
      });
  }
};

exports.codAdvanceInitiate = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId)
      .populate('productID', 'cropName')
      .populate('consumerID', 'name email phone');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.consumerID._id.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not authorised' });
    if (['Paid', 'AdvancePaid'].includes(order.paymentStatus))
      return res.status(400).json({ message: 'Already paid' });

    const advanceAmount = Math.round(order.totalPrice * 0.25);
    const remainingAmount = order.totalPrice - advanceAmount;
    const advancePaisa = Math.round(advanceAmount * 100); // Khalti uses paisa
    const txnRef = `agri-adv-${order._id}-${Date.now()}`;

    const payload = {
      return_url: `${CLIENT_BASE}/payment/callback?method=khalti&type=advance&orderId=${orderId}`,
      website_url: CLIENT_BASE,
      amount: advancePaisa,
      purchase_order_id: txnRef,
      purchase_order_name: `AgriConnect COD Advance - ${order.productID?.cropName || 'Order'}`,
      customer_info: {
        name: order.consumerID?.name || 'Customer',
        email: order.consumerID?.email || '',
        phone: order.consumerID?.phone || '',
      },
    };

    const khaltiResp = await khaltiRequest('/api/v2/epayment/initiate/', payload);

    await Payment.create({
      orderID: order._id,
      userID: req.user.id,
      method: 'Khalti-Advance',
      amount: advanceAmount,
      status: 'Initiated',
      refId: khaltiResp.pidx,
    });
    await Order.findByIdAndUpdate(orderId, {
      paymentStatus: 'Initiated',
      paymentMethod: 'COD',
      paymentRef: txnRef,
      advanceAmount,
      remainingAmount,
    });

    res.json({ paymentUrl: khaltiResp.payment_url, pidx: khaltiResp.pidx, advanceAmount, remainingAmount });
  } catch (e) {
    console.error('[Khalti COD advance initiate]', e.response?.data || e.message);
    res
      .status(502)
      .json({ message: 'Could not start the Khalti advance payment right now. Please try again shortly.' });
  }
};

exports.codAdvanceVerify = async (req, res) => {
  try {
    const { pidx, orderId } = req.body;
    if (!pidx || !orderId) return res.status(400).json({ message: 'pidx and orderId are required' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.consumerID.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not authorised' });
    if (order.paymentStatus === 'AdvancePaid')
      return res.json({ success: true, message: 'Advance already verified', alreadyVerified: true, order });

    // Server-to-server verification with Khalti
    const lookup = await khaltiRequest('/api/v2/epayment/lookup/', { pidx });

    if (lookup.status !== 'Completed') {
      await Order.findByIdAndUpdate(orderId, { paymentStatus: 'Failed' });
      return res.json({ success: false, message: `Advance payment status: ${lookup.status}` });
    }

    // Validate advance amount
    const expectedPaisa = Math.round(order.advanceAmount * 100);
    if (lookup.total_amount !== expectedPaisa) {
      console.error(`[Khalti COD] Amount mismatch: expected ${expectedPaisa}, got ${lookup.total_amount}`);
      return res
        .status(400)
        .json({ success: false, message: 'Advance amount mismatch. Please contact support.' });
    }

    await Payment.findOneAndUpdate(
      { refId: pidx },
      { status: 'Completed', transactionId: lookup.transaction_id, rawResponse: lookup }
    );
    const updated = await Order.findByIdAndUpdate(
      orderId,
      { paymentStatus: 'AdvancePaid', paymentMethod: 'COD', advanceTxnRef: lookup.transaction_id },
      { new: true }
    )
      .populate('productID', 'cropName')
      .populate('consumerID', 'name');

    if (updated) {
      await sendNotification(
        updated.farmerID,
        'order_placed',
        '💜 COD Order — Advance Paid via Khalti',
        `${updated.consumerID?.name} paid NPR ${updated.advanceAmount} advance for ${updated.productID?.cropName}. Collect NPR ${updated.remainingAmount} on delivery.`,
        '/dashboard/logistics'
      );
    }
    res.json({
      success: true,
      message: 'Advance verified! Pay the rest on delivery.',
      transactionId: lookup.transaction_id,
      order: updated,
    });
  } catch (e) {
    console.error('[Khalti COD advance verify]', e.response?.data || e.message);
    res
      .status(502)
      .json({
        message:
          'Could not verify the Khalti advance payment right now. If you were charged, contact support with your order ID.',
      });
  }
};

exports.codDirect = async (req, res) => {
  res.status(400).json({
    message: 'Direct COD without advance is not available. Please use COD with 25% Khalti advance.',
    codAdvanceRequired: true,
  });
};
