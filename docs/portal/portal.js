import { P } from './palette.js';
import { TAU, clamp } from './util.js';
import { GLYPH } from './sprites.js';
import { Raster } from './raster.js';
import { Scene } from './scene.js';
import { Transition, FOLD } from './transition.js';
import * as audio from './audio.js';

// Open/close controller: idle → opening → open → closing → popping → idle.
const DURATION = 1.15;
const POP = 0.5;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const SPEAKER = `<svg viewBox="0 0 9 8" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor">
<rect x="0" y="3" width="2" height="2"/><rect x="2" y="2" width="1" height="4"/><rect x="3" y="1" width="1" height="6"/>
<g class="waves"><rect x="5" y="3" width="1" height="2"/><rect x="7" y="2" width="1" height="4"/></g></svg>`;

let button, root, canvas, sound, raster, scene, trans, page, wob;
let state = 'idle';
let p = 0, t = 0, last = 0, raf = 0, popT = 0;
let sparks = [];

export function toggle(btn) {
  button = btn;
  if (!root) build();
  if (state === 'idle' || state === 'popping') open();
  else if (state === 'closing') state = 'opening';
  else close();
}

function build() {
  root = document.createElement('div');
  root.className = 'portal-overlay';
  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  sound = document.createElement('button');
  sound.type = 'button';
  sound.className = 'portal-sound';
  sound.setAttribute('aria-label', 'Sound');
  sound.setAttribute('aria-pressed', 'false');
  sound.innerHTML = SPEAKER;
  sound.addEventListener('click', () => {
    const on = !audio.enabled();
    audio.setEnabled(on);
    sound.setAttribute('aria-pressed', String(on));
    if (on && (state === 'open' || state === 'opening')) audio.startHum();
  });
  root.append(canvas, sound);
  document.body.append(root);

  raster = new Raster(canvas);
  trans = new Transition(raster, reduced);
  page = document.getElementById('page');
  wob = page && !reduced && !isSafari ? makeWobble() : null;

  root.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  addEventListener('resize', () => {
    if (state === 'idle') return;
    layout();
    scene?.layout();
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (state === 'open' || state === 'opening')) close();
  });
}

function makeWobble() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.innerHTML = `<filter id="portal-wobble" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.01 0.02" numOctaves="2" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="B"/></filter>`;
  document.body.append(svg);
  return { turb: svg.querySelector('feTurbulence'), disp: svg.querySelector('feDisplacementMap') };
}

// About 3–5 CSS px per art pixel, snapped to whole device pixels so every pixel is square.
function layout() {
  const vw = innerWidth, vh = innerHeight, dpr = devicePixelRatio || 1;
  const cssPx = clamp(Math.min(vw, vh) / 120, 3, 5);
  const s = Math.max(1, Math.round(cssPx * dpr));
  const W = Math.ceil((vw * dpr) / s), H = Math.ceil((vh * dpr) / s);
  raster.resize(W, H);
  canvas.style.width = `${(W * s) / dpr}px`;
  canvas.style.height = `${(H * s) / dpr}px`;
  const b = button.getBoundingClientRect();
  trans.layout(((b.left + b.width / 2) * dpr) / s, ((b.top + b.height / 2) * dpr) / s);
}

function open() {
  state = 'opening';
  sparks = [];
  root.classList.add('is-active');
  document.documentElement.classList.add('portal-open');
  button.setAttribute('aria-expanded', 'true');
  button.setAttribute('aria-label', 'Close the portal');
  layout();
  scene = new Scene(raster, { variant: (Math.random() * 3) | 0, reduced });
  scene.prewarm(9);
  audio.startHum();
  start();
}

function close() {
  state = 'closing';
  root.classList.remove('is-open');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', 'Open the portal');
  audio.stopHum();
}

function start() {
  if (raf) return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function frame(now) {
  raf = 0;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  t += dt;
  const dur = reduced ? 0.5 : DURATION;

  if (state === 'opening') {
    const before = p;
    p = Math.min(1, p + dt / dur);
    if (before < FOLD && p >= FOLD && !reduced) audio.pop(true);
    if (p >= 1) {
      state = 'open';
      root.classList.add('is-open');
    }
  } else if (state === 'closing') {
    p = Math.max(0, p - dt / dur);
    if (p <= 0) beginPop();
  }

  if (state === 'popping') {
    drawSparks(dt);
  } else {
    if (trans.sceneVisible(p)) {
      scene.update(dt);
      scene.draw();
    } else {
      raster.px.fill(0);
    }
    trans.draw(p, t);
  }
  raster.present();
  wobble();

  if (state === 'idle') return finish();
  raf = requestAnimationFrame(frame);
}

function beginPop() {
  state = 'popping';
  popT = 0;
  audio.pop(false);
  if (reduced) return;
  const cols = [P.pink, P.cyan, P.blush, P.violet];
  sparks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * TAU + Math.random() * 0.3, sp = 22 + Math.random() * 26;
    return { x: trans.bx, y: trans.by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: i % 3 ? GLYPH.dot : GLYPH.plus, c: cols[i % 4] };
  });
}

// The closing pop: a ring and a scatter of sparks from the button.
function drawSparks(dt) {
  popT += dt;
  raster.px.fill(0);
  const k = popT / POP;
  if (k >= 1 || reduced) {
    state = 'idle';
    return;
  }
  const drag = Math.exp(-3 * dt);
  for (const s of sparks) {
    s.vx *= drag;
    s.vy *= drag;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    for (const [dx, dy] of s.g) raster.dot(s.x + dx, s.y + dy, s.c, 1 - k);
  }
  const rad = 2 + k * 14, n = Math.max(8, Math.round(rad * 6));
  for (let i = 0; i < n; i++) raster.dot(trans.bx + Math.cos((i / n) * TAU) * rad, trans.by + Math.sin((i / n) * TAU) * rad, P.blush, (1 - k) * 0.8);
}

// Ripple the homepage behind the oil while it folds out.
function wobble() {
  if (!wob) return;
  const k = state === 'opening' || state === 'closing' ? Math.sin(Math.PI * clamp(p / (FOLD + 0.02))) : 0;
  if (k > 0.01) {
    page.style.filter = 'url(#portal-wobble)';
    wob.disp.setAttribute('scale', (k * 28).toFixed(1));
    wob.turb.setAttribute('baseFrequency', `${(0.008 + 0.004 * Math.sin(t * 3)).toFixed(4)} 0.018`);
  } else if (page.style.filter) {
    page.style.filter = '';
  }
}

function finish() {
  root.classList.remove('is-active');
  document.documentElement.classList.remove('portal-open');
  if (page) page.style.filter = '';
  scene = null;
}
