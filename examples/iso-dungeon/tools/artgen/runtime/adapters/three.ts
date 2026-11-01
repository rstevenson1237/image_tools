/**
 * three.js adapter: pixel textures with `NearestFilter`, sprites as camera-facing billboards
 * (`THREE.Sprite`) sized in world units by `pixelsPerUnit`, frames chosen by UV offset / repeat (mirrored facings by a
 * negative repeat), and the 8-direction facing picked from the camera-relative angle (`billboardAngle`). Also: slice
 * rotation (sprite stacks), additive blending, `.glb` voxel models (`voxelModel`), and lit billboards
 * (`threeLitAdapter`): camera-facing quads with a Lambert material whose normal map is the frame's rect in the pack's
 * normal atlases, so scene lights (a lamp) shade the sprite. Runtime 1.5: rigged models (`riggedModel`): the skinned `.glb`
 * `artgen rig` writes, with a clip per state played by an `AnimationMixer` and its levels of detail picked by distance.
 */
import {
  AdditiveBlending, AnimationMixer, LoopOnce, LoopRepeat, NormalBlending, DataTexture, Mesh, MeshLambertMaterial, NearestFilter, NoColorSpace, PlaneGeometry, RepeatWrapping, RGBAFormat,
  SRGBColorSpace, Sprite, SpriteMaterial, Vector3, type AnimationAction, type AnimationClip, type Camera, type Object3D,
} from 'three';
import type { AssetRef, AtlasImage, RuntimeAdapter } from '../types.js';
import type { FrameSelect, Pack } from '../pack.js';

export interface ThreeAdapterOptions {
  /** Atlas pixels per world unit (default 32: a 32 px sprite is 1 unit tall). */
  pixelsPerUnit?: number;
  /**
   * Alpha cut-out threshold. The default (`ALPHA_TEST`, 0.02) drops only clear pixels, so translucent shadow pixels
   * (a direction's `shadow.alpha`, typically 0.35) draw blended instead of vanishing; clear pixels still write no depth.
   * Raise it (e.g. 0.5) for hard cut-outs when overlapping translucent sprites sort badly.
   */
  alphaTest?: number;
}

/** Default alpha cut-out: just above 0, so only clear pixels are discarded (see `ThreeAdapterOptions.alphaTest`). */
export const ALPHA_TEST = 0.02;

/**
 * Upload RGBA pixels as a nearest-filtered texture (rows flipped so v = 0 is the bottom): sRGB colour, or linear data
 * for normal-map atlases (`<pack>-N.n.png`, or `linear: true`).
 */
