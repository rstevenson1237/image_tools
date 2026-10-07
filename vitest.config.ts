import { defineConfig } from 'vitest/config';

/**
 * Tests cover the rune-free, DOM-free modules only — the vector model, the SVG
 * serializer, the zoom ladder and the artgen project engine / files / zip.
 * Keeping those free of `$state` is what lets this run in a plain node
 * environment with no Svelte plugin in the pipeline.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
