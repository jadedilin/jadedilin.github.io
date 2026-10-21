import { P, bayer } from './palette.js';
import { TAU, clamp, lerp, smooth, fract, rng, hash01, makeNoise } from './util.js';
import { SHIPS, GLYPH } from './sprites.js';

// The dream catcher: raiders arrive, cross the barrier of beliefs, and meet one of a few fates.
// Arrivals follow a fixed schedule that repeats every LOOP seconds, like a GIF.
const LOOP = 36;
const FATES = [
  'weave', 'weave', 'weave', 'weave', 'weave',
  'dissolve', 'dissolve', 'dissolve',
  'star', 'star',
  'slow', 'slow',
  'ghost', 'ghost',
];
const TINTS = [P.cyan, P.gold, P.violet, P.ice, P.teal];
const TRAILS = [
  { glyphs: ['sparkle', 'dot', 'dot'], c: P.blush },
  { glyphs: ['cross', 'dot'], c: P.ice },
  { glyphs: ['plus', 'dot', 'dot'], c: P.gold },
  { glyphs: ['dot', 'sparkle', 'dot', 'cross'], c: P.cyan },
  { glyphs: ['dot', 'dot', 'plus'], c: P.violet },
];
const DUST = [P.blush, P.ice, P.violet, P.pink];

function buildSchedule(seed) {
  const r = rng(seed);
  const fates = FATES.slice();
  for (let i = fates.length - 1; i > 0; i--) {
    const j = (r() * (i + 1)) | 0;
    [fates[i], fates[j]] = [fates[j], fates[i]];
  }
  return fates.map((fate, i) => ({
    t: ((i + 0.5 + (r() - 0.5) * 0.6) * LOOP) / fates.length,
    fate,
    lane: 0.2 + r() * 0.6,
    design: (r() * SHIPS.length) | 0,
    amp: 2 + r() * 5,
    freq: 0.12 + r() * 0.18,
    phase: r() * TAU,
    speed: 0.85 + r() * 0.3,
    trail: (r() * TRAILS.length) | 0,
    tint: TINTS[(r() * TINTS.length) | 0],
    starAngle: (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.35),
    starFan: r() < 0.4,
    starCurve: (r() - 0.5) * 0.5,
  }));
}

export class Scene {
  // variant: 0 still night, 1 meteor shower, 2 dust lane
  constructor(raster, { variant = 0, reduced = false, seed = 1984 } = {}) {
    this.r = raster;
    this.variant = variant;
    this.pace = reduced ? 0.6 : 1;
    this.noise = makeNoise(11);
    this.rand = rng(seed ^ 0x9e3779b9);
    this.schedule = buildSchedule(seed);
    this.showerAngle = this.rand() * TAU;
    this.t = 0;
    this.clock = 0;
    this.ships = [];
    this.particles = [];
    this.comets = [];
    this.meteors = [];
    this.rings = [];
    this.pulse = 0;
    this.nextMeteor = 1.5;
    this.layout();
  }

