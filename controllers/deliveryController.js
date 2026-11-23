const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { haversineKm } = require('../utils/geoUtils');
const { buildGraph, aStar, fmtTime } = require('../services/deliveryService');

exports.nearestFarmers = async (req, res) => {
  try {
    const { lat, lng, limit = 5 } = req.query;
    if (!lat || !lng) return res.status(400).json({ message: 'lat and lng required' });
    const cLat = +lat,
      cLng = +lng;
    const requestedLimit = Math.min(+limit || 5, 50);

    const farmers = await User.find({
      role: 'Farmer',
      isActive: { $ne: false },
      'location.lat': { $exists: true, $ne: null },
    })
      .select('name location avatar bio')
      .lean();

    const CANDIDATE_CAP = Math.max(requestedLimit * 4, 20);
    const withDirect = farmers.map(f => ({
      f,
      directKm: haversineKm(cLat, cLng, f.location.lat, f.location.lng),
    }));
    withDirect.sort((a, b) => a.directKm - b.directKm);
    const candidates = withDirect.slice(0, CANDIDATE_CAP);

    // ONE query for product counts + ratings across ALL candidates,
    // instead of 2 separate queries per farmer.
    const farmerIds = candidates.map(c => c.f._id);
    const stats = await Product.aggregate([
      { $match: { farmerID: { $in: farmerIds }, isAvailable: true } },
      {
        $group: {
          _id: '$farmerID',
          productCount: { $sum: 1 },
          avgRating: { $avg: { $cond: [{ $gt: ['$avgRating', 0] }, '$avgRating', null] } },
        },
      },
    ]);
    const statsById = new Map(stats.map(s => [s._id.toString(), s]));

    const results = candidates
      .map(({ f, directKm }) => {
        const { graph, nodeMap } = buildGraph(
          { lat: f.location.lat, lng: f.location.lng, label: f.name },
          { lat: cLat, lng: cLng, label: 'You' }
        );
        const result = aStar(graph, 'FARM', 'DEST', nodeMap);
        if (!result) return null;
        const waypoints = result.path.map(id => ({
          id,
          label: nodeMap[id]?.label || id,
          lat: nodeMap[id]?.lat,
          lng: nodeMap[id]?.lng,
        }));
        const s = statsById.get(f._id.toString());
        return {
          farmer: {
            ...f,
            productCount: s?.productCount || 0,
            avgRating: parseFloat((s?.avgRating || 0).toFixed(1)),
          },
          distance: result.distance,
          estimatedTime: fmtTime(result.distance),
          waypoints,
          directKm: parseFloat(directKm.toFixed(1)),
        };
      })
      .filter(Boolean);

    results.sort((a, b) => a.distance - b.distance);
    res.json({ farmers: results.slice(0, requestedLimit) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.previewRoute = async (req, res) => {
  try {
    const { farmLat = 28.2, farmLng = 84.0, destLat = 27.7, destLng = 85.3, farmLabel, destLabel } = req.body;
    const { graph, nodeMap } = buildGraph(
      { lat: +farmLat, lng: +farmLng, label: farmLabel || 'Farm' },
      { lat: +destLat, lng: +destLng, label: destLabel || 'Customer' }
    );
    const result = aStar(graph, 'FARM', 'DEST', nodeMap);
    if (!result) return res.status(422).json({ message: 'No route' });
    const waypoints = result.path.map(id => ({
      id,
      label: nodeMap[id]?.label || id,
      lat: nodeMap[id]?.lat,
      lng: nodeMap[id]?.lng,
    }));
    res.json({
      path: result.path,
      distance: result.distance,
      waypoints,
      estimatedTime: fmtTime(result.distance),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.optimizeOrderRoute = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('farmerID', 'name location')
      .populate('consumerID', 'name location')
      .populate('productID', 'cropName location');
    if (!order) return res.status(404).json({ message: 'Not found' });
    const { graph, nodeMap } = buildGraph(
      {
        lat: order.productID.location.lat,
        lng: order.productID.location.lng,
        label: `${order.productID.cropName} Farm`,
      },
      {
        lat: order.consumerID.location?.lat || 27.7172,
        lng: order.consumerID.location?.lng || 85.324,
        label: order.consumerID.name,
      }
    );
    const result = aStar(graph, 'FARM', 'DEST', nodeMap);
    if (!result) return res.status(422).json({ message: 'No route' });
    const waypoints = result.path.map(id => ({
      id,
      label: nodeMap[id]?.label || id,
      lat: nodeMap[id]?.lat,
      lng: nodeMap[id]?.lng,
    }));
    order.routeData = { path: result.path, distance: result.distance, waypoints };
    await order.save();
    res.json({
      orderId: order._id,
      path: result.path,
      distance: result.distance,
      waypoints,
      estimatedTime: fmtTime(result.distance),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
