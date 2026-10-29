/** Every operation of the full CLI and the MCP server: the pixel-art module's, then the maps module's (docs/OPERATION-REGISTRY.md §2). */
import { ART_OPS } from './art.ts';
import { MAP_OPS } from './maps.ts';
import type { OpDef } from './registry.ts';

export const OPS: OpDef[] = [...ART_OPS, ...MAP_OPS];
export { ART_OPS, MAP_OPS };
