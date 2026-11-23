const CartItem = require('../models/CartItem');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { sendNotification } = require('../services/notificationService');

exports.getCart = async (req, res) => {
  try {
    if (req.user.role === 'Farmer') return res.status(403).json({ message: 'Farmers cannot use cart' });
    const items = await CartItem.find({ consumerID: req.user.id }).populate({
      path: 'productID',
      populate: { path: 'farmerID', select: 'name location avatar' },
    });
    // Return ALL items (even unavailable ones) — client shows "unavailable" badge
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.addToCart = async (req, res) => {
  try {
    if (req.user.role === 'Farmer') return res.status(403).json({ message: 'Farmers cannot add to cart' });
    const { productID, quantity = 1 } = req.body;
    const product = await Product.findById(productID);
    if (!product || !product.isAvailable) return res.status(404).json({ message: 'Product not available' });
    if (product.farmerID.toString() === req.user.id)
      return res.status(403).json({ message: 'Cannot buy own product' });
    // FIX (audit): was find-then-create/update (a read-then-write race under
    // concurrent requests). findOneAndUpdate+upsert is atomic and pairs safely
    // with the new unique (consumerID, productID) index.
    const item = await CartItem.findOneAndUpdate(
      { consumerID: req.user.id, productID },
      { $set: { quantity: Math.min(quantity, product.quantity) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await item.populate({
      path: 'productID',
      populate: { path: 'farmerID', select: 'name location avatar' },
    });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity < 1) {
      await CartItem.findByIdAndDelete(req.params.itemId);
      return res.json({ deleted: true });
    }
    const item = await CartItem.findOneAndUpdate(
      { _id: req.params.itemId, consumerID: req.user.id },
      { quantity },
      { new: true }
    ).populate({ path: 'productID', populate: { path: 'farmerID', select: 'name location avatar' } });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.removeCartItem = async (req, res) => {
  try {
    await CartItem.findOneAndDelete({ _id: req.params.itemId, consumerID: req.user.id });
    res.json({ deleted: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    await CartItem.deleteMany({ consumerID: req.user.id });
    res.json({ cleared: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.checkout = async (req, res) => {
  try {
    if (req.user.role === 'Farmer') return res.status(403).json({ message: 'Farmers cannot checkout' });
    const { deliveryAddress = '' } = req.body;
    const items = await CartItem.find({ consumerID: req.user.id }).populate('productID');
    if (!items.length) return res.status(400).json({ message: 'Cart is empty' });
    // FIX (perf audit): this used to run User.findById(req.user.id) once
    // PER cart item inside the loop below — identical query repeated N
    // times for the same, unchanging user. Fetch it once, reuse it.
    const consumer = await User.findById(req.user.id).select('name');
    const orders = [];
    for (const item of items) {
      const p = item.productID;
      if (!p || !p.isAvailable) continue;
      const qty = Math.min(item.quantity, p.quantity);
      const order = await Order.create({
        farmerID: p.farmerID,
        consumerID: req.user.id,
        productID: p._id,
        quantity: qty,
        totalPrice: p.price * qty,
        deliveryAddress,
        paymentStatus: 'Unpaid',
      });
      const newQty = p.quantity - qty;
      await Product.findByIdAndUpdate(p._id, {
        quantity: newQty,
        isAvailable: newQty > 0,
        $inc: { demand: qty },
        $push: { weeklySales: { $each: [qty], $slice: -4 } },
      });
      orders.push(order);
      await sendNotification(
        p.farmerID,
        'order_placed',
        '📦 New Order Received',
        `${consumer?.name} ordered ${qty} ${p.unit} of ${p.cropName}`,
        '/dashboard/logistics',
        { orderId: order._id }
      );
    }
    await CartItem.deleteMany({ consumerID: req.user.id });
    res.json({ orders, message: `${orders.length} order(s) placed — please complete payment` });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
