/**
 * The free camera (docs/MESHES.md §9): a perspective orbit camera and a software triangle rasteriser, so the CLI's
 * turntable and the web UI's orbit preview draw the same pixels. Meshes draw their baked colour lit through the normal
 * map by a key light (the direction's) and an ambient term; voxel meshes draw their ramp colours lit by the face normal.
 * The camera works in glTF's frame (x right, y up, z toward the viewer), so yaw 0 looks at the model's front as the
 * sprites' facing `s` does and x is to the right, as in every pixel-art view.
 */
import { parseColor } from 'artgen-primitives/lib/color.ts';
import { Grid } from 'artgen-primitives/lib/grid.ts';
import type { V3 } from '../t2/scene3d.ts';
import { greedyMesh } from '../voxel/gltf.ts';
import type { VoxelSet } from '../voxel/raster.ts';
import type { MeshResult } from './build.ts';

/** What the rasteriser draws: positions and normals in model units (artgen frame), with a texture or vertex colours. */
export interface ViewMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** Per vertex 0–255 RGB (voxel meshes). */
  colors?: Float32Array;
  uvs?: Float32Array;
  tangents?: Float32Array;
  color?: Grid;
  normal?: Grid;
}

export interface OrbitOptions {
  /** Model point looked at (default the box centre). */
  target?: V3;
  /** Degrees round the vertical axis; 0 looks at the front (+y), as facing `s`. */
  yaw?: number;
  /** Degrees above the horizon. */
  pitch?: number;
  /** Model units from the target (default: the whole model in view). */
  distance?: number;
  /** Vertical field of view, degrees (default 30). */
  fov?: number;
  w: number;
  h: number;
}

export interface OrbitCamera { eye: V3; right: V3; up: V3; fwd: V3; focal: number; w: number; h: number; near: number }

const gl = (p: V3): V3 => [p[0], p[2], p[1]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** The model's box and bounding radius (model units). */
export function viewBounds(m: ViewMesh): { center: V3; radius: number } {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], P = m.positions;
  for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], P[i + a]); hi[a] = Math.max(hi[a], P[i + a]); }
  if (!P.length) return { center: [0, 0, 0], radius: 1 };
  const center: V3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  return { center, radius: Math.max(1e-3, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2) };
}

