export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const fract = (x) => x - Math.floor(x);

// Seeded PRNG (mulberry32), so the loop repeats exactly.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer hash to [0, 1); used for stipple patterns that travel with an object.
export function hash01(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

// Tileable fractal value noise baked into a 128x128 texture, sampled bilinearly.
const N = 128;
export function makeNoise(seed) {
  const r = rng(seed);
  const tex = new Float32Array(N * N);
  let amp = 1;
  for (const cell of [32, 16, 8, 4]) {
    const g = N / cell;
    const lat = Float32Array.from({ length: g * g }, r);
    for (let y = 0; y < N; y++) {
      const gy = y / cell, iy = Math.floor(gy), fy = smooth(gy - iy);
      const y0 = iy % g, y1 = (iy + 1) % g;
      for (let x = 0; x < N; x++) {
        const gx = x / cell, ix = Math.floor(gx), fx = smooth(gx - ix);
        const x0 = ix % g, x1 = (ix + 1) % g;
        const a = lat[y0 * g + x0], b = lat[y0 * g + x1], c = lat[y1 * g + x0], d = lat[y1 * g + x1];
        tex[y * N + x] += amp * (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy);
      }
    }
    amp *= 0.5;
  }
  let lo = Infinity, hi = -Infinity;
  for (const v of tex) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let i = 0; i < tex.length; i++) tex[i] = (tex[i] - lo) / (hi - lo);

  return (x, y) => {
    x %= N; if (x < 0) x += N;
    y %= N; if (y < 0) y += N;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
    const x1 = (x0 + 1) & (N - 1), y1 = (y0 + 1) & (N - 1);
    const a = tex[y0 * N + x0], b = tex[y0 * N + x1], c = tex[y1 * N + x0], d = tex[y1 * N + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
