const { haversineKm } = require('../utils/geoUtils');

//A* pathfinding
class AStarHeap {
  constructor() {
    this.h = [];
  }
  push(n) {
    this.h.push(n);
    this._up(this.h.length - 1);
  }
  pop() {
    const t = this.h[0],
      l = this.h.pop();
    if (this.h.length) {
      this.h[0] = l;
      this._dn(0);
    }
    return t;
  }
  get size() {
    return this.h.length;
  }
  _up(i) {
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.h[p].f <= this.h[i].f) break;
      [this.h[p], this.h[i]] = [this.h[i], this.h[p]];
      i = p;
    }
  }
  _dn(i) {
    const n = this.h.length;
    while (true) {
      let s = i,
        l = 2 * i + 1,
        r = 2 * i + 2;
      if (l < n && this.h[l].f < this.h[s].f) s = l;
      if (r < n && this.h[r].f < this.h[s].f) s = r;
      if (s === i) break;
      [this.h[s], this.h[i]] = [this.h[i], this.h[s]];
      i = s;
    }
  }
}
// Heuristic: straight-line road-adjusted distance to target node
function aStarHeuristic(nodeA, nodeB) {
  if (!nodeA || !nodeB) return 0;
  return haversineKm(nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng) * ROAD;
}

// A* search — finds optimal path guided by haversine heuristic
function aStar(graph, src, tgt, nodeMap) {
  const gScore = {},
    fScore = {},
    prev = {},
    closed = new Set();
  Object.keys(graph).forEach(n => {
    gScore[n] = Infinity;
    fScore[n] = Infinity;
    prev[n] = null;
  });
  gScore[src] = 0;
  fScore[src] = aStarHeuristic(nodeMap[src], nodeMap[tgt]);
  const heap = new AStarHeap();
  heap.push({ id: src, f: fScore[src] });
  while (heap.size) {
    const { id: current } = heap.pop();
    if (current === tgt) {
      const path = [];
      let cur = tgt;
      while (cur) {
        path.unshift(cur);
        cur = prev[cur];
      }
      return { path, distance: parseFloat(gScore[tgt].toFixed(1)) };
    }
    if (closed.has(current)) continue;
    closed.add(current);
    for (const { to: neighbor, w } of graph[current] || []) {
      if (closed.has(neighbor)) continue;
      const tentG = gScore[current] + w;
      if (tentG < gScore[neighbor]) {
        prev[neighbor] = current;
        gScore[neighbor] = tentG;
        fScore[neighbor] = tentG + aStarHeuristic(nodeMap[neighbor], nodeMap[tgt]);
        heap.push({ id: neighbor, f: fScore[neighbor] });
      }
    }
  }
  return null;
}
const ROAD = 1.4,
  SPEED = 40;
const HUBS = [
  { id: 'H_KTM', label: 'Kathmandu', lat: 27.7172, lng: 85.324 },
  { id: 'H_PKR', label: 'Pokhara', lat: 28.2096, lng: 83.9856 },
  { id: 'H_BRT', label: 'Biratnagar', lat: 26.4525, lng: 87.2718 },
  { id: 'H_BTR', label: 'Butwal', lat: 27.7006, lng: 83.4483 },
  { id: 'H_DHR', label: 'Dharan', lat: 26.8132, lng: 87.2846 },
  { id: 'H_CHT', label: 'Chitwan', lat: 27.5291, lng: 84.3542 },
  { id: 'H_BRD', label: 'Birgunj', lat: 27.0104, lng: 84.8799 },
  { id: 'H_JNK', label: 'Janakpur', lat: 26.7288, lng: 85.9236 },
];
function buildGraph(farm, dest) {
  const relevant = HUBS.filter(
    h =>
      haversineKm(farm.lat, farm.lng, h.lat, h.lng) < 350 ||
      haversineKm(dest.lat, dest.lng, h.lat, h.lng) < 350
  )
    .sort(
      (a, b) =>
        Math.min(
          haversineKm(farm.lat, farm.lng, a.lat, a.lng),
          haversineKm(dest.lat, dest.lng, a.lat, a.lng)
        ) -
        Math.min(haversineKm(farm.lat, farm.lng, b.lat, b.lng), haversineKm(dest.lat, dest.lng, b.lat, b.lng))
    )
    .slice(0, 5);
  const nodes = [
    { id: 'FARM', label: farm.label || 'Farm', lat: farm.lat, lng: farm.lng },
    ...relevant,
    { id: 'DEST', label: dest.label || 'Customer', lat: dest.lat, lng: dest.lng },
  ];
  const graph = {};
  nodes.forEach(n => {
    graph[n.id] = [];
  });
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const w = parseFloat(
        (haversineKm(nodes[i].lat, nodes[i].lng, nodes[j].lat, nodes[j].lng) * ROAD).toFixed(1)
      );
      graph[nodes[i].id].push({ to: nodes[j].id, w });
      graph[nodes[j].id].push({ to: nodes[i].id, w });
    }
  return { graph, nodeMap: Object.fromEntries(nodes.map(n => [n.id, n])) };
}
function fmtTime(km) {
  const h = km / SPEED;
  return h < 1 ? `${Math.round(h * 60)} mins` : `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
}

module.exports = { AStarHeap, aStarHeuristic, aStar, ROAD, SPEED, HUBS, buildGraph, fmtTime };
