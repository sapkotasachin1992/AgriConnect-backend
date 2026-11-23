function makePairKey(idA, idB) {
  return [idA.toString(), idB.toString()].sort().join('_');
}

module.exports = { makePairKey };
