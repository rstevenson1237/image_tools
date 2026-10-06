/**
 * Shared adapter contract (SPEC §12.2): every adapter — the shipped ones and any new target — runs this suite with an
 * inspector that reads its nodes back. Test-only; not part of the vendored runtime.
 */
import { describe, expect, test } from 'vitest';
import { createPack, type Pack, type RuntimeAdapter } from '../index.js';
import { synthPack } from '../testkit.js';

export interface Inspector<Tex, Node, Parent> {
  /** Atlas rect the node shows and whether it is mirrored. */
  frame(n: Node): { x: number; y: number; w: number; h: number; flipX: boolean };
  /** Anchor in (unmirrored) frame pixels. */
  anchor(n: Node): [number, number];
  position(n: Node): [number, number];
  /** Identity of the atlas texture the node samples. */
  texture(n: Node): unknown;
  /** A fresh scene parent and its child count. */
  parent(): Parent;
  children(p: Parent): number;
  /** Optional: the loaded textures are nearest-filtered with no mipmaps. */
  nearest?(t: Tex): boolean;
}

export function adapterContract<Tex, Node, Parent>(make: () => RuntimeAdapter<Tex, Node, Parent>, ins: Inspector<Tex, Node, Parent>): void {
  const load = (): Promise<Pack<Tex, Node, Parent>> => { const { manifest, images } = synthPack(); return createPack(manifest, images, make()); };
  const rectOf = (p: Pack<Tex, Node, Parent>, sel: Parameters<Pack['frame']>[1], id = 'walker') => { const { x, y, w, h } = p.frame(id, sel); return { x, y, w, h }; };

  describe(`adapter contract: ${make().id}`, () => {
    test('loads one texture per atlas (+ recoloured atlases for palette swaps)', async () => {
      const p = await load();
      expect(p.textures).toHaveLength(1);
      expect(p.swapSets.get('gob#red')?.tex[0]).toBeDefined();
      if (ins.nearest) expect(p.textures.every(t => ins.nearest!(t))).toBe(true);
    });

    test('a new sprite shows its first state, facing 0, frame 0, anchored by the asset anchor', async () => {
      const p = await load(), s = p.sprite('walker');
      expect(ins.frame(s.node)).toEqual({ ...rectOf(p, { state: 'idle' }), flipX: false });
      expect(ins.anchor(s.node)).toEqual([3, 7]);
    });

    test('play / face / update select the matching frame', async () => {
      const p = await load(), s = p.sprite('walker').play('walk').setFacing('ne');
      s.update(100);
      expect(ins.frame(s.node)).toEqual({ ...rectOf(p, { state: 'walk', facing: 3, frame: 1 }), flipX: false });
      s.update(250);
      expect(ins.frame(s.node)).toEqual({ ...rectOf(p, { state: 'walk', facing: 3, frame: 3 }), flipX: false });
    });

    test('mirrored facings flip about the anchor', async () => {
      const p = await load(), s = p.sprite('walker').face(Math.PI);
      expect(ins.frame(s.node)).toEqual({ ...rectOf(p, { facing: 2 }), flipX: true });
      expect(ins.anchor(s.node)).toEqual([3, 7]);
      s.face(0);
      expect(ins.frame(s.node).flipX).toBe(false);
    });

    test('positions nodes', async () => {
      const p = await load(), s = p.sprite('walker').at(12, -4, 3);
      expect(ins.position(s.node)).toEqual([12, -4]);
    });

    test('palette swap variants sample the recoloured atlas at the base rect', async () => {
      const p = await load(), base = p.sprite('gob'), red = p.sprite('gob', { variant: 'red' });
      expect(ins.frame(red.node)).toEqual(ins.frame(base.node));
      expect(ins.texture(red.node)).not.toBe(ins.texture(base.node));
    });

    test('effects attach to a parent and are disposed when they finish', async () => {
      const p = await load(), parent = ins.parent(), fx = p.effect('boom', { parent });
      fx.spawn(1, 1); fx.spawn(2, 2);
      expect(ins.children(parent)).toBe(2);
      fx.update(1000);
      expect(ins.children(parent)).toBe(0);
    });

    test('tile nodes show the resolved autotile frame', async () => {
      const p = await load(), parent = ins.parent(), t = p.tiles('wall'), n = t.node(8, 8, { index: t.resolve(1 | 16), parent });
      const { x, y, w, h } = t.frame(5);
      expect(ins.frame(n)).toEqual({ x, y, w, h, flipX: false });
      expect(ins.children(parent)).toBe(1);
      p.dispose();
    });
  });
}
