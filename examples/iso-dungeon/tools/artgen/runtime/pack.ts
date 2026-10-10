/**
 * A loaded pack: the manifest, its atlases uploaded through an adapter, and the objects game code uses — sprites
 * (state × facing × frame), tilesets (autotile + variants) and effect players.
 */
import { resolveAutotile, cellHash } from './autotile.js';
import { angleOf, chooseFacing } from './facing.js';
import { StackSprite, type StackOptions } from './stack.js';
import type { AnchorOf, AssetRef, AtlasImage, FrameRect, PackAsset, PackManifest, PackStateDef, RuntimeAdapter, StateOf, VariantOf } from './types.js';

export const RUNTIME_VERSION = '1.2.1';

export interface DecodedImage { width: number; height: number; data: Uint8ClampedArray | Uint8Array }

export interface LoadOptions {
  /** Atlas decoder (default: fetch + createImageBitmap + OffscreenCanvas, i.e. any modern browser). */
  decode?: (url: string) => Promise<DecodedImage>;
  /** Manifest loader (default: fetch). */
  fetchJson?: (url: string) => Promise<unknown>;
  /** Also load the normal-map atlases the pack lists (`pack.normals`), for lit sprites (P6a). */
  normals?: boolean;
  /**
   * Called with the ids of unapproved assets the pack carries (`artgen export --include-drafts`). Default: a console
   * warning, so drafts can't ship unnoticed; pass `false` to silence it once you know.
   */
  onDrafts?: ((ids: string[]) => void) | false;
}

/** Default `onDrafts`: one console warning naming the draft assets (no DOM / Node types in the core: via globalThis). */
const warnDrafts = (pack: string) => (ids: string[]) =>
  (globalThis as { console?: { warn(...a: unknown[]): void } }).console?.warn(
    `artgen: pack "${pack}" includes ${ids.length} unapproved draft asset${ids.length > 1 ? 's' : ''} (${ids.join(', ')}) — approve them and re-export before shipping`);

const idOf = (r: AssetRef): string => (typeof r === 'string' ? r : r.id);

/** Check a manifest can be read by this runtime. */
export function checkManifest(m: unknown): PackManifest {
  const p = m as PackManifest;
  if (!p || typeof p !== 'object' || p.format !== 1 || !Array.isArray(p.atlases) || typeof p.assets !== 'object') throw new Error('not an artgen pack.json (format 1)');
  if (p.runtime && p.runtime.split('.')[0] !== RUNTIME_VERSION.split('.')[0])
    throw new Error(`pack "${p.pack}" was exported for runtime ${p.runtime}, this is ${RUNTIME_VERSION}: re-run \`artgen export --runtime\``);
  return p;
}

/** Fetch a pack.json and its atlases, upload them through the adapter. */
export async function loadPack<Tex, Node, Parent>(url: string, adapter: RuntimeAdapter<Tex, Node, Parent>, opts: LoadOptions = {}): Promise<Pack<Tex, Node, Parent>> {
  const manifest = checkManifest(await (opts.fetchJson ?? fetchJson)(url));
  const base = url.slice(0, url.lastIndexOf('/') + 1), decode = opts.decode ?? decodeImage;
  const images = await Promise.all(manifest.atlases.map(name => decode(base + name)));
  const normals = opts.normals && manifest.normals ? await Promise.all(manifest.normals.map(name => decode(base + name))) : undefined;
  const drafts = manifest.drafts ?? [];
  if (drafts.length && opts.onDrafts !== false) (opts.onDrafts ?? warnDrafts(manifest.pack))(drafts);
  return createPack(manifest, images, adapter, normals);
}

/** Build a pack from an already-parsed manifest and decoded atlases (tests, tools, custom loaders). */
export async function createPack<Tex, Node, Parent>(manifest: PackManifest, images: DecodedImage[], adapter: RuntimeAdapter<Tex, Node, Parent>, normals?: DecodedImage[]): Promise<Pack<Tex, Node, Parent>> {
  checkManifest(manifest);
  const wrap = (img: DecodedImage, index: number, name: string): AtlasImage => ({ name, index, width: img.width, height: img.height, data: new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.byteLength) });
  const atlases = images.map((img, i) => wrap(img, i, manifest.atlases[i]));
  const textures = await Promise.all(atlases.map(a => adapter.loadTexture(a)));
  const pack = new Pack(manifest, adapter, atlases, textures);
  if (normals) {
    pack.normalAtlases = normals.map((img, i) => wrap(img, i, manifest.normals?.[i] ?? `normal-${i}`));
    pack.normalTextures = await Promise.all(pack.normalAtlases.map(a => adapter.loadTexture(a)));
  }
  // palette swaps: recoloured copies of the atlases the asset uses, uploaded once
  for (const [id, a] of Object.entries(manifest.assets)) for (const [swap, map] of Object.entries(a.swaps ?? {})) {
    const bins = new Set(a.frames.map(f => f[0])), set: (Tex | undefined)[] = [], imgs: (AtlasImage | undefined)[] = [];
    for (const b of bins) { imgs[b] = recolor(atlases[b], map, swap); set[b] = await adapter.loadTexture(imgs[b]!); }
    pack.swapSets.set(`${id}#${swap}`, { tex: set, img: imgs });
  }
  return pack;
}

