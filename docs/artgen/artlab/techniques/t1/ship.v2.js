// T1 ship v2: per-pixel writes with manual edge AA on the hull taper, subtle planking,
// layered superstructure, superfiring turret drawn last, 5" secondaries, AA tubs, own outline + shadow pass.
const { Grid, PAL } = require('../../lib/core');
const N = PAL.navy, W = 160, H = 41, X0 = 5, L = 150, CY = 20;
const tx = t => Math.round(X0 + t * L);
function halfWidth(x) {
  const t = (x + 0.5 - X0) / L; if (t < 0 || t > 1) return -1;
  if (t < 0.06) return 10 * (0.75 + 0.25 * Math.sqrt(Math.max(0, 1 - ((0.06 - t) / 0.06) ** 2)));
  if (t < 0.55) return 10;
  return 10 * Math.cos(((t - 0.55) / 0.45) * Math.PI / 2) ** 0.9; // smooth ogive bow
}
const box = (g, x0, x1, y0, y1, fn) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = fn(x, y); if (c) g.set(x, y, c); } };
function turret(g, cx, dir, big = false) {
  const r = big ? 5 : 4.5;
  for (const o of [-2, 0, 2]) for (let i = 3; i <= 14; i++) g.set(cx + dir * i, CY + o, i < 6 ? N[4] : N[3]);   // barrels + blast bags
  box(g, cx - 7, cx + 7, CY - 6, CY + 6, (x, y) => {
    const fx = (x - cx) * dir, dy = y - CY;                     // fx > 0 = front
    const inside = fx >= 0 ? (fx <= 3.5 && Math.abs(dy) <= r - Math.max(0, fx - 1.5)) : (fx * fx + dy * dy <= r * r);
    if (!inside) return null;
    return dy <= -r + 1.5 ? N[0] : dy >= r - 1.5 ? N[3] : big ? N[0] : N[1];
  });
  g.set(cx - dir * 2, CY - 2, N[3]); g.set(cx - dir * 2, CY + 2, N[3]); // rangefinder ears
}
module.exports = {
  notes: 'Manual AA taper, planks, layered superstructure, superfiring order, secondaries, outline+shadow',
  render() {
    const g = new Grid(W, H);
    for (let x = 0; x < W; x++) { const hw = halfWidth(x); if (hw < 0) continue;
      for (let y = 0; y < H; y++) { const d = Math.abs(y - CY), cov = hw + 0.5 - d; if (cov <= 0.25) continue;
        let c = cov < 0.75 ? N[3] : cov < 1.75 ? N[1] : (d % 3 === 0 ? PAL.teak[1] : PAL.teak[0]);
        if (c === PAL.teak[0] && (x * 7 + y * 13) % 29 === 0) c = PAL.teak[1];
        g.set(x, y, c); } }
    box(g, tx(0.81), tx(0.83), CY - 6, CY + 6, (x, y) => Math.abs(Math.abs(y - CY) - (x - tx(0.81)) * 2) < 1.5 ? N[2] : null); // breakwater
    box(g, tx(0.35), tx(0.61), CY - 6, CY + 6, (x, y) => y === CY - 6 ? N[1] : y === CY + 6 ? N[3] : N[2]);        // deckhouse
    box(g, tx(0.39), tx(0.57), CY - 4, CY + 4, (x, y) => y === CY - 4 ? N[0] : y === CY + 4 ? N[3] : N[1]);        // O1 level
    box(g, tx(0.555), tx(0.6), CY - 3, CY + 3, (x, y) => x === tx(0.6) ? N[3] : y === CY - 3 ? N[0] : N[0]);       // conning tower
    for (const fx of [tx(0.445), tx(0.5)]) box(g, fx - 3, fx + 3, CY - 3, CY + 3, (x, y) => {
      const q = ((x - fx) / 2.8) ** 2 + ((y - CY) / 3.2) ** 2; return q > 1 ? null : q < 0.35 ? PAL.outline : (y < CY ? N[2] : N[3]); });
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const x = tx(0.38 + i * 0.055), y = CY + s * 8;
      box(g, x - 1, x + 1, y - 1, y + 1, (xx, yy) => yy === y - 1 ? N[0] : N[1]); g.set(x - 1, y + s * 2, N[3]); g.set(x + 1, y + s * 2, N[3]); }
    for (const t of [0.2, 0.33, 0.66, 0.78]) for (const s of [-1, 1]) { g.set(tx(t), CY + s * 8, N[2]); g.set(tx(t) + 1, CY + s * 8, N[3]); }
    box(g, tx(0.08), tx(0.12), CY - 1, CY + 1, () => N[3]);                                                         // stern hatch
    turret(g, tx(0.27), -1); turret(g, tx(0.74), 1); turret(g, tx(0.655), 1, true);                                // A, then B superfiring on top
    // outline + drop shadow pass
    const src = g.clone();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!src.alpha(x, y)) {
      if ([[1,0],[-1,0],[0,1],[0,-1]].some(([a, b]) => src.alpha(x + a, y + b))) g.set(x, y, N[4]);
      else if (src.alpha(x - 2, y - 2)) g.set(x, y, PAL.shadow); }
    return g;
  },
};
