const mongoose = require('mongoose');

const Review = mongoose.model(
  'Review',
  new mongoose.Schema(
    {
      productID: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      farmerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      reviewerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      rating: { type: Number, required: true, min: 1, max: 5 },
      comment: { type: String, default: '' },
      orderID: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    },
    { timestamps: true }
  )
);

module.exports = Review;
