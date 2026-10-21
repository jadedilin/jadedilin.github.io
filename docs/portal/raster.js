import { BAYER } from './palette.js';

// A small pixel buffer. Screen space is (x, y). Flow space is (u, v): u runs along
// the long side of the screen (left→right in landscape, top→bottom in portrait).
export class Raster {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize(W, H) {
    this.canvas.width = W;
    this.canvas.height = H;
    this.W = W;
    this.H = H;
    this.img = this.ctx.createImageData(W, H);
    this.px = new Uint32Array(this.img.data.buffer);
    this.portrait = H > W;
    this.L = Math.max(W, H);
    this.S = Math.min(W, H);
  }

  present() {
    this.ctx.putImageData(this.img, 0, 0);
  }

  // Alpha below 1 is rendered as ordered dither, never blended.
  dot(x, y, c, a = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    if (a < 1 && (a <= 0 || a <= BAYER[(y & 3) * 4 + (x & 3)])) return;
    this.px[y * this.W + x] = c;
  }

  put(u, v, c, a = 1) {
    if (this.portrait) this.dot(v, u, c, a);
    else this.dot(u, v, c, a);
  }

  glyph(u, v, g, c, a = 1) {
    for (const [du, dv] of g) this.put(u + du, v + dv, c, a);
  }

  sprite(u, v, s, frame, a = 1, tint = 0) {
    const u0 = Math.round(u - s.w / 2), v0 = Math.round(v - s.h / 2), f = s.frames[frame];
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const c = f[y * s.w + x];
        if (c) this.put(u0 + x, v0 + y, tint || c, a);
      }
    }
  }

  line(u0, v0, u1, v1, c, a = 1) {
    const n = Math.max(Math.abs(u1 - u0), Math.abs(v1 - v0), 1);
    for (let i = 0; i <= n; i++) this.put(u0 + ((u1 - u0) * i) / n, v0 + ((v1 - v0) * i) / n, c, a);
  }
}
