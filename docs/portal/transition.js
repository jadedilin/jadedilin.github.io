import { P, IRIDESCENT, bayer } from './palette.js';
import { clamp, lerp, smooth, fract, makeNoise } from './util.js';

// One timeline p ∈ [0, 1] drives both directions: opening plays it forwards, closing backwards.
//   0 → WINK   an eye opens and winks shut at the portal button
//   → FOLD     black oil folds out of the closed eye and floods the screen
//   → FLASH    pop: a dithered flash
//   → 1        the oil drains away (top first) to reveal the dream catcher
export const WINK = 0.14;
export const FOLD = 0.56;
const FLASH = 0.64;

export class Transition {
  constructor(raster, reduced) {
    this.r = raster;
    this.reduced = reduced;
    this.n = makeNoise(5);
  }

  layout(bx, by) {
    const { W, H } = this.r;
    this.bx = bx;
    this.by = by;
    this.Rmax = 1.3 * Math.max(Math.hypot(bx, by), Math.hypot(W - bx, by), Math.hypot(bx, H - by), Math.hypot(W - bx, H - by)) + 4;
  }

  sceneVisible(p) {
    return this.reduced ? p > 0 : p >= FOLD;
  }

  draw(p, t) {
    if (p >= 1) return;
    if (this.reduced) return this.dissolve(p);
    if (p < WINK) return this.eye(Math.sin((Math.PI * p) / WINK), t);
    if (p < FOLD) {
      const k = (p - WINK) / (FOLD - WINK);
      return this.oil(lerp(2, this.Rmax, k * k * k), 0, 0, t);
    }
    const flash = p < FLASH ? Math.sin((Math.PI * (p - FOLD)) / (FLASH - FOLD)) : 0;
    const drain = p > FLASH ? smooth((p - FLASH) / (1 - FLASH)) * 1.08 : 0;
    this.oil(Infinity, drain, flash, t);
  }

  // Black oil lit by coloured light: a dark base with sparse dithered thin-film sheen.
  oilColor(x, y, t, b) {
    const N = this.n;
    const n1 = N(x * 0.35 + t * 2, y * 0.35);
    const n2 = N(x * 0.22 + n1 * 18 - t * 1.4, y * 0.22 + n1 * 12 + t * 0.8);
    const spec = clamp((n2 - 0.52) * 2.4) * 0.7;
    if (spec > b) {
      if (spec > 0.45 && b < 0.08) return P.white;
      return IRIDESCENT[(fract(n2 * 3 + n1 + t * 0.15) * IRIDESCENT.length) | 0];
    }
    return n1 > 0.42 + (b - 0.5) * 0.4 ? P.night : P.void;
  }

  oil(R, drain, flash, t) {
    const { W, H, px } = this.r;
    const N = this.n;
    const { bx, by } = this;
    let x0 = 0, x1 = W, y0 = 0, y1 = H;
    if (R !== Infinity) {
      const m = Math.ceil(R * 1.25) + 2;
      x0 = Math.max(0, Math.floor(bx - m));
      x1 = Math.min(W, Math.ceil(bx + m));
      y0 = Math.max(0, Math.floor(by - m));
      y1 = Math.min(H, Math.ceil(by + m));
    }
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const b = bayer(x, y);
        const e = N(x * 0.9 + t * 9, y * 0.9 - t * 4);
        let edge = false;
        if (R !== Infinity) {
          const d = Math.hypot(x - bx, y - by) * (0.8 + e * 0.4);
          if (d > R) continue;
          edge = d > R - 2.2;
        }
        if (drain > 0) {
          const val = 0.62 * N(x * 0.5 + 40, y * 0.5 + 17) + 0.38 * (y / H);
          if (val < drain) continue;
          if (val < drain + 0.03) edge = true;
        }
        let c = edge ? (e > 0.5 ? P.magenta : P.cyan) : this.oilColor(x, y, t, b);
        if (flash > 0 && b < flash * 0.75) c = b < flash * 0.3 ? P.white : P.blush;
        px[y * W + x] = c;
      }
    }
  }

  eye(o, t) {
    const r = this.r;
    const { bx, by } = this;
    const a = 10, b = 6.5 * o;
    if (b < 0.6) {
      for (let dx = -a; dx <= a; dx++) r.dot(bx + dx, by, P.pink);
      return;
    }
    for (let dy = -Math.ceil(b); dy <= Math.ceil(b); dy++) {
      for (let dx = -a; dx <= a; dx++) {
        const lim = b * (1 - (dx / a) ** 2);
        if (Math.abs(dy) > lim) continue;
        const x = Math.round(bx + dx), y = Math.round(by + dy);
        const inner = Math.abs(dy) < lim - 1.2 && Math.abs(dx) < a - 1.5;
        let c = inner ? this.oilColor(x, y, t, bayer(x, y)) : P.pink;
        const pr = dx * dx + dy * dy;
        if (inner && pr <= (2.4 * o) ** 2) c = pr <= 1 ? P.white : P.cyan;
        r.dot(x, y, c);
      }
    }
  }

  // Reduced motion: a plain pixel dissolve, no wink, fold or flash.
  dissolve(p) {
    const { W, H, px } = this.r;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.n(x * 0.6, y * 0.6) * 0.8 + bayer(x, y) * 0.2 > p) px[y * W + x] = 0;
      }
    }
  }
}
