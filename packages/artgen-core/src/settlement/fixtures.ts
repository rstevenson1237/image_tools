/**
 * Furniture and fixtures: the things drawn in a building's rooms and on the site (beds, tables, hearths, stairs, wells,
 * carts). Each is plain geometry drawn to its own true size, so a 6 × 3 ft bed takes a bed's floor on the plan. A kind
 * has a name, a default size in feet (`w` across, `h` deep, before turning) and a drawing in a `w × h` pixel box centred
 * on the origin, with the theme's colours as `{ink}`, `{fill}` (wood, cloth), `{accent}` (fire, metal), `{stone}` and
 * `{water}`; `s` is the line width.
 */
import { n1 } from '../lib/svgdraw.ts';

export interface FixtureKind {
  name: string;
  /** Default size in feet, [across, deep]. */
  ft: [number, number];
  group: 'furniture' | 'fittings' | 'worship' | 'household' | 'stairs' | 'outdoor';
  draw: (w: number, h: number, s: number) => string;
}

const R = (x: number, y: number, w: number, h: number, fill: string, s: number, extra = '') => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(w)}" height="${n1(h)}" fill="${fill}" stroke="{ink}" stroke-width="${n1(s)}"${extra}/>`;
const C = (cx: number, cy: number, r: number, fill: string, s: number) => `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(Math.max(0.5, r))}" fill="${fill}" stroke="{ink}" stroke-width="${n1(s)}"/>`;
const E = (rx: number, ry: number, fill: string, s: number) => `<ellipse rx="${n1(Math.max(0.5, rx))}" ry="${n1(Math.max(0.5, ry))}" fill="${fill}" stroke="{ink}" stroke-width="${n1(s)}"/>`;
const L = (d: string, s: number, color = '{ink}') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n1(s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const box = (w: number, h: number, fill: string, s: number) => R(-w / 2, -h / 2, w, h, fill, s);
/** Treads across a run of stairs, `n` of them, climbing toward +x. */
const treads = (w: number, h: number, n: number) => { let d = ''; for (let i = 1; i < n; i++) { const x = -w / 2 + (w * i) / n; d += `M${n1(x)} ${n1(-h / 2)}V${n1(h / 2)}`; } return d; };

export const FIXTURES: Record<string, FixtureKind> = {
  // furniture
  bed: { name: 'Bed', ft: [3, 6], group: 'furniture', draw: (w, h, s) => box(w, h, '{fill}', s) + R(-w * 0.35, -h / 2 + h * 0.06, w * 0.7, h * 0.18, '{paper}', s * 0.7) + L(`M${n1(-w / 2)} ${n1(-h * 0.12)}H${n1(w / 2)}`, s * 0.7) },
  'double-bed': { name: 'Double bed', ft: [5, 6.5], group: 'furniture', draw: (w, h, s) => box(w, h, '{fill}', s) + R(-w * 0.44, -h / 2 + h * 0.06, w * 0.4, h * 0.16, '{paper}', s * 0.7) + R(w * 0.04, -h / 2 + h * 0.06, w * 0.4, h * 0.16, '{paper}', s * 0.7) + L(`M${n1(-w / 2)} ${n1(-h * 0.14)}H${n1(w / 2)}`, s * 0.7) },
  table: { name: 'Table', ft: [6, 3], group: 'furniture', draw: (w, h, s) => box(w, h, '{fill}', s) },
  'round-table': { name: 'Round table', ft: [4, 4], group: 'furniture', draw: (w, h, s) => E(w / 2, h / 2, '{fill}', s) },
  'long-table': { name: 'Long table (feast)', ft: [16, 3.5], group: 'furniture', draw: (w, h, s) => box(w, h, '{fill}', s) + L(`M${n1(-w / 2 + h * 0.3)} 0H${n1(w / 2 - h * 0.3)}`, s * 0.5) },
  chair: { name: 'Chair', ft: [1.6, 1.6], group: 'furniture', draw: (w, h, s) => box(w, h, '{fill}', s * 0.8) + L(`M${n1(-w / 2)} ${n1(-h / 2 + h * 0.2)}H${n1(w / 2)}`, s * 1.2) },
  stool: { name: 'Stool', ft: [1.3, 1.3], group: 'furniture', draw: (w, h, s) => E(w / 2, h / 2, '{fill}', s * 0.8) },
  bench: { name: 'Bench', ft: [5, 1.2], group: 'furniture', draw: (w, h, s) => box(w, h, '{fill}', s * 0.8) },
  chest: { name: 'Chest', ft: [3, 1.6], group: 'furniture', draw: (w, h, s) => box(w, h, '{fill}', s) + L(`M${n1(-w / 2)} ${n1(-h * 0.1)}H${n1(w / 2)}`, s * 0.7) + R(-w * 0.07, -h * 0.2, w * 0.14, h * 0.3, '{accent}', s * 0.5) },
  wardrobe: { name: 'Wardrobe', ft: [4, 2], group: 'furniture', draw: (w, h, s) => box(w, h, '{fill}', s) + L(`M0 ${n1(-h / 2)}V${n1(h / 2)}`, s * 0.7) },
  shelf: { name: 'Shelves', ft: [4, 1.2], group: 'furniture', draw: (w, h, s) => box(w, h, '{fill}', s) + L(`M${n1(-w / 6)} ${n1(-h / 2)}V${n1(h / 2)}M${n1(w / 6)} ${n1(-h / 2)}V${n1(h / 2)}`, s * 0.5) },
  bookcase: { name: 'Bookcase', ft: [4, 1.5], group: 'furniture', draw: (w, h, s) => { let d = ''; for (let i = 1; i < 8; i++) d += `M${n1(-w / 2 + (w * i) / 8)} ${n1(-h / 2 + h * 0.2)}V${n1(h / 2 - h * 0.15)}`; return box(w, h, '{fill}', s) + L(d, s * 0.5); } },
  desk: { name: 'Desk', ft: [4, 2.2], group: 'furniture', draw: (w, h, s) => box(w, h, '{fill}', s) + R(w * 0.15, -h / 2, w * 0.35, h, 'none', s * 0.5) },
  counter: { name: 'Counter', ft: [8, 2], group: 'furniture', draw: (w, h, s) => box(w, h, '{fill}', s) + L(`M${n1(-w / 2)} ${n1(h * 0.15)}H${n1(w / 2)}`, s * 0.6) },
  bar: { name: 'Bar (with kegs)', ft: [10, 2.5], group: 'furniture', draw: (w, h, s) => box(w, h, '{fill}', s) + [-0.3, 0, 0.3].map(f => C(w * f, 0, h * 0.28, '{accent}', s * 0.5)).join('') },
  // fittings
  barrel: { name: 'Barrel', ft: [2, 2], group: 'fittings', draw: (w, h, s) => E(w / 2, h / 2, '{fill}', s) + E(w * 0.28, h * 0.28, 'none', s * 0.6) },
  crate: { name: 'Crate', ft: [2, 2], group: 'fittings', draw: (w, h, s) => box(w, h, '{fill}', s) + L(`M${n1(-w / 2)} ${n1(-h / 2)}L${n1(w / 2)} ${n1(h / 2)}M${n1(w / 2)} ${n1(-h / 2)}L${n1(-w / 2)} ${n1(h / 2)}`, s * 0.6) },
  sacks: { name: 'Sacks', ft: [3, 2], group: 'fittings', draw: (w, h, s) => `<g transform="translate(${n1(-w * 0.22)} 0)">${E(w * 0.26, h * 0.42, '{fill}', s * 0.8)}</g><g transform="translate(${n1(w * 0.22)} ${n1(h * 0.05)})">${E(w * 0.26, h * 0.42, '{fill}', s * 0.8)}</g>` },
  hearth: { name: 'Hearth (open fire)', ft: [4, 4], group: 'fittings', draw: (w, h, s) => E(w / 2, h / 2, '{stone}', s) + E(w * 0.26, h * 0.26, '{accent}', s * 0.6) },
  fireplace: { name: 'Fireplace (in a wall)', ft: [5, 2.5], group: 'fittings', draw: (w, h, s) => box(w, h, '{stone}', s) + `<path d="M${n1(-w * 0.3)} ${n1(h / 2)}V${n1(-h * 0.05)}H${n1(w * 0.3)}V${n1(h / 2)}Z" fill="{accent}" stroke="{ink}" stroke-width="${n1(s * 0.6)}"/>` },
  oven: { name: 'Oven', ft: [4, 4], group: 'fittings', draw: (w, h, s) => `<path d="M${n1(-w / 2)} ${n1(h / 2)}V${n1(-h * 0.1)}A${n1(w / 2)} ${n1(h * 0.4)} 0 0 1 ${n1(w / 2)} ${n1(-h * 0.1)}V${n1(h / 2)}Z" fill="{stone}" stroke="{ink}" stroke-width="${n1(s)}"/>` + R(-w * 0.2, h * 0.15, w * 0.4, h * 0.35, '{accent}', s * 0.6) },
  forge: { name: 'Forge', ft: [5, 4], group: 'fittings', draw: (w, h, s) => box(w, h, '{stone}', s) + E(w * 0.26, h * 0.26, '{accent}', s * 0.6) },
  anvil: { name: 'Anvil', ft: [2.5, 1.2], group: 'fittings', draw: (w, h, s) => `<path d="M${n1(-w / 2)} ${n1(-h / 2)}H${n1(w * 0.3)}L${n1(w / 2)} 0L${n1(w * 0.3)} ${n1(h / 2)}H${n1(-w / 2)}Z" fill="{accent}" stroke="{ink}" stroke-width="${n1(s)}"/>` },
  cauldron: { name: 'Cauldron', ft: [2.5, 2.5], group: 'fittings', draw: (w, h, s) => E(w / 2, h / 2, '{accent}', s) + E(w * 0.32, h * 0.32, '{water}', s * 0.5) },
  loom: { name: 'Loom', ft: [5, 3], group: 'fittings', draw: (w, h, s) => { let d = ''; for (let i = 1; i < 7; i++) d += `M${n1(-w / 2 + (w * i) / 7)} ${n1(-h / 2)}V${n1(h / 2)}`; return box(w, h, 'none', s) + L(d, s * 0.4); } },
  // worship and ceremony
  altar: { name: 'Altar', ft: [6, 3], group: 'worship', draw: (w, h, s) => box(w, h, '{stone}', s) + L(`M0 ${n1(-h * 0.3)}V${n1(h * 0.3)}M${n1(-h * 0.3)} 0H${n1(h * 0.3)}`, s * 0.8) },
  pew: { name: 'Pew', ft: [8, 2], group: 'worship', draw: (w, h, s) => box(w, h, '{fill}', s * 0.8) + L(`M${n1(-w / 2)} ${n1(-h / 2 + h * 0.25)}H${n1(w / 2)}`, s) },
  throne: { name: 'Throne', ft: [3, 3], group: 'worship', draw: (w, h, s) => box(w, h, '{accent}', s) + R(-w / 2, -h / 2, w, h * 0.3, '{fill}', s) + R(-w / 2, -h / 2, w * 0.18, h, '{fill}', s * 0.7) + R(w / 2 - w * 0.18, -h / 2, w * 0.18, h, '{fill}', s * 0.7) },
  rug: { name: 'Rug', ft: [8, 5], group: 'worship', draw: (w, h, s) => R(-w / 2, -h / 2, w, h, '{accent}', s * 0.6, ' fill-opacity="0.35"') + R(-w * 0.38, -h * 0.34, w * 0.76, h * 0.68, 'none', s * 0.5) },
  statue: { name: 'Statue', ft: [3, 3], group: 'worship', draw: (w, h, s) => box(w, h, '{stone}', s) + C(0, 0, Math.min(w, h) * 0.28, '{paper}', s * 0.8) },
  pillar: { name: 'Pillar', ft: [2, 2], group: 'worship', draw: (w, h, s) => E(w / 2, h / 2, '{stone}', s) },
  // household
  bath: { name: 'Bath / tub', ft: [5, 2.6], group: 'household', draw: (w, h, s) => `<rect x="${n1(-w / 2)}" y="${n1(-h / 2)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(h * 0.45)}" fill="{fill}" stroke="{ink}" stroke-width="${n1(s)}"/><rect x="${n1(-w * 0.4)}" y="${n1(-h * 0.3)}" width="${n1(w * 0.8)}" height="${n1(h * 0.6)}" rx="${n1(h * 0.3)}" fill="{water}" stroke="{ink}" stroke-width="${n1(s * 0.5)}"/>` },
  privy: { name: 'Privy', ft: [3, 3], group: 'household', draw: (w, h, s) => box(w, h, '{fill}', s) + E(w * 0.22, h * 0.26, '{paper}', s * 0.7) },
  trough: { name: 'Trough', ft: [6, 2], group: 'household', draw: (w, h, s) => box(w, h, '{fill}', s) + R(-w * 0.42, -h * 0.28, w * 0.84, h * 0.56, '{water}', s * 0.5) },
  'weapon-rack': { name: 'Weapon rack', ft: [4, 1], group: 'household', draw: (w, h, s) => { let d = `M${n1(-w / 2)} 0H${n1(w / 2)}`; for (let i = 1; i < 5; i++) d += `M${n1(-w / 2 + (w * i) / 5)} ${n1(-h * 0.8)}V${n1(h * 0.8)}`; return box(w, h, '{fill}', s * 0.7) + L(d, s * 0.7, '{accent}'); } },
  // stairs and openings (stairs climb toward their angle: +x before turning)
  stairs: { name: 'Stairs (climb to the right)', ft: [10, 4], group: 'stairs', draw: (w, h, s) => box(w, h, '{paper}', s) + L(treads(w, h, Math.max(3, Math.round(w / (h * 0.3)))), s * 0.6) },
  'stairs-up': { name: 'Stairs up', ft: [10, 4], group: 'stairs', draw: (w, h, s) => box(w, h, '{paper}', s) + L(treads(w, h, Math.max(3, Math.round(w / (h * 0.3)))), s * 0.6) + L(`M${n1(-w * 0.38)} 0H${n1(w * 0.34)}M${n1(w * 0.2)} ${n1(-h * 0.2)}L${n1(w * 0.36)} 0L${n1(w * 0.2)} ${n1(h * 0.2)}`, s) },
  'stairs-down': { name: 'Stairs down', ft: [10, 4], group: 'stairs', draw: (w, h, s) => box(w, h, '{paper}', s) + L(treads(w, h, Math.max(3, Math.round(w / (h * 0.3)))), s * 0.6) + L(`M${n1(w * 0.38)} 0H${n1(-w * 0.34)}M${n1(-w * 0.2)} ${n1(-h * 0.2)}L${n1(-w * 0.36)} 0L${n1(-w * 0.2)} ${n1(h * 0.2)}`, s) },
  'spiral-stairs': { name: 'Spiral stairs', ft: [6, 6], group: 'stairs', draw: (w, h, s) => { let d = ''; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; d += `M0 0L${n1(Math.cos(a) * w / 2)} ${n1(Math.sin(a) * h / 2)}`; } return E(w / 2, h / 2, '{paper}', s) + L(d, s * 0.5) + C(0, 0, Math.min(w, h) * 0.1, '{ink}', 0); } },
  ladder: { name: 'Ladder', ft: [2, 5], group: 'stairs', draw: (w, h, s) => { let d = `M${n1(-w * 0.35)} ${n1(-h / 2)}V${n1(h / 2)}M${n1(w * 0.35)} ${n1(-h / 2)}V${n1(h / 2)}`; for (let i = 1; i < 5; i++) d += `M${n1(-w * 0.35)} ${n1(-h / 2 + (h * i) / 5)}H${n1(w * 0.35)}`; return L(d, s); } },
  trapdoor: { name: 'Trapdoor', ft: [3, 3], group: 'stairs', draw: (w, h, s) => box(w, h, '{fill}', s) + L(`M${n1(-w / 2)} ${n1(-h / 2)}L${n1(w / 2)} ${n1(h / 2)}`, s * 0.6) + C(w * 0.3, 0, Math.min(w, h) * 0.06, '{ink}', 0) },
  millstone: { name: 'Millstone', ft: [6, 6], group: 'fittings', draw: (w, h, s) => E(w / 2, h / 2, '{stone}', s) + E(w * 0.12, h * 0.12, '{paper}', s * 0.6) + L(`M${n1(-w * 0.4)} 0H${n1(-w * 0.15)}M${n1(w * 0.15)} 0H${n1(w * 0.4)}`, s * 0.5) },
  bunk: { name: 'Bunk bed', ft: [3, 6.5], group: 'furniture', draw: (w, h, s) => box(w, h, '{fill}', s) + R(-w / 2, -h / 2, w, h * 0.5, 'none', s * 0.6) + R(-w * 0.35, -h / 2 + h * 0.05, w * 0.7, h * 0.12, '{paper}', s * 0.6) + R(-w * 0.35, h * 0.05, w * 0.7, h * 0.12, '{paper}', s * 0.6) },
  dais: { name: 'Dais', ft: [12, 8], group: 'worship', draw: (w, h, s) => box(w, h, '{stone}', s) + R(-w * 0.4, -h * 0.35, w * 0.8, h * 0.7, 'none', s * 0.5) },
  // site and outdoor
  well: { name: 'Well', ft: [5, 5], group: 'outdoor', draw: (w, h, s) => E(w / 2, h / 2, '{stone}', s) + E(w * 0.3, h * 0.3, '{water}', s * 0.7) },
  fountain: { name: 'Fountain', ft: [12, 12], group: 'outdoor', draw: (w, h, s) => E(w / 2, h / 2, '{stone}', s) + E(w * 0.4, h * 0.4, '{water}', s * 0.6) + C(0, 0, Math.min(w, h) * 0.1, '{stone}', s * 0.7) },
  stall: { name: 'Market stall', ft: [8, 5], group: 'outdoor', draw: (w, h, s) => box(w, h, '{accent}', s) + L(`M${n1(-w / 2)} ${n1(-h / 2)}L${n1(w / 2)} ${n1(h / 2)}M${n1(w / 2)} ${n1(-h / 2)}L${n1(-w / 2)} ${n1(h / 2)}`, s * 0.5) },
  cart: { name: 'Cart', ft: [5, 9], group: 'outdoor', draw: (w, h, s) => R(-w * 0.4, -h * 0.25, w * 0.8, h * 0.7, '{fill}', s) + R(-w / 2, 0, w * 0.1, h * 0.3, '{ink}', 0) + R(w * 0.4, 0, w * 0.1, h * 0.3, '{ink}', 0) + L(`M${n1(-w * 0.2)} ${n1(-h * 0.25)}L${n1(-w * 0.15)} ${n1(-h / 2)}M${n1(w * 0.2)} ${n1(-h * 0.25)}L${n1(w * 0.15)} ${n1(-h / 2)}`, s) },
  haystack: { name: 'Haystack', ft: [8, 8], group: 'outdoor', draw: (w, h, s) => E(w / 2, h / 2, '{fill}', s) + E(w * 0.32, h * 0.32, 'none', s * 0.5) + E(w * 0.14, h * 0.14, 'none', s * 0.5) },
  woodpile: { name: 'Woodpile', ft: [6, 3], group: 'outdoor', draw: (w, h, s) => box(w, h, '{fill}', s) + [-0.3, 0, 0.3].map(f => C(w * f, 0, h * 0.3, 'none', s * 0.5)).join('') },
  signpost: { name: 'Signpost', ft: [3, 3], group: 'outdoor', draw: (w, h, s) => C(0, 0, Math.min(w, h) * 0.15, '{ink}', 0) + L(`M0 0L${n1(w / 2)} ${n1(-h * 0.2)}M0 0L${n1(-w / 2)} ${n1(-h * 0.1)}`, s * 1.2) },
  cross: { name: 'Wayside cross / grave', ft: [2, 3], group: 'outdoor', draw: (w, h, s) => L(`M0 ${n1(-h / 2)}V${n1(h / 2)}M${n1(-w / 2)} ${n1(-h * 0.18)}H${n1(w / 2)}`, s * 1.4) },
  gallows: { name: 'Gallows', ft: [8, 8], group: 'outdoor', draw: (w, h, s) => box(w, h, '{fill}', s) + L(`M${n1(-w * 0.3)} ${n1(h * 0.3)}V${n1(-h * 0.3)}H${n1(w * 0.3)}V${n1(-h * 0.1)}`, s * 1.3) },
  pen: { name: 'Pen / sty', ft: [10, 8], group: 'outdoor', draw: (w, h, s) => R(-w / 2, -h / 2, w, h, 'none', s, ` stroke-dasharray="${n1(s * 3)} ${n1(s * 1.5)}"`) },
  boat: { name: 'Boat', ft: [5, 14], group: 'outdoor', draw: (w, h, s) => `<path d="M0 ${n1(-h / 2)}Q${n1(w / 2)} ${n1(-h * 0.2)} ${n1(w / 2)} ${n1(h * 0.3)}L${n1(w * 0.3)} ${n1(h / 2)}H${n1(-w * 0.3)}L${n1(-w / 2)} ${n1(h * 0.3)}Q${n1(-w / 2)} ${n1(-h * 0.2)} 0 ${n1(-h / 2)}Z" fill="{fill}" stroke="{ink}" stroke-width="${n1(s)}"/>` + L(`M${n1(-w * 0.4)} 0H${n1(w * 0.4)}M${n1(-w * 0.4)} ${n1(h * 0.22)}H${n1(w * 0.4)}`, s * 0.6) },
  dock: { name: 'Jetty / dock', ft: [6, 20], group: 'outdoor', draw: (w, h, s) => { let d = ''; for (let i = 1; i < Math.max(2, Math.round(h / w * 3)); i++) d += `M${n1(-w / 2)} ${n1(-h / 2 + (h * i) / Math.max(2, Math.round(h / w * 3)))}H${n1(w / 2)}`; return box(w, h, '{fill}', s) + L(d, s * 0.4); } },
};

export const FIXTURE_KINDS = Object.keys(FIXTURES);

/** A fixture's size in plan (or site) cells of `perCell` feet: its own, else its kind's. */
export function fixtureSize(f: { kind: string; w?: number; h?: number }, perCell: number): [number, number] {
  const k = FIXTURES[f.kind];
  return [f.w ?? (k ? k.ft[0] / perCell : 1), f.h ?? (k ? k.ft[1] / perCell : 1)];
}
