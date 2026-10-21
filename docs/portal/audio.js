// Soft chiptune hum and pop. Off by default; nothing is created until sound is switched on.
let ctx = null;
let on = false;
let hum = null;

const NOTES = [440, 523.25, 659.25, 783.99, 659.25, 523.25];

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const enabled = () => on;

export function setEnabled(v) {
  on = v;
  if (v) ac();
  else stopHum();
}

export function pop(opening) {
  if (!on) return;
  const c = ac(), now = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(opening ? 220 : 880, now);
  o.frequency.exponentialRampToValueAtTime(opening ? 880 : 180, now + 0.09);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  o.connect(g).connect(c.destination);
  o.start(now);
  o.stop(now + 0.2);
}

function blip(freq) {
  if (!hum) return;
  const c = ctx, now = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  o.connect(g).connect(hum.out);
  o.start(now);
  o.stop(now + 0.5);
}

export function startHum() {
  if (!on || hum) return;
  const c = ac(), now = c.currentTime;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(0.05, now + 1.5);
  out.connect(c.destination);

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  lp.Q.value = 2;
  lp.connect(out);

  const lfo = c.createOscillator(), depth = c.createGain();
  lfo.frequency.value = 0.12;
  depth.gain.value = 140;
  lfo.connect(depth).connect(lp.frequency);

  const o1 = c.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = 55;
  o1.connect(lp);

  const o2 = c.createOscillator(), g2 = c.createGain();
  o2.type = 'square';
  o2.frequency.value = 110.4;
  g2.gain.value = 0.25;
  o2.connect(g2).connect(lp);

  let i = 0;
  const arp = setInterval(() => {
    const f = NOTES[i++ % NOTES.length];
    if (Math.random() < 0.6) blip(f);
  }, 700);

  [o1, o2, lfo].forEach((o) => o.start(now));
  hum = { out, oscs: [o1, o2, lfo], arp };
}

export function stopHum() {
  if (!hum) return;
  const h = hum, now = ctx.currentTime;
  hum = null;
  clearInterval(h.arp);
  h.out.gain.cancelScheduledValues(now);
  h.out.gain.setValueAtTime(Math.max(h.out.gain.value, 0.0001), now);
  h.out.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  h.oscs.forEach((o) => o.stop(now + 0.65));
}
