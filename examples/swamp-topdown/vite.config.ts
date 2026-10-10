// main.ts awaits loadPack at the top level, which Vite's default build target (es2020) rejects; every browser that
// runs the game supports ES2022.
export default { build: { target: 'es2022' } };
