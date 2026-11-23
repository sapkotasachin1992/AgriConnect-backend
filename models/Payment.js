const mongoose = require('mongoose');

const Payment = mongoose.model(
  'Payment',
  new mongoose.Schema(
    {
      orderID: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
      userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      method: String,
      amount: Number,
      status: String,
      refId: String,
      transactionId: String,
      rawResponse: Object,
    },
    { timestamps: true }
  )
);

module.exports = Payment;
