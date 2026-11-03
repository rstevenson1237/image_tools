// Compare a rendered dungeon with a reference image (docs/DUNGEON.md, "Comparing a render with a reference").
// Both images become a floor mask (a light pixel is floor), the render is shifted onto the reference's grid, and the
// script reports how much of the floor they share: IoU = shared / (in either), plus the pixel counts missing from the
// render and extra in it. It writes the reference, the aligned render and a red/blue diff side by side.
//
//   node scripts/dungeon-compare.mjs --source ref.png --mine out/d.png [options]   (npm run compare:dungeon -- …)
//
//   --source <png>       the reference image
//   --mine <png>         the render (`artgen dungeon render <id> --ppu <px a cell>`)
//   --origin <x,y>       where the reference's cell 0,0 lies in its pixels (default 0,0). A render has its sheet's
//                        corner at 0,0, so this is the shift that lines the two grids up: find it from a gridline's
//                        position in the reference (x = line − k × cell) and the same for y
//   --channel <c>        r, g, b or lum, the channel tested for floor (default lum)
//   --floor <n>          floor when the channel is above n, 0..255 (default 170); a coloured rock needs a channel
//                        the rock is low in: blue rock (58,156,240) with white floor: --channel r --floor 120
//   --close <n>          fill gaps in the floor (grid lines, text, symbols) with n rounds of closing (default 3)
//   --margin <n>         ignore n pixels along every edge of the reference (a white border or a cropped line)
//   --out <png>          the side-by-side image (default: compare.png beside --mine)
//   --min-iou <x>        exit 1 when the IoU is lower
//   --json               print the numbers as JSON
// Colours in the diff: grey = floor in both, red = floor in the reference only, blue = floor in the render only.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { decodePNG, encodePNG, Grid } from 'artgen-core';

const flag = (name) => process.argv.includes(name);
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 && i + 1 < process.argv.length ? process.argv[i + 1] : dflt; };
const fail = (m) => { console.error(`dungeon-compare: ${m}`); process.exit(2); };

const srcPath = arg('--source'), minePath = arg('--mine');
if (!srcPath || !minePath) fail('--source and --mine are needed (see the top of this file)');
const [ox, oy] = (arg('--origin', '0,0')).split(',').map(Number);
if (![ox, oy].every(Number.isFinite)) fail('--origin is x,y in pixels');
const channel = arg('--channel', 'lum'), floorMin = Number(arg('--floor', '170')), closeN = Number(arg('--close', '3'));
if (!['r', 'g', 'b', 'lum'].includes(channel)) fail('--channel is r, g, b or lum');
if (!(floorMin >= 0 && floorMin <= 255)) fail('--floor is 0..255');
if (!(Number.isInteger(closeN) && closeN >= 0)) fail('--close is a whole number');
const margin = Number(arg('--margin', '0'));
if (!(Number.isInteger(margin) && margin >= 0)) fail('--margin is a whole number of pixels');
const out = resolve(arg('--out', join(dirname(resolve(minePath)), 'compare.png')));

const load = (p) => decodePNG(new Uint8Array(readFileSync(p)));
const src = load(srcPath), mine = load(minePath);
const { w, h } = src;

// A pixel of g (RGBA over white where it is transparent) as the tested channel, 0..255; off the image: 0.
function level(g, x, y) {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return 0;
  const i = (y * g.w + x) * 4, a = g.d[i + 3] / 255;
  const c = (k) => g.d[i + k] * a + 255 * (1 - a);
  return channel === 'r' ? c(0) : channel === 'g' ? c(1) : channel === 'b' ? c(2) : 0.299 * c(0) + 0.587 * c(1) + 0.114 * c(2);
}

// The level at a fractional pixel position, interpolated between the four pixels round it (a cell origin that is not
// a whole pixel shifts the render by a fraction).
function sample(g, fx, fy) {
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  return level(g, x0, y0) * (1 - tx) * (1 - ty) + level(g, x0 + 1, y0) * tx * (1 - ty)
    + level(g, x0, y0 + 1) * (1 - tx) * ty + level(g, x0 + 1, y0 + 1) * tx * ty;
}

// Binary closing with the plus-shaped element, n rounds (dilate n times, then erode n times).
function morph(mask, dilate) {
  const o = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= w || yy >= h ? (dilate ? 0 : 1) : mask[yy * w + xx]);
    const hit = at(x, y) | at(x - 1, y) | at(x + 1, y) | at(x, y - 1) | at(x, y + 1);
    const all = at(x, y) & at(x - 1, y) & at(x + 1, y) & at(x, y - 1) & at(x, y + 1);
    o[y * w + x] = dilate ? hit : all;
  }
  return o;
}
function close(mask) {
  let m = mask;
  for (let i = 0; i < closeN; i++) m = morph(m, true);
  for (let i = 0; i < closeN; i++) m = morph(m, false);
  return m;
}

const sMask = new Uint8Array(w * h), mMask = new Uint8Array(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  sMask[y * w + x] = level(src, x, y) > floorMin ? 1 : 0;
  // the render's pixel under this reference pixel: the reference's cell origin sits at (ox, oy), the render's at 0,0
  mMask[y * w + x] = sample(mine, x - ox, y - oy) > floorMin ? 1 : 0;
}
const sa = close(sMask), ma = close(mMask);
const inside = (x, y) => x >= margin && y >= margin && x < w - margin && y < h - margin;

let both = 0, either = 0, missing = 0, extra = 0;
const panel = new Grid(w * 3 + 20, h);
const put = (px, y, r, g, b) => { const i = (y * panel.w + px) * 4; panel.d[i] = r; panel.d[i + 1] = g; panel.d[i + 2] = b; panel.d[i + 3] = 255; };
for (let y = 0; y < h; y++) {
  for (let px = 0; px < panel.w; px++) put(px, y, 20, 20, 20);
  for (let x = 0; x < w; x++) {
    const s = sa[y * w + x], m = ma[y * w + x];
    if (inside(x, y)) { if (s && m) both++; if (s || m) either++; if (s && !m) missing++; if (!s && m) extra++; }
    const si = (y * w + x) * 4;
    put(x, y, src.d[si], src.d[si + 1], src.d[si + 2]);
    const mx = Math.round(x - ox), my = Math.round(y - oy);
    if (mine.inb(mx, my)) { const mi = (my * mine.w + mx) * 4; put(w + 10 + x, y, mine.d[mi], mine.d[mi + 1], mine.d[mi + 2]); }
    const dc = s && m ? [235, 235, 235] : s ? [230, 60, 60] : m ? [70, 120, 255] : [30, 30, 30];
    put(2 * w + 20 + x, y, ...dc);
  }
}
writeFileSync(out, encodePNG(panel));

const iou = either ? both / either : 1;
const result = { iou: Number(iou.toFixed(4)), shared: both, missing, extra, source: [w, h], render: [mine.w, mine.h], origin: [ox, oy], margin, channel, floor: floorMin, close: closeN, out };
if (flag('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`floor IoU ${iou.toFixed(3)}  (shared ${both}, missing from render ${missing}, extra in render ${extra})`);
  console.log(`left to right: reference | render shifted by ${ox},${oy} | diff (grey both, red reference only, blue render only)`);
  console.log(`wrote ${out}`);
}
const min = arg('--min-iou');
if (min !== undefined && iou < Number(min)) { console.error(`dungeon-compare: IoU ${iou.toFixed(3)} is below --min-iou ${min}`); process.exit(1); }
