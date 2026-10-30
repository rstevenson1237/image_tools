// Every adapter passes the same contract (contract.ts): canvas2d (reference), pixi, three — and a stub fourth adapter
// written only against the public core API, which is all a new target needs (D3: no core changes).
import { Container, DOMAdapter, type Sprite as PixiSprite, type TextureSource } from 'pixi.js';
import { AdditiveBlending, DataTexture, NearestFilter, Object3D, PerspectiveCamera, type Sprite as ThreeSprite } from 'three';
import { describe, expect, test } from 'vitest';
import { createPack, type RuntimeAdapter } from '../index.js';
import { synthPack } from '../testkit.js';
import { canvas2dAdapter, Canvas2DLayer, drawNode, type Canvas2DNode, type CanvasLike } from './canvas2d.js';
import { pixiAdapter, pixiLitAdapter, pixiStrip, type PixiLitNode } from './pixi.js';
import type { LightRig } from '../light.js';
import { billboardAngle, threeAdapter, threeLitAdapter, tileTexture, type LitNode } from './three.js';
import { adapterContract } from './contract.js';

/** Node has no canvas: a stand-in that keeps the uploaded pixels. */
const fakeCanvas = (w: number, h: number): CanvasLike & { pixels?: Uint8ClampedArray } => {
  const c: CanvasLike & { pixels?: Uint8ClampedArray } = {
    width: w, height: h,
    getContext: () => ({ createImageData: (iw: number, ih: number) => ({ data: new Uint8ClampedArray(iw * ih * 4) }), putImageData: (img: { data: Uint8ClampedArray }) => { c.pixels = img.data; } }),
  };
  return c;
};

adapterContract(() => canvas2dAdapter({ createCanvas: fakeCanvas }), {
  frame: n => ({ x: n.frame!.x, y: n.frame!.y, w: n.frame!.w, h: n.frame!.h, flipX: n.flipX }),
  anchor: n => n.anchor,
  position: n => [n.x, n.y],
  texture: n => n.tex,
  parent: () => new Canvas2DLayer(),
  children: l => l.nodes.length,
  rotation: n => n.rotation ?? 0,
  blend: n => n.blend ?? 'normal',
});

adapterContract(pixiAdapter, {
  frame: s => ({ x: s.texture.frame.x, y: s.texture.frame.y, w: s.texture.frame.width, h: s.texture.frame.height, flipX: s.scale.x < 0 }),
  anchor: s => [s.anchor.x * s.texture.frame.width, s.anchor.y * s.texture.frame.height],
  position: s => [s.position.x, s.position.y],
  texture: s => s.texture.source,
  parent: () => new Container(),
  children: c => c.children.length,
  nearest: (t: TextureSource) => t.scaleMode === 'nearest' && !t.autoGenerateMipmaps,
  rotation: s => s.rotation,
  blend: s => (s.blendMode === 'add' ? 'add' : 'normal'),
});

// lit sprites in Pixi (R6c): Node has no WebGL, so the program's precision probe gets a stand-in canvas; the shader itself runs in
// the browser acceptance (`npm run accept:lit`). The inspector reads the frame, flip and anchor back from the node's uniforms.
DOMAdapter.set({ ...DOMAdapter.get(), createCanvas: (() => ({ getContext: () => ({ isContextLost: () => false, FRAGMENT_SHADER: 1, HIGH_FLOAT: 2, getShaderPrecisionFormat: () => ({ precision: 23 }) }) })) as never });
const litRig = (): LightRig => ({ ambient: [0.2, 0.2, 0.2], lights: [{ x: 4, y: 2, z: 6, color: [1, 0.8, 0.5], intensity: 1.5, radius: 40 }], bands: 3 });
const litUniforms = (m: PixiLitNode) => (m.shader!.resources as unknown as { node: { uniforms: { uFrame: Float32Array; uAnchor: Float32Array; uFlip: number; uHasNormal: number } } }).node.uniforms;
const litSource = (m: PixiLitNode) => (m.shader!.resources as unknown as { uAlbedo: TextureSource }).uAlbedo;
adapterContract(() => pixiLitAdapter({ rig: litRig() }), {
  frame: m => { const f = litUniforms(m).uFrame; return { x: f[0], y: f[1], w: f[2], h: f[3], flipX: litUniforms(m).uFlip === 1 }; },
  anchor: m => { const a = litUniforms(m).uAnchor; return [a[0], a[1]]; },
  position: m => [m.position.x, m.position.y],
  texture: litSource,
  parent: () => new Container(),
  children: c => c.children.length,
  nearest: (t: TextureSource) => t.scaleMode === 'nearest' && !t.autoGenerateMipmaps,
  blend: m => (m.blendMode === 'add' ? 'add' : 'normal'),
});

