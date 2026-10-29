/**
 * `artgen map …`, `artgen dungeon …` and `artgen settlement …`: the commands of the map, dungeon and settlement engines. They are a module of their own,
 * with `formats`, so the maps-only bundle (`artgen-maps.js`, see `maps-bin.ts`) holds them without the pixel-art pipeline.
 *
 * Each command names its map by id (in a project: `art/maps/<id>/map.json`) or by `--file <path>`, which needs no
 * project and renders beside the file unless `--out` says otherwise. The commands are the operations of `ops/maps.ts`;
 * this file hands a command line to the generic parser (`ops/cli.ts`) with the Node pieces it needs.
 */
import { readFileSync } from 'node:fs';
import { findProject, requireProject } from './projectfs.ts';
import { runCli } from './ops/cli.ts';
import { CORE_OPS } from './ops/core.ts';
import { MAP_OPS, MAP_USAGE } from './ops/maps.ts';
import { usageLines, type Ctx } from './ops/registry.ts';

declare const __ARTGEN_VERSION__: string | undefined;
declare const __ARTGEN_SHA__: string | undefined;

export { MAP_USAGE };

/** The context the command line gives an operation: the project found from `--root` (or the working directory), paths as they are. */
const cliCtx = (root: string | undefined): Ctx => ({ surface: 'cli', project: () => requireProject(root), findProject: () => findProject(root), rel: f => f });

/** What a group of commands says when no command of it matches (the full CLI uses these too). */
export const GROUP_HELP: Record<string, string> = {
  map: 'map: new | gen | edit | grid | label | symbol | symbols | overlay | set | render | show | facts | check | sync | list (artgen --help)',
  dungeon: 'dungeon: new | gen | room | block | link | unlink | door | connect | disconnect | grid | style | label | symbol | symbols | overlay | check | fit | render | show | facts | sync | list (artgen --help)',
  settlement: 'settlement: new | gen | building | interior | floor | room | connect | disconnect | door | window | fixture | prop | road | water | wall | area | tree | grid | style | label | symbol | overlay | check | facts | render | show | list | fixtures | symbols (artgen --help)',
};

/** Run a command line (`['map', 'render', 'isle', …]`) against the map module's operations. */
const dispatch = (argv: string[]): Promise<number> => runCli([...MAP_OPS, ...CORE_OPS], argv, {
  log: s => console.log(s), ctx: cliCtx, readFile: f => readFileSync(f, 'utf8'),
  unknown: a => { throw new Error(GROUP_HELP[a[0]] ?? `artgen: unknown command '${a.slice(0, 2).join(' ')}' — run artgen --help for the list`); },
});

/** The `--help` lines of the maps-only bundle: the map operations, then the core module's (`ui`, `report`, `upstream`). */
const MAPS_BUNDLE_USAGE = `${MAP_USAGE}\n${CORE_OPS.flatMap(usageLines).join('\n')}`;

/** Entry point of the maps-only bundle (`artgen-maps.js`): `map`, `dungeon`, `settlement`, `formats` and the core module's commands (`ui`, `report`, `upstream`), nothing else. */
export async function mapsMain(argv: string[]): Promise<number> {
  const [cmd, sub, ...rest] = argv, args = [sub, ...rest].filter((a): a is string => a !== undefined);
  if (cmd === '--version' || cmd === 'version') { console.log(MAPS_VERSION); return 0; }
  if (!cmd || cmd === '--help' || cmd === 'help') { console.log(`artgen-maps ${MAPS_VERSION} — the artgen map, dungeon and settlement engines, usable alone.\n\nusage:\n${MAPS_BUNDLE_USAGE}\n       artgen-maps.js --version | --help`); return 0; }
  if (cmd === 'formats' || cmd === 'map' || cmd === 'dungeon' || cmd === 'settlement' || CORE_OPS.some(op => op.name === cmd)) return dispatch([cmd, ...args]);
  throw new Error(`artgen-maps: ${cmd}: not a command here; this bundle has map, dungeon, settlement, formats, ${CORE_OPS.map(op => op.name).join(', ')} (--help)`);
}

/** `artgen-maps.js --version`: the release and the commit it was built from. */
export const MAPS_VERSION = `${typeof __ARTGEN_VERSION__ === 'string' ? __ARTGEN_VERSION__ : 'dev'} (${typeof __ARTGEN_SHA__ === 'string' ? __ARTGEN_SHA__ : 'unknown'})`;
