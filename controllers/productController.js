const Product = require('../models/Product');
const User = require('../models/User');
const { haversineKm } = require('../utils/geoUtils');
const { calcPriceStatus } = require('../utils/pricingUtils');
const { generateFeatureTags } = require('../utils/recommendationUtils');

exports.listProducts = async (req, res) => {
  try {
    const { category, season, search, consumerLat, consumerLng, page = 1, limit = 24 } = req.query;
    const filter = { isAvailable: true };
    if (category) filter.category = category;
    if (season) filter.season = season;
    if (search) filter.cropName = new RegExp(search, 'i');

    const pageNum = Math.max(+page || 1, 1);
    const pageSize = Math.min(+limit || 24, 50);
    const skip = (pageNum - 1) * pageSize;

    const [total, rawProducts] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .populate('farmerID', 'name location phone avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
    ]);

    let products = rawProducts;
    if (consumerLat && consumerLng) {
      const cLat = parseFloat(consumerLat),
        cLng = parseFloat(consumerLng);
      products = products.map(p => ({
        ...p,
        _distKm: haversineKm(cLat, cLng, p.location.lat, p.location.lng),
      }));
      products.sort((a, b) => {
        const aN = a._distKm < 150,
          bN = b._distKm < 150;
        if (aN && !bN) return -1;
        if (!aN && bN) return 1;
        return aN ? a._distKm - b._distKm : b.demand - a.demand;
      });
    }

    res.json({
      products,
      pagination: { page: pageNum, limit: pageSize, total, hasMore: skip + products.length < total },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.viewProduct = async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, { $inc: { demand: 1 } }, { new: true }).populate(
      'farmerID',
      'name location phone avatar bio'
    );
    if (!p) return res.status(404).json({ message: 'Not found' });
    await User.findByIdAndUpdate(req.user.id, {
      $push: { viewHistory: { $each: [{ category: p.category, cropName: p.cropName }], $slice: -20 } },
    });
    res.json(p);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    if (!['Farmer', 'Admin'].includes(req.user.role))
      return res.status(403).json({ message: 'Only farmers can list' });
    // FIX (audit): a deactivated farmer's existing listings are hidden, but
    // without this check they could still publish brand-new ones — closing
    // that bypass so deactivation actually prevents new transactions.
    const requester = await User.findById(req.user.id).select('isActive role');
    if (requester?.role === 'Farmer' && requester?.isActive === false)
      return res.status(403).json({ message: 'Your account has been deactivated. Contact support.' });
    const { price, aiSuggestedPrice, discountPrice, cropName, category, quantity } = req.body;
    const qty = parseFloat(quantity) || 0;
    const p = await Product.create({
      ...req.body,
      quantity: qty,
      isAvailable: qty > 0,
      farmerID: req.user.id,
      priceStatus: calcPriceStatus(price, aiSuggestedPrice, discountPrice),
      featureTags: generateFeatureTags(cropName || '', category || 'Other'),
    });
    res.status(201).json(p);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.getFarmerProducts = async (req, res) => {
  try {
    res.json(await Product.find({ farmerID: req.user.id }).sort({ createdAt: -1 }));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const p = await Product.findByIdAndUpdate(req.params.id, { $inc: { demand: 1 } }, { new: true }).populate(
      'farmerID',
      'name location phone avatar bio avgRating reviewCount'
    );
    if (!p) return res.status(404).json({ message: 'Not found' });
    res.json(p);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Not found' });
    if (p.farmerID.toString() !== req.user.id && req.user.role !== 'Admin')
      return res.status(403).json({ message: 'Not authorised' });
    const merged = { ...p.toObject(), ...req.body };
    const qty = parseFloat(merged.quantity) || 0;
    const u = await Product.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        quantity: qty,
        isAvailable: qty > 0,
        priceStatus: calcPriceStatus(merged.price, merged.aiSuggestedPrice, merged.discountPrice),
        featureTags: generateFeatureTags(merged.cropName, merged.category),
      },
      { new: true }
    );
    res.json(u);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Not found' });
    if (p.farmerID.toString() !== req.user.id && req.user.role !== 'Admin')
      return res.status(403).json({ message: 'Not authorised' });
    await p.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
