import { register } from './workerRegistry';

/** Imported by every tool that uses the imagekit worker; builds without those tools do not carry the worker. */
register('imagekit', () => new Worker(new URL('./imagekit.worker.ts', import.meta.url), { type: 'module' }));
