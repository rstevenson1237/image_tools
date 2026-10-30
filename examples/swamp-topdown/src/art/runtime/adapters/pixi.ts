// Vendored by `artgen export --runtime` (artgen-runtime 1.4.0). Local edits are detected and kept;
// re-export with --force to overwrite them. Source: packages/artgen-runtime in rstevenson1237/image_tools.
/**
 * Pixi.js (v8) adapter. Atlases become nearest-filtered `TextureSource`s, nodes are `Sprite`s whose
 * texture is swapped per frame (frame textures are cached per atlas rect), mirrored facings flip `scale.x` about the
 * anchor, and z goes to `zIndex` (the parent is made `sortableChildren` on attach) for iso / oblique depth sorting.
 * Palette swaps arrive as recoloured atlases from the core, so no filter is needed. Also lit sprites (`pixiLitAdapter`):
 * quad `Mesh`es with a GLSL shader that shades each texel with the frame's rect of the pack's normal atlas under the
 * point lights of a `LightRig` (the model in `../light.ts`). WebGL only.
 */
import { BufferImageSource, Mesh, MeshGeometry, Rectangle, Shader, Sprite, Texture, UniformGroup, type Container, type TextureSource } from 'pixi.js';
import type { AssetRef, FrameRect, RuntimeAdapter } from '../types.js';
import type { FrameSelect, Pack } from '../pack.js';
import { MAX_LIGHTS, type LightRig } from '../light.js';

export interface PixiAdapterOptions {
  /** Integer pixel zoom applied to every sprite node (default 1; or scale the parent container). */
  scale?: number;
}

const frames = new WeakMap<TextureSource, Map<string, Texture>>();

/** The (cached) Pixi texture for one atlas rect. */
export function frameTexture(f: FrameRect<TextureSource>): Texture {
  let m = frames.get(f.tex);
  if (!m) frames.set(f.tex, (m = new Map()));
  const key = `${f.x},${f.y},${f.w},${f.h}`;
  let t = m.get(key);
  if (!t) m.set(key, (t = new Texture({ source: f.tex, frame: new Rectangle(f.x, f.y, f.w, f.h) })));
  return t;
}

/** Textures of one state strip, for Pixi's own `AnimatedSprite` if a game prefers it. */
export function pixiStrip(pack: Pack<TextureSource, Sprite, Container>, ref: AssetRef, sel: Omit<FrameSelect, 'frame'> = {}): Texture[] {
  const a = pack.asset(ref), state = sel.state ?? Object.keys(a.states)[0];
  return Array.from({ length: a.states[state].frames }, (_, frame) => frameTexture(pack.frame(ref, { ...sel, state, frame })));
}

export function pixiAdapter(opts: PixiAdapterOptions = {}): RuntimeAdapter<TextureSource, Sprite, Container> {
  const scale = opts.scale ?? 1;
  return {
    id: 'pixi',
    loadTexture: a => new BufferImageSource({
      resource: new Uint8Array(a.data.buffer, a.data.byteOffset, a.data.byteLength), width: a.width, height: a.height,
      scaleMode: 'nearest', autoGenerateMipmaps: false, label: a.swap ? `${a.name}#${a.swap}` : a.name,
    }),
    createNode(tex) {
      const s = new Sprite(new Texture({ source: tex }));
      s.scale.set(scale);
      s.roundPixels = true;
      return s;
    },
    setFrame(s, f, flipX) {
      s.texture = frameTexture(f);
      s.scale.x = (flipX ? -1 : 1) * Math.abs(s.scale.x);
    },
    setAnchor: (s, [ax, ay], [w, h]) => s.anchor.set(ax / w, ay / h),
    setPosition(s, x, y, z) { s.position.set(x, y); if (z !== undefined) s.zIndex = z; },
    setRotation(s, rad) { s.rotation = rad; },
    setBlend(s, mode) { s.blendMode = mode === 'add' ? 'add' : 'normal'; },
    attach(parent, s) { parent.sortableChildren = true; parent.addChild(s); },
    dispose: s => s.destroy(),
    disposeTexture(t) { frames.get(t)?.forEach(x => x.destroy()); frames.delete(t); t.destroy(); },
  };
}

export interface PixiLitOptions extends PixiAdapterOptions {
  /** The lights. Read on every render, so the game may mutate it (move a lantern, change `ambient`) or replace its `lights`. */
  rig: LightRig;
}

