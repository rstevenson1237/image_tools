/**
 * Texture baking (docs/MESHES.md §6): every texel inside a triangle finds its point on the true surface (the distance
 * field, not the budgeted mesh) and bakes from the source there. Colour: the paint solid's ramp (the voxel rules), its
 * middle step moved one step by the solid's grain noise (`pbr`), or the step the direction's banded light picks for the
 * true normal (`baked`). Normal: the true normal in the triangle's tangent frame, so the normal map puts back the detail
 * the budget took out (faceted triangles stay flat). Roughness and metal: the solid's, else by the material's name,
 * packed as glTF has them (G roughness, B metal). Colours are palette-exact. Each chart then grows two texels into its
 * gutter, so a sample at a chart's edge never reads the background.
 */
import { parseColor } from 'artgen-primitives/lib/color.ts';
import { Grid } from 'artgen-primitives/lib/grid.ts';
import { bandIndices } from 'artgen-primitives/raster.ts';
import type { DirContext } from '../direction.ts';
import { camera, lightIn } from '../views/camera.ts';
import type { V3 } from '../t2/scene3d.ts';
import type { SceneField, Solid } from './field.ts';
import { texelsIn, type TriMesh } from './uv.ts';

export type MeshLook = 'pbr' | 'baked';
export interface BakedTextures { color: Grid; normal: Grid; orm: Grid }

/** Roughness and metal by material name (the solid's own `rough` / `metal` win). */
const SURFACES: [RegExp, number, number][] = [
  [/metal|steel|iron|gold|silver|brass|copper|bronze|chrome/, 0.35, 1],
  [/glass|ice|water|gem|crystal|jewel/, 0.1, 0],
  [/skin|flesh/, 0.55, 0],
  [/leather/, 0.65, 0],
  [/wood|bark/, 0.8, 0],
  [/stone|rock|brick|bone/, 0.9, 0],
  [/cloth|fabric|wool|fur|hair|grass|moss|leaf|dirt|sand|mud/, 0.95, 0],
];

export function surfaceOf(s: Pick<Solid, 'role' | 'rough' | 'metal'>): { rough: number; metal: number } {
  const hit = SURFACES.find(([re]) => re.test(s.role ?? ''));
  return { rough: s.rough ?? hit?.[1] ?? 0.85, metal: s.metal ?? hit?.[2] ?? 0 };
}

