// T1 tank v1: per-pixel loops - track pods, chamfered hull, round turret with normal shading, twin barrels.
const { Grid, PAL } = require('../../lib/core');
module.exports = {
  notes: 'Per-pixel math: pods, chamfer hull, shaded dome turret',
  render() {
    const g = new Grid(64, 64), A = PAL.armor;
    for (let y = 10; y < 58; y++) for (const x0 of [7, 47]) for (let x = x0; x < x0 + 10; x++)
      g.set(x, y, (x === x0 || x === x0 + 9) ? A[4] : ((y >> 1) % 2 ? A[3] : A[2]));
    for (let y = 8; y < 60; y++) for (let x = 16; x < 48; x++) {
      const dx = Math.abs(x + 0.5 - 32), top = y - 8, bot = 59 - y;
      if (dx + (top < 8 ? 8 - top : 0) > 16 || dx + (bot < 5 ? 5 - bot : 0) > 16) continue;
      g.set(x, y, dx > 14 ? A[3] : y < 12 ? A[0] : A[1]);
    }
    for (let y = 18; y < 50; y++) { g.set(18, y, PAL.cyan[1]); g.set(45, y, PAL.cyan[1]); }
    for (let i = 0; i < 3; i++) for (let x = 24 + i * 6; x < 28 + i * 6; x++) for (let y = 53; y < 56; y++) g.set(x, y, PAL.orange[1]);
    for (let y = 22; y < 47; y++) for (let x = 20; x < 44; x++) {
      const nx = (x + 0.5 - 32) / 11, ny = (y + 0.5 - 34) / 11, r = nx * nx + ny * ny; if (r > 1) continue;
      const l = -(nx + ny) / 1.4; g.set(x, y, r > 0.8 ? A[4] : l > 0.35 ? A[0] : l > -0.2 ? A[1] : A[2]);
    }
    for (const bx of [28, 34]) for (let y = 3; y < 25; y++) { g.set(bx, y, A[3]); g.set(bx + 1, y, A[2]); }
    for (const bx of [28, 34]) { g.set(bx, 3, PAL.cyan[1]); g.set(bx + 1, 3, PAL.cyan[1]); }
    g.set(31, 31, PAL.cyan[0]); g.set(32, 31, PAL.cyan[1]);
    return g;
  },
};
