/**
 * The map module's operations (docs/OPERATION-REGISTRY.md §6): every `map`, `dungeon`, `settlement` and `formats`
 * operation, declared once for the CLI, the MCP server and (from stage 3) the Python client. It imports only files the
 * maps-only bundle may hold (`packages/artgen-dist/test/maps-graph.test.ts`), never the pixel-art pipeline. The order
 * is the MCP tools' order (each group as the MCP list had it, new tools after their group) with the command-line-only
 * operations beside their relatives; the workflow operations (`maps-workflow.ts`) come last.
 */
import { dungeon, map, settlement } from 'artgen-core/maps';
import { DUNGEON_OPS_LIST } from './maps-dungeon.ts';
import { MAP_MAP_OPS } from './maps-map.ts';
import { MAP_TRACE_OPS } from './maps-trace.ts';
import { WORKFLOW_OPS } from './maps-workflow.ts';
import { SETTLEMENT_OPS_LIST } from './maps-settlement.ts';
import { defineOp, usageLines, type OpDef } from './registry.ts';

const formats = defineOp({
  name: 'formats', module: 'maps', effect: 'read', summary: 'The map, dungeon and settlement file format versions this artgen reads and writes.',
  description: 'The map, dungeon and settlement file format versions this artgen reads and writes (a newer file is refused).',
  params: {},
  run: () => ({ map: map.MAP_FORMAT, dungeon: dungeon.DUNGEON_FORMAT, settlement: settlement.SETTLEMENT_FORMAT }),
  cli: { usage: '       artgen formats   (the map, dungeon and settlement file format versions this artgen reads; a newer file is refused)', text: r => Object.entries(r).map(([k, v]) => `${k} ${v}`).join('\n') },
  mcp: {}, python: {},
});

export const MAP_OPS: OpDef[] = [...MAP_MAP_OPS, ...MAP_TRACE_OPS, ...DUNGEON_OPS_LIST, ...SETTLEMENT_OPS_LIST, formats, ...WORKFLOW_OPS];

/** The note under the map operations' `--help` lines. */
export const MAP_NOTE = '       (map, dungeon and settlement commands take --file <path> in place of <id>: no project needed; renders go beside the file or to --out)';
/** The `--help` lines of these operations, in order. */
export const MAP_USAGE = `${MAP_OPS.flatMap(usageLines).join('\n')}\n${MAP_NOTE}`;
