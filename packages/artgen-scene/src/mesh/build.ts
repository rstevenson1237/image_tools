/**
 * A 3D-mode scene as a true 3D mesh (docs/MESHES.md §4): the scene's distance field, dual-contoured under a triangle
 * budget, smooth or faceted per part, laid out in box-projected UV charts and baked into colour, normal and
 * roughness-metal textures. The voxels are untouched: this is a second renderer of the same source.
 */
import type { DirContext } from '../direction.ts';
import type { Scene3D, V3 } from '../t2/scene3d.ts';
import { bakeTextures, type BakedTextures, type MeshLook } from './bake.ts';
import { contourBudget } from './contour.ts';
import { sceneField } from './field.ts';
import { layoutUvs, type TriMesh } from './uv.ts';

export type MeshMode = 'auto' | 'smooth' | 'faceted';

export interface MeshOptions {
  /** Triangles at most (default by kind, `meshBudget`). */
  budget?: number;
  /** `auto` (default): smooth normals for `toon` parts, faceted for `flat` ones. */
  mode?: MeshMode;
  /** Texels per model unit (default 4). */
  texels?: number;
  look?: MeshLook;
  /** Grain noise seed. */
  seed?: number;
  /** Shading of parts without `shade` (as the raster renderer's `shade`; default `flat`). */
  shade?: 'flat' | 'toon';
}

export interface MeshResult {
  mesh: TriMesh;
  textures: BakedTextures;
  /** Atlas size and the texel density used (it halves when the atlas would pass 2048). */
  atlas: [number, number];
  texels: number;
  charts: number;
  budget: number;
  mode: MeshMode;
  look: MeshLook;
  /** Contour grid: cells along the longest side, and the spacing in model units. */
  grid: { n: number; h: number };
  /** Model-unit box of the mesh. */
  bounds: [number, number, number, number, number, number];
}

/** Triangle budgets by kind (docs/MESHES.md §4.1). */
export const MESH_BUDGETS: Record<string, number> = {
  character: 4000, creature: 4000, vehicle: 3000, building: 3000, prop: 1500, item: 1500, weapon: 1500, tile: 500, tileset: 500, texture: 500,
};
export const meshBudget = (kind?: string): number => (kind && MESH_BUDGETS[kind]) || 2000;

/** Mesh a 3D-mode scene: contour the field under the budget, lay out the UVs, bake the textures. */
export function buildMesh(scene: Scene3D, o: MeshOptions = {}): MeshResult {
  const field = sceneField(scene), budget = o.budget ?? 2000, mode = o.mode ?? 'auto', look = o.look ?? 'pbr', texels = o.texels ?? 4;
  if (!field.bounds) throw new Error('mesh: the scene is empty');
  const [x0, y0, z0, x1, y1, z1] = field.bounds, pad = 1 / scene.k;
  const normal = (x: number, y: number, z: number) => field.normal(x, y, z);
  const c = contourBudget(field.sdf, normal, [x0 - pad, y0 - pad, z0 - pad, x1 + pad, y1 + pad, z1 + pad], budget);
  const P = c.positions, I = c.indices, tris = I.length / 3, part = new Uint16Array(tris), smooth = new Uint8Array(tris), parts: string[] = [], pi = new Map<string, number>();
  for (let t = 0; t < tris; t++) {
    const v = [0, 1, 2].map(k => I[t * 3 + k]), ctr: V3 = [0, 1, 2].map(a => (P[v[0] * 3 + a] + P[v[1] * 3 + a] + P[v[2] * 3 + a]) / 3) as V3;
    const s = field.paint(ctr, field.normal(...ctr));
    if (!pi.has(s.part)) { pi.set(s.part, parts.length); parts.push(s.part); }
    part[t] = pi.get(s.part)!;
    smooth[t] = mode === 'smooth' ? 1 : mode === 'faceted' ? 0 : (s.shade ?? o.shade ?? 'flat') === 'toon' ? 1 : 0;
  }
  const uv = layoutUvs({ positions: P, indices: I, part, parts, smooth, normal: p => field.normal(p[0], p[1], p[2]) }, texels);
  const textures = bakeTextures(uv.mesh, uv.width, uv.height, field, scene.dir as DirContext, { look, seed: o.seed });
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], P[i + a]); hi[a] = Math.max(hi[a], P[i + a]); }
  return {
    mesh: uv.mesh, textures, atlas: [uv.width, uv.height], texels: uv.texels, charts: uv.charts, budget, mode, look,
    grid: { n: c.n, h: c.h }, bounds: [lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]],
  };
}

