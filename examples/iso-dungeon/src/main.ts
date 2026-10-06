// Torchdeep — the knight patrols a torch-lit crypt room. Iso floor tiles, depth-sorted props and characters, looping
// torch flames, all from the exported pack through the vendored artgen runtime (the `art` blocks are the art code).
import { Application, Container } from 'pixi.js';
// art
import { depthKey, isoToScreen, loadPack } from './art/runtime/index.js';
import { pixiAdapter } from './art/runtime/adapters/pixi.js';
import { Assets, Packs } from './art/assets';
// /art

const N = 9, ZOOM = 3, TILE = { w: 32, h: 16 };
const app = new Application();
await app.init({ width: N * TILE.w * ZOOM, height: (N * TILE.h + 40) * ZOOM, background: '#0b0c0e', preference: 'webgl', antialias: false });
document.body.appendChild(app.canvas);
const floor = new Container(), world = new Container();
for (const c of [floor, world]) { c.scale.set(ZOOM); c.position.set((N * TILE.w * ZOOM) / 2, 36 * ZOOM); }
app.stage.addChild(floor, world);

const at = (x: number, y: number, z = 0) => isoToScreen(x + 0.5, y + 0.5, z, TILE);
const room: [keyof typeof Assets, number, number, { variant?: number | 'bloody'; state?: 'open' | 'closed' }?][] = [
  ['pillar', 0, 0], ['pillar', 8, 0], ['pillar', 0, 8], ['brazier', 4, 0], ['brazier', 0, 4], ['chest', 8, 4, { state: 'open' }], ['chest', 7, 7],
  ['barrel', 1, 1], ['barrel', 2, 1, { variant: 1 }], ['barrel', 1, 2, { variant: 2 }], ['rubble', 6, 1], ['rubble', 3, 7, { variant: 2 }],
  ['skeleton-knight', 5, 5, { variant: 'bloody' }], ['skeleton-knight', 2, 6], ['slime', 6, 3],
];
// the knight's patrol: a square around the middle of the room
const patrol = (t: number): [number, number] => { const s = ((t % 4) + 4) % 4, k = s % 1, e = [[2, 2], [6, 2], [6, 6], [2, 6], [2, 2]]; const [a, b] = [e[Math.floor(s)], e[Math.floor(s) + 1]]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };

// art
const pack = await loadPack(Packs.main, pixiAdapter()), tiles = pack.tiles(Assets.floor);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) tiles.node(...at(x, y), { variant: tiles.pick(x, y), parent: floor });
const props = room.map(([id, x, y, o]) => pack.sprite(Assets[id], { parent: world, ...o }).at(...at(x, y), depthKey(x, y)));
const torches = pack.effect(Assets['torch-flame'], { parent: world, loop: true });
for (const [x, y] of [[4, 0], [0, 4]]) torches.spawn(...at(x, y, 22), depthKey(x, y, 22));
const hero = pack.sprite(Assets.hero, { state: 'walk', parent: world });
// /art

let t = 0;
app.ticker.add(tick => {
  const dt = tick.deltaMS, [x0, y0] = patrol(t);
  t += dt / 2500;
  const [x, y] = patrol(t), [sx0, sy0] = at(x0, y0), [sx, sy] = at(x, y);
  // art
  hero.faceToward(sx - sx0, sy - sy0).at(sx, sy, depthKey(x, y)).update(dt);
  props.forEach(p => p.update(dt)); torches.update(dt);
  // /art
});
Object.assign(globalThis, { __game: { app, setTime: (v: number) => { t = v; } } });