/** A look-at camera round a target. `fit` is the radius that must stay in view when no distance is given. */
export function orbitCamera(o: OrbitOptions, fit = 1): OrbitCamera {
  const fov = ((o.fov ?? 30) * Math.PI) / 180, yaw = ((o.yaw ?? 0) * Math.PI) / 180, pitch = ((o.pitch ?? 20) * Math.PI) / 180;
  const half = Math.min(fov / 2, Math.atan((Math.tan(fov / 2) * o.w) / o.h)), d = o.distance ?? (fit / Math.sin(half)) * 1.05;
  const t = gl(o.target ?? [0, 0, 0]), eye: V3 = [t[0] + d * Math.sin(yaw) * Math.cos(pitch), t[1] + d * Math.sin(pitch), t[2] + d * Math.cos(yaw) * Math.cos(pitch)];
  const fwd = unit(sub(t, eye)), right = unit(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
  return { eye, right, up, fwd, focal: o.h / 2 / Math.tan(fov / 2), w: o.w, h: o.h, near: d * 0.05 };
}

/** Screen position and depth of a model point (undefined behind the near plane). */
export function projectPoint(cam: OrbitCamera, p: V3): [number, number, number] | undefined {
  const q = sub(gl(p), cam.eye), z = dot(q, cam.fwd);
  if (z < cam.near) return undefined;
  return [cam.w / 2 + (dot(q, cam.right) / z) * cam.focal, cam.h / 2 - (dot(q, cam.up) / z) * cam.focal, z];
}

export interface RasterMeshOptions {
  /** Key light in the model frame (toward the light); default up, to the front-left. */
  light?: V3;
  ambient?: number;
  /** Samples per pixel per axis (default 2). */
  ss?: number;
  /** Fill colour behind the model (default transparent). */
  background?: string;
}

/** Draw a mesh with a depth buffer: texels (nearest) or vertex colours, lit by the key light and ambient. */
export function rasterMesh(m: ViewMesh, cam: OrbitCamera, o: RasterMeshOptions = {}): Grid {
  const ss = o.ss ?? 2, W = cam.w * ss, H = cam.h * ss, depth = new Float32Array(W * H).fill(Infinity), rgb = new Float32Array(W * H * 3);
  const L = unit(o.light ?? [-0.4, 0.6, 0.7]), amb = o.ambient ?? 0.45, sc: OrbitCamera = { ...cam, w: W, h: H, focal: cam.focal * ss };
  const P = m.positions, N = m.normals, I = m.indices, T = m.tangents, U = m.uvs, C = m.colors, tex = m.color, nmap = m.normal;
  const proj: ([number, number, number] | undefined)[] = [];
  for (let i = 0; i < P.length / 3; i++) proj.push(projectPoint(sc, [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]));
  for (let t = 0; t < I.length / 3; t++) {
    const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2], pa = proj[a], pb = proj[b], pc = proj[c];
    if (!pa || !pb || !pc) continue;
    const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(pa[0], pb[0], pc[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(pa[0], pb[0], pc[0])));
    const y0 = Math.max(0, Math.floor(Math.min(pa[1], pb[1], pc[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(pa[1], pb[1], pc[1])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      let wa = ((pb[0] - px) * (pc[1] - py) - (pb[1] - py) * (pc[0] - px)) / area, wb = ((pc[0] - px) * (pa[1] - py) - (pc[1] - py) * (pa[0] - px)) / area;
      let wc = 1 - wa - wb;
      if (wa < 0 || wb < 0 || wc < 0) continue;
      // perspective-correct weights
      const ia = wa / pa[2], ib = wb / pb[2], ic = wc / pc[2], iz = ia + ib + ic, z = 1 / iz, q = y * W + x;
      if (z >= depth[q]) continue;
      depth[q] = z; wa = ia * z; wb = ib * z; wc = ic * z;
      const at = (A: Float32Array, n: number, k: number) => A[a * n + k] * wa + A[b * n + k] * wb + A[c * n + k] * wc;
      let n: V3 = unit([at(N, 3, 0), at(N, 3, 1), at(N, 3, 2)]), col: [number, number, number] = [200, 200, 200];
      if (U && tex) {
        const u = at(U, 2, 0), v = at(U, 2, 1), tx = Math.min(tex.w - 1, Math.max(0, Math.floor(u * tex.w))), ty = Math.min(tex.h - 1, Math.max(0, Math.floor(v * tex.h))), ti = (ty * tex.w + tx) * 4;
        col = [tex.d[ti], tex.d[ti + 1], tex.d[ti + 2]];
        if (nmap && T) {
          const tg = unit([at(T, 4, 0), at(T, 4, 1), at(T, 4, 2)]), w = T[a * 4 + 3], bt = cross(n, tg).map(v => v * w) as V3;
          const ex = nmap.d[ti] / 127.5 - 1, ey = nmap.d[ti + 1] / 127.5 - 1, ez = nmap.d[ti + 2] / 127.5 - 1;
          n = unit([tg[0] * ex + bt[0] * ey + n[0] * ez, tg[1] * ex + bt[1] * ey + n[1] * ez, tg[2] * ex + bt[2] * ey + n[2] * ez]);
        }
      } else if (C) col = [at(C, 3, 0), at(C, 3, 1), at(C, 3, 2)];
      const lit = amb + (1 - amb) * Math.max(0, dot(n, L)) * 1.25;
      rgb[q * 3] = col[0] * lit; rgb[q * 3 + 1] = col[1] * lit; rgb[q * 3 + 2] = col[2] * lit;
    }
  }
  const out = new Grid(cam.w, cam.h), bg = o.background ? parseColor(o.background) : undefined;
  for (let y = 0; y < cam.h; y++) for (let x = 0; x < cam.w; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const q = (y * ss + j) * W + x * ss + i;
      if (depth[q] === Infinity) { if (bg) { r += bg[0]; g += bg[1]; b += bg[2]; } continue; }
      r += rgb[q * 3]; g += rgb[q * 3 + 1]; b += rgb[q * 3 + 2]; n++;
    }
    const k = bg ? ss * ss : n, i = (y * cam.w + x) * 4;
    if (!k) continue;
    out.d[i] = r / k; out.d[i + 1] = g / k; out.d[i + 2] = b / k; out.d[i + 3] = bg ? 255 : Math.round((n / (ss * ss)) * 255);
  }
  return out;
}

/** A baked mesh as the rasteriser draws it. */
export const viewOfMesh = (r: MeshResult): ViewMesh => ({
  positions: r.mesh.positions, normals: r.mesh.normals, indices: r.mesh.indices, uvs: r.mesh.uvs, tangents: r.mesh.tangents, color: r.textures.color, normal: r.textures.normal,
});

/** A voxel set as greedy-meshed quads (model units: fine voxels ÷ `k`), coloured by each ramp's middle step. */
export function voxelViewMesh(set: VoxelSet, k = 1): ViewMesh {
  const quads = greedyMesh(set), P = new Float32Array(quads.length * 12), N = new Float32Array(quads.length * 12), C = new Float32Array(quads.length * 12), I = new Uint32Array(quads.length * 6);
  const mid = set.mats.map(r => parseColor(r[r.length >> 1]));
  quads.forEach((q, i) => {
    q.p.forEach((p, c) => { P.set([p[0] / k, p[1] / k, p[2] / k], i * 12 + c * 3); N.set(q.n, i * 12 + c * 3); C.set(mid[q.mat].slice(0, 3), i * 12 + c * 3); });
    I.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  });
  return { positions: P, normals: N, indices: I, colors: C };
}

export interface TurntableOptions { angles?: number; pitch?: number; fov?: number; w?: number; h?: number; light?: V3; background?: string; ss?: number }

/** The model from `angles` yaws (default 8, every 45° from the front) at one pitch, side by side with a 1 px gap. */
export function turntable(m: ViewMesh, o: TurntableOptions = {}): Grid {
  const n = o.angles ?? 8, w = o.w ?? 96, h = o.h ?? 96, { center, radius } = viewBounds(m), out = new Grid(n * (w + 1) - 1, h);
  for (let i = 0; i < n; i++) {
    const cam = orbitCamera({ target: center, yaw: (i * 360) / n, pitch: o.pitch ?? 20, fov: o.fov, w, h }, radius);
    out.blit(rasterMesh(m, cam, { light: o.light, background: o.background, ss: o.ss }), i * (w + 1), 0);
  }
  return out;
}
