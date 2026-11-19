/** Random helpers. `rand` is swappable so tests can be deterministic. */
export let rand: () => number = Math.random;
export function setRandom(fn: () => number) { rand = fn; }

export function seeded(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
export const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];

function gaussian(): number {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Marsaglia–Tsang gamma sampler. */
function gamma(k: number): number {
  if (k < 1) return gamma(k + 1) * Math.pow(rand(), 1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do { x = gaussian(); v = 1 + c * x; } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** A draw from Beta(a, b): the heart of Thompson sampling. */
export function betaSample(a: number, b: number): number {
  const x = gamma(a), y = gamma(b);
  return x / (x + y);
}
