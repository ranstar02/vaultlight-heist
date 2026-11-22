// Vaultlight: The Meridian Job — shared constants and tiny geometry helpers.
// One job each: this file only names the numbers and the pure math every other
// module needs. Nothing here touches the canvas, the audio, or the world state.

export const FIELD = { width: 1280, height: 800 };
export const STEP = 1 / 60;
export const BEST_KEY = 'vaultlight-best-loot';

// Movement and detection tuning.
export const PLAYER = {
  radius: 13,
  speed: 205,
  ventSpeed: 105,
  lockpickSeconds: 3,
};
export const GUARD = {
  radius: 14,
  patrolSpeed: 88,
  chaseSpeed: 178,
  viewRange: 235,
  viewHalfAngle: 0.62, // ~35 degrees each side
  loseSightSeconds: 2.2,
  touchRange: 30,
};
export const CAMERA = {
  range: 270,
  halfAngle: 0.5,
  sweepSeconds: 5.2,
};
export const ALARM = {
  guardPerSecond: 34,
  cameraPerSecond: 24,
  laserPerSecond: 55,
  decayPerSecond: 9,
  diamondSpike: 12,
  max: 100,
};
export const TOOLS = {
  smokeCount: 2,
  smokeSeconds: 5,
  smokeRadius: 78,
  empCount: 1,
  empSeconds: 8,
};
export const DIAMOND_VALUE = 500000;
export const CASE_VALUE = 25000;

// Colours: warm light on a dark floor, danger in red/yellow, loot in cyan,
// safe cover in deep blue — readable at a glance.
export const COLORS = {
  floor: '#1b1712',
  floorAlt: '#221c15',
  wall: '#2e3440',
  wallTop: '#3d4658',
  shadow: '#101d33',
  vent: '#0d1526',
  coneCalm: 'rgba(255, 214, 90, 0.20)',
  coneCalmEdge: 'rgba(255, 214, 90, 0.55)',
  coneHot: 'rgba(255, 70, 60, 0.28)',
  coneHotEdge: 'rgba(255, 70, 60, 0.8)',
  cameraCone: 'rgba(255, 190, 60, 0.16)',
  laser: '#ff3b30',
  loot: '#4de8ff',
  player: '#e8e6df',
  guard: '#c94f43',
  gold: '#ffd166',
};

/** Clamp a number between two bounds. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Squared distance between two points. */
export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Smallest absolute difference between two angles, in radians. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** True when the point is inside the rectangle (x, y, w, h). */
export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

/**
 * True when the segment (x1,y1)-(x2,y2) hits the rectangle. Used for
 * line-of-sight: a wall between a guard and the thief breaks the sight line.
 */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  if (pointInRect(x1, y1, rect) || pointInRect(x2, y2, rect)) return true;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const edges = [
    [rect.x, rect.y, rect.x + rect.w, rect.y],
    [rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h],
    [rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h],
    [rect.x, rect.y + rect.h, rect.x, rect.y],
  ];
  for (let i = 0; i < edges.length; i += 1) {
    const [ex1, ey1, ex2, ey2] = edges[i];
    const ex = ex2 - ex1;
    const ey = ey2 - ey1;
    const denom = dx * ey - dy * ex;
    if (denom === 0) continue;
    const t = ((ex1 - x1) * ey - (ey1 - y1) * ex) / denom;
    const u = ((ex1 - x1) * dy - (ey1 - y1) * dx) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  return false;
}

/** True when the segment crosses the circle (smoke blocks sight too). */
export function segmentHitsCircle(x1, y1, x2, y2, cx, cy, radius) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist2(x1, y1, cx, cy) <= radius * radius;
  let t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  return dist2(x1 + dx * t, y1 + dy * t, cx, cy) <= radius * radius;
}
