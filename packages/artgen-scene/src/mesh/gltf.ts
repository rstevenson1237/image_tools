/**
 * glTF for meshes (docs/MESHES.md §7). `meshGlb` writes a baked mesh as one `.glb`: one node, one primitive (positions,
 * normals, tangents, UVs, indices) and one material with colour, normal and roughness-metal textures, sampled nearest
 * with no mipmaps so texels stay square pixels; `baked` meshes are unlit (`KHR_materials_unlit`). Axes and origin as
 * `voxelGlb` has them: artgen x / y / z become glTF x / z / y, the footprint centre at the origin, the ground at y = 0.
 *
 * `readGlb` and `glbTriangles` read any binary glTF 2.0 the converters take in: accessors of every component type,
 * strides, normalised integers, the node tree (matrices or TRS), triangle lists, strips and fans, and per-vertex colour
 * from `COLOR_0`, the base colour texture (PNG) and the base colour factor.
 */
import { decodePNG, encodePNG } from 'artgen-primitives/lib/png.ts';
import type { Grid } from 'artgen-primitives/lib/grid.ts';
import type { V3 } from '../t2/scene3d.ts';
import { glbBytes } from '../voxel/gltf.ts';
import type { MeshResult } from './build.ts';

export interface MeshGlbOptions {
  name?: string;
  /** Metres (glTF units) per model unit. */
  metresPerUnit: number;
}

const ARRAY_BUFFER = 34962, ELEMENT_ARRAY_BUFFER = 34963, NEAREST = 9728, CLAMP = 33071;

/** `.glb` bytes for a baked mesh. */
export function meshGlb(r: MeshResult, o: MeshGlbOptions): Uint8Array {
  const { positions: P, normals: N, tangents: T, uvs: U, indices: I } = r.mesh, s = o.metresPerUnit, n = P.length / 3;
  const cx = (r.bounds[0] + r.bounds[3]) / 2, cy = (r.bounds[1] + r.bounds[4]) / 2;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), tan = new Float32Array(n * 4), idx = new Uint32Array(I.length);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    const p = [(P[i * 3] - cx) * s, P[i * 3 + 2] * s, (P[i * 3 + 1] - cy) * s];
    pos.set(p, i * 3);
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], p[a]); max[a] = Math.max(max[a], p[a]); }
    nor.set([N[i * 3], N[i * 3 + 2], N[i * 3 + 1]], i * 3);
    // swapping y and z is a mirror: the bitangent's sign flips with it
    tan.set([T[i * 4], T[i * 4 + 2], T[i * 4 + 1], -T[i * 4 + 3]], i * 4);
  }
  // the mirror also reverses the winding
  for (let t = 0; t < I.length; t += 3) { idx[t] = I[t]; idx[t + 1] = I[t + 2]; idx[t + 2] = I[t + 1]; }
  const chunks: Uint8Array[] = [], views: any[] = [];
  let offset = 0;
  const view = (bytes: Uint8Array, target?: number) => {
    const pad = (4 - (bytes.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(target && { target }) });
    chunks.push(bytes, new Uint8Array(pad));
    offset += bytes.length + pad;
    return views.length - 1;
  };
  const bytes = (a: Float32Array | Uint32Array) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const accessors = [
    { bufferView: view(bytes(pos), ARRAY_BUFFER), componentType: 5126, count: n, type: 'VEC3', min, max },
    { bufferView: view(bytes(nor), ARRAY_BUFFER), componentType: 5126, count: n, type: 'VEC3' },
    { bufferView: view(bytes(tan), ARRAY_BUFFER), componentType: 5126, count: n, type: 'VEC4' },
    { bufferView: view(bytes(new Float32Array(U)), ARRAY_BUFFER), componentType: 5126, count: n, type: 'VEC2' },
    { bufferView: view(bytes(idx), ELEMENT_ARRAY_BUFFER), componentType: 5125, count: idx.length, type: 'SCALAR' },
  ];
  const images = [r.textures.color, r.textures.normal, r.textures.orm].map(g => ({ bufferView: view(encodePNG(g)), mimeType: 'image/png' }));
  const unlit = r.look === 'baked', name = o.name ?? 'mesh';
  const json = {
    asset: { version: '2.0', generator: 'artgen' }, ...(unlit && { extensionsUsed: ['KHR_materials_unlit'] }),
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name }],
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TANGENT: 2, TEXCOORD_0: 3 }, indices: 4, material: 0 }] }],
    materials: [{
      name, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicRoughnessTexture: { index: 2 }, metallicFactor: 1, roughnessFactor: 1 },
      normalTexture: { index: 1 }, ...(unlit && { extensions: { KHR_materials_unlit: {} } }),
    }],
    samplers: [{ magFilter: NEAREST, minFilter: NEAREST, wrapS: CLAMP, wrapT: CLAMP }],
    textures: [0, 1, 2].map(source => ({ sampler: 0, source })), images, accessors, bufferViews: views,
    buffers: [{ byteLength: offset }],
    extras: { artgen: { budget: r.budget, triangles: I.length / 3, mode: r.mode, look: r.look, texelsPerUnit: r.texels, atlas: r.atlas, metresPerUnit: s } },
  };
  const bin = new Uint8Array(offset);
  let at = 0;
  for (const c of chunks) { bin.set(c, at); at += c.length; }
  return glbBytes(json, bin);
}

