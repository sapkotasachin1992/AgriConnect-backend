const mongoose = require('mongoose');

const CartItem = mongoose.model(
  'CartItem',
  new mongoose.Schema(
    {
      consumerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      productID: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      quantity: { type: Number, default: 1, min: 1 },
    },
    { timestamps: true }
  )
);

CartItem.schema.index({ consumerID: 1 });
CartItem.schema.index({ consumerID: 1, productID: 1 }, { unique: true });

module.exports = CartItem;
