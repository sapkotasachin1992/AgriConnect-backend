const mongoose = require('mongoose');

const Product = mongoose.model(
  'Product',
  new mongoose.Schema(
    {
      farmerID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      cropName: { type: String, required: true, trim: true },
      description: { type: String, default: '' },
      category: {
        type: String,
        enum: ['Vegetable', 'Fruit', 'Grain', 'Dairy', 'Herb', 'Other'],
        default: 'Other',
      },
      quantity: { type: Number, required: true, min: 0 },
      unit: { type: String, default: 'kg' },
      price: { type: Number, required: true, min: 0 },
      discountPrice: { type: Number, default: null },
      aiSuggestedPrice: { type: Number, default: 0 },
      priceStatus: { type: String, enum: ['match', 'sale', 'above', 'none'], default: 'none' },
      location: {
        city: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      season: { type: String, default: 'Year-Round' },
      imageURL: { type: String, default: '' },
      isAvailable: { type: Boolean, default: true },
      demand: { type: Number, default: 0 },
      featureTags: [String],
      avgRating: { type: Number, default: 0 },
      reviewCount: { type: Number, default: 0 },
      weeklySales: { type: [Number], default: [0, 0, 0, 0] },
    },
    { timestamps: true }
  )
);
// farmerID or isAvailable — without these, Mongo does a full collection scan.
Product.schema.index({ farmerID: 1 });
Product.schema.index({ isAvailable: 1, category: 1 });

module.exports = Product;
