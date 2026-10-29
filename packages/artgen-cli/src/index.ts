/** artgen CLI and Node I/O adapter. */
export const name = 'artgen-cli';
export * from './node.ts';
export * from './bench.ts';
export * from './asset.ts';
export * from './report.ts';
export { main, VERSION } from './cli.ts';
export * from './p6.ts';
export * from './map.ts';
export * from './dungeon.ts';
export * from './settlement.ts';
export * from './project.ts';
export * from './templates.ts';
export * from './w1.ts';
export * from './w2.ts';
export * from './runtime.ts';
export { MAP_OPS, MAP_USAGE } from './ops/maps.ts';
export { runCli, findOp, type CliIO } from './ops/cli.ts';
export { defineOp, inputSchema, mcpName, mcpOf, cliOf, isExcluded, paramSchema, opHelp, usageLines, flagOf, wordsOf, type OpDef, type Ctx, type Param, type Effect, type Module, type Excluded, type Content as OpContent } from './ops/registry.ts';
