// voxel.js - Technique 4: build a sparse voxel model from 3D primitives, render 2:1 isometric.
// Each voxel = 4x4 px cube: rows 0-1 top face, rows 2-3 left(+y)|right(+x) faces. Painter's order.
const { Grid, PAL } = require('./core');
const post = require('./post');
class Voxels {
  // k = voxels per model unit (v2): author in coarse units, get k-times finer voxels for smoother shapes
  constructor({ k = 1 } = {}) { this.m = new Map(); this.k = k; }
  set(x, y, z, ramp) { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (ramp) this.m.set(`${x},${y},${z}`, [x, y, z, ramp]); else this.m.delete(`${x},${y},${z}`); return this; }
  has(x, y, z) { return this.m.has(`${x},${y},${z}`); }
  box(x0, y0, z0, x1, y1, z1, ramp) { const k = this.k; [x0, y0, z0] = [x0, y0, z0].map(v => Math.round(v * k)); [x1, y1, z1] = [x1, y1, z1].map(v => Math.round((v + 1) * k) - 1);
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, z, ramp); return this; }
  ellipsoid(cx, cy, cz, rx, ry, rz, ramp) { const k = this.k; [cx, cy, cz, rx, ry, rz] = [cx, cy, cz, rx, ry, rz].map(v => v * k); if (k > 1) { cx += (k - 1) / 2; cy += (k - 1) / 2; cz += (k - 1) / 2; }
    for (let z = Math.floor(cz - rz); z <= cz + rz; z++) for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1) this.set(x, y, z, ramp);
    return this;
  }
  line(a, b, ramp) { const k = this.k, [x0, y0, z0] = a.map(v => v * k), [x1, y1, z1] = b.map(v => v * k), n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)) || 1;
    for (let i = 0; i <= n; i++) { const px = x0 + (x1 - x0) * i / n, py = y0 + (y1 - y0) * i / n, pz = z0 + (z1 - z0) * i / n;
      for (let c = 0; c < Math.max(1, this.thick || 1); c++) this.set(px + (c & 1), py + ((c >> 1) & 1), pz, ramp); } return this; }
  paint(fn) { for (const v of this.m.values()) { const r = fn(v[0], v[1], v[2], v[3]); if (r) v[3] = r; } return this; }
  // ramp = [top, left(+y), right(+x)] or a 3+ colour material ramp (light, mid, dark)
  // ss > 1 (v2): render at ss x size, majority-downsample to target, then shadow + outline at final res
  render(w, h, opts = {}) {
    const ss = opts.ss || 1; if (ss === 1) return this._render(w, h, opts);
    const big = this._render(w * ss, h * ss, { ...opts, ox: opts.ox * ss, oy: opts.oy * ss, outline: false, shadow: false });
    let g = post.modeDownsample(big, ss);
    if (opts.shadowAt) { const s = new Grid(w, h); require('./iso').groundShadow(s, ...opts.shadowAt); g = s.stamp(g); }
    return opts.outline === false ? g : post.outline(g, opts.outlineColor || PAL.outline);
  }
  _render(w, h, { ox, oy, outline = true, outlineColor = PAL.outline, shadow = true, edgeLight = true } = {}) {
    let g = new Grid(w, h); const vs = [...this.m.values()].sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[2] - b[2]);
    if (shadow) { const xs = vs.filter(v => v[2] === 0); if (xs.length) { // ground shadow from footprint
      const sh = new Grid(w, h); for (const [x, y] of xs) { const sx = ox + (x - y) * 2, sy = oy + (x + y) + 2;
        for (let j = -1; j < 3; j++) for (let i = -3; i < 3; i++) sh.set(sx + i, sy + j, '#000000'); }
      for (let i = 0; i < w * h; i++) if (sh.d[i * 4 + 3]) g.set(i % w, Math.floor(i / w), PAL.shadow); } }
    for (const [x, y, z, r] of vs) {
      const sx = ox + (x - y) * 2 - 2, sy = oy + (x + y) - z * 2, T = r[0], L = r[1], R = r[2] || r[1];
      const topLit = edgeLight && !this.has(x, y, z + 1) && (!this.has(x - 1, y, z) || !this.has(x, y - 1, z));
      for (let i = 0; i < 4; i++) { g.set(sx + i, sy, T); g.set(sx + i, sy + 1, T); }
      if (topLit && !this.has(x, y - 1, z + 1)) { g.set(sx + 1, sy, r[3] || T); g.set(sx + 2, sy, r[3] || T); }
      for (let j = 2; j < 4; j++) { g.set(sx, sy + j, L); g.set(sx + 1, sy + j, L); g.set(sx + 2, sy + j, R); g.set(sx + 3, sy + j, R); }
    }
    if (outline) g = post.outline(g, outlineColor);
    return g;
  }
}
// helper: material ramp (light, mid, dark[, highlight]) -> voxel face ramp [top, left, right, highlight]
const face = (m, hi) => [m[0], m[1], m[2] || m[1], hi];
module.exports = { Voxels, face };
