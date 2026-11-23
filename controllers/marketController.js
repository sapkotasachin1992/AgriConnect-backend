const Product = require('../models/Product');
const Order = require('../models/Order');

exports.marketInsights = async (req, res) => {
  try {
    const [td, cd, ro] = await Promise.all([
      Product.find({ isAvailable: true })
        .sort({ demand: -1 })
        .limit(5)
        .select('cropName demand price category'),
      Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 }, avgPrice: { $avg: '$price' } } }]),
      Order.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
    ]);
    res.json({ topDemand: td, categoryDist: cd, recentOrders: ro });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
