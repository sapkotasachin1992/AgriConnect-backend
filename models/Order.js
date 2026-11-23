const mongoose = require('mongoose');

const Order = mongoose.model(
  'Order',
  new mongoose.Schema(
    {
      farmerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      consumerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      productID: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, required: true },
      totalPrice: { type: Number, required: true },
      status: { type: String, enum: ['Pending', 'In-Transit', 'Delivered', 'Cancelled'], default: 'Pending' },
      paymentStatus: {
        type: String,
        enum: ['Unpaid', 'Initiated', 'AdvancePaid', 'Paid', 'Failed', 'Refunded'],
        default: 'Unpaid',
      },
      paymentMethod: { type: String, default: '' },
      paymentRef: { type: String, default: '' },
      routeData: { type: Object, default: {} },
      deliveryAddress: { type: String, default: '' },
      // COD with 25% advance via Khalti
      advanceAmount: { type: Number, default: 0 }, // 25% paid via Khalti upfront
      remainingAmount: { type: Number, default: 0 }, // 75% to be collected on delivery
      advanceTxnRef: { type: String, default: '' }, // Khalti transaction ID for advance
    },
    { timestamps: true }
  )
);
// FIX (perf audit): GET /api/orders always filters by one of these.
Order.schema.index({ consumerID: 1, createdAt: -1 });
Order.schema.index({ farmerID: 1, createdAt: -1 });

module.exports = Order;