// ---- reading

export interface Glb { json: any; bin: Uint8Array }

export function readGlb(bytes: Uint8Array): Glb {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 20 || dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a binary glTF (.glb) file');
  if (dv.getUint32(4, true) !== 2) throw new Error(`glTF version ${dv.getUint32(4, true)}: only 2 is read`);
  let o = 12, json: any, bin: Uint8Array = new Uint8Array(0);
  while (o + 8 <= bytes.length) {
    const n = dv.getUint32(o, true), type = dv.getUint32(o + 4, true), body = bytes.subarray(o + 8, o + 8 + n);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body));
    else if (type === 0x004e4942) bin = body;
    o += 8 + n;
  }
  if (!json) throw new Error('glb: no JSON chunk');
  return { json, bin };
}

const COMPONENTS: Record<number, [number, (dv: DataView, o: number) => number, number]> = {
  5120: [1, (dv, o) => dv.getInt8(o), 127], 5121: [1, (dv, o) => dv.getUint8(o), 255], 5122: [2, (dv, o) => dv.getInt16(o, true), 32767],
  5123: [2, (dv, o) => dv.getUint16(o, true), 65535], 5125: [4, (dv, o) => dv.getUint32(o, true), 4294967295], 5126: [4, (dv, o) => dv.getFloat32(o, true), 1],
};
const WIDTH: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** An accessor's values, flat (normalised integers as 0–1 or −1–1). */
export function accessor(g: Glb, i: number): { data: Float64Array; width: number; count: number } {
  const a = g.json.accessors?.[i];
  if (!a) throw new Error(`glb: no accessor ${i}`);
  if (a.sparse) throw new Error('glb: sparse accessors are not read');
  const [size, read, max] = COMPONENTS[a.componentType] ?? (() => { throw new Error(`glb: component type ${a.componentType}`); })();
  const width = WIDTH[a.type], data = new Float64Array(a.count * width);
  if (a.bufferView === undefined) return { data, width, count: a.count };
  const v = g.json.bufferViews[a.bufferView], buf = bufferOf(g, v.buffer), base = (v.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = v.byteStride ?? size * width;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < width; c++) {
    const x = read(dv, base + k * stride + c * size);
    data[k * width + c] = a.normalized ? (a.componentType === 5126 ? x : Math.max(-1, x / max)) : x;
  }
  return { data, width, count: a.count };
}

function bufferOf(g: Glb, i: number): Uint8Array {
  const b = g.json.buffers?.[i];
  if (!b) throw new Error(`glb: no buffer ${i}`);
  if (b.uri === undefined) return g.bin;
  const m = /^data:[^;]*;base64,(.*)$/.exec(b.uri);
  if (!m) throw new Error(`glb: buffer ${i} is an outside file (${b.uri}); give a self-contained .glb`);
  return Uint8Array.from(atob(m[1]), c => c.charCodeAt(0));
}

