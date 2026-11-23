const Review = require('../models/Review');
const Product = require('../models/Product');
const User = require('../models/User');
const { sendNotification } = require('../services/notificationService');

exports.getProductReviews = async (req, res) => {
  try {
    res.json(
      await Review.find({ productID: req.params.productId })
        .populate('reviewerID', 'name avatar')
        .sort({ createdAt: -1 })
    );
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.getFarmerReviews = async (req, res) => {
  try {
    res.json(
      await Review.find({ farmerID: req.params.farmerId })
        .populate('reviewerID', 'name avatar')
        .populate('productID', 'cropName')
        .sort({ createdAt: -1 })
    );
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.createReview = async (req, res) => {
  try {
    if (req.user.role === 'Farmer') return res.status(403).json({ message: 'Farmers cannot review' });
    const { productID, rating, comment, orderID } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating 1-5' });
    const product = await Product.findById(productID);
    if (!product) return res.status(404).json({ message: 'Not found' });
    if (await Review.findOne({ productID, reviewerID: req.user.id }))
      return res.status(409).json({ message: 'Already reviewed' });
    const review = await Review.create({
      productID,
      farmerID: product.farmerID,
      reviewerID: req.user.id,
      rating,
      comment: comment || '',
      orderID,
    });
    const agg = await Review.aggregate([
      { $match: { productID: product._id } },
      { $group: { _id: null, avg: { $avg: '$rating' }, cnt: { $sum: 1 } } },
    ]);
    await Product.findByIdAndUpdate(productID, {
      avgRating: parseFloat((agg[0]?.avg || rating).toFixed(1)),
      reviewCount: agg[0]?.cnt || 1,
    });
    const reviewer = await User.findById(req.user.id).select('name');
    await sendNotification(
      product.farmerID,
      'new_review',
      `⭐ New ${rating}-Star Review`,
      `${reviewer?.name} reviewed ${product.cropName}`,
      '/dashboard/farmer'
    );
    res.status(201).json(await Review.findById(review._id).populate('reviewerID', 'name avatar'));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
