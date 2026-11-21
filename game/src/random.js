// Seeded random numbers for Vice Rush. The city layout and the staged
// screenshots use fixed seeds so the same seed always builds the same
// streets; live play uses a seed from the clock so no two drives feel
// identical. mulberry32 is tiny, fast, and good enough for a game.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed);
  }
  // Float in [0, 1).
  float() {
    return this.next();
  }
  // Float in [a, b).
  range(a, b) {
    return a + (b - a) * this.next();
  }
  // Integer in [a, b] inclusive.
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  // True with probability p.
  chance(p) {
    return this.next() < p;
  }
  // One element of an array.
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  // A shuffled copy of an array.
  shuffled(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }
}

// The shared live-play generator. Its seed comes from the clock, so each
// session shuffles traffic colours, pedestrian looks and spawn spots.
export const rng = new Rng((Date.now() % 2147483647) | 1);

// A fixed generator for anything that must be identical every run, like
// the city blocks and the staged screenshot scenes.
export function fixedRng(seed) {
  return new Rng(seed);
}
