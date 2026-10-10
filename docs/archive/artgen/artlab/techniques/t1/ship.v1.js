// T1 ship v1: per-pixel "shader" loops - hull profile function, deck planks, turrets, funnels.
const { Grid, PAL } = require('../../lib/core');
const W = 160, H = 41, X0 = 5, L = 150, CY = 20; // bow to the right, centreline row 20
function halfWidth(x) {
  const t = (x + 0.5 - X0) / L; if (t < 0 || t > 1) return -1;
  if (t < 0.08) return 10 * (0.7 + 0.3 * Math.sqrt(1 - ((0.08 - t) / 0.08) ** 2));
  if (t < 0.6) return 10;
  return 10 * (1 - ((t - 0.6) / 0.4) ** 1.8);
}
const tx = t => Math.round(X0 + t * L);
function turret(g, cx, dir) { // dir 1 = faces bow, -1 = stern
  for (let y = CY - 4; y <= CY + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
    const dx = x - cx, dy = y - CY; if (Math.abs(dx) + Math.abs(dy) > 7) continue; // octagonal
    g.set(x, y, dy < -2 ? PAL.navy[0] : dy > 2 ? PAL.navy[3] : PAL.navy[1]);
  }
  for (const by of [CY - 2, CY, CY + 2]) for (let i = 4; i <= 13; i++) g.set(cx + dir * i, by, PAL.navy[3]);
}
module.exports = {
  notes: 'Profile-function hull, plank rows, octagon turrets',
  render() {
    const g = new Grid(W, H);
    for (let x = 0; x < W; x++) { const hw = halfWidth(x); if (hw < 0) continue;
      for (let y = 0; y < H; y++) { const d = Math.abs(y - CY); if (d > hw) continue;
        g.set(x, y, hw - d < 1 ? PAL.navy[3] : (y % 2 ? PAL.teak[0] : PAL.teak[1])); } }
    // superstructure block + bridge
    for (let x = tx(0.36); x <= tx(0.58); x++) for (let y = CY - 5; y <= CY + 5; y++) g.set(x, y, y === CY - 5 ? PAL.navy[0] : y === CY + 5 ? PAL.navy[3] : PAL.navy[2]);
    for (let x = tx(0.52); x <= tx(0.57); x++) for (let y = CY - 3; y <= CY + 3; y++) g.set(x, y, PAL.navy[1]);
    for (const fx of [tx(0.42), tx(0.47)]) for (let y = CY - 3; y <= CY + 3; y++) for (let x = fx - 2; x <= fx + 2; x++)
      if ((x - fx) ** 2 + (y - CY) ** 2 <= 7) g.set(x, y, (x - fx) ** 2 + (y - CY) ** 2 <= 2 ? PAL.outline : PAL.navy[3]);
    turret(g, tx(0.72), 1); turret(g, tx(0.64), 1); turret(g, tx(0.27), -1);
    for (let i = 0; i < 4; i++) for (const sy of [CY - 7, CY + 7]) { const x = tx(0.37 + i * 0.055); for (let k = 0; k < 2; k++) g.set(x + k, sy, PAL.navy[1]); }
    return g;
  },
};
