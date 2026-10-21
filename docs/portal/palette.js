// Fixed night palette. Colours are packed as little-endian RGBA for Uint32 pixel buffers.
const HEX = {
  void: '#05020d',
  night: '#0c0a26',
  navy: '#1a1f48',
  dusk: '#2a1650',
  purple: '#7b2cbf',
  magenta: '#f72585',
  pink: '#ff4fa3',
  blush: '#ffb3d9',
  www: '#0a5fd1',
  sky: '#5ab8ff',
  cyan: '#7ff3ff',
  ice: '#dfe8ff',
  white: '#ffffff',
  gold: '#ffd27a',
  teal: '#19b5a5',
  violet: '#b46cff',
  dimstar: '#43508f',
  steel: '#8a9ad6',
};

const pack = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
};

export const P = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, pack(v)]));

// Thin-film colours for the oil sheen, in interference order.
export const IRIDESCENT = [P.gold, P.magenta, P.violet, P.www, P.teal, P.cyan];

// 4x4 ordered dither thresholds in (0, 1).
export const BAYER = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16));
export const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