/** A lit sprite node: a quad mesh whose shader reads the frame, flip and anchor from its own uniforms. */
export type PixiLitNode = Mesh<MeshGeometry, Shader>;

const LIT_VERTEX = `
attribute vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec4 uFrame;
uniform vec2 uAtlas;
uniform vec2 uAnchor;
uniform float uFlip;
uniform vec3 uNode;
varying vec2 vUV;
varying vec2 vWorld;
void main() {
  vec2 a = aPosition, size = uFrame.zw;
  // the quad is the frame, the anchor pixel at the origin; a mirrored frame flips about the anchor
  vec2 local = vec2(mix(-uAnchor.x + a.x * size.x, uAnchor.x - (1.0 - a.x) * size.x, uFlip), -uAnchor.y + a.y * size.y);
  vUV = (uFrame.xy + vec2(mix(a.x, 1.0 - a.x, uFlip), a.y) * size) / uAtlas;
  vWorld = uNode.xy + local * uNode.z;
  gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(local, 1.0)).xy, 0.0, 1.0);
}`;

// the same maths as `shadeTexel` in ../light.ts
const LIT_FRAGMENT = `
precision highp float;
varying vec2 vUV;
varying vec2 vWorld;
uniform sampler2D uAlbedo;
uniform sampler2D uNormals;
uniform float uHasNormal;
uniform float uFlip;
uniform vec3 uAmbient;
uniform float uBands;
uniform float uCount;
uniform vec4 uLightPos[${MAX_LIGHTS}];
uniform vec4 uLightCol[${MAX_LIGHTS}];
void main() {
  vec4 c = texture2D(uAlbedo, vUV);
  vec3 n = vec3(0.0, 0.0, 1.0);
  if (uHasNormal > 0.5) {
    vec4 t = texture2D(uNormals, vUV);
    vec3 m = vec3(t.x * 2.0 - 1.0, -(t.y * 2.0 - 1.0), t.z * 2.0 - 1.0);
    float l = length(m);
    if (t.a > 0.0 && l > 0.0) n = m / l;
    if (uFlip > 0.5) n.x = -n.x;
  }
  vec3 sum = uAmbient;
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (float(i) >= uCount) break;
    vec3 d = vec3(uLightPos[i].xy - vWorld, uLightPos[i].z);
    float dist = length(d);
    float f = max(0.0, 1.0 - dist / uLightPos[i].w);
    f *= f;
    float lam = max(0.0, dot(n, d / max(dist, 0.000001)));
    if (uBands > 0.5) lam = floor(lam * uBands + 0.5) / uBands;
    sum += uLightCol[i].rgb * (lam * f);
  }
  gl_FragColor = vec4(c.rgb * sum, c.a);
}`;

/** One unit quad for every lit node: the shader sizes it to the frame. */
let quad: MeshGeometry | undefined;
const unitQuad = () => quad ??= new MeshGeometry({ positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) });

const u = (m: PixiLitNode) => (m.shader!.resources as unknown as { node: UniformGroup }).node.uniforms as Record<'uFrame' | 'uAtlas' | 'uAnchor' | 'uNode', Float32Array> & { uFlip: number; uHasNormal: number };

/**
 * Lit sprites for Pixi.js v8 (WebGL; WebGPU is not supported by this adapter): like `pixiAdapter`, but each node is a
 * quad `Mesh` with a GLSL shader that samples the frame's rect of the colour atlas and, when the pack was loaded with
 * `{ normals: true }` and the asset exports normals, of the normal atlas, and shades every texel with the point lights of
 * `o.rig` (`shadeTexel` is the reference). Frame, flip, anchor and position live in uniforms, so a frame change rebuilds
 * nothing; mirrored frames flip about the anchor and the normal's x with them (the pack only holds east-side facings). Assets
 * without normals are lit as flat faces toward the viewer. Light positions are in the parent container's space.
 * Use it for the sprites that should take the lantern's light; keep `pixiAdapter` for the rest.
 */
