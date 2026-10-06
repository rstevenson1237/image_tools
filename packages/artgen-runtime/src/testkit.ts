/**
 * Test-only: a small synthetic pack whose frames are flat colours that encode (asset, state, facing, frame), so a
 * test can tell exactly which frame a node shows. Not part of the vendored runtime.
 */
import type { PackAsset, PackFrame, PackManifest } from './types.js';
import type { DecodedImage } from './pack.js';

export const W = 8, H = 8;

/** Colour of a synthetic frame cell (green channel 0x40 marks "base" pixels the `red` swap recolours). */
export const cellColour = (n: number): [number, number, number] => [n & 255, 0x40, 0x80];

export function synthPack(): { manifest: PackManifest; images: DecodedImage[] } {
  const defs: Record<string, Omit<PackAsset, 'frames' | 'version' | 'sourceHash' | 'directions'> & { frameCount: (s: string) => number }> = {
    // east-side facings only: west ones come from mirroring
    walker: { kind: 'character', view: 'topdown', size: [W, H], anchor: [3, 7], facings: ['s', 'se', 'e', 'ne', 'n'], states: { idle: { frames: 1, fps: 8, loop: true }, walk: { frames: 4, fps: 10, loop: true } }, variants: ['base'], frameCount: s => (s === 'walk' ? 4 : 1) },
    boom: { kind: 'effect', view: 'topdown', size: [W, H], anchor: [4, 4], facings: ['s'], states: { idle: { frames: 3, fps: 10, loop: false } }, variants: ['base'], frameCount: () => 3 },
    gob: { kind: 'character', view: 'iso', size: [W, H], anchor: [4, 7], facings: ['s'], states: { idle: { frames: 1, fps: 8, loop: true } }, variants: ['base', 'v1', 'red'], swaps: { red: { '#004080': '#ff0000' } }, frameCount: () => 1 },
    wall: { kind: 'tileset', view: 'topdown', size: [W, H], anchor: [4, 4], facings: ['s'], states: { idle: { frames: 16, fps: 8, loop: true } }, variants: ['base'], autotile: 'wang16', tile: W, frameCount: () => 16 },
  };
  const frames: { asset: string; f: PackFrame }[] = [];
  for (const [id, d] of Object.entries(defs)) {
    const pv = d.variants.length - Object.keys(d.swaps ?? {}).length;
    for (let v = 0; v < pv; v++) for (const s of Object.keys(d.states)) d.facings.forEach((_, fi) => {
      for (let fr = 0; fr < d.frameCount(s); fr++) frames.push({ asset: id, f: [0, 0, 0, W, H, fi, s, fr, v] });
    });
  }
  const cols = 16, rows = Math.ceil(frames.length / cols), aw = cols * W, ah = rows * H, data = new Uint8ClampedArray(aw * ah * 4);
  frames.forEach(({ f }, n) => {
    f[1] = (n % cols) * W; f[2] = Math.floor(n / cols) * H;
    const [r, g, b] = cellColour(n);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = ((f[2] + y) * aw + f[1] + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = x === 0 && y === 0 ? 0 : 255;
    }
  });
  const assets: Record<string, PackAsset> = {};
  for (const [id, { frameCount: _, ...d }] of Object.entries(defs))
    assets[id] = { ...d, directions: d.facings.length, frames: frames.filter(x => x.asset === id).map(x => x.f), version: 'finish.v1', sourceHash: id };
  // make one swap colour hit: gob's base frame pixels are (n, 0x40, 0x80) → give it exactly #004080
  const gob = assets.gob.frames[0];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = ((gob[2] + y) * aw + gob[1] + x) * 4; data[i] = 0; }
  const manifest: PackManifest = { format: 1, pack: 'synth', generator: 'test', direction: { id: 'd', version: 1 }, runtime: '1.0.0', atlases: ['synth-0.png'], assets };
  return { manifest, images: [{ width: aw, height: ah, data }] };
}

/** Index of the frame cell a rect points at (inverse of the layout above). */
export const cellAt = (x: number, y: number): number => (y / H) * 16 + x / W;
