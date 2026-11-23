const User = require('../models/User');
const Product = require('../models/Product');

exports.listFarmers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const pageNum = Math.max(+page || 1, 1);
    const pageSize = Math.min(+limit || 20, 50);
    const filter = { role: 'Farmer' };
    if (search) filter.name = new RegExp(search, 'i');
    const [total, farmers] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('name email phone avatar location isActive deactivatedAt createdAt')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);
    // One aggregation for all their product counts, instead of N queries
    const farmerIds = farmers.map(f => f._id);
    const counts = await Product.aggregate([
      { $match: { farmerID: { $in: farmerIds } } },
      { $group: { _id: '$farmerID', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map(c => [c._id.toString(), c.count]));
    const withCounts = farmers.map(f => ({ ...f, productCount: countMap.get(f._id.toString()) || 0 }));
    res.json({
      farmers: withCounts,
      pagination: { page: pageNum, limit: pageSize, total, hasMore: pageNum * pageSize < total },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.deactivateFarmer = async (req, res) => {
  try {
    const farmer = await User.findOne({ _id: req.params.id, role: 'Farmer' });
    if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
    farmer.isActive = false;
    farmer.deactivatedAt = new Date();
    await farmer.save();
    const productsResult = await Product.updateMany({ farmerID: farmer._id }, { isAvailable: false });
    console.log(
      `[ADMIN] Farmer ${farmer._id} deactivated by admin ${req.user.id} — ${productsResult.modifiedCount} product(s) hidden`
    );
    res.json({ message: 'Farmer deactivated', hiddenProducts: productsResult.modifiedCount });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.reactivateFarmer = async (req, res) => {
  try {
    const farmer = await User.findOne({ _id: req.params.id, role: 'Farmer' });
    if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
    farmer.isActive = true;
    farmer.deactivatedAt = undefined;
    await farmer.save();

    res.json({ message: 'Farmer reactivated' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
