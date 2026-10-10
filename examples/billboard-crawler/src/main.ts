// Hollow Ward — a ghoul paces the ward while the view drifts round it. The ghoul is an 8-direction billboard whose
// facing follows the camera, lit by the player's oil lamp: it loads through the lit three adapter with the pack's
// normal maps, so the lamp (a flickering point light at the camera) shades it (P6d). Floor and walls tile the exported
// textures. All art comes through the vendored artgen runtime (the `art` blocks are the art code).
import * as THREE from 'three';
// art
import { loadPack } from './art/runtime/index.js';
import { billboardAngle, threeAdapter, threeLitAdapter, tileTexture } from './art/runtime/adapters/three.js';
import { Assets, Packs } from './art/assets';
// /art

const W = 320, H = 200, ROOM = 8;
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(W, H, false);
renderer.domElement.style.cssText = 'width: 960px; height: 600px; image-rendering: pixelated';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, W / H, 0.05, 50);
scene.background = new THREE.Color('#06070c');
scene.fog = new THREE.Fog('#06070c', 2.5, 9);
const surface = (map: THREE.Texture, w: number, h: number) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map }));
const furniture: [keyof typeof Assets, number, number][] = [
  ['iron-bed', -2.6, -3.1], ['iv-stand', -1.5, -3.4], ['iron-bed', 0.8, -3.3], ['wheelchair', 2.9, -2.3], ['orderly', 3.2, 1.4], ['rat', -3.2, 2.2], ['iron-bed', -2.6, 3.0],
];

// art
const pack = await loadPack(Packs.main, threeAdapter({ pixelsPerUnit: 24 }));
const floor = surface(tileTexture(pack, Assets.linoleum, { repeat: [ROOM, ROOM] }), ROOM, ROOM);
const walls = [0, 1, 2, 3].map(() => surface(tileTexture(pack, Assets['ward-wall'], { repeat: [ROOM, 2] }), ROOM, 2));
const props = furniture.map(([id, x, z]) => pack.sprite(Assets[id], { parent: scene }).at(x, 0, z));
const lamps = pack.effect(Assets['lamp-flicker'], { parent: scene, loop: true });
lamps.spawn(-3.7, 1.3, -0.5); lamps.spawn(3.7, 1.3, -1.5);
const lit = await loadPack(Packs.main, threeLitAdapter({ pixelsPerUnit: 24 }), { normals: true });
const ghoul = lit.sprite(Assets.ghoul, { state: 'walk', parent: scene });
// /art
// the player's oil lamp: a warm point light carried at the camera, flickering; a little cold ambient for the ward
const lamp = new THREE.PointLight('#ffc890', 3, 6, 1.4);
scene.add(lamp, new THREE.AmbientLight('#8090b0', 0.35));

floor.rotation.x = -Math.PI / 2;
walls.forEach((w, i) => { const a = (i * Math.PI) / 2; w.position.set(-Math.sin(a) * (ROOM / 2), 1, -Math.cos(a) * (ROOM / 2)); w.rotation.y = a; });
scene.add(floor, ...walls);

let t = 0, last = performance.now();
renderer.setAnimationLoop(now => {
  const dt = Math.min(100, now - last);
  last = now; t += dt / 1000;
  // the ghoul paces a circle; the camera drifts round the ward the other way, always looking at it
  const a = t * 0.8, gx = Math.cos(a) * 1.3, gz = Math.sin(a) * 1.3, heading = Math.atan2(-Math.sin(a), Math.cos(a)), c = -t * 0.3;
  camera.position.set(Math.sin(c) * 2.5, 0.75, Math.cos(c) * 2.5);
  camera.lookAt(gx * 0.6, 0.45, gz * 0.6);
  lamp.position.set(camera.position.x + 0.3, 0.6, camera.position.z);
  lamp.intensity = 2.6 + Math.sin(t * 23) * 0.3 + Math.sin(t * 7.3) * 0.25;
  // art
  ghoul.at(gx, 0, gz).face(billboardAngle(heading, ghoul.node, camera)).update(dt);
  props.forEach(p => p.update(dt)); lamps.update(dt);
  // /art
  renderer.render(scene, camera);
});
Object.assign(globalThis, { __game: { renderer, ghoul, lamp, setTime: (v: number) => { t = v; } } });
