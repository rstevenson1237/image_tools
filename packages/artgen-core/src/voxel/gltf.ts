/**
 * Greedy-mesh glTF export (PLAN P6a, SPEC §7): voxel faces merged into maximal rectangles per material and direction,
 * written as one binary `.glb` (a mesh with one primitive per material, flat normals, base colour = the ramp's middle
 * step). Axes: artgen's x right / y toward the viewer / z up become glTF's x / z / y (Y up, right-handed). The game
 * loads it with three.js `GLTFLoader` (`voxelModel` in the three adapter keeps the colours flat and unfiltered).
 */
import { parseColor } from '../lib/color.ts';
import type { V3 } from '../views/camera.ts';
import { VoxelGrid, type VoxelSet } from './raster.ts';

export interface Quad { mat: number; /** 4 corners, model frame */ p: [V3, V3, V3, V3]; n: V3 }

/** Greedy meshing: visible faces merged into rectangles of one material. */
export function greedyMesh(set: VoxelSet): Quad[] {
  const g = new VoxelGrid(set), quads: Quad[] = [];
  if (g.empty) return quads;
  const lo = [g.x0, g.y0, g.z0], n = [g.nx, g.ny, g.nz];
  const matAt = (p: number[]) => { const c = g.at(p[0], p[1], p[2]); return c < 0 ? -1 : set.cells[c].mat; };
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3, v = (d + 2) % 3;
    for (const dir of [1, -1]) {
      for (let s = 0; s < n[d]; s++) {
        // mask of faces on the `dir` side of layer s
        const mask = new Int32Array(n[u] * n[v]).fill(-1);
        for (let j = 0; j < n[v]; j++) for (let i = 0; i < n[u]; i++) {
          const p = [0, 0, 0]; p[d] = lo[d] + s; p[u] = lo[u] + i; p[v] = lo[v] + j;
          const m = matAt(p);
          if (m < 0) continue;
          const q = [...p]; q[d] += dir;
          if (matAt(q) < 0) mask[j * n[u] + i] = m;
        }
        for (let j = 0; j < n[v]; j++) for (let i = 0; i < n[u];) {
          const m = mask[j * n[u] + i];
          if (m < 0) { i++; continue; }
          let w = 1;
          while (i + w < n[u] && mask[j * n[u] + i + w] === m) w++;
          let h = 1;
          grow: while (j + h < n[v]) { for (let k = 0; k < w; k++) if (mask[(j + h) * n[u] + i + k] !== m) break grow; h++; }
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[(j + y) * n[u] + i + x] = -1;
          const plane = lo[d] + s + (dir > 0 ? 1 : 0), corner = (a: number, b: number): V3 => { const c: V3 = [0, 0, 0]; c[d] = plane; c[u] = lo[u] + a; c[v] = lo[v] + b; return c; };
          const nn: V3 = [0, 0, 0]; nn[d] = dir;
          const ps: [V3, V3, V3, V3] = [corner(i, j), corner(i + w, j), corner(i + w, j + h), corner(i, j + h)];
          quads.push({ mat: m, p: dir > 0 ? ps : [ps[0], ps[3], ps[2], ps[1]], n: nn });
          i += w;
        }
      }
    }
  }
  return quads;
}

const srgbToLinear = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };

/** `.glb` bytes for a voxel set. `scale` = metres (glTF units) per voxel; the footprint centre sits at the origin. */
export function voxelGlb(set: VoxelSet, o: { scale?: number; name?: string } = {}): Uint8Array {
  const quads = greedyMesh(set), s = o.scale ?? 0.1, g = new VoxelGrid(set), [cx, cy] = g.pivot();
  const toGl = (p: V3): V3 => [(p[0] - cx) * s, p[2] * s, (p[1] - cy) * s];
  const nToGl = (n: V3): V3 => [n[0], n[2], n[1]];
  const bins: number[][] = [], json: any = {
    asset: { version: '2.0', generator: 'artgen' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: o.name ?? 'voxels' }],
    meshes: [{ name: o.name ?? 'voxels', primitives: [] }], materials: [], accessors: [], bufferViews: [], buffers: [],
  };
  let offset = 0;
  const view = (bytes: Uint8Array, target: number) => {
    const pad = (4 - (bytes.length % 4)) % 4;
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
    bins.push([...bytes, ...new Array(pad).fill(0)]);
    offset += bytes.length + pad;
    return json.bufferViews.length - 1;
  };
  set.mats.forEach((ramp, mi) => {
    const qs = quads.filter(q => q.mat === mi);
    if (!qs.length) return;
    const pos = new Float32Array(qs.length * 12), nor = new Float32Array(qs.length * 12), idx = new Uint32Array(qs.length * 6);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    qs.forEach((q, k) => {
      // model → glTF swaps y and z (a mirror), so reverse the winding to keep faces outward
      const ps = [q.p[0], q.p[3], q.p[2], q.p[1]].map(toGl);
      ps.forEach((p, c) => { pos.set(p, k * 12 + c * 3); nor.set(nToGl(q.n), k * 12 + c * 3); for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], p[a]); max[a] = Math.max(max[a], p[a]); } });
      idx.set([k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3], k * 6);
    });
    const pv = view(new Uint8Array(pos.buffer), 34962), nv = view(new Uint8Array(nor.buffer), 34962), iv = view(new Uint8Array(idx.buffer), 34963);
    const acc = (bufferView: number, componentType: number, count: number, type: string, extra = {}) => { json.accessors.push({ bufferView, componentType, count, type, ...extra }); return json.accessors.length - 1; };
    const [r, gg, b] = parseColor(ramp[ramp.length >> 1]);
    json.materials.push({ name: `mat${mi}`, pbrMetallicRoughness: { baseColorFactor: [srgbToLinear(r), srgbToLinear(gg), srgbToLinear(b), 1], metallicFactor: 0, roughnessFactor: 1 } });
    json.meshes[0].primitives.push({
      attributes: { POSITION: acc(pv, 5126, qs.length * 4, 'VEC3', { min, max }), NORMAL: acc(nv, 5126, qs.length * 4, 'VEC3') },
      indices: acc(iv, 5125, qs.length * 6, 'SCALAR'), material: json.materials.length - 1,
    });
  });
  const bin = new Uint8Array(bins.flat());
  json.buffers.push({ byteLength: bin.length });
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const jb = new TextEncoder().encode(text), total = 12 + 8 + jb.length + 8 + bin.length;
  const out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jb.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(jb, 20);
  dv.setUint32(20 + jb.length, bin.length, true); dv.setUint32(24 + jb.length, 0x004e4942, true); out.set(bin, 28 + jb.length);
  return out;
}

/** Parse a `.glb` header + JSON chunk (tests and tools). */
export function readGlbJson(bytes: Uint8Array): any {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a glb');
  const n = dv.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + n)));
}