describe('pixi lit sprites (R6c)', () => {
  const withNormals = async (rig: LightRig, scale?: number) => {
    const { manifest, images } = synthPack();
    manifest.normals = ['synth-0.n.png'];
    manifest.assets.walker.normals = true;
    const normals = images.map(i => ({ ...i, data: new Uint8ClampedArray(i.data.length).fill(128) }));
    return createPack(manifest, images, pixiLitAdapter({ rig, scale }), normals);
  };

  test('a frame with normals samples the normal atlas rect; an asset without normals is lit as a flat face', async () => {
    const p = await withNormals(litRig()), w = p.sprite('walker'), b = p.sprite('boom');
    expect(litUniforms(w.node).uHasNormal).toBe(1);
    expect((w.node.shader!.resources as unknown as { uNormals: TextureSource }).uNormals).toBe(p.normalTextures![0]);
    expect(litUniforms(b.node).uHasNormal).toBe(0);
    expect((b.node.shader!.resources as unknown as { uNormals: TextureSource }).uNormals).toBe(litSource(b.node));
    const plain = await createPack(synthPack().manifest, synthPack().images, pixiLitAdapter({ rig: litRig() }));
    expect(litUniforms(plain.sprite('walker').node).uHasNormal).toBe(0);
  });

  test('the shader code carries the lighting model: banded Lambert × squared falloff over the first MAX_LIGHTS lights', async () => {
    const p = await withNormals(litRig()), prog = p.sprite('walker').node.shader!.glProgram!;
    expect(prog.fragment).toMatch(/precision highp float/);
    expect(prog.fragment).toContain('max(0.0, 1.0 - dist / uLightPos[i].w)');
    expect(prog.fragment).toContain('floor(lam * uBands + 0.5) / uBands');
    expect(prog.fragment).toContain('uLightPos[8]');
  });

  test('the rig is read on every render: the game mutates it and the next frame uses the new values', async () => {
    const rig = litRig(), p = await withNormals(rig, 2), s = p.sprite('walker', { parent: new Container() }).at(5, 6, 1);
    const sync = () => s.node.onRender!(undefined as never), group = (s.node.shader!.resources as unknown as { lights: { uniforms: Record<string, Float32Array & number> } }).lights.uniforms;
    sync();
    expect([group.uCount, group.uBands]).toEqual([1, 3]);
    expect(Array.from(group.uLightPos.subarray(0, 4))).toEqual([4, 2, 6, 40]);
    expect(Array.from(group.uLightCol.subarray(0, 3)).map(v => Math.round(v * 100) / 100)).toEqual([1.5, 1.2, 0.75]);
    expect(Array.from(group.uAmbient).map(v => Math.round(v * 10) / 10)).toEqual([0.2, 0.2, 0.2]);
    rig.lights[0].x = 30; rig.lights.push({ x: 1, y: 1, z: 1, color: [0, 0, 1], intensity: 1, radius: 5 }); rig.bands = 0; rig.ambient = [1, 1, 1];
    sync();
    expect([group.uCount, group.uBands, group.uLightPos[0], group.uLightPos[4], group.uLightCol[6]]).toEqual([2, 0, 30, 1, 1]);
    expect(Array.from(group.uAmbient)).toEqual([1, 1, 1]);
    for (let i = 0; i < 12; i++) rig.lights.push({ ...rig.lights[0] });
    sync();
    expect(group.uCount).toBe(8);
  });

  test('position, scale and depth: the node sits at (x, y) with the pixel zoom, the shader gets the same placement, z sorts', async () => {
    const p = await withNormals(litRig(), 3), parent = new Container(), s = p.sprite('walker', { parent }).at(12, -4, 7);
    expect(s.node.scale.x).toBe(3); expect(s.node.position.x).toBe(12); expect(s.node.zIndex).toBe(7); expect(parent.sortableChildren).toBe(true);
    const node = (s.node.shader!.resources as unknown as { node: { uniforms: { uNode: Float32Array } } }).node.uniforms.uNode;
    expect(Array.from(node)).toEqual([12, -4, 3]);
  });

  test('the bounds follow the quad: the frame around the anchor, mirrored about it', async () => {
    const p = await withNormals(litRig()), s = p.sprite('walker');
    expect(s.node.boundsArea).toMatchObject({ x: -3, y: -7, width: 8, height: 8 });
    s.face(Math.PI);
    expect(s.node.boundsArea).toMatchObject({ x: 3 - 8, y: -7, width: 8, height: 8 });
  });
});

