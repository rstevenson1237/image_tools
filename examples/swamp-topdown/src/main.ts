// Bogwatch — the lantern-bearer wades a loop through the marsh at dusk. Art comes from the exported pack through the
// vendored artgen runtime; the lines between `art` markers are all the art code the game needs.
import { Application, Container } from 'pixi.js';
// art
import { loadPack } from './art/runtime/index.js';
import { pixiAdapter } from './art/runtime/adapters/pixi.js';
import { Assets, Packs } from './art/assets';
// /art

const TILE = 16, COLS = 24, ROWS = 16, ZOOM = 2;
const app = new Application();
await app.init({ width: COLS * TILE * ZOOM, height: ROWS * TILE * ZOOM, background: '#0d100d', preference: 'webgl', antialias: false });
document.body.appendChild(app.canvas);
const ground = new Container(), world = new Container();
ground.scale.set(ZOOM); world.scale.set(ZOOM);
app.stage.addChild(ground, world);

// a pond in the middle of the bog, and scenery around it
const isWater = (x: number, y: number) => Math.hypot((x - 11.5) / 1.6, y - 7.5) < 3.2 || Math.hypot(x - 19, y - 3) < 1.6;
const scenery: [keyof typeof Assets, number, number, number][] = [
  ['sunk-crate', 3, 3, 0], ['sunk-crate', 20, 12, 1], ['sunk-crate', 6, 13, 2], ['lantern-post', 16, 5, 0], ['bone-pile', 4, 9, 0],
  ['reeds', 7, 6, 0], ['reeds', 15, 10, 1], ['reeds', 9, 11, 2], ['reeds', 17, 7, 0], ['leech', 21, 7, 0], ['bog-goblin', 2, 6, 1], ['bog-goblin', 22, 2, 0],
];
const path = (t: number) => [11.5 * TILE + Math.cos(t) * 7.5 * TILE, 7.5 * TILE + Math.sin(2 * t) * 4.2 * TILE] as const;

// art
const pack = await loadPack(Packs.main, pixiAdapter());
const mud = pack.tiles(Assets.mud), water = pack.tiles(Assets['bog-water']);
for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) (isWater(x, y) ? water : mud).node((x + 0.5) * TILE, (y + 0.5) * TILE, { parent: ground });
const props = scenery.map(([id, x, y, variant]) => pack.sprite(Assets[id], { variant, parent: world }).at((x + 0.5) * TILE, (y + 0.5) * TILE, y));
const hero = pack.sprite(Assets['lantern-bearer'], { state: 'walk', parent: world });
const wisps = pack.effect(Assets.wisp, { parent: world, loop: true });
[[12, 6], [8, 3], [19, 10]].forEach(([x, y]) => wisps.spawn(x * TILE, y * TILE, 99));
// /art

let t = 0;
app.ticker.add(tick => {
  const dt = tick.deltaMS, [x0, y0] = path(t);
  t += dt / 4000;
  const [x, y] = path(t);
  // art
  hero.faceToward(x - x0, y - y0).at(x, y, y / TILE).update(dt);
  props.forEach(p => p.update(dt)); wisps.update(dt);
  // /art
});
Object.assign(globalThis, { __game: { app, setTime: (v: number) => { t = v; } } });
