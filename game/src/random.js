// A tiny seeded random generator, so the city, the traffic and the walkers
// are the same on every load with the same seed. Nothing here touches
// Math.random, which would make two runs differ.

// Mulberry32: a small, fast generator with a good spread for a game.
export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A float in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// A whole number in [min, max].
export function rangeInt(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

// One element of an array, picked uniformly.
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

// A shuffled copy of an array (Fisher-Yates, driven by the seeded rng).
export function shuffled(rng, items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

// Clamp a value into [min, max].
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Wrap an angle into (-PI, PI].
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

// The shortest signed turn from angle `from` to angle `to`.
export function angleTo(from, to) {
  return wrapAngle(to - from);
}

// Straight-line distance on the ground plane.
export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
