// Page of the lit-sprite acceptance (scripts/artgen-lit-accept.mjs): Pixi + `pixiLitAdapter` + the runtime's synthetic pack with
// normals, rendered in the browser's WebGL and read back. Every opaque pixel of every sprite is compared with `shadeTexel` (the
// reference of the lighting model) for each light scenario. Bundled by esbuild; not part of the vendored runtime.
import { Application, Container } from 'pixi.js';
import { createPack, decodeNormal, shadeTexel, type LightRig } from '../packages/artgen-runtime/src/index.ts';
import { pixiLitAdapter } from '../packages/artgen-runtime/src/adapters/pixi.ts';
import { synthNormals, synthPack } from '../packages/artgen-runtime/src/testkit.ts';

type RGBA = [number, number, number, number];
const SCREEN = [112, 40] as const;

/** The scenes: sprites at integer positions (the pixel of a texel is its texel), one mirrored, one without normals. */
type Sprite = ReturnType<Awaited<ReturnType<typeof createPack>>['sprite']>;
const SPRITES: { id: string; x: number; y: number; setup?: (s: Sprite) => void }[] = [
  { id: 'walker', x: 12, y: 20 },
  { id: 'walker', x: 36, y: 20, setup: s => { s.play('walk').setFacing('ne'); s.update(250); } },   // another frame, another normal map
  { id: 'walker', x: 60, y: 20, setup: s => { s.face(Math.PI); } },                                   // west: the east frame mirrored about the anchor
  { id: 'boom', x: 88, y: 20 },                                                                       // no normals: lit as a flat face
];

const lamp = (x: number, c: [number, number, number]) => ({ x, y: 14, z: 9, color: c, intensity: 1.4, radius: 70 });
const SCENARIOS: { name: string; rig: () => LightRig }[] = [
  { name: 'no light', rig: () => ({ ambient: [0.6, 0.6, 0.6], lights: [], bands: 0 }) },
  { name: 'light left', rig: () => ({ ambient: [0.25, 0.25, 0.3], lights: [lamp(4, [1, 0.8, 0.5])], bands: 0 }) },
  { name: 'light right', rig: () => ({ ambient: [0.25, 0.25, 0.3], lights: [lamp(108, [0.6, 0.8, 1])], bands: 0 }) },
  { name: 'light left, 3 bands', rig: () => ({ ambient: [0.25, 0.25, 0.3], lights: [lamp(4, [1, 0.8, 0.5])], bands: 3 }) },
  { name: 'light right, 3 bands', rig: () => ({ ambient: [0.25, 0.25, 0.3], lights: [lamp(108, [0.6, 0.8, 1])], bands: 3 }) },
  { name: 'both lights, 4 bands', rig: () => ({ ambient: [0.1, 0.1, 0.1], lights: [lamp(4, [1, 0.8, 0.5]), lamp(108, [0.6, 0.8, 1])], bands: 4 }) },
  { name: 'both lights, smooth', rig: () => ({ ambient: [0.1, 0.1, 0.1], lights: [lamp(4, [1, 0.8, 0.5]), lamp(108, [0.6, 0.8, 1])], bands: 0 }) },
];

export async function run(): Promise<{ scenarios: { name: string; compared: number; unstable: number; maxDelta: number; bad: string[]; mean: number[]; total: number }[]; renderer: string }> {
  const { manifest, images } = synthPack(), normals = synthNormals(manifest, images);
  const rig: LightRig = { ambient: [1, 1, 1], lights: [], bands: 0 };
  const pack = await createPack(manifest, images, pixiLitAdapter({ rig }), normals);
  const app = new Application();
  await app.init({ width: SCREEN[0], height: SCREEN[1], background: 0x101820, antialias: false, resolution: 1, autoDensity: false, preference: 'webgl', preserveDrawingBuffer: true });
  document.body.append(app.canvas);
  const world = new Container();
  app.stage.addChild(world);
  const sprites = SPRITES.map(s => { const sp = pack.sprite(s.id, { parent: world }).at(s.x, s.y); s.setup?.(sp); return { s, sp }; });
  const gl = (app.renderer as unknown as { gl: WebGL2RenderingContext }).gl;
  const out: Awaited<ReturnType<typeof run>>['scenarios'] = [];

  for (const sc of SCENARIOS) {
    const want = sc.rig();
    rig.ambient = want.ambient; rig.lights = want.lights; rig.bands = want.bands;      // the game mutates the rig; the next frame uses it
    app.renderer.render(app.stage);
    const buf = new Uint8Array(SCREEN[0] * SCREEN[1] * 4);
    gl.readPixels(0, 0, SCREEN[0], SCREEN[1], gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const px = (x: number, y: number): RGBA => { const i = ((SCREEN[1] - 1 - y) * SCREEN[0] + x) * 4; return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]; };
    let compared = 0, unstable = 0, maxDelta = 0, sum = [0, 0, 0, 0];
    const bad: string[] = [];
    for (const { s, sp } of sprites) {
      const f = pack.frame(s.id, { state: sp.state, facing: sp.facing, frame: sp.frame, sub: sp.sub }), flip = sp.flipX, [ax, ay] = pack.asset(s.id).anchor;
      const nf = f.normal, A = f.atlas, N = nf?.atlas;
      for (let j = 0; j < f.h; j++) for (let k = 0; k < f.w; k++) {
        const i = flip ? f.w - 1 - k : k, ai = ((f.y + j) * A.width + f.x + i) * 4;       // k: column drawn, i: column of the atlas frame
        if (A.data[ai + 3] !== 255) continue;
        const sx = s.x + (flip ? ax - f.w : -ax) + k, sy = s.y - ay + j, albedo: RGBA = [A.data[ai], A.data[ai + 1], A.data[ai + 2], 255];
        let n: [number, number, number] = [0, 0, 1];
        if (N) { const ni = ((f.y + j) * N.width + f.x + i) * 4; n = decodeNormal(N.data[ni], N.data[ni + 1], N.data[ni + 2], N.data[ni + 3]); if (flip) n = [-n[0], n[1], n[2]]; }
        const ref = (dx: number) => shadeTexel(albedo, n, sx + 0.5 + dx, sy + 0.5, want), e = ref(0), got = px(sx, sy);
        // a texel at a band edge flips a whole step on a rounding difference between the GPU's float32 and our float64: not a test of the model
        const e1 = ref(-2e-3), e2 = ref(2e-3);
        if ([e1, e2].some(o => [0, 1, 2].some(c => Math.abs(o[c] - e[c]) > 3))) { unstable++; continue; }
        compared++;
        const d = Math.max(...[0, 1, 2].map(c => Math.abs(got[c] - e[c])));
        maxDelta = Math.max(maxDelta, d);
        for (let c = 0; c < 3; c++) sum[c] += got[c];
        if (d > 3 && bad.length < 6) bad.push(`${s.id}@${s.x},${s.y} texel ${k},${j}: got ${got.slice(0, 3)} want ${e.slice(0, 3)}`);
      }
    }
    out.push({ name: sc.name, compared, unstable, maxDelta, bad, mean: sum.slice(0, 3).map(v => Math.round(v / Math.max(1, compared))), total: sum[0] + sum[1] + sum[2] });
  }
  return { scenarios: out, renderer: String(gl.getParameter(gl.VERSION)) };
}
(globalThis as unknown as { runAccept: typeof run }).runAccept = run;
