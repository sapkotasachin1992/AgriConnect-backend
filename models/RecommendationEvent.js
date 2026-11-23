const mongoose = require('mongoose');

const RecommendationEvent = mongoose.model(
  'RecommendationEvent',
  new mongoose.Schema(
    {
      userID: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      productID: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
      eventType: { type: String, enum: ['impression', 'click', 'add_to_cart'], required: true },
      rank: { type: Number }, // position in the shown list (1-based)
      score: { type: Number }, // _cbfScore at impression time
      contentSim: { type: Number },
      sameCategory: { type: Boolean },
      queryCategory: { type: String },
      queryCropName: { type: String },
      distanceKm: { type: Number },
      demand: { type: Number },
      price: { type: Number },
      avgRating: { type: Number },
    },
    { timestamps: true }
  )
);

// Training export scans by time;
RecommendationEvent.schema.index({ createdAt: -1 });
RecommendationEvent.schema.index({ userID: 1, productID: 1, eventType: 1, createdAt: -1 });

module.exports = RecommendationEvent;