export function pixelTexture(a: Pick<AtlasImage, 'width' | 'height' | 'data'> & { name?: string }, linear = /\.n\.png$/.test(a.name ?? '')): DataTexture {
  const row = a.width * 4, data = new Uint8Array(a.data.length);
  for (let y = 0; y < a.height; y++) data.set(a.data.subarray(y * row, (y + 1) * row), (a.height - 1 - y) * row);
  const t = new DataTexture(data, a.width, a.height, RGBAFormat);
  t.colorSpace = linear ? NoColorSpace : SRGBColorSpace;
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
      const s = new Sprite(new SpriteMaterial({ map: tex.clone(), transparent: true, alphaTest: opts.alphaTest ?? ALPHA_TEST }));
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

export interface ThreeLitOptions extends ThreeAdapterOptions {
  /**
   * Turn each billboard about the vertical axis to face the camera before it renders (default true): lit sprites
   * stay upright like the classic raycaster billboards, so their normals light consistently.
   */
  faceCamera?: boolean;
}

interface LitData { anchor: [number, number]; size: [number, number]; flipX: boolean; fw: number; fh: number }
const lit = (m: Mesh) => m.userData as LitData;
export type LitNode = Mesh<PlaneGeometry, MeshLambertMaterial>;

/** Put the quad's vertices so the anchor pixel sits at the node's origin (y up, world units). */
function placeQuad(m: LitNode, ppu: number) {
  const { anchor: [ax, ay], fw, fh, flipX } = lit(m), x0 = (flipX ? ax - fw : -ax) / ppu, x1 = x0 + fw / ppu, y1 = ay / ppu, y0 = y1 - fh / ppu;
  const p = m.geometry.attributes.position;
  // PlaneGeometry vertex order: top-left, top-right, bottom-left, bottom-right
  p.setXYZ(0, x0, y1, 0); p.setXYZ(1, x1, y1, 0); p.setXYZ(2, x0, y0, 0); p.setXYZ(3, x1, y0, 0);
  p.needsUpdate = true;
  m.geometry.computeBoundingSphere();
}

const _cam = new Vector3(), _me = new Vector3();

/**
 * Lit billboards: like `threeAdapter`, but each node is a quad mesh with a `MeshLambertMaterial`, its colour
 * frame as `map` and — when the pack was loaded with `{ normals: true }` and the asset exports normals — the same rect
 * of the normal atlas as `normalMap`. Mirrored frames negate the normal's x. Use it for sprites that should take the
 * scene's lights (the crawler's ghoul by the lamp); keep `threeAdapter` for unlit ones.
 */
export function threeLitAdapter(opts: ThreeLitOptions = {}): RuntimeAdapter<DataTexture, LitNode, Object3D> {
  const ppu = opts.pixelsPerUnit ?? 32, face = opts.faceCamera ?? true;
  const use = (m: LitNode, slot: 'map' | 'normalMap', tex: DataTexture | undefined) => {
    const cur = m.material[slot];
    if (!tex) { if (cur) { cur.dispose(); m.material[slot] = null; m.material.needsUpdate = true; } return null; }
    if (cur && cur.source === tex.source) return cur;
    cur?.dispose();
    const t = tex.clone();
    m.material[slot] = t; m.material.needsUpdate = true;
    return t;
  };
  return {
    id: 'three-lit',
    loadTexture: a => pixelTexture(a),
    createNode(tex) {
      const m = new Mesh(new PlaneGeometry(1, 1), new MeshLambertMaterial({ map: tex.clone(), transparent: true, alphaTest: opts.alphaTest ?? ALPHA_TEST }));
      m.userData = { anchor: [0, 0], size: [1, 1], flipX: false, fw: 1, fh: 1 } satisfies LitData;
      if (face) m.onBeforeRender = (_r, _s, camera: Camera) => {
        camera.getWorldPosition(_cam); m.getWorldPosition(_me);
        m.rotation.y = Math.atan2(_cam.x - _me.x, _cam.z - _me.z);
      };
      return m as LitNode;
    },
    setFrame(m, f, flipX) {
      const W = f.atlas.width, H = f.atlas.height;
      for (const [slot, tex] of [['map', f.tex], ['normalMap', f.normal?.tex]] as const) {
        const t = use(m, slot, tex);
        if (!t) continue;
        t.repeat.set(((flipX ? -1 : 1) * f.w) / W, f.h / H);
        t.offset.set((flipX ? f.x + f.w : f.x) / W, 1 - (f.y + f.h) / H);
      }
      m.material.normalScale.set(flipX ? -1 : 1, 1);
      Object.assign(lit(m), { flipX, fw: f.w, fh: f.h });
      placeQuad(m, ppu);
    },
    setAnchor(m, a, size) { Object.assign(lit(m), { anchor: [a[0], a[1]], size: [size[0], size[1]] }); placeQuad(m, ppu); },
    setPosition(m, x, y, z) { m.position.set(x, y, z ?? m.position.z); },
    setBlend(m, mode) { m.material.blending = mode === 'add' ? AdditiveBlending : NormalBlending; m.material.needsUpdate = true; },
    attach: (parent, m) => { parent.add(m); },
    dispose(m) { m.removeFromParent(); m.material.map?.dispose(); m.material.normalMap?.dispose(); m.material.dispose(); m.geometry.dispose(); },
    disposeTexture: t => t.dispose(),
  };
}

/** What `artgen rig` records in a rigged `.glb` (`extras.artgen`). */
export interface RiggedInfo {
  rig: { plan: string; set: string; height: number; bones: string[] };
  lods: { node: number; name: string; triangles: number; budget: number; distance: number }[];
  clips: Record<string, { duration: number; loop: boolean; keys: number }>;
  metresPerUnit: number;
}

export interface RiggedModel {
  /** The model's root: add it to the scene, move and turn it (it faces +z at rotation 0). */
  object: Object3D;
  /** The clips by state, the mixer playing them, and the state playing now. */
  clips: Record<string, AnimationClip>;
  mixer: AnimationMixer;
  state: string;
  /** A non-looping state (attack, hurt) reached its end and holds its last pose. */
  done: boolean;
  /** The levels of detail, nearest first, with the distance each starts at (metres of the model: scaling the object scales them). */
  lods: { object: Object3D; distance: number; triangles: number }[];
  /** The level shown now. */
  lod: number;
  info: RiggedInfo;
  /** Play a state's clip (looping as exported), cross-fading from the last over `fade` ms (default 120; 0 cuts). The state already playing goes on unless `restart` (a finished one-shot starts again). */
  play(state: string, o?: { fade?: number; restart?: boolean }): RiggedModel;
  at(x: number, y: number, z: number): RiggedModel;
  /** Turn to a heading (radians about +y; 0 faces +z), as `billboardAngle` reads a heading. */
  face(heading: number): RiggedModel;
  /** Advance the clip by `dtMs` and, with a camera, show the level of detail for its distance. */
  update(dtMs: number, camera?: Object3D): RiggedModel;
  dispose(): void;
}

const _cw = new Vector3(), _mw = new Vector3(), _sw = new Vector3();

/**
 * A rigged model exported by `artgen rig` (`<id>.rigged.glb`: a skinned mesh per level of detail over one skeleton, a clip
 * per state) loaded through three's `GLTFLoader`, passed in as for `voxelModel`. `play(state)` runs the state's clip in
 * an `AnimationMixer` (idle and walk loop, attack and hurt play once and hold); `update(dtMs, camera)` advances it and
 * shows the level of detail for the camera's distance. Textures sample nearest (the file says so), so texels stay pixels.
 */
export async function riggedModel(loader: { loadAsync(url: string): Promise<{ scene: Object3D; animations: AnimationClip[]; userData?: Record<string, unknown> }> }, url: string, o: { state?: string } = {}): Promise<RiggedModel> {
  const gltf = await loader.loadAsync(url), root = gltf.scene, info = (gltf.userData?.artgen ?? root.userData?.artgen) as RiggedInfo | undefined;
  if (!info?.rig || !info.lods?.length) throw new Error(`${url}: not a rigged model from artgen rig (no extras.artgen.rig)`);
  const lods = info.lods.map(l => {
    const object = root.getObjectByName(l.name);
    if (!object) throw new Error(`${url}: level ${l.name} is missing`);
    // the skinned meshes move with their bones, so their bounds do too: don't cull them on the bind pose's box
    object.traverse(c => { c.frustumCulled = false; });
    return { object, distance: l.distance, triangles: l.triangles };
  }).sort((a, b) => a.distance - b.distance);
  const mixer = new AnimationMixer(root), clips = Object.fromEntries(gltf.animations.map(c => [c.name, c]));
  let action: AnimationAction | undefined;
  const m: RiggedModel = {
    object: root, clips, mixer, state: '', done: false, lods, lod: 0, info,
    play(state, p = {}) {
      const clip = clips[state];
      if (!clip) throw new Error(`rigged model: no clip ${state} (has ${Object.keys(clips).join(', ')})`);
      // the state already playing goes on (a finished one-shot starts again)
      if (state === m.state && !p.restart && !m.done) return m;
      const next = mixer.clipAction(clip), loop = info.clips[state]?.loop ?? true, fade = (p.fade ?? 120) / 1000;
      next.reset();
      next.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
      next.clampWhenFinished = !loop;
      next.play();
      if (action && action !== next && fade > 0) action.crossFadeTo(next, fade, false);
      else if (action && action !== next) action.stop();
      action = next; m.state = state; m.done = false;
      return m;
    },
    at(x, y, z) { root.position.set(x, y, z); return m; },
    face(heading) { root.rotation.y = heading; return m; },
    update(dtMs, camera) {
      mixer.update(dtMs / 1000);
      if (action && !(info.clips[m.state]?.loop ?? true)) m.done = !action.isRunning();
      if (camera) {
        camera.getWorldPosition(_cw); root.getWorldPosition(_mw); root.getWorldScale(_sw);
        // the switch distances are the file's metres: a model scaled down switches sooner
        const d = _cw.distanceTo(_mw) / Math.max(1e-9, Math.abs(_sw.y));
        let k = 0;
        lods.forEach((l, i) => { if (d >= l.distance) k = i; });
        if (k !== m.lod || !lods[k].object.visible) lods.forEach((l, i) => { l.object.visible = i === k; });
        m.lod = k;
      }
      return m;
    },
    dispose() {
      mixer.stopAllAction(); root.removeFromParent();
      root.traverse(c => {
        const mesh = c as Object3D & { geometry?: { dispose(): void }; material?: { dispose(): void; [k: string]: unknown } };
        mesh.geometry?.dispose();
        if (mesh.material) { for (const v of Object.values(mesh.material)) if (v && typeof v === 'object' && 'isTexture' in v) (v as unknown as { dispose(): void }).dispose(); mesh.material.dispose(); }
      });
    },
  };
  lods.forEach((l, i) => { l.object.visible = i === 0; });
  return m.play(o.state ?? (clips.idle ? 'idle' : gltf.animations[0]?.name ?? ''));
}