// lit billboards (P6d): the frame is read back from the map's UV transform, the anchor from the quad's vertices
const litFrame = (m: LitNode) => {
  const t = m.material.map!, { width: W, height: H } = t.image as { width: number; height: number }, flipX = t.repeat.x < 0;
  const w = Math.round(Math.abs(t.repeat.x) * W), h = Math.round(t.repeat.y * H);
  return { x: Math.round(t.offset.x * W) - (flipX ? w : 0), y: Math.round((1 - t.offset.y) * H) - h, w, h, flipX };
};
adapterContract(() => threeLitAdapter({ pixelsPerUnit: 8 }), {
  frame: litFrame,
  anchor: m => {
    const p = m.geometry.attributes.position, { w, flipX } = litFrame(m), x0 = p.getX(0) * 8, y1 = p.getY(0) * 8;
    return [flipX ? w + x0 : -x0, y1].map(v => Math.round(v * 1000) / 1000) as [number, number];
  },
  position: m => [m.position.x, m.position.y],
  texture: m => m.material.map!.source,
  parent: () => new Object3D(),
  children: o => o.children.length,
  nearest: (t: DataTexture) => t.magFilter === NearestFilter && !t.generateMipmaps,
  blend: m => (m.material.blending === AdditiveBlending ? 'add' : 'normal'),
});

