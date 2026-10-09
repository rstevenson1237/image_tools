/**
 * three.js adapter (SPEC §12.2, D3): pixel textures with `NearestFilter`, sprites as camera-facing billboards
 * (`THREE.Sprite`) sized in world units by `pixelsPerUnit`, frames chosen by UV offset / repeat (mirrored facings by a
 * negative repeat), and the 8-direction facing picked from the camera-relative angle (`billboardAngle`). P6a: slice
 * rotation (sprite stacks), additive blending, `.glb` voxel models (`voxelModel`).
 */
import {
  AdditiveBlending, NormalBlending, DataTexture, NearestFilter, RepeatWrapping, RGBAFormat, SRGBColorSpace, Sprite, SpriteMaterial, Vector3,
  type Object3D,
} from 'three';
import type { AssetRef, AtlasImage, RuntimeAdapter } from '../types.js';
import type { FrameSelect, Pack } from '../pack.js';

export interface ThreeAdapterOptions {
  /** Atlas pixels per world unit (default 32: a 32 px sprite is 1 unit tall). */
  pixelsPerUnit?: number;
  /** Alpha cut-out threshold (default 0.5: hard pixel edges, no sorting artefacts). */
  alphaTest?: number;
}

/** Upload RGBA pixels as a nearest-filtered sRGB texture (rows flipped so v = 0 is the bottom). */
export function pixelTexture(a: Pick<AtlasImage, 'width' | 'height' | 'data'>): DataTexture {
  const row = a.width * 4, data = new Uint8Array(a.data.length);
  for (let y = 0; y < a.height; y++) data.set(a.data.subarray(y * row, (y + 1) * row), (a.height - 1 - y) * row);
  const t = new DataTexture(data, a.width, a.height, RGBAFormat);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** A repeating texture of one tile frame (floors, walls): `repeat` tiles across the surface. */
export function tileTexture(pack: Pack<DataTexture, Sprite, Object3D>, ref: AssetRef, opts: FrameSelect & { repeat?: [number, number] } = {}): DataTexture {
  const t = pixelTexture(pack.pixels(ref, opts));
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(...(opts.repeat ?? [1, 1]));
  return t;
}

const _c = new Vector3(), _p = new Vector3(), _f = new Vector3(), _r = new Vector3(), UP = new Vector3(0, 1, 0);

/**
 * Screen angle for `sprite.face()` from a billboard's heading as seen by the camera. `heading` is the entity's yaw
 * (radians about +Y; 0 faces +Z); facing the camera gives south (the front view), moving to the camera's right gives east.
 */
export function billboardAngle(heading: number, entity: Object3D, camera: Object3D): number {
  camera.getWorldPosition(_c);
  entity.getWorldPosition(_p);
  _f.subVectors(_p, _c).setY(0);
  if (_f.lengthSq() < 1e-12) camera.getWorldDirection(_f).setY(0);
  _f.normalize();
  _r.crossVectors(_f, UP);
  const hx = Math.sin(heading), hz = Math.cos(heading);
  return Math.atan2(-(hx * _f.x + hz * _f.z), hx * _r.x + hz * _r.z);
}

interface NodeData { anchor: [number, number]; size: [number, number]; flipX: boolean }
const data = (s: Sprite) => s.userData as NodeData;

function placeCenter(s: Sprite) {
  const { anchor: [ax, ay], size: [w, h], flipX } = data(s);
  s.center.set(flipX ? 1 - ax / w : ax / w, 1 - ay / h);
}

export function threeAdapter(opts: ThreeAdapterOptions = {}): RuntimeAdapter<DataTexture, Sprite, Object3D> {
  const ppu = opts.pixelsPerUnit ?? 32;
  return {
    id: 'three',
    loadTexture: a => pixelTexture(a),
    createNode(tex) {
      const s = new Sprite(new SpriteMaterial({ map: tex.clone(), transparent: true, alphaTest: opts.alphaTest ?? 0.5 }));
      s.userData = { anchor: [0, 0], size: [1, 1], flipX: false } satisfies NodeData;
      return s;
    },
    setFrame(s, f, flipX) {
      let map = s.material.map!;
      if (map.source !== f.tex.source) { map.dispose(); map = s.material.map = f.tex.clone(); s.material.needsUpdate = true; }
      const W = f.atlas.width, H = f.atlas.height;
      map.repeat.set(((flipX ? -1 : 1) * f.w) / W, f.h / H);
      map.offset.set((flipX ? f.x + f.w : f.x) / W, 1 - (f.y + f.h) / H);
      s.scale.set(f.w / ppu, f.h / ppu, 1);
      data(s).flipX = flipX;
      placeCenter(s);
    },
    setAnchor(s, a, size) { Object.assign(data(s), { anchor: [a[0], a[1]], size: [size[0], size[1]] }); placeCenter(s); },
    setPosition(s, x, y, z) { s.position.set(x, y, z ?? s.position.z); },
    setRotation(s, rad) { s.material.rotation = -rad; },
    setBlend(s, mode) { s.material.blending = mode === 'add' ? AdditiveBlending : NormalBlending; s.material.needsUpdate = true; },
    attach: (parent, s) => { parent.add(s); },
    dispose(s) { s.removeFromParent(); s.material.map?.dispose(); s.material.dispose(); },
    disposeTexture: t => t.dispose(),
  };
}

/**
 * A voxel model exported by `artgen voxel` (`<id>.glb`, greedy-meshed, one material per ramp) loaded through three's
 * `GLTFLoader` — passed in, since it lives in `three/examples` — with flat shading so the voxel faces stay crisp.
 */
export async function voxelModel(loader: { loadAsync(url: string): Promise<{ scene: Object3D }> }, url: string): Promise<Object3D> {
  const { scene } = await loader.loadAsync(url);
  scene.traverse(o => {
    const mat = (o as Object3D & { material?: { flatShading?: boolean; needsUpdate?: boolean } }).material;
    if (mat) { mat.flatShading = true; mat.needsUpdate = true; }
  });
  return scene;
}
