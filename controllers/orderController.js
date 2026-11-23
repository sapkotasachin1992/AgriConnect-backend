const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { sendNotification } = require('../services/notificationService');

exports.createOrder = async (req, res) => {
  try {
    if (req.user.role === 'Farmer') return res.status(403).json({ message: 'Farmers cannot place orders' });
    const { productID, quantity, deliveryAddress } = req.body;
    const p = await Product.findById(productID);
    if (!p || !p.isAvailable) return res.status(404).json({ message: 'Product not available' });
    if (p.farmerID.toString() === req.user.id)
      return res.status(403).json({ message: 'Cannot buy own product' });
    const qty = Math.min(+quantity, p.quantity);
    // Create order with Unpaid status — payment to be selected by user
    const order = await Order.create({
      farmerID: p.farmerID,
      consumerID: req.user.id,
      productID,
      quantity: qty,
      totalPrice: p.price * qty,
      deliveryAddress: deliveryAddress || '',
      paymentStatus: 'Unpaid',
    });
    const newQty = p.quantity - qty;
    await Product.findByIdAndUpdate(productID, {
      quantity: newQty,
      isAvailable: newQty > 0,
      $inc: { demand: qty },
      $push: { weeklySales: { $each: [qty], $slice: -4 } },
    });
    const consumer = await User.findById(req.user.id).select('name');
    await sendNotification(
      p.farmerID,
      'order_placed',
      '📦 New Order Received',
      `${consumer?.name} ordered ${qty} ${p.unit} of ${p.cropName}`,
      '/dashboard/logistics'
    );
    res.status(201).json(order);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const f = req.user.role === 'Farmer' ? { farmerID: req.user.id } : { consumerID: req.user.id };
    res.json(
      await Order.find(f)
        .populate('productID', 'cropName imageURL price')
        .populate('farmerID', 'name location phone avatar bio')
        .populate('consumerID', 'name location')
        .sort({ createdAt: -1 })
    );
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const existing = await Order.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Order not found' });

    if (existing.farmerID.toString() !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorised to update this order' });
    }
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .populate('productID', 'cropName')
      .populate('consumerID', 'name');
    if (status === 'In-Transit')
      await sendNotification(
        order.consumerID._id,
        'order_shipped',
        '🚚 Order On the Way!',
        `Your ${order.productID?.cropName} is heading to you!`,
        '/dashboard/logistics'
      );
    else if (status === 'Delivered')
      await sendNotification(
        order.consumerID._id,
        'order_delivered',
        '✅ Order Delivered!',
        `Your ${order.productID?.cropName} has been delivered. Please leave a review!`,
        '/dashboard/logistics'
      );
    else if (status === 'Cancelled')
      await sendNotification(
        order.consumerID._id,
        'order_cancelled',
        '❌ Order Cancelled',
        `Your ${order.productID?.cropName} order was cancelled.`,
        '/dashboard/logistics'
      );
    res.json(order);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.getOrderHistory = async (req, res) => {
  try {
    const filter =
      req.user.role === 'Farmer'
        ? { farmerID: req.user.id, status: { $in: ['Delivered', 'Cancelled'] } }
        : { consumerID: req.user.id, status: { $in: ['Delivered', 'Cancelled'] } };
    const orders = await Order.find(filter)
      .populate('productID', 'cropName imageURL price category unit')
      .populate('farmerID', 'name location phone avatar')
      .populate('consumerID', 'name location')
      .sort({ updatedAt: -1 });
    res.json(orders);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
