const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { predictDemand } = require('../ml/predictDemand');

/** Least-squares slope over the weekly sales window → rising / falling / stable. */
function computeTrend(ws = [0, 0, 0, 0]) {
  const n = ws.length;
  if (n < 2) return { slope: 0, direction: 'stable' };
  const xM = (n - 1) / 2,
    yM = ws.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  ws.forEach((y, x) => {
    num += (x - xM) * (y - yM);
    den += (x - xM) ** 2;
  });
  const slope = den > 0 ? num / den : 0;
  return {
    slope: parseFloat(slope.toFixed(2)),
    direction: slope > 0.5 ? 'rising' : slope < -0.5 ? 'falling' : 'stable',
  };
}

exports.demandForecast = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId).select('farmerID');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.farmerID.toString() !== req.user.id && req.user.role !== 'Admin') {
      return res.status(403).json({ message: "Not authorised to view this product's forecast" });
    }
    const result = await predictDemand(Order, Product, req.params.productId);
    res.json(result);
  } catch (e) {
    console.error('[ML demand-forecast]', e.message);
    res.status(500).json({ message: 'Could not generate a forecast right now.' });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const [
      totalUsers,
      totalFarmers,
      totalConsumers,
      totalProducts,
      totalOrders,
      totalRevenue,
      weekOrders,
      categoryDist,
      topProducts,
      dailyOrders,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'Farmer' }),
      User.countDocuments({ role: 'Consumer' }),
      Product.countDocuments({ isAvailable: true }),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
      ]),
      Order.countDocuments({ createdAt: { $gte: weekAgo } }),
      Product.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            avgPrice: { $avg: '$price' },
            totalDemand: { $sum: '$demand' },
          },
        },
      ]),
      Product.find({ isAvailable: true })
        .sort({ demand: -1 })
        .limit(10)
        .select('cropName demand price category avgRating weeklySales'),
      Order.aggregate([
        { $match: { createdAt: { $gte: weekAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            revenue: { $sum: '$totalPrice' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const trendData = topProducts.map(p => {
      const trend = computeTrend(p.weeklySales || [0, 0, 0, 0]);
      const message =
        trend.direction === 'rising'
          ? `${p.cropName} demand is increasing 📊`
          : trend.direction === 'falling'
            ? `${p.cropName} demand is slowing`
            : `${p.cropName} demand is stable`;
      const pricePrediction =
        trend.direction === 'rising'
          ? 'Price may rise next week 📈'
          : trend.direction === 'falling'
            ? 'Price may drop — good time to buy'
            : 'Price expected to remain stable';
      return {
        _id: p._id,
        cropName: p.cropName,
        category: p.category,
        demand: p.demand,
        price: p.price,
        avgRating: p.avgRating,
        trend,
        message,
        pricePrediction,
      };
    });
    res.json({
      summary: {
        totalUsers,
        totalFarmers,
        totalConsumers,
        totalProducts,
        totalOrders,
        weekOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
      categoryDist,
      topProducts: trendData,
      dailyOrders,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