/** Recolour an atlas with a hex → hex map (opaque and translucent pixels alike; alpha kept). */
export function recolor(atlas: AtlasImage, map: Record<string, string>, swap?: string): AtlasImage {
  const rgb = (h: string) => parseInt(h.replace('#', '').slice(0, 6), 16);
  const m = new Map(Object.entries(map).map(([a, b]) => [rgb(a), rgb(b)]));
  const data = new Uint8ClampedArray(atlas.data);
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const to = m.get((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    if (to !== undefined) { data[i] = to >> 16; data[i + 1] = (to >> 8) & 255; data[i + 2] = to & 255; }
  }
  return { ...atlas, data, ...(swap && { swap }) };
}

interface TexSet<Tex> { tex: (Tex | undefined)[]; img: (AtlasImage | undefined)[] }
/** `frame` is the logical frame; `sub` the smoothing sub-frame within it (states exported with `sub`, P6c). */
export interface FrameSelect { state?: string; facing?: number; frame?: number; sub?: number; variant?: string | number }

export class Pack<Tex = unknown, Node = unknown, Parent = unknown> {
  /** `asset#swap` → recoloured textures per atlas. */
  readonly swapSets = new Map<string, TexSet<Tex>>();
  /** Normal-map atlases and textures (same layout as the colour atlases), when loaded with `normals: true`. */
  normalAtlases?: AtlasImage[];
  normalTextures?: Tex[];
  private readonly index = new Map<string, Map<string, number>>();

  readonly manifest: PackManifest;
  readonly adapter: RuntimeAdapter<Tex, Node, Parent>;
  readonly atlases: AtlasImage[];
  readonly textures: Tex[];

  constructor(manifest: PackManifest, adapter: RuntimeAdapter<Tex, Node, Parent>, atlases: AtlasImage[], textures: Tex[]) {
    this.manifest = manifest; this.adapter = adapter; this.atlases = atlases; this.textures = textures;
  }

  get ids(): string[] { return Object.keys(this.manifest.assets); }

  asset(ref: AssetRef): PackAsset {
    const id = idOf(ref), a = this.manifest.assets[id];
    if (!a) throw new Error(`pack "${this.manifest.pack}" has no asset "${id}" (has: ${this.ids.join(', ')})`);
    return a;
  }

  /** Was this asset exported before approval (`--include-drafts`)? */
  isDraft(ref: AssetRef): boolean { return !!this.asset(ref).draft; }

  /** Number of param variants (the rest of `variants` are palette swaps over variant 0). */
  paramVariants(ref: AssetRef): number {
    const a = this.asset(ref);
    return a.variants.length - Object.keys(a.swaps ?? {}).length;
  }

  /** Index into the asset's `frames` for a selection; missing facings fall back to facing 0, missing frames to frame 0. */
  frameIndex(ref: AssetRef, sel: FrameSelect = {}): number {
    const id = idOf(ref), a = this.asset(id);
    let map = this.index.get(id);
    if (!map) { map = new Map(a.frames.map((f, i) => [`${f[8]}|${f[6]}|${f[5]}|${f[7]}`, i])); this.index.set(id, map); }
    const v = this.variantIndex(a, sel.variant), pv = v < this.paramVariants(id) ? v : 0;
    const state = sel.state ?? Object.keys(a.states)[0], fi = sel.facing ?? 0, k = a.states[state]?.sub ?? 1;
    const fr = (sel.frame ?? 0) * k + Math.min(k - 1, Math.max(0, sel.sub ?? 0));
    const i = map.get(`${pv}|${state}|${fi}|${fr}`) ?? map.get(`${pv}|${state}|0|${fr}`) ?? map.get(`${pv}|${state}|${fi}|0`) ?? map.get(`0|${state}|0|0`);
    if (i === undefined) throw new Error(`${id}: no frame for state "${state}"`);
    return i;
  }

  /** Frame rect for a selection (fallbacks as `frameIndex`). */
  frame(ref: AssetRef, sel: FrameSelect = {}): FrameRect<Tex> {
    const id = idOf(ref), a = this.asset(id), v = this.variantIndex(a, sel.variant);
    const [bin, x, y, w, h] = a.frames[this.frameIndex(id, sel)], swap = v >= this.paramVariants(id) ? this.swapSets.get(`${id}#${a.variants[v]}`) : undefined;
    const normal = a.normals && this.normalTextures && this.normalAtlases ? { tex: this.normalTextures[bin], atlas: this.normalAtlases[bin] } : undefined;
    return { tex: swap?.tex[bin] ?? this.textures[bin], atlas: swap?.img[bin] ?? this.atlases[bin], x, y, w, h, ...(normal && { normal }) };
  }

  /** The normal-map rect of a selection (same atlas position as its colour frame), when normals are loaded. */
  normalFrame(ref: AssetRef, sel: FrameSelect = {}): FrameRect<Tex> | undefined {
    if (!this.normalTextures || !this.normalAtlases) return undefined;
    const [bin, x, y, w, h] = this.asset(ref).frames[this.frameIndex(ref, sel)];
    return { tex: this.normalTextures[bin], atlas: this.normalAtlases[bin], x, y, w, h };
  }

  /** A named anchor (`hand`, `head`…) of the selected frame in frame pixels, or undefined when that frame lacks it. */
  anchor(ref: AssetRef, name: string, sel: FrameSelect = {}): [number, number] | undefined {
    const a = this.asset(ref), list = a.anchors?.[name];
    if (!list) throw new Error(`${idOf(ref)}: no anchor "${name}" (has: ${Object.keys(a.anchors ?? {}).join(', ') || 'none'})`);
    return list[this.frameIndex(ref, sel)] ?? undefined;
  }

  /** Pixels of one frame (e.g. to build an engine-side repeating texture). */
  pixels(ref: AssetRef, sel: FrameSelect = {}): AtlasImage {
    const f = this.frame(ref, sel), data = new Uint8ClampedArray(f.w * f.h * 4);
    for (let r = 0; r < f.h; r++) data.set(f.atlas.data.subarray(((f.y + r) * f.atlas.width + f.x) * 4, ((f.y + r) * f.atlas.width + f.x + f.w) * 4), r * f.w * 4);
    return { name: `${idOf(ref)}`, index: -1, width: f.w, height: f.h, data, ...(f.atlas.swap && { swap: f.atlas.swap }) };
  }

  private variantIndex(a: PackAsset, v: string | number | undefined): number {
    if (v === undefined) return 0;
    const i = typeof v === 'number' ? v : a.variants.indexOf(v);
    if (i < 0 || i >= a.variants.length) throw new Error(`unknown variant "${v}" (has: ${a.variants.join(', ')})`);
    return i;
  }

  /** A sprite with its own state machine and adapter node. */
  sprite<A extends AssetRef>(ref: A, opts: SpriteOptions<VariantOf<A>, StateOf<A>, Parent> = {}): ArtSprite<Tex, Node, StateOf<A>, AnchorOf<A>> {
    const s = new ArtSprite<Tex, Node, StateOf<A>, AnchorOf<A>>(this, idOf(ref), opts.variant, opts.state);
    if (opts.parent !== undefined) this.adapter.attach?.(opts.parent, s.node);
    return s;
  }

  /** A sprite stack (P6a): every slice of the asset's first state, rotated together. */
  stack<A extends AssetRef>(ref: A, opts: StackOptions<Parent> = {}): StackSprite<Tex, Node, Parent> { return new StackSprite(this, ref, opts); }

  tiles<A extends AssetRef>(ref: A): TileSet<Tex, Node, Parent> { return new TileSet(this, idOf(ref)); }

  effect<A extends AssetRef>(ref: A, opts: EffectOptions<VariantOf<A>, Parent> = {}): EffectPlayer<Tex, Node, Parent> { return new EffectPlayer(this, idOf(ref), opts); }

  dispose(): void {
    const free = this.adapter.disposeTexture?.bind(this.adapter);
    if (!free) return;
    this.textures.forEach(free);
    this.normalTextures?.forEach(free);
    for (const s of this.swapSets.values()) s.tex.forEach(t => t !== undefined && free(t));
  }
}

export interface SpriteOptions<V extends string = string, S extends string = string, Parent = unknown> {
  variant?: V | number;
  state?: S;
  parent?: Parent;
}

/**
 * Logical frame (and smoothing sub-frame) shown `ms` into a state: per-frame durations when exported, else the state's
 * fps; a logical frame's sub-frames split its time evenly. `done` once a non-looping state ran out.
 */
export function frameAt(st: PackStateDef, ms: number, loop = st.loop): { frame: number; sub: number; done: boolean } {
  const d = st.durations ?? Array.from({ length: st.frames }, () => 1000 / st.fps), k = st.sub ?? 1;
  const total = d.reduce((a, b) => a + b, 0);
  if (!loop && ms >= total) return { frame: st.frames - 1, sub: k - 1, done: true };
  let t = ((ms % total) + total) % total, f = 0;
  while (f < st.frames - 1 && t >= d[f]) t -= d[f++];
  return { frame: f, sub: Math.min(k - 1, Math.floor((t / d[f]) * k)), done: false };
}

/**
 * Sprite state machine: state × facing × frame with per-state fps (or per-frame durations) and loop. `update(dtMs)`
 * advances time; the node is only touched when the shown frame changes.
 */
export class ArtSprite<Tex = unknown, Node = unknown, S extends string = string, N extends string = string> {
  readonly node: Node;
  readonly asset: PackAsset;
  state: S;
  facing = 0;
  flipX = false;
  /** Logical frame (what the animation contract counts: "the hit lands on frame 2"). */
  frame = 0;
  /** Smoothing sub-frame within it (display only; 0 unless the state was exported with `sub`). */
  sub = 0;
  /** Playback speed multiplier. */
  speed = 1;
  /** A non-looping state reached its last frame. */
  done = false;
  /** Overrides the exported loop flag of every state when set. */
  loop: boolean | undefined;
  private time = 0;
  private shown = '';

  readonly pack: Pack<Tex, Node, any>;
  readonly id: string;
  readonly variant: string | number;

  constructor(pack: Pack<Tex, Node, any>, id: string, variant: string | number = 0, state?: S) {
    this.pack = pack; this.id = id; this.variant = variant;
    this.asset = pack.asset(id);
    this.state = (state ?? Object.keys(this.asset.states)[0]) as S;
    if (!this.asset.states[this.state]) throw new Error(`${id}: no state "${this.state}" (has: ${Object.keys(this.asset.states).join(', ')})`);
    const f = pack.frame(id, { variant, state: this.state });
    this.node = pack.adapter.createNode(f.tex);
    pack.adapter.setAnchor(this.node, this.asset.anchor, this.asset.size);
    if (this.asset.blend === 'add') pack.adapter.setBlend?.(this.node, 'add');
    this.apply();
  }

  get states(): S[] { return Object.keys(this.asset.states) as S[]; }
  get facingName(): string { return this.asset.facings[this.facing]; }

  /** Switch state (no-op if already playing it, unless `restart`). */
  play(state: S, restart = false): this {
    if (!this.asset.states[state]) throw new Error(`${this.id}: no state "${state}" (has: ${this.states.join(', ')})`);
    if (state === this.state && !restart) return this;
    this.state = state; this.time = 0; this.frame = 0; this.sub = 0; this.done = false;
    return this.apply();
  }

  /** Face a screen angle (radians; 0 = east, π/2 = south/towards the viewer): nearest facing, mirror-aware. */
  face(angle: number): this {
    const c = chooseFacing(this.asset.facings, angle);
    this.facing = c.index; this.flipX = c.flipX;
    return this.apply();
  }

  /** Face along a screen-space vector; a zero vector keeps the current facing. */
  faceToward(dx: number, dy: number): this { return dx || dy ? this.face(angleOf(dx, dy)) : this; }

  setFacing(name: string): this {
    const i = this.asset.facings.indexOf(name);
    if (i < 0) throw new Error(`${this.id}: no facing "${name}"`);
    this.facing = i; this.flipX = false;
    return this.apply();
  }

  /** Advance by `dtMs`. Returns true while playing, false once a non-looping state has finished. */
  update(dtMs: number): boolean {
    const st = this.asset.states[this.state];
    if (st.frames * (st.sub ?? 1) <= 1 || this.done) return !this.done;
    this.time += dtMs * this.speed;
    const r = frameAt(st, this.time, this.loop ?? st.loop);
    this.frame = r.frame; this.sub = r.sub; this.done = r.done;
    this.apply();
    return !this.done;
  }

  at(x: number, y: number, z?: number): this { this.pack.adapter.setPosition(this.node, x, y, z); return this; }

  /**
   * Where a named anchor of the shown frame is, relative to the sprite's position (unscaled pixels, the anchor
   * pixel's centre; mirrored when the sprite is flipped). Add it to the position you passed to `at` to place an
   * effect or a held prop. Undefined when this frame doesn't have the anchor (e.g. a hand hidden behind the body).
   */
  anchor(name: N): { x: number; y: number } | undefined {
    const p = this.pack.anchor(this.id, name, { variant: this.variant, state: this.state, facing: this.facing, frame: this.frame, sub: this.sub });
    if (!p) return undefined;
    const [ax, ay] = this.asset.anchor, dx = p[0] + 0.5 - ax;
    return { x: this.flipX ? -dx : dx, y: p[1] + 0.5 - ay };
  }

  /** The frame currently shown. */
  get rect(): FrameRect<Tex> { return this.pack.frame(this.id, { variant: this.variant, state: this.state, facing: this.facing, frame: this.frame, sub: this.sub }); }

  dispose(): void { this.pack.adapter.dispose(this.node); }

  private apply(): this {
    const key = `${this.state}|${this.facing}|${this.frame}|${this.sub}|${this.flipX}`;
    if (key !== this.shown) { this.shown = key; this.pack.adapter.setFrame(this.node, this.rect, this.flipX); }
    return this;
  }
}

/** A tile asset: autotile resolver over its frames (state 0, facing 0, frame = tile index) and variant picking. */
export class TileSet<Tex = unknown, Node = unknown, Parent = unknown> {
  readonly asset: PackAsset;
  readonly pack: Pack<Tex, Node, Parent>;
  readonly id: string;
  constructor(pack: Pack<Tex, Node, Parent>, id: string) { this.pack = pack; this.id = id; this.asset = pack.asset(id); }

  get size(): [number, number] { return this.asset.size; }
  /** Param variants available for variety (palette swaps excluded). */
  get variants(): number { return this.pack.paramVariants(this.id); }

  /** Neighbour mask → tile index (0 when the tileset has no autotile layout). */
  resolve(mask: number): number { return resolveAutotile(this.asset.autotile, mask, this.asset.map); }

  /** Deterministic variant for a map cell. */
  pick(x: number, y: number, seed = 0): number { return cellHash(x, y, this.variants, seed); }

  frame(index = 0, variant: number | string = 0): FrameRect<Tex> { return this.pack.frame(this.id, { frame: index, variant }); }

  /** A positioned node showing one tile; the asset's anchor is the tile centre. */
  node(x: number, y: number, opts: { index?: number; variant?: number | string; z?: number; parent?: Parent } = {}): Node {
    const f = this.frame(opts.index ?? 0, opts.variant ?? 0), ad = this.pack.adapter, n = ad.createNode(f.tex);
    ad.setAnchor(n, this.asset.anchor, this.asset.size);
    ad.setFrame(n, f, false);
    ad.setPosition(n, x, y, opts.z);
    if (opts.parent !== undefined) ad.attach?.(opts.parent, n);
    return n;
  }
}

export interface EffectOptions<V extends string = string, Parent = unknown> {
  variant?: V | number;
  parent?: Parent;
  /** Override the exported loop flag (e.g. a torch flame that burns until removed). */
  loop?: boolean;
}

/** Effect player: spawns effect sprites, advances them and disposes the non-looping ones when they finish. */
export class EffectPlayer<Tex = unknown, Node = unknown, Parent = unknown> {
  readonly active: ArtSprite<Tex, Node>[] = [];
  readonly pack: Pack<Tex, Node, Parent>;
  readonly id: string;
  readonly opts: EffectOptions<string, Parent>;
  constructor(pack: Pack<Tex, Node, Parent>, id: string, opts: EffectOptions<string, Parent> = {}) { this.pack = pack; this.id = id; this.opts = opts; pack.asset(id); }

  spawn(x: number, y: number, z?: number): ArtSprite<Tex, Node> {
    const s = this.pack.sprite(this.id, { variant: this.opts.variant, parent: this.opts.parent }).at(x, y, z);
    s.loop = this.opts.loop;
    this.active.push(s);
    return s;
  }

  /** Advance every live effect; finished ones are removed and disposed. */
  update(dtMs: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const s = this.active[i];
      if (!s.update(dtMs)) { s.dispose(); this.active.splice(i, 1); }
    }
  }

  clear(): void { for (const s of this.active.splice(0)) s.dispose(); }
}

async function fetchJson(url: string): Promise<unknown> {
  const g = globalThis as unknown as { fetch(u: string): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }> };
  const r = await g.fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

/** Browser decoder: exact pixels (no premultiply, no colour conversion). */
async function decodeImage(url: string): Promise<DecodedImage> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  const r = await g.fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const bmp = await g.createImageBitmap(await r.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const c = new g.OffscreenCanvas(bmp.width, bmp.height), ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close?.();
  return { width: d.width, height: d.height, data: d.data };
}
