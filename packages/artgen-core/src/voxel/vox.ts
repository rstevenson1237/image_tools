/**
 * MagicaVoxel `.vox` read / write (PLAN P6a, SPEC §7). Version 150, the chunks every reader understands: `MAIN` with
 * `SIZE`, `XYZI` and `RGBA`. Coordinates are 0–255 per axis, z up — the same axes as artgen's 3D mode.
 *
 * Writing keeps one palette entry per material (its ramp's middle step), so a model round-trips by material; reading
 * gives raw voxels + palette, and `voxCells` groups them by colour so a scene can add them as `cells` specs with the
 * direction's ramps (nearest ramp per colour unless the caller maps them).
 */
import { normHex, parseColor } from '../lib/color.ts';
import type { V3 } from '../views/camera.ts';
import type { VoxelSet } from './raster.ts';

export interface VoxModel {
  size: V3;
  /** [x, y, z, colour index 1–255]. */
  voxels: [number, number, number, number][];
  /** 256 colours (`#rrggbb`); entry i is colour index i + 1 (index 0 is unused / empty). */
  palette: string[];
}

const ascii = (s: string) => [...s].map(c => c.charCodeAt(0));

function chunk(id: string, content: Uint8Array, children: Uint8Array = new Uint8Array(0)): Uint8Array {
  const out = new Uint8Array(12 + content.length + children.length), v = new DataView(out.buffer);
  out.set(ascii(id), 0);
  v.setInt32(4, content.length, true); v.setInt32(8, children.length, true);
  out.set(content, 12); out.set(children, 12 + content.length);
  return out;
}

const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

export function encodeVox(m: VoxModel): Uint8Array {
  for (const [i, n] of m.size.entries()) if (n < 1 || n > 256) throw new Error(`vox: size[${i}] ${n} outside 1–256`);
  const size = new Uint8Array(12), sv = new DataView(size.buffer);
  m.size.forEach((n, i) => sv.setInt32(i * 4, n, true));
  const xyzi = new Uint8Array(4 + m.voxels.length * 4);
  new DataView(xyzi.buffer).setInt32(0, m.voxels.length, true);
  m.voxels.forEach(([x, y, z, c], i) => xyzi.set([x, y, z, c], 4 + i * 4));
  const rgba = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) { const [r, g, b] = parseColor(m.palette[i] ?? '#000000'); rgba.set([r, g, b, 255], i * 4); }
  const body = concat([chunk('SIZE', size), chunk('XYZI', xyzi), chunk('RGBA', rgba)]);
  const head = new Uint8Array(8);
  head.set(ascii('VOX '), 0); new DataView(head.buffer).setInt32(4, 150, true);
  return concat([head, chunk('MAIN', new Uint8Array(0), body)]);
}

export function decodeVox(bytes: Uint8Array): VoxModel {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), id = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4));
  if (id(0) !== 'VOX ') throw new Error('not a .vox file');
  let size: V3 = [0, 0, 0], voxels: VoxModel['voxels'] = [], palette: string[] | undefined;
  // walk MAIN's children (first model only)
  let o = 8 + 12;
  const end = Math.min(bytes.length, 8 + 12 + v.getInt32(8 + 8, true));
  let models = 0;
  while (o + 12 <= end) {
    const cid = id(o), n = v.getInt32(o + 4, true), m = v.getInt32(o + 8, true), c = o + 12;
    if (cid === 'SIZE' && models === 0) size = [v.getInt32(c, true), v.getInt32(c + 4, true), v.getInt32(c + 8, true)];
    else if (cid === 'XYZI' && models++ === 0) {
      const k = v.getInt32(c, true);
      voxels = Array.from({ length: k }, (_, i) => [bytes[c + 4 + i * 4], bytes[c + 5 + i * 4], bytes[c + 6 + i * 4], bytes[c + 7 + i * 4]] as [number, number, number, number]);
    } else if (cid === 'RGBA') palette = Array.from({ length: 256 }, (_, i) => normHex(`rgb(${bytes[c + i * 4]},${bytes[c + i * 4 + 1]},${bytes[c + i * 4 + 2]})`));
    o = c + n + m;
  }
  return { size, voxels, palette: palette ?? DEFAULT_PALETTE() };
}

/** MagicaVoxel's default palette is long; files without RGBA are rare — a grey ramp keeps them readable. */
const DEFAULT_PALETTE = () => Array.from({ length: 256 }, (_, i) => { const g = 255 - i; return normHex(`rgb(${g},${g},${g})`); });

/** A render-ready voxel set → `.vox`: one palette entry per material (its middle ramp step). Shifts to start at 0. */
export function voxFromSet(set: VoxelSet): VoxModel {
  if (set.mats.length > 255) throw new Error('vox: more than 255 materials');
  const xs = set.cells.map(c => c.v[0]), ys = set.cells.map(c => c.v[1]), zs = set.cells.map(c => c.v[2]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), z0 = Math.min(...zs);
  const size: V3 = [Math.max(...xs) - x0 + 1, Math.max(...ys) - y0 + 1, Math.max(...zs) - z0 + 1];
  const palette = Array.from({ length: 256 }, (_, i) => (i < set.mats.length ? set.mats[i][set.mats[i].length >> 1] : '#000000'));
  return { size, palette, voxels: set.cells.map(c => [c.v[0] - x0, c.v[1] - y0, c.v[2] - z0, c.mat + 1]) };
}

/** Voxels grouped by colour index, with the colour: add each group as a `cells` spec in a 3D scene. */
export function voxCells(m: VoxModel): { color: string; index: number; cells: V3[] }[] {
  const by = new Map<number, V3[]>();
  for (const [x, y, z, c] of m.voxels) { let l = by.get(c); if (!l) by.set(c, (l = [])); l.push([x, y, z]); }
  return [...by].sort((a, b) => a[0] - b[0]).map(([index, cells]) => ({ index, color: m.palette[index - 1], cells }));
}
