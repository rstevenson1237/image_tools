// T1 iso chest v1: per-pixel face tests against hand-derived 2:1 edge equations (no shape library).
// Frame 0 closed, frame 1 open (vertical lid on the back hinge, gold coins inside).
const { Grid, PAL } = require('../../lib/core');
const W = PAL.wood, Gd = PAL.gold, H = 8;
const L = [3, 13], F = [19, 21], R = [28, 16.5], B = [12, 8.5];        // top-face corners (screen)
const fl = x => L[1] + (x - L[0]) / 2, fr = x => F[1] - (x - F[0]) / 2;  // front edges
const bl = x => L[1] - (x - L[0]) / 2, br = x => B[1] + (x - B[0]) / 2;  // back edges
function draw(g, ox, open) {
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const X = x + 0.5, Y = y + 0.5; let c = null;
    const front = X < F[0] ? fl(X) : fr(X), back = X < B[0] ? bl(X) : br(X), strap = [7, 8, 14, 15, 23, 24].includes(x);
    if (X >= L[0] && X <= R[0] && Y >= back && Y <= front) {            // top face
      if (open) c = (Y - back > 1.2 && front - Y > 1.2) ? (((x + y) % 3) ? Gd[0] : Gd[1]) : W[2];
      else c = Y - back < 1 ? W[0] : W[1];
    } else if (X >= L[0] && X <= F[0] && Y > fl(X) && Y <= fl(X) + H) { // left (long) face
      const dz = Y - fl(X); c = !open && dz < 3 ? W[0] : dz < 3.5 && !open ? PAL.outline : W[1];
      if (strap) c = Gd[1]; if (x >= 10 && x <= 11 && dz > 2 && dz < 6) c = PAL.steel[open ? 2 : 0];
    } else if (X > F[0] && X <= R[0] && Y > fr(X) && Y <= fr(X) + H) {  // right face
      const dz = Y - fr(X); c = !open && dz < 3 ? W[1] : dz < 3.5 && !open ? PAL.outline : W[2]; if (strap) c = Gd[2];
    } else if (open && X >= B[0] && X <= R[0] && Y >= br(X) - 9 && Y < br(X)) { // raised lid inner face
      const dz = br(X) - Y; c = dz > 8 || X < B[0] + 1 || X > R[0] - 1 ? Gd[1] : W[2];
    }
    if (c) g.set(ox + x, y, c);
  }
  const src = g.clone();
  for (let y = 0; y < 32; y++) for (let x = ox; x < ox + 32; x++) if (!src.alpha(x, y) && [[1,0],[-1,0],[0,1],[0,-1]].some(([a, b]) => src.alpha(x + a, y + b))) g.set(x, y, PAL.outline);
}
module.exports = { notes: 'Edge-equation shader for iso box, two states', render() { const g = new Grid(64, 32); draw(g, 0, false); draw(g, 32, true); return g; } };
