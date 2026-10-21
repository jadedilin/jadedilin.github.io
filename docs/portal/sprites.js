import { P } from './palette.js';

const KEY = {
  w: P.ice, W: P.white, c: P.cyan, b: P.sky, B: P.www, p: P.pink, m: P.magenta,
  v: P.violet, V: P.purple, g: P.gold, t: P.teal, k: P.void, l: P.blush,
};

// Ships are drawn nose-up and rotated so the nose points along +u.
// 'f' is engine flame: gold on frame 0, blush on frame 1.
function ship(rowsA, rowsB = rowsA) {
  const h = rowsA.length, w = rowsA[0].length;
  const frames = [rowsA, rowsB].map((rows, fi) => {
    const out = new Uint32Array(w * h);
    rows.forEach((row, ry) => {
      [...row].forEach((ch, rx) => {
        if (ch === '.') return;
        const c = ch === 'f' ? (fi ? P.blush : P.gold) : KEY[ch];
        out[rx * h + (h - 1 - ry)] = c;
      });
    });
    return out;
  });
  return { w: h, h: w, frames };
}

export const SHIPS = [
  ship([
    '...w...',
    '..wcw..',
    '..wcw..',
    '..www..',
    '.vwwwv.',
    'vv.w.vv',
    '...f...',
  ]),
  ship(
    ['...mm...', '..mmmm..', '.mmmmmm.', 'mm.mm.mm', 'mmmmmmmm', '..m..m..', '.m.mm.m.', 'm.m..m.m'],
    ['...mm...', '..mmmm..', '.mmmmmm.', 'mm.mm.mm', 'mmmmmmmm', '..m..m..', '.m.mm.m.', '.m....m.'],
  ),
  ship([
    '..vvv..',
    '.vcccv.',
    'vwwwwwv',
    '.vfvfv.',
  ]),
  ship([
    '..p..',
    '.pwp.',
    'pwwwp',
    'p.f.p',
  ]),
  ship([
    'b.....b',
    'bb...bb',
    'bwwwwwb',
    'bwkwkwb',
    'bwwlwwb',
    '.bwwwb.',
    '..f.f..',
  ]),
  ship([
    '..g..',
    '.gwg.',
    'gwcwg',
    '.gwg.',
    '..f..',
  ]),
];

// Tiny single-colour glyphs, as pixel offsets: · + × ✦ and a six-point comet head.
export const GLYPH = {
  dot: [[0, 0]],
  plus: [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]],
  cross: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  sparkle: [[0, -2], [0, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [0, 1], [0, 2]],
  head: [
    [-2, -2], [0, -2], [2, -2],
    [-1, -1], [0, -1], [1, -1],
    [-2, 0], [-1, 0], [1, 0], [2, 0],
    [-1, 1], [0, 1], [1, 1],
    [-2, 2], [0, 2], [2, 2],
  ],
};