type M4 = number[];
const IDENTITY: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** Column-major 4×4 product a·b. */
const mul = (a: M4, b: M4): M4 => { const r = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) for (let k = 0; k < 4; k++) r[c * 4 + rr] += a[k * 4 + rr] * b[c * 4 + k]; return r; };
function local(n: any): M4 {
  if (n.matrix) return n.matrix;
  const [tx, ty, tz] = n.translation ?? [0, 0, 0], [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

const toSrgb = (c: number) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const toLinear = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };

/** Triangles of a glTF scene in artgen's frame (metres; x right, y toward the viewer, z up), each corner with its sRGB colour. */
export interface GlbTriangles {
  /** 9 numbers per triangle. */
  positions: Float32Array;
  /** 9 numbers per triangle: sRGB 0–255 per corner. */
  colors: Float32Array;
  /** Per triangle, when its material has a base colour texture that was read: the image and the corners' UVs. */
  textured: ({ image: Grid; uv: [number, number, number, number, number, number] } | undefined)[];
  warnings: string[];
}

/** The colour of a point on triangle `t` with barycentric weights (sRGB 0–255). */
export function triangleColor(m: GlbTriangles, t: number, w: V3): [number, number, number] {
  const tx = m.textured[t], C = m.colors;
  const base = [0, 1, 2].map(c => C[t * 9 + c] * w[0] + C[t * 9 + 3 + c] * w[1] + C[t * 9 + 6 + c] * w[2]);
  if (!tx) return base as [number, number, number];
  const u = tx.uv[0] * w[0] + tx.uv[2] * w[1] + tx.uv[4] * w[2], v = tx.uv[1] * w[0] + tx.uv[3] * w[1] + tx.uv[5] * w[2], img = tx.image;
  const x = ((Math.floor(u * img.w) % img.w) + img.w) % img.w, y = ((Math.floor(v * img.h) % img.h) + img.h) % img.h, i = (y * img.w + x) * 4;
  return [0, 1, 2].map(c => toSrgb(toLinear(img.d[i + c]) * toLinear(base[c]))) as [number, number, number];
}

export function glbTriangles(g: Glb): GlbTriangles {
  const pos: number[] = [], col: number[] = [], textured: GlbTriangles['textured'] = [], warnings: string[] = [], images = new Map<number, Grid | null>();
  const imageOf = (ti: number): Grid | null => {
    const src = g.json.textures?.[ti]?.source;
    if (src === undefined) return null;
    if (!images.has(src)) {
      const im = g.json.images[src];
      let grid: Grid | null = null;
      if (im.bufferView !== undefined && (im.mimeType ?? 'image/png') === 'image/png') {
        const v = g.json.bufferViews[im.bufferView], buf = bufferOf(g, v.buffer);
        try { grid = decodePNG(buf.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)); } catch (e) { warnings.push(`image ${src}: ${(e as Error).message}; using the base colour`); }
      } else warnings.push(`image ${src}: ${im.mimeType ?? im.uri ?? 'not embedded'} is not read (PNG only); using the base colour`);
      images.set(src, grid);
    }
    return images.get(src) ?? null;
  };
  const visit = (ni: number, parent: M4) => {
    const node = g.json.nodes[ni], m = mul(parent, local(node));
    if (node.mesh !== undefined) for (const prim of g.json.meshes[node.mesh].primitives) {
      const mode = prim.mode ?? 4;
      if (mode < 4) { warnings.push(`mesh ${node.mesh}: points and lines skipped`); continue; }
      if (prim.attributes.POSITION === undefined) continue;
      const P = accessor(g, prim.attributes.POSITION), C = prim.attributes.COLOR_0 !== undefined ? accessor(g, prim.attributes.COLOR_0) : undefined;
      const mat = g.json.materials?.[prim.material], pbr = mat?.pbrMetallicRoughness ?? {}, f = pbr.baseColorFactor ?? [1, 1, 1, 1];
      const texInfo = pbr.baseColorTexture, uvAcc = texInfo ? prim.attributes[`TEXCOORD_${texInfo.texCoord ?? 0}`] : undefined;
      const img = texInfo && uvAcc !== undefined ? imageOf(texInfo.index) : null, UV = img ? accessor(g, uvAcc) : undefined;
      let order = prim.indices !== undefined ? Array.from(accessor(g, prim.indices).data) : Array.from({ length: P.count }, (_, i) => i);
      if (mode === 5) order = order.slice(2).flatMap((_, i) => (i % 2 ? [order[i + 1], order[i], order[i + 2]] : [order[i], order[i + 1], order[i + 2]]));
      else if (mode === 6) order = order.slice(2).flatMap((_, i) => [order[0], order[i + 1], order[i + 2]]);
      for (let t = 0; t + 2 < order.length; t += 3) {
        const uv: number[] = [];
        // glTF → artgen swaps y and z (a mirror): the corners go in reverse to keep the triangles wound outward
        for (const c of [0, 2, 1]) {
          const v = order[t + c], x = P.data[v * 3], y = P.data[v * 3 + 1], z = P.data[v * 3 + 2];
          const wx = m[0] * x + m[4] * y + m[8] * z + m[12], wy = m[1] * x + m[5] * y + m[9] * z + m[13], wz = m[2] * x + m[6] * y + m[10] * z + m[14];
          pos.push(wx, wz, wy);
          const lin = [0, 1, 2].map(k => f[k] * (C ? C.data[v * C.width + k] : 1));
          col.push(...lin.map(toSrgb));
          if (UV) uv.push(UV.data[v * 2], UV.data[v * 2 + 1]);
        }
        textured.push(img ? { image: img, uv: uv as [number, number, number, number, number, number] } : undefined);
      }
    }
    for (const c of node.children ?? []) visit(c, m);
  };
  const scene = g.json.scenes?.[g.json.scene ?? 0];
  const roots: number[] = scene?.nodes ?? (g.json.nodes ?? []).map((_: unknown, i: number) => i);
  for (const r of roots) visit(r, IDENTITY);
  return { positions: new Float32Array(pos), colors: new Float32Array(col), textured, warnings };
}
