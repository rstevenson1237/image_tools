// T1 tank v2: per-pixel writes with ordered-dither dome shading, track cleats, hull panel seams,
// side armour skirts, muzzle brakes, glow highlights, own outline + drop shadow pass.
const { Grid, PAL } = require('../../lib/core');
const A = PAL.armor, C = PAL.cyan, OR = PAL.orange;
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const ramp = (v, x, y, cols) => { // v 0..1 -> dithered index into cols
  const f = v * (cols.length - 1), i = Math.floor(f); return cols[Math.min(cols.length - 1, i + ((f - i) * 16 > BAYER[y & 3][x & 3] ? 1 : 0))];
};
function hullIn(x, y) { const dx = Math.abs(x + 0.5 - 32); return y >= 8 && y < 60 && dx <= 16 - Math.max(0, 16 - (y - 8)) * 0.5 - Math.max(0, y - 54); }
module.exports = {
  notes: 'Dithered dome, cleats, seams, skirts, muzzle brakes, outline+shadow',
  render() {
    const g = new Grid(64, 64);
    for (const x0 of [6, 48]) for (let y = 9; y < 59; y++) for (let x = x0; x < x0 + 10; x++) {           // tracks
      const edge = x === x0 || x === x0 + 9, cleat = (y + 1) % 3 === 0;
      g.set(x, y, edge ? A[4] : cleat ? A[4] : (x === x0 + 1 || x === x0 + 8) ? A[2] : A[3]); }
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (hullIn(x, y)) {                     // hull
      const dx = Math.abs(x + 0.5 - 32), lit = x < 32;
      let c = !hullIn(x, y - 1) ? A[0] : !hullIn(x, y + 1) ? A[3] : dx > 13 ? (lit ? A[1] : A[2]) : (lit ? A[0] : A[1]);
      if ((y === 20 || y === 46) && dx < 13) c = A[2];                                                     // panel seams
      if (Math.round(dx) === 13 && y > 16 && y < 52) c = A[3];
      g.set(x, y, c); }
    for (let y = 18; y < 50; y++) { g.set(19, y, C[y % 6 === 0 ? 0 : 1]); g.set(44, y, C[y % 6 === 0 ? 0 : 1]); } // glow strips
    for (let i = 0; i < 3; i++) for (let x = 24 + i * 6; x < 28 + i * 6; x++) for (let y = 53; y < 56; y++) g.set(x, y, y === 53 ? OR[0] : y === 55 ? OR[2] : OR[1]);
    for (const bx of [27, 34]) for (let y = 2; y < 26; y++) for (let k = 0; k < 3; k++) {                // barrels
      const brake = y < 6; g.set(bx + k, y, brake ? (k === 1 ? A[4] : A[2]) : [A[1], A[2], A[3]][k]); }
    for (const bx of [27, 34]) for (let k = 0; k < 3; k++) g.set(bx + k, 1, C[1]);
    for (let y = 22; y < 47; y++) for (let x = 20; x < 44; x++) {                                         // dithered dome turret
      const nx = (x + 0.5 - 32) / 11.5, ny = (y + 0.5 - 34) / 11.5, r = nx * nx + ny * ny; if (r > 1) continue;
      const nz = Math.sqrt(1 - r), light = Math.max(0, (-nx * 0.5 - ny * 0.6 + nz * 0.62));
      g.set(x, y, r > 0.86 ? A[4] : ramp(1 - light, x, y, [A[0], A[1], A[2], A[3]])); }
    for (let y = 29; y < 33; y++) for (let x = 30; x < 34; x++) g.set(x, y, (x - 30) + (y - 29) < 2 ? C[0] : C[1]); // sensor
    g.set(25, 38, A[4]); g.set(38, 38, A[4]); g.set(32, 42, A[4]);                                          // hatch rivets
    const src = g.clone();                                                                                  // outline + shadow
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (!src.alpha(x, y)) {
      if ([[1,0],[-1,0],[0,1],[0,-1]].some(([a, b]) => src.alpha(x + a, y + b))) g.set(x, y, PAL.outline);
      else if (src.alpha(x - 2, y - 2)) g.set(x, y, PAL.shadow); }
    return g;
  },
};
