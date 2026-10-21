// The unlabelled portal on the homepage. Draws a tiny 16x16 swirl and lazy-loads the portal on demand.
const btn = document.querySelector('.portal-btn');

if (btn) {
  const cv = btn.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(16, 16);
  const px = new Uint32Array(img.data.buffer);
  const rgb = (h) => (0xff000000 | ((h & 0xff) << 16) | (h & 0xff00) | (h >> 16)) >>> 0;
  const RING = [0xf72585, 0xff4fa3, 0xb46cff, 0x7b2cbf, 0x7ff3ff, 0xb46cff].map(rgb);
  const VOID = rgb(0x05020d), DUSK = rgb(0x2a1650), CYAN = rgb(0x7ff3ff);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const fract = (x) => x - Math.floor(x);

  let mod;
  const load = () => (mod ||= import('./portal.js'));
  for (const e of ['pointerenter', 'focus', 'touchstart']) btn.addEventListener(e, load, { once: true, passive: true });
  btn.addEventListener('click', () => load().then((m) => m.toggle(btn)));
  (window.requestIdleCallback || ((f) => setTimeout(f, 2500)))(load);

  let hover = false, t = 0, last = performance.now(), acc = 0;
  btn.addEventListener('pointerenter', () => (hover = true));
  btn.addEventListener('pointerleave', () => (hover = false));

  const draw = () => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x - 7.5, dy = (y - 7.5) * 1.12;
        const r = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
        const b = BAYER[(y & 3) * 4 + (x & 3)];
        let c = 0;
        if (r < 4.4) {
          c = fract(ang * 2 - r * 0.22 + t * 0.35) < 0.22 && b < 0.5 ? DUSK : VOID;
          if (r < 1 && Math.sin(t * 2) > 0.6) c = CYAN;
        } else if (r < 6.6) {
          c = RING[(fract(ang - t * 0.18) * RING.length) | 0];
        } else if (r < 7.6 && b < 0.35) {
          c = DUSK;
        }
        px[y * 16 + x] = c;
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  const tick = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt * (hover ? 2.5 : 1);
    acc += dt;
    if (acc > 1 / 12) {
      acc = 0;
      draw();
    }
    requestAnimationFrame(tick);
  };
  draw();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(tick);
}
