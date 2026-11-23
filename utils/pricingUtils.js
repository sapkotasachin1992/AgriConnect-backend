function calcPriceStatus(p, ai, discount) {
  // If farmer explicitly set a discount price lower than regular → always 'sale'
  if (discount && discount > 0 && discount < p) return 'sale';
  if (!ai || ai <= 0) return 'none';
  const d = (p - ai) / ai;
  if (Math.abs(d) <= 0.02) return 'match';
  if (d < -0.02) return 'sale';
  return 'above';
}

module.exports = { calcPriceStatus };
