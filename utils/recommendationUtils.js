const { haversineKm } = require('./geoUtils');

const CBF_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'our',
  'your',
  'this',
  'that',
  'are',
  'was',
  'fresh',
  'organic',
  'farm',
  'premium',
  'quality',
  'local',
  'natural',
  'pure',
  'best',
  'good',
  'new',
  'top',
  'fine',
  'grade',
  'healthy',
  'tasty',
  'delicious',
  'homegrown',
  'homemade',
  'farmhouse',
  'garden',
  'field',
  'harvest',
  'harvested',
]);

function generateFeatureTags(name, cat) {
  const tags = [
    cat.toLowerCase(),
    ...name
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !CBF_STOPWORDS.has(w)),
  ];
  const syn = {
    Vegetable: ['veggie', 'greens'],
    Fruit: ['sweet', 'tropical'],
    Grain: ['cereal', 'staple'],
    Dairy: ['milk', 'cream'],
    Herb: ['spice', 'aromatic'],
    Other: ['farm'],
  };
  return [...new Set([...tags, ...(syn[cat] || []).slice(0, 2)])];
}

// content-based recommendation
function buildTFMap(tags) {
  const tf = {};
  tags.forEach(t => {
    tf[t] = (tf[t] || 0) + 1;
  });
  const n = tags.length || 1;
  Object.keys(tf).forEach(k => {
    tf[k] /= n;
  });
  return tf;
}

function buildIDF(allProducts) {
  const N = allProducts.length || 1;
  const df = {};
  for (const p of allProducts) {
    const tags = p.featureTags?.length ? p.featureTags : generateFeatureTags(p.cropName, p.category);
    for (const t of new Set(tags)) df[t] = (df[t] || 0) + 1;
  }
  const idf = {};

  for (const t in df) idf[t] = Math.log(N / (1 + df[t])) + 1;
  return idf;
}

/* Convert a tag list into an L2-normalised TF-IDF vector. */
function buildTFIDFVector(tags, idf) {
  const tf = buildTFMap(tags);
  const v = {};
  for (const t in tf) v[t] = tf[t] * (idf[t] !== undefined ? idf[t] : Math.log(2) + 1); // unseen term -> treat as maximally rare
  return v;
}

function buildUserProfileVector(viewHistory, idf) {
  const recent = (viewHistory || []).slice(-PROFILE_HISTORY_WINDOW);
  if (!recent.length) return null;
  const centroid = {};
  let weightSum = 0;
  recent.forEach((h, i) => {
    const w = i + 1;
    weightSum += w;
    const vec = buildTFIDFVector(
      generateFeatureTags(h.cropName || h.category || '', h.category || 'Other'),
      idf
    );
    for (const t in vec) centroid[t] = (centroid[t] || 0) + vec[t] * w;
  });
  for (const t in centroid) centroid[t] /= weightSum;
  return centroid;
}

/* Blend two sparse vectors: alpha*a + (1-alpha)*b */
function blendVectors(a, b, alpha) {
  if (!b) return a;
  if (!a) return b;
  const out = {};
  for (const t in a) out[t] = (out[t] || 0) + a[t] * alpha;
  for (const t in b) out[t] = (out[t] || 0) + b[t] * (1 - alpha);
  return out;
}
function cosineSim(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0,
    nA = 0,
    nB = 0;
  keys.forEach(k => {
    const av = a[k] || 0,
      bv = b[k] || 0;
    dot += av * bv;
    nA += av * av;
    nB += bv * bv;
  });
  const d = Math.sqrt(nA) * Math.sqrt(nB);
  return d > 0 ? dot / d : 0;
}

const CBF_WEIGHTS = {
  sameCategoryBonus: 0.5, // added to content score when categories match
  crossCategoryDiscount: 0.25, // content score multiplier when categories differ
  crossCategoryBonusScale: 0.2, // location+demand multiplier when categories differ
  locationNear: 0.3, // < 50km
  locationMid: 0.15, // < 100km
  locationFar: 0.08, // < 200km
  demandCapUnits: 100,
  demandMaxBonus: 0.1,
  minScoreThreshold: 0.05,

  queryWeight: 0.7,
};
// How many recent views feed the profile centroid.
const PROFILE_HISTORY_WINDOW = 20;

