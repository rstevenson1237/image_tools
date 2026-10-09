/**
 * Pixi.js (v8) adapter (SPEC §12.2, D3). Atlases become nearest-filtered `TextureSource`s, nodes are `Sprite`s whose
 * texture is swapped per frame (frame textures are cached per atlas rect), mirrored facings flip `scale.x` about the
 * anchor, and z goes to `zIndex` (the parent is made `sortableChildren` on attach) for iso / oblique depth sorting.
 * Palette swaps arrive as recoloured atlases from the core, so no filter is needed.
 */
import { BufferImageSource, Rectangle, Sprite, Texture, type Container, type TextureSource } from 'pixi.js';
import type { AssetRef, FrameRect, RuntimeAdapter } from '../types.js';
import type { FrameSelect, Pack } from '../pack.js';

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
