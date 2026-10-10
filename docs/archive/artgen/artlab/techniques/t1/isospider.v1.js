// T1 iso spider v1: half char map body (abdomen + cephalothorax, 4 eyes, hourglass), mirrored;
// 8 legs as hand-placed 3-point polylines via inline Bresenham; own outline pass; ground shadow.
const { Grid, PAL } = require('../../lib/core');
const { groundShadow } = require('../../lib/iso');
const K = { O: PAL.outline, P: PAL.purple[0], p: PAL.purple[1], q: PAL.purple[2], R: PAL.red[0], W: '#ffffff' };
const HALF = ['','','',
  '..........OOOOOO','........OOPPPPPP','.......OPPPPPPPP','......OPPPppppPP','......OPpppppppp','.....OPpppppppRR',
  '.....OPppppppppR','.....OppppppppRR','.....Oqppppppppp','......Oqqppppppp','......OqqqpppppR','.......OOqqqqqqq',
  '.........OpPPPPP','.........OpPPPPp','........OppPPppp','........OpRWppRW','........OpRRppRR','........OqqpppPP',
  '.........OqqpppP','..........OOqqqq','............OWO.','............OO..'];
const LEGS = [[[12, 15], [7, 8], [3, 12]], [[11, 17], [4, 13], [1, 19]], [[11, 19], [4, 19], [2, 26]], [[12, 21], [8, 23], [7, 29]]];
function line(g, [x0, y0], [x1, y1], c) { let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, e = dx + dy;
  for (;;) { g.set(x0, y0, c); g.set(31 - x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
module.exports = {
  notes: 'Char-map body + mirrored Bresenham legs + outline pass',
  render() {
    let g = new Grid(32, 32);
    for (const [a, b, c] of LEGS) { line(g, a, b, PAL.purple[1]); line(g, b, c, PAL.purple[2]); g.set(b[0], b[1], PAL.purple[0]); g.set(31 - b[0], b[1], PAL.purple[0]); }
    HALF.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.set(x, y, K[ch]); g.set(31 - x, y, K[ch]); } }));
    const src = g.clone(), out = new Grid(32, 32); groundShadow(out, 16, 22, 10);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (!src.alpha(x, y) && [[1,0],[-1,0],[0,1],[0,-1]].some(([a, b]) => src.alpha(x + a, y + b))) out.set(x, y, PAL.outline);
    return out.stamp(src);
  },
};
