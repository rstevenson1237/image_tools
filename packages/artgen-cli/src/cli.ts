/**
 * artgen CLI (entry point: `bin.ts`). Every command is an operation of the registry (`ops/art.ts` for the pixel-art pipeline,
 * `ops/maps.ts` for maps, dungeons and settlements), read by the generic parser in `ops/cli.ts`: its flags, `<command> --help`
 * and the lines of `artgen --help` all come from the declaration, and a flag the command doesn't have is an error. Only
 * `--version` and `--help` are built in here. Every command takes --json (machine-readable output) and --root <game repo>.
 */
import { readFileSync } from 'node:fs';
import { openAsset } from './asset.ts';
import { artMetricsOf } from './loop/art-metrics.ts';
import { GROUP_HELP } from './maps-cli.ts';
import { findProject, requireProject } from './projectfs.ts';
import { findOp, runCli } from './ops/cli.ts';
import { OPS } from './ops/index.ts';
import { MAP_NOTE } from './ops/maps.ts';
import { usageLines, type Ctx } from './ops/registry.ts';
import { VERSION } from './version.ts';
import { resolveAssetArg } from './w2.ts';

export { VERSION };

const HEADER = `artgen — code-generated pixel art for games, driven by a locked art direction (art/direction.json).
Lock a direction, write briefs, let the pipeline make and review each asset, approve, then export packs and the
runtime your game loads them with. In Claude Code, start with /artgen-direction; the skills drive these commands.

usage:`;
const FOOTER = `Commands take --json (machine-readable output) and --root <game repo>; asset commands also take
--direction <file|benchmark|alt> and --ledger <file>. \`artgen <command> --help\` lists a command's flags.`;
/** `artgen --help`: the header, every operation's usage lines in registry order, the footer. */
export const USAGE = [HEADER, ...OPS.flatMap(usageLines), MAP_NOTE, '       artgen --version | --help', '', FOOTER].join('\n');

/** What an operation sees on the command line: the project found from `--root` (or the working directory), paths as they are, assets opened with the `--direction` and `--ledger` overrides. */
const cliCtx = (root: string | undefined): Ctx => ({
  surface: 'cli', root, project: () => requireProject(root), findProject: () => findProject(root), rel: f => f,
  assetPath: arg => resolveAssetArg(findProject(root), arg as string),
  asset: (arg, o) => openAsset(resolveAssetArg(findProject(root), arg as string), { direction: o?.direction, ledger: o?.ledger }),
  direction: d => d as string | undefined, artMetrics: artMetricsOf,
});

export async function main(argv: string[]): Promise<number> {
  const [cmd] = argv;
  if (cmd === '--version' || cmd === 'version') { console.log(VERSION); return 0; }
  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') { console.log(USAGE); return 0; }
  if (!findOp(OPS, argv)) {
    if (GROUP_HELP[cmd]) throw new Error(GROUP_HELP[cmd]);
    console.error(`artgen: unknown command '${argv.slice(0, 2).join(' ')}' — run artgen --help for the list`);
    return 1;
  }
  return runCli(OPS, argv, { log: s => console.log(s), ctx: cliCtx, readFile: f => readFileSync(f, 'utf8') });
}
