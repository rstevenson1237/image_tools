/**
 * The map module's operations (docs/OPERATION-REGISTRY.md §6): every `map`, `dungeon`, `settlement` and `formats`
 * operation, declared once for the CLI, the MCP server and (from stage 3) the Python client. It imports only files the
 * maps-only bundle may hold (`packages/artgen-dist/test/maps-graph.test.ts`), never the pixel-art pipeline. The order
 * is the MCP tools' order (each group as the MCP list had it, new tools after their group) with the command-line-only
 * operations beside their relatives; the workflow operations (`maps-workflow.ts`) come last.
 */
import { DUNGEON_CHECKS, SCHEMAS, dungeon, map, schemaKeys, settlement } from 'artgen-core/maps';
import { DUNGEON_OPS_LIST } from './maps-dungeon.ts';
import { MAP_MAP_OPS } from './maps-map.ts';
import { MAP_TRACE_OPS } from './maps-trace.ts';
import { WORKFLOW_OPS } from './maps-workflow.ts';
import { SETTLEMENT_OPS_LIST } from './maps-settlement.ts';
import { TILEMAP_OPS } from './maps-tilemap.ts';
import { defineOp, p, usageLines, type OpDef } from './registry.ts';

const formats = defineOp({
  name: 'formats', module: 'maps', effect: 'read', summary: 'The map, dungeon and settlement file format versions this artgen reads and writes.',
  description: 'The map, dungeon and settlement file format versions this artgen reads and writes (a newer file is refused).',
  params: {},
  run: () => ({ map: map.MAP_FORMAT, dungeon: dungeon.DUNGEON_FORMAT, settlement: settlement.SETTLEMENT_FORMAT }),
  cli: { usage: '       artgen formats   (the map, dungeon and settlement file format versions this artgen reads; a newer file is refused)', text: r => Object.entries(r).map(([k, v]) => `${k} ${v}`).join('\n') },
  mcp: {}, python: {},
});

const schema = defineOp({
  name: 'schema', module: 'maps', effect: 'read', summary: 'The JSON Schema of a dungeon, map or settlement file, or of a layout graph; --keys lists every key with its line, --checks the dungeon check ids.',
  description: 'The JSON Schema (draft 2020-12) of a file the map engines read: dungeon, map, settlement, or graph (the input of dungeon layout). keys: every key path with what it means instead; checks: the ids of dungeon check\'s findings with what each means.',
  params: {
    kind: p.oneOf(['dungeon', 'map', 'settlement', 'graph', 'layout', 'design'], 'dungeon | map | settlement | graph | layout | design', { positional: true, required: 'schema <dungeon|map|settlement|graph|layout|design>' }),
    keys: p.bool('list every key path with its line instead of the schema'), checks: p.bool('list the dungeon check ids instead'),
  },
  run: (i: { kind: 'dungeon' | 'map' | 'settlement' | 'graph' | 'layout' | 'design'; keys?: boolean; checks?: boolean }) => (i.checks ? { checks: DUNGEON_CHECKS } : i.keys ? { keys: schemaKeys(SCHEMAS[i.kind]).map(([key, line]) => ({ key, line })) } : SCHEMAS[i.kind]),
  cli: {
    usage: '       artgen schema dungeon|map|settlement|graph|layout|design [--keys] [--checks]   the file\'s JSON Schema; --keys every key with its line; --checks the ids dungeon check gives',
    text: (r: { keys?: { key: string; line: string }[]; checks?: Record<string, string> }) => (r.checks ? Object.entries(r.checks).map(([k, v]) => `${k.padEnd(22)} ${v}`).join('\n') : r.keys ? r.keys.map(k => `${k.key.padEnd(34)} ${k.line}`).join('\n') : JSON.stringify(r, null, 2)),
  },
  mcp: {}, python: {},
});

export const MAP_OPS: OpDef[] = [...MAP_MAP_OPS, ...MAP_TRACE_OPS, ...DUNGEON_OPS_LIST, ...SETTLEMENT_OPS_LIST, ...TILEMAP_OPS, formats, schema, ...WORKFLOW_OPS];

/** The note under the map operations' `--help` lines. */
export const MAP_NOTE = '       (map, dungeon and settlement commands take --file <path> in place of <id>: no project needed; renders go beside the file or to --out)';
/** The `--help` lines of these operations, in order. */
export const MAP_USAGE = `${MAP_OPS.flatMap(usageLines).join('\n')}\n${MAP_NOTE}`;
