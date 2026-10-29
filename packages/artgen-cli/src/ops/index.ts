/** Every operation of the full CLI and the MCP server: the pixel-art module's, the maps module's, then the core module's (docs/OPERATION-REGISTRY.md §2). */
import { ART_OPS } from './art.ts';
import { CORE_OPS } from './core.ts';
import { MAP_OPS } from './maps.ts';
import type { OpDef } from './registry.ts';

export const OPS: OpDef[] = [...ART_OPS, ...MAP_OPS, ...CORE_OPS];
export { ART_OPS, MAP_OPS, CORE_OPS };