  layout() {
    const { L, S, W, H } = this.r;
    const N = this.noise;
    this.uB = Math.round(L * 0.47);
    this.netU = Math.round(L * 0.77);
    this.netV = S / 2;
    this.netR = Math.min(S * 0.44, L * 0.2);
    this.speed = L * 0.065;
    this.gravity = this.r.portrait ? [7, 0] : [0, 7];

    const r = rng(77);
    this.stars = Array.from({ length: Math.round((L * S) / 160) }, () => ({
      u: r() * L,
      v: r() * S,
      layer: r() < 0.55 ? 0 : r() < 0.7 ? 1 : 2,
      tw: r() < 0.3 ? r() * TAU : -1,
      sparkle: r() < 0.04,
    }));
    this.starSpeed = [1.2, 2.6, 5].map((s) => (s * L) / 320);

    // Barrier: a zigzag lattice of belief nodes across the whole flow.
    this.nodes = [];
    for (let v = 2, i = 0; v < S - 1; v += 3.5, i++) {
      this.nodes.push({
        u: this.uB + (i % 2 ? 3 : -3) + (r() - 0.5) * 2,
        v: v + (r() - 0.5) * 1.5,
        du: 0, vel: 0, glow: 0,
        ph: r() * TAU,
        big: r() < 0.18,
      });
    }
    this.edges = [];
    for (let i = 0; i < this.nodes.length - 1; i++) {
      this.edges.push([i, i + 1]);
      if (i + 2 < this.nodes.length && r() < 0.55) this.edges.push([i, i + 2]);
    }

    // Static background: Tristimania navy, a soft vignette and faint paper texture.
    this.bg = new Uint32Array(W * H);
    const cx = W / 2, cy = H / 2, maxd = Math.hypot(cx, cy);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const b = bayer(x, y);
        const d = Math.hypot(x - cx, y - cy) / maxd;
        let c = P.night;
        if (b < (d - 0.55) * 1.6) c = P.void;
        else if (N(x * 1.3, y * 1.3) > 0.74 && b < 0.16) c = P.navy;
        this.bg[y * W + x] = c;
      }
    }

    this.dust = [];
    if (this.variant === 2) {
      const w = S * 0.16;
      for (let u = 0; u < L; u++) {
        for (let v = 0; v < S; v++) {
          const d = v - (S * 0.5 + (u - L / 2) * 0.3);
          const dens = Math.exp(-((d / w) ** 2)) * N(u * 1.1 + 20, v * 1.1);
          const b = bayer(u, v);
          if (dens > 0.62 && b < 0.1) this.dust.push(u, v, P.purple);
          else if (dens * 0.75 > b) this.dust.push(u, v, P.dusk);
        }
      }
    }
  }

  prewarm(seconds) {
    for (let s = 0; s < seconds; s += 1 / 30) this.update(1 / 30);
  }

  update(dt) {
    dt *= this.pace;
    this.t += dt;
    const prev = this.clock;
    this.clock = (this.clock + dt) % LOOP;
    const wrapped = this.clock < prev;
    for (const e of this.schedule) {
      if (wrapped ? e.t > prev || e.t <= this.clock : e.t > prev && e.t <= this.clock) this.spawn(e);
    }

    for (const sh of this.ships) this.updateShip(sh, dt);
    this.ships = this.ships.filter((s) => !s.dead);

    for (const p of this.particles) {
      p.age += dt;
      const k = Math.exp(-p.drag * dt);
      p.vu *= k;
      p.vv *= k;
      if (p.grav) {
        p.vu += this.gravity[0] * dt;
        p.vv += this.gravity[1] * dt;
      }
      p.u += p.vu * dt;
      p.v += p.vv * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);

    for (const list of [this.comets, this.meteors]) for (const c of list) this.updateComet(c, dt);
    this.comets = this.comets.filter((c) => !c.dead);
    this.meteors = this.meteors.filter((c) => !c.dead);

    for (const g of this.rings) g.age += dt;
    this.rings = this.rings.filter((g) => g.age < 0.35);

    for (const n of this.nodes) {
      n.vel += (-55 * n.du - 5 * n.vel) * dt;
      n.du += n.vel * dt;
      n.glow = Math.max(0, n.glow - dt * 0.8);
    }
    this.pulse = Math.max(0, this.pulse - dt * 1.2);

    if (this.t >= this.nextMeteor) {
      this.spawnMeteor();
      this.nextMeteor = this.t + (this.variant === 1 ? 2.2 + this.rand() * 2.3 : 10 + this.rand() * 8);
    }
  }

  spawn(e) {
    this.ships.push({
      e,
      s: SHIPS[e.design],
      u: -6,
      v: e.lane * this.r.S,
      age: 0,
      tau: 0,
      state: 'approach',
      a: 1,
      tint: 0,
      trailT: 0.2,
      trailI: 0,
      hist: [],
    });
  }

  laneV(sh) {
    const { e } = sh;
    return e.lane * this.r.S + e.amp * Math.sin(TAU * e.freq * sh.age + e.phase);
  }

  updateShip(sh, dt) {
    sh.age += dt;
    const go = this.speed * sh.e.speed;
    switch (sh.state) {
      case 'approach':
        sh.u += go * dt;
        sh.v = this.laneV(sh);
        this.emitTrail(sh, dt, 1, 1);
        if (sh.u >= this.uB) this.cross(sh);
        break;

      case 'slow': {
        // Ease almost to a stop, hang, then drift on into the net.
        sh.tau += dt;
        const t = sh.tau;
        const mul = t < 1.2 ? lerp(1, 0.12, smooth(t / 1.2)) : t < 3.7 ? 0.12 : lerp(0.12, 1, smooth(clamp((t - 3.7) / 2)));
        sh.u += go * mul * dt;
        sh.v = this.laneV(sh);
        this.emitTrail(sh, dt, 1, mul);
        if (Math.hypot(sh.u - this.netU, sh.v - this.netV) < this.netR * 0.9) this.beginWeave(sh);
        break;
      }

      case 'ghost':
        sh.tau += dt;
        sh.u += go * dt;
        sh.v = this.laneV(sh);
        sh.a = lerp(1, 0.45, smooth(clamp(sh.tau / 0.8))) * clamp((this.r.L + 4 - sh.u) / (this.r.L - this.netU));
        this.emitTrail(sh, dt, sh.a, 1);
        if (sh.u > this.r.L + 8) sh.dead = true;
        break;

      case 'weave': {
        // Spiral into the wormhole as a thread of light.
        sh.tau += dt;
        const k = sh.tau / sh.Tw;
        if (k >= 1) {
          this.pulse = 1;
          sh.state = 'fade';
          break;
        }
        sh.theta += (0.4 + 3.5 * k ** 1.5) * dt;
        const rad = sh.r0 * (1 - k) ** 1.2;
        sh.u = this.netU + Math.cos(sh.theta) * rad;
        sh.v = this.netV + Math.sin(sh.theta) * rad;
        sh.a = 1 - sh.tau / 0.7;
        sh.hist.push(sh.u, sh.v);
        if (sh.hist.length > 52) sh.hist.splice(0, 2);
        break;
      }

      case 'fade':
        sh.hist.splice(0, 2 * Math.max(1, Math.round(dt * 40)));
        if (!sh.hist.length) sh.dead = true;
        break;
    }
  }

  emitTrail(sh, dt, alpha, rate) {
    sh.trailT -= dt;
    if (sh.trailT > 0) return;
    sh.trailT = (0.32 + this.rand() * 0.2) / Math.max(rate, 0.35);
    const tr = TRAILS[sh.e.trail];
    this.particles.push({
      u: sh.u - sh.s.w / 2 - 2,
      v: sh.v + (this.rand() - 0.5) * 2,
      vu: -this.speed * 0.15,
      vv: (this.rand() - 0.5) * 1.5,
      drag: 0.5,
      grav: false,
      age: 0,
      life: 1.5,
      glyph: tr.glyphs[sh.trailI++ % tr.glyphs.length],
      c: sh.tint || tr.c,
      a: alpha,
      ph: this.rand() * TAU,
    });
  }

  cross(sh) {
    this.ripple(sh.v);
    const { e } = sh;
    switch (e.fate) {
      case 'weave':
        this.beginWeave(sh);
        break;
      case 'dissolve':
        this.burst(sh.u, sh.v);
        sh.dead = true;
        break;
      case 'star':
        this.rings.push({ u: sh.u, v: sh.v, age: 0, c: P.ice });
        this.comets.push({
          u: sh.u, v: sh.v,
          a: e.starAngle,
          speed: this.r.L * 0.2,
          curve: e.starCurve,
          bend: e.starCurve * 1.4,
          tailMax: this.r.S * (e.starFan ? 0.4 : 0.55),
          spread: e.starFan ? 0.45 : 0.14,
          lines: e.starFan ? 13 : 7,
          head: true,
          bright: 1,
          life: Infinity,
          age: 0,
          seed: (this.rand() * 1e6) | 0,
        });
        sh.dead = true;
        break;
      case 'slow':
        sh.state = 'slow';
        break;
      case 'ghost':
        sh.state = 'ghost';
        sh.tint = e.tint;
        break;
    }
  }

  beginWeave(sh) {
    sh.state = 'weave';
    sh.tau = 0;
    sh.Tw = 5;
    sh.r0 = Math.hypot(sh.u - this.netU, sh.v - this.netV);
    sh.theta = Math.atan2(sh.v - this.netV, sh.u - this.netU);
  }

  ripple(v) {
    for (const n of this.nodes) {
      const f = Math.exp(-(((n.v - v) / 9) ** 2));
      n.vel += 26 * f;
      n.glow = Math.max(n.glow, f);
    }
  }

  burst(u, v) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + this.rand() * 0.4;
      const sp = this.r.S * (0.12 + this.rand() * 0.1);
      const g = this.rand();
      this.particles.push({
        u, v,
        vu: Math.cos(ang) * sp,
        vv: Math.sin(ang) * sp,
        drag: 1.8,
        grav: true,
        age: 0,
        life: 2.2 + this.rand() * 1.2,
        glyph: g < 0.15 ? 'sparkle' : g < 0.4 ? 'cross' : g < 0.55 ? 'plus' : 'dot',
        c: DUST[(this.rand() * DUST.length) | 0],
        a: 1,
        ph: this.rand() * TAU,
      });
    }
    this.rings.push({ u, v, age: 0, c: P.blush });
  }

  spawnMeteor() {
    const { L, S } = this.r;
    const shower = this.variant === 1;
    this.meteors.push({
      u: this.rand() * L,
      v: this.rand() * S,
      a: shower ? this.showerAngle + (this.rand() - 0.5) * 0.16 : this.rand() * TAU,
      speed: L * 0.45,
      curve: 0,
      bend: (this.rand() - 0.5) * 0.3,
      tailMax: S * (0.25 + this.rand() * 0.2),
      spread: shower && this.rand() < 0.3 ? 0.3 : 0.06,
      lines: 3,
      head: false,
      bright: 0.55,
      life: 1.4 + this.rand() * 0.8,
      age: 0,
      seed: (this.rand() * 1e6) | 0,
    });
  }

  updateComet(c, dt) {
    c.age += dt;
    c.a += c.curve * dt;
    c.u += Math.cos(c.a) * c.speed * dt;
    c.v += Math.sin(c.a) * c.speed * dt;
    const m = c.tailMax + 10;
    if (c.age > c.life || c.u < -m || c.v < -m || c.u > this.r.L + m || c.v > this.r.S + m) c.dead = true;
  }

  // ---- drawing ----

  draw() {
    const r = this.r;
    r.px.set(this.bg);
    for (let i = 0; i < this.dust.length; i += 3) r.put(this.dust[i], this.dust[i + 1], this.dust[i + 2]);
    this.drawStars();
    for (const m of this.meteors) this.drawComet(m);
    this.drawNet();
    this.drawBarrierGlow();
    for (const sh of this.ships) if (sh.hist.length) this.drawThread(sh.hist);
    for (const p of this.particles) this.drawParticle(p);
    for (const sh of this.ships) {
      if (sh.state === 'fade' || sh.a <= 0) continue;
      r.sprite(sh.u, sh.v, sh.s, ((sh.age * 4) | 0) & 1, sh.a, sh.tint);
    }
    for (const c of this.comets) this.drawComet(c);
    this.drawBarrier();
    for (const g of this.rings) {
      const rad = 1 + g.age * 28, a = 1 - g.age / 0.35, n = Math.max(8, Math.round(rad * 6));
      for (let i = 0; i < n; i++) r.put(g.u + Math.cos((i / n) * TAU) * rad, g.v + Math.sin((i / n) * TAU) * rad, g.c, a);
    }
  }

  drawStars() {
    const { r, t } = this;
    const L = r.L;
    const col = [P.dimstar, P.steel, P.ice];
    for (const s of this.stars) {
      const u = (((s.u - t * this.starSpeed[s.layer]) % L) + L) % L;
      const a = s.tw < 0 ? 1 : 0.5 + 0.5 * Math.sin(t * 1.7 + s.tw);
      if (s.sparkle) {
        r.glyph(u, s.v, GLYPH.plus, P.dimstar, a * 0.7);
        r.put(u, s.v, P.ice, a);
      } else {
        r.put(u, s.v, col[s.layer], a);
      }
    }
  }

  // Engraved comet after the Tristimania cover: a fan of fine stippled lines behind a bright head.
  drawComet(c) {
    const r = this.r;
    const tail = c.tailMax * Math.min(1, c.age / 0.9);
    let fade = c.bright;
    if (c.life !== Infinity) fade *= Math.min(1, c.age / 0.25) * clamp((c.life - c.age) / 0.5);
    fade *= c.lines > 7 ? 0.55 : 0.8;
    const back = c.a + Math.PI;
    for (let i = 0; i < c.lines; i++) {
      const off = lerp(-c.spread, c.spread, i / (c.lines - 1));
      const len = tail * (1 - (Math.abs(off) / c.spread) * 0.4) * (0.85 + 0.15 * hash01(c.seed + i));
      for (let k = 1; k < len; k++) {
        const q = k / len;
        const dens = (1 - q) ** 0.9 * fade;
        if (hash01(c.seed * 7 + i * 131 + k * 17) > dens) continue;
        const ang = back + off * (0.7 + q) + c.bend * q * q;
        r.put(c.u + Math.cos(ang) * k, c.v + Math.sin(ang) * k, q < 0.18 ? P.ice : q < 0.5 ? P.steel : P.dimstar);
      }
    }
    if (c.head) {
      r.glyph(c.u, c.v, GLYPH.head, P.ice);
      r.put(c.u, c.v, P.white);
    } else {
      r.glyph(c.u, c.v, GLYPH.plus, P.ice, fade * 0.6);
      r.put(c.u, c.v, P.white, fade * 1.6);
    }
  }

  // The net: a top-down wormhole funnel in old-web blue, with rings flowing inward.
  drawNet() {
    const { r, t } = this;
    const cu = this.netU, cv = this.netV, R = this.netR;
    const rot = t * 0.22;

    for (let j = 0; j < 10; j++) {
      const base = (j / 10) * TAU + rot;
      for (let rad = R * 0.08; rad < R; rad += 0.8) {
        const q = rad / R;
        const th = base + 2.2 * (1 - q) ** 2;
        const a = 0.5 * smooth(clamp((1 - q) * 4)) * clamp(q / 0.2);
        r.put(cu + Math.cos(th) * rad, cv + Math.sin(th) * rad, q < 0.35 ? P.sky : P.www, a);
      }
    }

    const K = 7, phase = fract(t * 0.06);
    for (let k = 0; k < K; k++) {
      const s = (k + 1 - phase) / K;
      const rad = R * s ** 1.6;
      const a = smooth(clamp((1 - s) * 5)) * (0.35 + 0.45 * (1 - s));
      const c = s < 0.35 ? P.cyan : s < 0.65 ? P.sky : P.www;
      const n = Math.max(10, Math.round(TAU * rad * 1.1));
      for (let i = 0; i < n; i++) {
        const th = (i / n) * TAU;
        r.put(cu + Math.cos(th) * rad, cv + Math.sin(th) * rad, c, a);
      }
    }

    r.glyph(cu, cv, GLYPH.plus, P.cyan, 0.55 + 0.45 * this.pulse);
    if (this.pulse > 0.05) r.glyph(cu, cv, GLYPH.sparkle, P.ice, this.pulse);
    r.put(cu, cv, P.white);
  }

  drawThread(h) {
    const r = this.r;
    const n = h.length / 2;
    for (let i = 1; i < n; i++) {
      const q = i / (n - 1 || 1);
      const c = q > 0.85 ? P.cyan : q > 0.45 ? P.sky : P.www;
      r.line(h[i * 2 - 2], h[i * 2 - 1], h[i * 2], h[i * 2 + 1], c, 0.25 + 0.75 * q);
    }
    r.put(h[h.length - 2], h[h.length - 1], P.white);
  }

  drawParticle(p) {
    const k = 1 - p.age / p.life;
    const a = k * (0.7 + 0.3 * Math.sin(p.age * 10 + p.ph)) * p.a;
    let g = p.glyph;
    if (g === 'sparkle' && k < 0.5) g = 'plus';
    if (k < 0.3) g = 'dot';
    this.r.glyph(p.u, p.v, GLYPH[g], p.c, a);
  }

  shimmer(v) {
    return Math.sin(v * 0.18 + this.t * 1.1) * 0.7;
  }

  drawBarrierGlow() {
    const { r, t } = this;
    for (let v = 0; v < r.S; v++) {
      const cu = this.uB + this.shimmer(v);
      const breathe = 0.75 + 0.25 * Math.sin(t * 0.7 + v * 0.09);
      for (let d = -7; d <= 7; d++) {
        const f = 1 - Math.abs(d) / 8;
        if (Math.abs(d) <= 2) r.put(cu + d, v, P.magenta, 0.12 * f * breathe);
        else r.put(cu + d, v, P.dusk, 0.55 * f * breathe);
      }
    }
  }

  drawBarrier() {
    const { r, t } = this;
    const pos = this.nodes.map((n) => [n.u + n.du + this.shimmer(n.v), n.v]);
    for (const [i, j] of this.edges) {
      const lit = Math.max(this.nodes[i].glow, this.nodes[j].glow);
      r.line(pos[i][0], pos[i][1], pos[j][0], pos[j][1], lit > 0.3 ? P.pink : P.purple, 0.45 + 0.4 * lit);
    }
    this.nodes.forEach((n, i) => {
      const [u, v] = pos[i];
      const b = 0.6 + 0.4 * Math.sin(t * 1.5 + n.ph) + n.glow;
      const c = n.glow > 0.4 ? P.blush : n.big ? P.pink : P.magenta;
      if (n.big) r.glyph(u, v, GLYPH.plus, c, clamp(b * 0.6));
      r.put(u, v, n.glow > 0.7 ? P.white : c, clamp(b));
    });
  }
}
