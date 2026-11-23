function haversineKm(a, b, c, d) {
  const R = 6371,
    f = v => (v * Math.PI) / 180;
  const x = Math.sin(f(c - a) / 2) ** 2 + Math.cos(f(a)) * Math.cos(f(c)) * Math.sin(f(d - b) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

module.exports = { haversineKm };