describe('three lit billboards (P6d)', () => {
  test('the normal map is the same rect of the normal atlas, flipped frames negate its x, the quad turns to the camera', async () => {
    const { manifest, images } = synthPack();
    manifest.normals = ['synth-0.n.png'];
    manifest.assets.walker.normals = true;
    const normals = images.map(i => ({ ...i, data: new Uint8ClampedArray(i.data.length).fill(128) }));
    const p = await createPack(manifest, images, threeLitAdapter({ pixelsPerUnit: 8 }), normals), s = p.sprite('walker');
    const m = s.node, n = m.material.normalMap!;
    expect(n).toBeTruthy();
    expect(n.colorSpace).toBe('');
    expect([n.offset.x, n.offset.y, n.repeat.x, n.repeat.y]).toEqual([m.material.map!.offset.x, m.material.map!.offset.y, m.material.map!.repeat.x, m.material.map!.repeat.y]);
    s.face(Math.PI); // west: the pack only has east-side facings, so the frame is mirrored
    expect(m.material.normalScale.x).toBe(-1);
    expect(m.material.normalMap!.repeat.x).toBeLessThan(0);
    const cam = new PerspectiveCamera();
    cam.position.set(5, 0, 0);
    m.onBeforeRender(undefined as never, undefined as never, cam, undefined as never, undefined as never, undefined as never);
    expect(m.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(p.sprite('boom').node.material.normalMap).toBeNull(); // assets without normals stay unlit-mapped
  });
});

const threeFrame = (s: ThreeSprite) => {
  const m = s.material.map!, { width: W, height: H } = m.image as { width: number; height: number }, flipX = m.repeat.x < 0;
  const w = Math.round(Math.abs(m.repeat.x) * W), h = Math.round(m.repeat.y * H);
  return { x: Math.round(m.offset.x * W) - (flipX ? w : 0), y: Math.round((1 - m.offset.y) * H) - h, w, h, flipX };
};
adapterContract(() => threeAdapter({ pixelsPerUnit: 8 }), {
  frame: threeFrame,
  anchor: s => { const { w, h, flipX } = threeFrame(s); return [(flipX ? 1 - s.center.x : s.center.x) * w, (1 - s.center.y) * h]; },
  position: s => [s.position.x, s.position.y],
  texture: s => s.material.map!.source,
  parent: () => new Object3D(),
  children: o => o.children.length,
  nearest: (t: DataTexture) => t.magFilter === NearestFilter && t.minFilter === NearestFilter && !t.generateMipmaps,
  rotation: s => -s.material.rotation,
  blend: s => (s.material.blending === AdditiveBlending ? 'add' : 'normal'),
});

/** A fourth target added without touching the core: an SVG-ish record per sprite. */
interface StubNode { href: string; view: string; transform: string; layer?: StubNode[] }
const stubAdapter = (): RuntimeAdapter<{ href: string }, StubNode, StubNode[]> => {
  const anchors = new WeakMap<StubNode, readonly [number, number]>(), pos = new WeakMap<StubNode, [number, number]>(), flips = new WeakMap<StubNode, boolean>();
  const tf = (n: StubNode) => { const [x, y] = pos.get(n) ?? [0, 0], [ax, ay] = anchors.get(n) ?? [0, 0]; n.transform = `translate(${x} ${y}) scale(${flips.get(n) ? -1 : 1} 1) translate(${-ax} ${-ay})`; };
  return {
    id: 'stub',
    loadTexture: a => ({ href: `${a.name}${a.swap ? `#${a.swap}` : ''}` }),
    createNode: t => ({ href: t.href, view: '', transform: '' }),
    setFrame(n, f, flipX) { n.href = f.tex.href; n.view = `${f.x} ${f.y} ${f.w} ${f.h}`; flips.set(n, flipX); tf(n); },
    setAnchor(n, a) { anchors.set(n, a); tf(n); },
    setPosition(n, x, y) { pos.set(n, [x, y]); tf(n); },
    attach(layer, n) { layer.push(n); n.layer = layer; },
    dispose(n) { n.layer?.splice(n.layer.indexOf(n), 1); },
  };
};
adapterContract(stubAdapter, {
  frame: n => { const [x, y, w, h] = n.view.split(' ').map(Number); return { x, y, w, h, flipX: n.transform.includes('scale(-1') }; },
  anchor: n => { const m = /translate\((-?[\d.]+) (-?[\d.]+)\)$/.exec(n.transform)!; return [-Number(m[1]) || 0, -Number(m[2]) || 0]; },
  position: n => { const m = /^translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(n.transform)!; return [Number(m[1]), Number(m[2])]; },
  texture: n => n.href,
  parent: () => [],
  children: l => l.length,
});

describe('adapter extras', () => {
  test('canvas2d draws in z order, mirrored about the anchor, at integer zoom', async () => {
    const { manifest, images } = synthPack(), p = await createPack(manifest, images, canvas2dAdapter({ createCanvas: fakeCanvas }));
    const layer = new Canvas2DLayer(), a = p.sprite('walker', { parent: layer }).at(10, 10, 2), b = p.sprite('gob', { parent: layer }).at(4, 4, 1);
    a.face(Math.PI);
    const calls: string[] = [];
    const ctx = { imageSmoothingEnabled: true, save() {}, restore() {}, translate: (x: number, y: number) => calls.push(`t ${x} ${y}`), scale: (x: number, y: number) => calls.push(`s ${x} ${y}`), drawImage: (_: unknown, ...r: number[]) => calls.push(`d ${r.join(' ')}`) };
    layer.draw(ctx, 3);
    expect(calls[0]).toBe('t 12 12'); // gob first (z 1)
    expect(calls.slice(3)).toEqual(['t 30 30', 's -3 3', `d ${a.rect.x} ${a.rect.y} 8 8 -3 -7 8 8`]);
    expect(ctx.imageSmoothingEnabled).toBe(false);
    b.dispose();
    expect(layer.nodes).toHaveLength(1);
    drawNode(ctx, { ...(a.node as Canvas2DNode), visible: false });
  });

  test('pixi: strip textures for AnimatedSprite; zIndex from z; parent sorts children', async () => {
    const { manifest, images } = synthPack(), p = await createPack(manifest, images, pixiAdapter({ scale: 2 })), stage = new Container();
    const strip = pixiStrip(p, 'walker', { state: 'walk', facing: 2 });
    expect(strip.map(t => t.frame.x)).toEqual([0, 1, 2, 3].map(frame => p.frame('walker', { state: 'walk', facing: 2, frame }).x));
    const s: PixiSprite = p.sprite('walker', { parent: stage }).at(1, 2, 7).face(Math.PI).node;
    expect([s.zIndex, s.scale.x, s.scale.y, stage.sortableChildren]).toEqual([7, -2, 2, true]);
  });

  test('three: billboard facing follows the camera; sprites are sized in world units; floor tile textures repeat', async () => {
    const { manifest, images } = synthPack(), p = await createPack(manifest, images, threeAdapter({ pixelsPerUnit: 8 }));
    const cam = new PerspectiveCamera(), ghoul = new Object3D();
    cam.position.set(0, 1, 5); ghoul.position.set(0, 0, 0); // camera on +z looking at the ghoul
    const name = (heading: number) => { const s = p.sprite('walker'); s.face(billboardAngle(heading, ghoul, cam)); return `${s.facingName}${s.flipX ? '*' : ''}`; };
    expect(name(0)).toBe('s'); // heading +z → walking towards the camera: front view
    expect(name(Math.PI)).toBe('n'); // walking away
    expect(name(Math.PI / 2)).toBe('e'); // heading +x → camera's right
    expect(name(-Math.PI / 2)).toBe('e*'); // camera's left: mirrored east
    cam.position.set(5, 1, 0); // the camera walks round to +x: the same heading now reads differently
    expect(name(0)).toBe('e*');
    const s = p.sprite('walker');
    expect([s.node.scale.x, s.node.scale.y]).toEqual([1, 1]);
    const floor = tileTexture(p, 'wall', { frame: 15, repeat: [4, 4] });
    expect([floor.image.width, floor.repeat.x, floor.magFilter]).toEqual([8, 4, NearestFilter]);
  });

  test('three: translucent shadow pixels survive the alpha cut-out; clear pixels do not', async () => {
    const { manifest, images } = synthPack(), shadow = Math.round(0.35 * 255) / 255; // a direction's default shadow alpha
    const cases: [RuntimeAdapter<DataTexture, unknown, unknown>, boolean][] = [[threeAdapter(), true], [threeLitAdapter(), true], [threeAdapter({ alphaTest: 0.5 }), false]];
    for (const [adapter, keeps] of cases) {
      const p = await createPack(manifest, images, adapter), m = (p.sprite('walker').node as { material: { alphaTest: number } }).material;
      expect(shadow >= m.alphaTest, `${adapter.id} keeps a 35 % shadow`).toBe(keeps);
      expect(m.alphaTest).toBeGreaterThan(0); // fully clear pixels are still discarded (no depth writes)
    }
  });
});
