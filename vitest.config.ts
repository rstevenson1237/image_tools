import { defineConfig } from 'vitest/config';

/**
 * Tests cover the rune-free, DOM-free modules only — the vector model and the
 * SVG serializer. Keeping those free of `$state` is what lets this run in a
 * plain node environment with no Svelte plugin in the pipeline.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