function contentBasedRecommend({
  queryCategory,
  queryCropName = '',
  allProducts,
  viewHistory = [],
  consumerLat,
  consumerLng,
  topN = 8,
  excludeId = null,
}) {
  const idf = buildIDF(allProducts);

  const qVec = buildTFIDFVector(generateFeatureTags(queryCropName || queryCategory, queryCategory), idf);
  const profileVec = buildUserProfileVector(viewHistory, idf);

  const queryVec = blendVectors(qVec, profileVec, CBF_WEIGHTS.queryWeight);

  const profileTopCategory = (() => {
    if (!viewHistory?.length) return null;
    const counts = {};
    viewHistory.slice(-PROFILE_HISTORY_WINDOW).forEach(h => {
      if (h.category) counts[h.category] = (counts[h.category] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  })();

  const scored = allProducts
    .filter(p => p.isAvailable && p._id.toString() !== excludeId)
    .map(p => {
      const pTags = p.featureTags?.length ? p.featureTags : generateFeatureTags(p.cropName, p.category);
      const contentSim = cosineSim(queryVec, buildTFIDFVector(pTags, idf));
      const sameCategory = p.category === queryCategory;

      let locationBonus = 0;
      if (consumerLat != null && consumerLng != null && p.location?.lat) {
        const d = haversineKm(consumerLat, consumerLng, p.location.lat, p.location.lng);
        locationBonus =
          d < 50
            ? CBF_WEIGHTS.locationNear
            : d < 100
              ? CBF_WEIGHTS.locationMid
              : d < 200
                ? CBF_WEIGHTS.locationFar
                : 0;
      }
      const demandBonus =
        Math.min(p.demand || 0, CBF_WEIGHTS.demandCapUnits) /
        (CBF_WEIGHTS.demandCapUnits / CBF_WEIGHTS.demandMaxBonus);

      const score = sameCategory
        ? contentSim + CBF_WEIGHTS.sameCategoryBonus + (locationBonus + demandBonus)
        : contentSim * CBF_WEIGHTS.crossCategoryDiscount +
          (locationBonus + demandBonus) * CBF_WEIGHTS.crossCategoryBonusScale;

      // Per-item explainability — why THIS product surfaced.
      const why = [];
      if (sameCategory) why.push(`same category (${p.category})`);
      if (contentSim > 0.25) why.push('high content similarity');
      else if (contentSim > 0.05) why.push('related content');
      if (profileVec && profileTopCategory === p.category)
        why.push(`matches your interest in ${profileTopCategory}`);
      if (locationBonus >= CBF_WEIGHTS.locationNear) why.push('near you');
      if (demandBonus >= CBF_WEIGHTS.demandMaxBonus * 0.8) why.push('popular right now');

      return {
        ...p,
        _cbfScore: parseFloat(score.toFixed(4)),
        _sameCategory: sameCategory,
        _contentSim: parseFloat(contentSim.toFixed(4)),
        _reason: why.length ? why.join(' + ') : 'loosely related',
      };
    })
    .filter(p => p._cbfScore > CBF_WEIGHTS.minScoreThreshold)
    .sort((a, b) => b._cbfScore - a._cbfScore)
    .slice(0, topN);

  let reason;
  if (queryCropName) reason = `More ${queryCategory}s like "${queryCropName}"`;
  else if (profileTopCategory && profileTopCategory === queryCategory)
    reason = `Because you often browse ${profileTopCategory} products`;
  else if (queryCategory) reason = `Top ${queryCategory} picks near you`;
  else reason = 'Recommended for you';
  return { products: scored, reason, usedProfile: !!profileVec };
}

module.exports = {
  CBF_STOPWORDS,
  CBF_WEIGHTS,
  PROFILE_HISTORY_WINDOW,
  generateFeatureTags,
  buildTFMap,
  buildIDF,
  buildTFIDFVector,
  buildUserProfileVector,
  blendVectors,
  cosineSim,
  contentBasedRecommend,
};
