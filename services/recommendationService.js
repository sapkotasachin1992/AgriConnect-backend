/**
 * Resolves the category for a recommendation query when the client didn't send one.
 * Logic moved verbatim from the /api/products/recommend handler.
 */
function resolveCategory(all, category, cropName) {
  if (!category) {
    if (cropName) {
      // Resolve the real category from an actual product matching this
      // name, instead of guessing from raw text with a hardcoded list.
      const match =
        all.find(p => p.cropName.toLowerCase().includes(cropName.toLowerCase())) ||
        all.find(p => cropName.toLowerCase().includes(p.cropName.toLowerCase()));
      category = match?.category || null;
    }
    if (!category) {
      // Still unknown — fall back to the single most popular category
      // in the actual catalog rather than a hardcoded 'Vegetable'.
      const counts = {};
      all.forEach(p => {
        counts[p.category] = (counts[p.category] || 0) + 1;
      });
      category = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other';
    }
  }
  return category;
}

module.exports = { resolveCategory };