export function pixiLitAdapter(o: PixiLitOptions): RuntimeAdapter<TextureSource, PixiLitNode, Container> {
  const scale = o.scale ?? 1, rig = o.rig;
  const lights = new UniformGroup({
    uAmbient: { value: new Float32Array(3), type: 'vec3<f32>' }, uBands: { value: 0, type: 'f32' }, uCount: { value: 0, type: 'f32' },
    uLightPos: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
    uLightCol: { value: new Float32Array(MAX_LIGHTS * 4), type: 'vec4<f32>', size: MAX_LIGHTS },
  });
  /** Copy the rig into the shared uniforms (every node does this just before it renders: the game's latest values win). */
  const sync = () => {
    const l = lights.uniforms as { uAmbient: Float32Array; uBands: number; uCount: number; uLightPos: Float32Array; uLightCol: Float32Array }, n = Math.min(rig.lights.length, MAX_LIGHTS);
    l.uAmbient[0] = rig.ambient[0]; l.uAmbient[1] = rig.ambient[1]; l.uAmbient[2] = rig.ambient[2];
    l.uBands = rig.bands; l.uCount = n;
    for (let i = 0; i < n; i++) {
      const L = rig.lights[i], k = i * 4;
      l.uLightPos[k] = L.x; l.uLightPos[k + 1] = L.y; l.uLightPos[k + 2] = L.z; l.uLightPos[k + 3] = L.radius;
      l.uLightCol[k] = L.color[0] * L.intensity; l.uLightCol[k + 1] = L.color[1] * L.intensity; l.uLightCol[k + 2] = L.color[2] * L.intensity; l.uLightCol[k + 3] = 0;
    }
    lights.update();
  };
  const place = (m: PixiLitNode) => {
    const a = u(m), flip = u(m).uFlip === 1, w = a.uFrame[2], h = a.uFrame[3], b = m.boundsArea ?? (m.boundsArea = new Rectangle());
    b.x = flip ? a.uAnchor[0] - w : -a.uAnchor[0]; b.y = -a.uAnchor[1]; b.width = w; b.height = h;
  };
  return {
    id: 'pixi-lit',
    loadTexture: a => new BufferImageSource({
      resource: new Uint8Array(a.data.buffer, a.data.byteOffset, a.data.byteLength), width: a.width, height: a.height,
      scaleMode: 'nearest', autoGenerateMipmaps: false, label: a.swap ? `${a.name}#${a.swap}` : a.name,
    }),
    createNode(tex) {
      const shader = Shader.from({
        gl: { vertex: LIT_VERTEX, fragment: LIT_FRAGMENT, name: 'artgen-lit', preferredFragmentPrecision: 'highp' },
        resources: {
          uAlbedo: tex, uNormals: tex, lights,
          node: {
            uFrame: { value: new Float32Array([0, 0, tex.width, tex.height]), type: 'vec4<f32>' }, uAtlas: { value: new Float32Array([tex.width, tex.height]), type: 'vec2<f32>' },
            uAnchor: { value: new Float32Array(2), type: 'vec2<f32>' }, uNode: { value: new Float32Array([0, 0, scale]), type: 'vec3<f32>' },
            uFlip: { value: 0, type: 'f32' }, uHasNormal: { value: 0, type: 'f32' },
          },
        },
      });
      const m: PixiLitNode = new Mesh({ geometry: unitQuad(), shader });
      m.scale.set(scale);
      m.onRender = sync;
      place(m);
      return m;
    },
    setFrame(m, f, flipX) {
      const a = u(m), r = m.shader!.resources as unknown as { uAlbedo: TextureSource; uNormals: TextureSource };
      a.uFrame[0] = f.x; a.uFrame[1] = f.y; a.uFrame[2] = f.w; a.uFrame[3] = f.h;
      a.uAtlas[0] = f.atlas.width; a.uAtlas[1] = f.atlas.height;
      a.uFlip = flipX ? 1 : 0;
      a.uHasNormal = f.normal ? 1 : 0;
      if (r.uAlbedo !== f.tex) r.uAlbedo = f.tex;
      const nt = f.normal?.tex ?? f.tex;
      if (r.uNormals !== nt) r.uNormals = nt;
      place(m);
    },
    setAnchor(m, [ax, ay]) { const a = u(m); a.uAnchor[0] = ax; a.uAnchor[1] = ay; place(m); },
    setPosition(m, x, y, z) { m.position.set(x, y); const a = u(m); a.uNode[0] = x; a.uNode[1] = y; if (z !== undefined) m.zIndex = z; },
    setBlend(m, mode) { m.blendMode = mode === 'add' ? 'add' : 'normal'; },
    attach(parent, m) { parent.sortableChildren = true; parent.addChild(m); },
    dispose(m) { m.shader?.destroy(); m.destroy(); },
    disposeTexture(t) { t.destroy(); },
  };
}
