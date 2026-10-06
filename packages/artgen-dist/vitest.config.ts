import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // the smoke test builds the bundles once and runs the installed CLI/MCP as child processes
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
