const Product = require('../models/Product');
const RecommendationEvent = require('../models/RecommendationEvent');
const { contentBasedRecommend } = require('../utils/recommendationUtils');
const { resolveCategory } = require('../services/recommendationService');

exports.recordEvent = async (req, res) => {
  try {
    const {
      productID,
      eventType,
      rank,
      score,
      contentSim,
      sameCategory,
      queryCategory,
      queryCropName,
      distanceKm,
      demand,
      price,
      avgRating,
    } = req.body;
    if (!productID || !['impression', 'click', 'add_to_cart'].includes(eventType)) {
      return res.status(400).json({ message: 'productID and a valid eventType are required' });
    }
    await RecommendationEvent.create({
      userID: req.user.id,
      productID,
      eventType,
      rank,
      score,
      contentSim,
      sameCategory,
      queryCategory,
      queryCropName,
      distanceKm,
      demand,
      price,
      avgRating,
    });
    res.status(204).end();
  } catch (e) {
    console.error('[rec-event]', e.message);
    res.status(204).end(); // never let analytics logging break the UI
  }
};

exports.recommendProducts = async (req, res) => {
  try {
    let { category, cropName = '', consumerLat, consumerLng, viewHistory = [], excludeId } = req.body;
    const all = await Product.find({ isAvailable: true }).populate('farmerID', 'name location avatar').lean();

    category = resolveCategory(all, category, cropName);

    const { products, reason } = contentBasedRecommend({
      queryCategory: category,
      queryCropName: cropName,
      allProducts: all,
      viewHistory,
      consumerLat: consumerLat ? +consumerLat : null,
      consumerLng: consumerLng ? +consumerLng : null,
      topN: 8,
      excludeId,
    });
    res.json({ products, reason, count: products.length, resolvedCategory: category });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