/** A hash in [0, 1) per voxel cell and solid (the grain is voxel-sized, so it reads as pixel art). */
function cellNoise(seed: number, x: number, y: number, z: number, salt: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ Math.imul(seed, 2246822519) ^ Math.imul(salt, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const rotZ = (v: V3, deg: number): V3 => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
};

/** The direction's light in the model frame, as the iso sprites have it (facing `s`; the iso camera yaws the model −45°). */
export function worldLight(dir: Pick<DirContext, 'camera'>): { light: V3; view: V3 } {
  const cam = camera('iso');
  return { light: rotZ(lightIn(cam, dir.camera.light), 45), view: rotZ(cam.V, 45) };
}

export interface BakeOptions { look?: MeshLook; seed?: number; gain?: number }

export function bakeTextures(mesh: TriMesh, width: number, height: number, field: SceneField, dir: DirContext, o: BakeOptions = {}): BakedTextures {
  const color = new Grid(width, height), normal = new Grid(width, height), orm = new Grid(width, height), set = new Uint8Array(width * height);
  const look = o.look ?? 'pbr', seed = o.seed ?? 1, gain = o.gain ?? 1.4, { light, view } = worldLight(dir), ref = light[0] * view[0] + light[1] * view[1] + light[2] * view[2];
  const salt = new Map(field.solids.map((s, i) => [s, i + 1]));
  const rgb = new Map<string, [number, number, number]>(), rgbOf = (hex: string) => { let c = rgb.get(hex); if (!c) rgb.set(hex, (c = parseColor(hex).slice(0, 3) as [number, number, number])); return c; };
  const { positions: P, normals: N, tangents: T, uvs: U, indices: I } = mesh;
  for (let t = 0; t < I.length / 3; t++) {
    const [a, b, c] = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], uv = (v: number): [number, number] => [U[v * 2] * width, U[v * 2 + 1] * height];
    texelsIn(uv(a), uv(b), uv(c), (x, y, wa, wb, wc) => {
      const at = (A: Float32Array, n: number, k: number) => A[a * n + k] * wa + A[b * n + k] * wb + A[c * n + k] * wc;
      let p: V3 = [at(P, 3, 0), at(P, 3, 1), at(P, 3, 2)];
      const vn: V3 = [at(N, 3, 0), at(N, 3, 1), at(N, 3, 2)];
      // onto the true surface (two Newton steps along the gradient)
      let n = field.normal(p[0], p[1], p[2], vn);
      for (let it = 0; it < 2; it++) {
        const d = field.sdf(p[0], p[1], p[2]);
        if (!Number.isFinite(d) || Math.abs(d) > 2) break;
        p = [p[0] - n[0] * d, p[1] - n[1] * d, p[2] - n[2] * d];
        n = field.normal(p[0], p[1], p[2], n);
      }
      const s = field.paint(p, n), ramp = s.ramp, mid = ramp.length >> 1;
      let step = mid;
      if (look === 'baked') {
        const lv = bandIndices(ramp.length, dir.shading.bands), nl = lv.length, dl = n[0] * light[0] + n[1] * light[1] + n[2] * light[2];
        step = lv[Math.max(0, Math.min(nl - 1, Math.round(((nl - 1) >> 1) - (dl - ref) * gain * (nl - 1))))];
      } else if (s.grain) {
        const k = field.k, r = cellNoise(seed, Math.floor(p[0] * k), Math.floor(p[1] * k), Math.floor(p[2] * k), salt.get(s)!);
        if (r < s.grain / 2) step = Math.max(0, mid - 1);
        else if (r > 1 - s.grain / 2) step = Math.min(ramp.length - 1, mid + 1);
      }
      const i = (y * width + x) * 4, [cr, cg, cb] = rgbOf(ramp[step]);
      color.d[i] = cr; color.d[i + 1] = cg; color.d[i + 2] = cb; color.d[i + 3] = 255;
      // tangent-space normal: the true normal against the triangle's frame (flat where the triangle is faceted)
      let tn: V3 = [0, 0, 1];
      if (mesh.smooth[t]) {
        const vl = Math.hypot(...vn) || 1, nv: V3 = [vn[0] / vl, vn[1] / vl, vn[2] / vl];
        const tx: V3 = [at(T, 4, 0), at(T, 4, 1), at(T, 4, 2)], w = T[a * 4 + 3], td = tx[0] * nv[0] + tx[1] * nv[1] + tx[2] * nv[2];
        let tt: V3 = [tx[0] - nv[0] * td, tx[1] - nv[1] * td, tx[2] - nv[2] * td];
        const tl = Math.hypot(...tt) || 1;
        tt = [tt[0] / tl, tt[1] / tl, tt[2] / tl];
        const bt: V3 = [(nv[1] * tt[2] - nv[2] * tt[1]) * w, (nv[2] * tt[0] - nv[0] * tt[2]) * w, (nv[0] * tt[1] - nv[1] * tt[0]) * w];
        tn = [n[0] * tt[0] + n[1] * tt[1] + n[2] * tt[2], n[0] * bt[0] + n[1] * bt[1] + n[2] * bt[2], n[0] * nv[0] + n[1] * nv[1] + n[2] * nv[2]];
        if (tn[2] < 0.05) { const l = Math.hypot(tn[0], tn[1]) || 1, z = 0.05, r = Math.sqrt(1 - z * z); tn = [(tn[0] / l) * r, (tn[1] / l) * r, z]; }
      }
      normal.d[i] = Math.round((tn[0] * 0.5 + 0.5) * 255); normal.d[i + 1] = Math.round((tn[1] * 0.5 + 0.5) * 255); normal.d[i + 2] = Math.round((tn[2] * 0.5 + 0.5) * 255); normal.d[i + 3] = 255;
      const sf = surfaceOf(s);
      orm.d[i] = 255; orm.d[i + 1] = Math.round(sf.rough * 255); orm.d[i + 2] = Math.round(sf.metal * 255); orm.d[i + 3] = 255;
      set[y * width + x] = 1;
    });
  }
  // grow every chart two texels into its gutter
  for (let pass = 0; pass < 2; pass++) {
    const grow: [number, number][] = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (set[y * width + x]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < width && Y < height && set[Y * width + X] === 1) { grow.push([y * width + x, Y * width + X]); break; }
      }
    }
    for (const [to, from] of grow) {
      for (const g of [color, normal, orm]) g.d.copyWithin(to * 4, from * 4, from * 4 + 4);
      set[to] = 2;
    }
    for (const [to] of grow) set[to] = 1;
  }
  return { color, normal, orm };
}
