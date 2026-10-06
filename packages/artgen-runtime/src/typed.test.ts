// Typed ids (PLAN P4 accept): the generated `assets.ts` entries type `play()` states and `variant` names, so editors
// autocomplete them and typos fail `tsc` (the @ts-expect-error lines are checked by `npm run typecheck`).
import { expect, expectTypeOf, test } from 'vitest';
import { createPack, type ArtSprite, type RuntimeAdapter } from './index.js';
import { synthPack } from './testkit.js';

// the shape `artgen export` writes into src/art/assets.ts
const Assets = {
  walker: { id: 'walker', pack: 'synth', kind: 'character', states: ['idle', 'walk'], facings: ['s', 'se', 'e', 'ne', 'n'], variants: ['base'] },
  gob: { id: 'gob', pack: 'synth', kind: 'character', states: ['idle'], facings: ['s'], variants: ['base', 'v1', 'red'] },
} as const;

const nul: RuntimeAdapter<null, object, null> = { id: 'null', loadTexture: () => null, createNode: () => ({}), setFrame() {}, setAnchor() {}, setPosition() {}, dispose() {} };

test('states and variants come from the typed ids', async () => {
  const { manifest, images } = synthPack(), pack = await createPack(manifest, images, nul);
  const walker = pack.sprite(Assets.walker, { state: 'walk' });
  expectTypeOf(walker).toEqualTypeOf<ArtSprite<null, object, 'idle' | 'walk'>>();
  walker.play('idle');
  // @ts-expect-error — not a state of walker
  expect(() => walker.play('run')).toThrow(/no state "run"/);
  pack.sprite(Assets.gob, { variant: 'red' });
  // @ts-expect-error — not a variant of gob
  expect(() => pack.sprite(Assets.gob, { variant: 'blue' })).toThrow(/unknown variant/);
  // plain string ids still work, untyped
  expectTypeOf(pack.sprite('walker').state).toEqualTypeOf<string>();
});
