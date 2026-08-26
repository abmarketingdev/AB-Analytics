/** Seeded PRNG. Deterministic by design: the same seed yields the same world on
 *  every reload, which is what makes a demo repeatable and screenshots durable. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable seed from a string key — lets detail be generated lazily per
 *  (person, date) and still replay identically. */
export function seedFrom(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const pick = <T,>(rand: () => number, arr: readonly T[]): T =>
  arr[Math.floor(rand() * arr.length)];

export const between = (rand: () => number, lo: number, hi: number) => lo + rand() * (hi - lo);

/** Door counts are log-normal in real data, never uniform — uniform random is
 *  the fastest way to make mock data look fake. */
export function logNormal(rand: () => number, median: number, sigma = 0.45) {
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return median * Math.exp(sigma * z);
}
