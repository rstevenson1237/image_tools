# Operation registry (R2)

Status: built, 2026-10-29 (§10 has what was built and how it differs from the design). This is phase R2 of [`TOOLING-PLAN.md`](TOOLING-PLAN.md) (§9, §10). The generated
reference of every operation is [`OPERATIONS.md`](OPERATIONS.md).

## 1. Goal

Today each artgen operation is written up to four times: a branch in the CLI's `main()` (`cli.ts`, `maps-cli.ts`) with
its own flag parsing and help line, an entry in the MCP server's hand-written `TOOLS` list (`server.ts`), a method in
the Python client, and sometimes a second implementation of the same edit (the dungeon edits exist once in the CLI and
again in `dungeon_edit`). The two lists have drifted: the CLI has `map facts`, `map check` and `dungeon facts` with no
MCP tool, and MCP has `conformance`, `map_update` and `dungeon_edit` with no CLI command.

After R2, each operation is **declared once** in a registry: its name, the module that owns it, its parameters with
types, its side effect, its implementation, and how each interface shows it. From that one declaration:

- the CLI parses its flags and positionals, prints `--help`, and dispatches to it;
- the MCP server lists it as a tool with a JSON Schema and calls it;
- the Python client gets a generated method for it;
- the docs get a reference table (`docs/OPERATIONS.md`);
- a parity test fails when an operation is missing from an interface without a stated reason.

**Accept (plan §10):** the MCP tool list comes from the registry; the parity test passes; the Python tests pass
unchanged. Also (§10 for every phase): `npm run check`, `npm test`, `check:packages`, `test:packages`, the boundary lint
and the bench stay green, and existing CLI and MCP behaviour is unchanged (the transcripts in §8 prove it).

## 2. Decisions

1. **The registry lives in `packages/artgen-cli/src/ops/`.** It is interface code (it binds the CLI and MCP to the
   engine), and the MCP server already depends on `artgen-cli`. `ops/registry.ts` (types, parameter kinds, the
   generic CLI parser, JSON Schema and help generation) imports nothing from Node or the engine, so the web app can
   import it later. A separate package can follow in R3 if the release packages need one.
2. **Two operation files, one per installer module.** `ops/maps.ts` holds every `map`, `dungeon`, `settlement` and
   `formats` operation and imports only files the maps-only bundle may hold (`maps-graph.test.ts`). `ops/art.ts` holds
   the pixel-art pipeline. `ops/index.ts` exports `OPS = [...ART_OPS, ...MAP_OPS]`. The maps-only bundle
   (`artgen-maps.js`) dispatches `MAP_OPS` only.
3. **One operation per CLI command and per MCP tool, merged where they do the same thing.** The inventory in §6 lists
   every operation. Where a CLI command and an MCP tool do the same job (`map show` and `map_get`, `dungeon gen` and
   `dungeon_generate`), they become one operation whose parameters are the union of both. A parameter that only makes
   sense on one surface says so (`mcp: false`, `cli: false`).
4. **Batch edits stay batches on MCP; CLI conveniences stay commands.** MCP keeps one `*_edit` tool per map kind that
   takes a list of edit ops (a long tool list costs every session context). The CLI's one-edit commands
   (`dungeon room add`, `settlement building add`, `map label`) stay as their own operations, which build one edit op
   and apply it through the same function the batch tool uses. They are excluded from MCP with the reason "covered by
   `dungeon_edit` …". The CLI gains the batch form too (`artgen dungeon edit <id> --ops '<json>'` or `--ops @ops.json`),
   so everything MCP can do, the CLI and Python can do.
5. **One edit vocabulary per map kind, in `artgen-mapgen`.** Settlement already has one (`SETTLEMENT_OPS`,
   `editSettlement`), used by the CLI, MCP and the web tool. R2 gives dungeons the same: `DUNGEON_OPS` and
   `editDungeon(m, op)` in `artgen-mapgen/src/dungeon/edit.ts`, merging the CLI's room / block / link / connect / door
   code with MCP's `dungeon_edit` (the union of their fields: MCP's `add_room` gains `fill` and `origin`, MCP's `link`
   gains the CLI's "a block id means its nearest room"). The pure helpers it needs (`cornerPoint`, `corridorEnd`,
   `doorPair`, `gridMode`) move down from `artgen-cli/src/dungeon.ts`, which re-exports them. Terrain-map edits are
   already plain data (`m.edits`); the label and symbol overlay code that the CLI and MCP each repeat for maps and
   dungeons becomes one helper in `ops/maps.ts`.
6. **The MCP tool set stays curated.** Every operation is on every surface unless its declaration names an exclusion
   with a reason. MCP keeps today's 44 tools and gains only cheap, safe, read-mostly ones: `formats`, `map_check`,
   `map_facts`, `dungeon_facts`, `brief_list`, `brief_add`. Any other operation names why it is not a tool (covered by a
   batch tool, reads a path outside the `art/` sandbox, a step the user or a skill must drive). Adding an operation
   forces that choice, because the parity test rejects a missing surface with no reason.
7. **Python is a thin CLI wrapper, so it follows the CLI.** Every CLI operation gets a generated Python method (except
   `bench`, which only runs in this repo). Its positional arguments are the CLI positionals and its keyword arguments
   are the CLI flags in snake case. The generated methods live in `python/artgen/src/artgen/_ops.py` as a mixin class;
   `Artgen` inherits it, and its hand-written methods (`render`, `review`, `texture`, … with their result classes) keep
   their names and win over generated ones. The Python tests stay unchanged.
8. **Behaviour is frozen first, then moved.** Before any code moves, a CLI transcript, an MCP transcript and a
   snapshot of today's MCP schemas are committed (§8). The refactor must keep them identical. New commands and new
   tools only add entries; nothing in an existing entry changes.
9. **Unknown flags are errors.** Today the CLI silently ignores a flag it doesn't know, which hides typos in skills.
   The generic parser knows every flag, so it refuses an unknown one (`artgen map render: unknown flag --thme (artgen
   map render --help)`) and an extra positional. A test parses every concrete CLI example in the shipped skills and
   commands, so the skills can't drift either.
10. **The web forms wait for R8.** §9 of the plan also has the web UI build its forms from the registry. That needs the
    one-shell UI of R8; R2 keeps `ops/registry.ts` free of Node imports so R8 can use it, and the shared edit
    vocabularies in `artgen-mapgen` are what the web map editors call.

## 3. The declaration

```ts
// packages/artgen-cli/src/ops/registry.ts (no node: or engine imports)
export type Module = 'core' | 'art' | 'maps';   // core: what every install has (`ui`, the review server); it is in both CLI bundles
/** read: writes nothing. write: changes a source file (a map, briefs, the ledger, direction.json). render: writes only derived files (out/, sheets/). */
export type Effect = 'read' | 'write' | 'render';

/** A surface the operation is left off, with the reason (shown in docs/OPERATIONS.md). */
export interface Excluded { exclude: string }

export interface Param {
  kind: 'string' | 'number' | 'integer' | 'boolean' | 'enum' | 'list' | 'points' | 'size' | 'json';
  doc?: string;                       // CLI --help, MCP description, Python docstring
  values?: readonly string[];         // enum
  item?: 'string' | 'number';         // list
  schema?: Record<string, unknown>;   // json (and any kind): the MCP JSON Schema, e.g. { type: 'array', items: { type: 'object' } }
  required?: boolean | string;        // a string is the error message, kept verbatim from today
  positional?: boolean | 'rest';      // CLI: bound in declaration order; rest = every remaining positional (an array)
  repeat?: boolean;                   // CLI: the flag may repeat (`--room a --room b`) → an array
  flag?: string;                      // CLI flag when it isn't `--<key in kebab case>` (e.g. `--pack` for `packs`)
  style?: 'switch' | 'onoff';         // boolean on the CLI: presence (`--empty`, default) or a value (`--legend on|off`)
  cli?: false;                        // not on the CLI (nor Python)
  mcp?: false;                        // not on MCP (every path outside art/ is mcp: false: the sandbox)
}

export interface Ctx {
  surface: 'cli' | 'mcp';
  /** The project: CLI requireProject(--root) with today's message; MCP the server's project. */
  project(): Project;
  /** CLI findProject(--root) (null outside a project); MCP the server's project. */
  findProject(): Project | null;
  /** A path a core function reported, as the surface shows it (MCP: relative to the project root). */
  rel(file: string): string;
  /** art module only (set by the CLI's and the MCP server's art context): resolve and open an asset argument. */
  asset?(arg: unknown, o?: { direction?: string; ledger?: string }): AssetDir;
  assetPath?(arg: unknown): string;
}

export interface OpDef<I = Record<string, any>, R = any> {
  name: string;                       // the CLI command path with dots: 'map.render', 'pass.status', 'render', 'import-edit'
  module: Module;
  summary: string;                    // one line: help, docs, Python docstring
  description?: string;               // MCP description (default: summary); copied verbatim from today's tool
  effect: Effect;
  params: Record<string, Param>;      // ordered; keys are snake_case and are the MCP argument names
  run(input: I, ctx: Ctx): R | Promise<R>;
  cli: Excluded | {
    usage: string | string[];         // the top-level --help line(s), kept from today's USAGE text
    text?(r: R, input: I): string;    // human output (default JSON)
    json?(r: R, input: I): unknown;   // the --json payload (default r)
    exit?(r: R, input: I): number;    // exit code (default 0)
    output?(r: R, input: I, io: { json: boolean; log(s: string): void }): void;  // escape hatch (report, bench)
  };
  mcp: Excluded | {
    name?: string;                    // default: name with . and - → _
    content?(r: R, input: I, ctx: Ctx): Content[] | Promise<Content[]>;  // default [text(r)]
  };
  python: Excluded | { name?: string };  // default: name with . and - → _
}
export const defineOp = <I, R>(op: OpDef<I, R>) => op;
```

`p` helpers keep declarations short: `p.str(doc, o?)`, `p.num`, `p.int`, `p.bool`, `p.oneOf(values, doc, o?)`,
`p.list(item, doc, o?)`, `p.points`, `p.size`, `p.json(schema, doc, o?)`.

**Global CLI flags**, accepted by every operation without being declared: `--json`, `--root <dir>`, `--help`.
Asset operations declare `direction` (CLI and MCP) and `ledger` (CLI only); map operations declare the path param as
key `path` with `flag: '--file'` and `mcp: false`.

### Parameter kinds

| Kind | CLI | MCP JSON Schema | Python hint |
|---|---|---|---|
| string | `--x value` | `{ type: 'string' }` | `str` |
| number / integer | `--x 3`; not finite → `--x: a number` | `{ type: 'number' }` | `float` / `int` |
| boolean, switch | `--x` present | `{ type: 'boolean' }` | `bool` |
| boolean, onoff | `--x on\|off` (via `onOff`: on/off/true/false/yes/no) | `{ type: 'boolean' }` | `bool` (sent as on/off) |
| enum | `--x a`; not listed → `--x: a, b, c` | `{ type: 'string', enum }` | `Literal[...]` |
| list | `--x a,b` (trimmed, empty dropped; `item: 'number'` converts) | `{ type: 'array', items }` | `Sequence[...]` |
| points | `--x 1,2,3,4` (the existing `numbers()`, even count) | `{ type: 'array', items: number }` | `Sequence[float]` |
| size | `--x 8x6` → `[8, 6]`; else `--x: WIDTHxHEIGHT, e.g. 8x6` | `{ type: 'array', items: number }` | `Union[str, Sequence[float]]` |
| json | `--x '<json>'` or `--x @file.json` | `schema` (required for this kind) | `Any` (sent as JSON) |

A param's `schema` overrides the generated one (texture's `size` is `{ description: 'px, or [w, h]; default 32' }`
today and stays so). Where today's code checks a value with a message a test or skill quotes, the param stays a plain
string and the operation keeps the check, so the message doesn't change.

### The CLI parser

`runCli(ops, argv, io)` in `ops/cli.ts` (imports only `registry.ts`; allowed in the maps bundle):

1. **Find the operation**: the longest operation whose command words (`name.split('.')`) are the first tokens of
   `argv`. None → today's `unknown command` message.
2. `--help` → the operation's help (its usage lines, then one line per param: flag, kind, doc), exit 0.
3. **Parse** the remaining tokens left to right. `--name` looks up a param by flag; a non-switch consumes the next
   token. Anything else is a positional, bound to positional params in declaration order (`rest` takes the remainder).
   Unknown flag or extra positional → an error naming the operation and pointing at `--help`.
4. **Path mode** (map operations): when `--file` is given, the `id` positional is not on the command line (today's
   `pos.unshift('')`), except for `new`, where an id may still be given.
5. Missing required → the param's message (or `<flag> is required`). Run with a `Ctx` built by the caller (the full
   CLI or the maps-only CLI), print `text` (or `json` with `--json`), return `exit`.

Errors are thrown, as today (`bin.ts` prints them; the tests `rejects.toThrow`).

`artgen --help` is the header text, then every CLI operation's usage lines in registry order, then the footer.
`artgen-maps.js --help` is the same for `MAP_OPS`. Built-ins (`--version`, `help`) stay outside the registry.

## 4. The MCP server after R2

`TOOLS` is generated: `OPS.filter(op => !excluded(op.mcp)).map(op => ({ name, description, inputSchema, annotations:
{ readOnlyHint: op.effect === 'read' }, run }))`, where `inputSchema = { type: 'object', properties, required }` from
the params that are not `mcp: false`. `run` builds the MCP `Ctx` (the project found at `cwd`; `asset()` through the
sandboxed `assetPath` and `dirOpt`; `rel()` = `projRel`) and returns `mcp.content(...)`. `handle()` and `serve()` keep
their behaviour; the hand-written list and its helpers move into the operation declarations. Tool descriptions are
copied verbatim.

MCP-only guards stay MCP-only: `approve` has `user_approved` (`cli: false`), checked when `ctx.surface === 'mcp'`.

## 5. Python and docs (generated)

`packages/artgen-cli/src/ops/gen.ts` exports `pythonOps(OPS)` and `operationsDoc(OPS)`; `npm run gen:ops` writes
`python/artgen/src/artgen/_ops.py` and `docs/OPERATIONS.md`, and a test fails when either is out of date.

```python
# Generated by `npm run gen:ops` from packages/artgen-cli/src/ops. Do not edit.
class Ops:
    def dungeon_check(self, id: Optional[str] = None, *, file: Optional[str] = None) -> "Result":
        """Check a dungeon: … (artgen dungeon check)"""
        return self._op("dungeon.check", [id], {"file": file})
```

`_OPS` in the same file maps each operation to its command words and each keyword to `(flag, kind)`; one `_op()`
method in `client.py` encodes values by kind (switch → presence, onoff → on/off, list/points → commas, size → `WxH`,
json → `json.dumps`) and calls `self._call(Result, …)`. `class Artgen(Ops)`; hand-written methods override.

`docs/OPERATIONS.md`: one table per module, one row per operation: name, effect, CLI usage, MCP tool (or the
exclusion reason), Python method, summary.

## 6. Inventory

Every row is one operation. **CLI** is the command (✚ = new on that surface); **MCP** is the tool name, or the
exclusion reason in italics; Python is the operation name with `.`/`-` → `_` unless noted (all CLI operations except
`bench`).

### Art module (`ops/art.ts`)

| Operation | CLI | MCP | Notes |
|---|---|---|---|
| `init` | `init` | *the server starts inside a project: run artgen init first* | |
| `direction.candidates` | `direction candidates` | *W1 runs through the art-direction skill and the CLI* | |
| `direction.tile` | `direction tile [names…]` | `direction_tile` | param `candidates` (CLI positional rest) |
| `direction.mix` | `direction mix` | *W1 …* | |
| `direction.lock` | `direction lock` | *locking is the user's choice; the art-direction skill runs it* | |
| `direction.anchors` | `direction anchors` | *W1 …* | |
| `direction.new` | `direction new` | *W1 …* | |
| `direction.show` | `direction show` | `direction_get` | ✚ CLI `--candidate`; MCP output as today |
| `direction.validate` | `direction validate <file>` | *reads a file by path; direction_get returns the parsed direction* | |
| `palette.import`, `palette.extract` | `palette import\|extract <file>` | *reads a file by path outside the sandbox* | |
| `palette.ramp` | `palette ramp <#hex>` | *W1 …* | |
| `new` | `new <id> --kind` | *make scaffolds assets from briefs* | |
| `finish` | `finish <asset>` | `finish` | |
| `pass.status` | `pass status <asset>` | `pass_status` | |
| `pass.next` | `pass next <asset>` | *pass_status includes the next step* | |
| `render` | `render <asset>` | `render` | `stages` mcp: false; `scale` cli: false |
| `conformance` | ✚ `conformance <asset> [--version v]` | `conformance` | |
| `review` | `review <asset>` | `review` | |
| `score` | `score <asset> <version> <score>` | `score` | MCP gains model, effort, tokens, ms |
| `variants` | `variants <asset>` | *a CLI review aid; review covers the pipeline's sheets* | |
| `report` | `report <dir>` | *writes a report for a folder by path* | `cli.output` |
| `brief.add` | `brief add <id>` | ✚ `brief_add` | |
| `brief.list` | `brief list` | ✚ `brief_list` | |
| `brief.rm` | `brief rm <id>` | *removing a brief is the user's call* | |
| `brief.lint` | `brief lint [ids]` | `brief_lint` | |
| `make` | `make [ids]` | `make` | |
| `status` | `status [ids]` | `status` | |
| `gallery` | `gallery [ids]` | `gallery` | |
| `feedback` | `feedback <id>` | `feedback` | |
| `approve` | `approve <id>` | `approve` | `user_approved` cli: false |
| `roster`, `roster.record` | `roster [ids]`, `roster record <file>` | *a roster review needs a fresh reviewer subagent; the CLI drives it* | |
| `export` | `export` | `export` | `packs` has `flag: '--pack'` |
| `restyle` | `restyle` | `restyle` | |
| `import-edit` | `import-edit <id> <png>` | *reads an edited PNG by path* | |
| `analytics` | `analytics` | `analytics` | `across`, `apply`, `min_assets`, `out` mcp: false; MCP output as today (markdown) |
| `voxel` | `voxel <asset>` | *writes model files for the game; run from the CLI* | |
| `texture` | `texture <material>` | `texture` | `out` mcp: false; `list` switch |
| `anim` | `anim <asset>` | *writes GIF and APNG previews; MCP returns PNG only* | |
| `fx` | `fx <preset>` | `fx` | `out` mcp: false |
| `bench` | `bench` | *this repo's benchmark* | Python excluded, same reason; `cli.output` |

### Maps module (`ops/maps.ts`)

| Operation | CLI | MCP | Notes |
|---|---|---|---|
| `formats` | `formats` | ✚ `formats` | |
| `map.list` | `map list` | `map_list` | CLI JSON as today (`{version, items}`); MCP output as today |
| `map.symbols` | `map symbols` | *map_list returns the symbol kinds* | |
| `map.show` | `map show <id>` | `map_get` | |
| `map.new` | `map new <id>` | `map_new` | CLI `size` (WxH); MCP `cols`, `rows` (cli: false) |
| `map.gen`, `map.grid`, `map.set` | as today | *map_update covers it* | |
| `map.update` | ✚ `map update <id>` | `map_update` | json params `gen`, `topo`, `grid`, `scale` |
| `map.edit` | `map edit <id> <op>` | `map_edit` | CLI sugar (paint, elevate, river, road, undo) plus ✚ `--ops`, `--undo n` |
| `map.label`, `map.symbol` | as today | *map_overlay add_labels / add_symbols* | |
| `map.overlay` | `map overlay <id> rm\|clear …` | `map_overlay` | ✚ CLI `--add-labels`, `--add-symbols` (json) … |
| `map.render` | `map render <id>` | `map_render` | MCP preview render as today |
| `map.facts` | `map facts <id>` | ✚ `map_facts` | |
| `map.check` | `map check <id>` | ✚ `map_check` | |
| `map.sync` | `map sync` | *reads --from by path (consumer tooling)* | |
| `dungeon.list`, `dungeon.show`, `dungeon.new`, `dungeon.render`, `dungeon.check` | as today | `dungeon_list`, `dungeon_get`, `dungeon_new`, `dungeon_render`, `dungeon_check` | `new`: MCP `mode` (generate\|room\|empty), CLI `--room` / `--empty` |
| `dungeon.gen` | `dungeon gen <id>` | `dungeon_generate` | union of params |
| `dungeon.update` | ✚ `dungeon update <id>` | `dungeon_update` | |
| `dungeon.edit` | ✚ `dungeon edit <id> --ops` | `dungeon_edit` | `editDungeon` |
| `dungeon.room`, `.block`, `.link`, `.unlink`, `.door`, `.connect`, `.disconnect`, `.fit` | as today | *dungeon_edit <op>* | build one op, call `editDungeon` |
| `dungeon.grid`, `dungeon.style` | as today | *dungeon_update covers it* | |
| `dungeon.label`, `dungeon.symbol` | as today | *dungeon_overlay …* | |
| `dungeon.overlay` | `dungeon overlay` | `dungeon_overlay` | merged like `map.overlay` |
| `dungeon.symbols` | `dungeon symbols` | *dungeon_list returns the symbol kinds* | |
| `dungeon.facts` | `dungeon facts <id>` | ✚ `dungeon_facts` | |
| `dungeon.sync` | `dungeon sync` | *reads --from by path* | |
| `settlement.list`, `.show`, `.new`, `.render`, `.check`, `.facts` | as today | `settlement_list`, `settlement_get`, `settlement_new`, `settlement_render`, `settlement_check`, `settlement_facts` | `show`: MCP's boolean `file` param, see below |
| `settlement.gen` | `settlement gen <id>` | `settlement_generate` | |
| `settlement.update` | ✚ `settlement update <id>` | `settlement_update` | |
| `settlement.edit` | ✚ `settlement edit <id> --ops` | `settlement_edit` | `editSettlement` |
| `settlement.building`, `.interior`, `.floor`, `.room`, `.connect`, `.disconnect`, `.door`, `.window`, `.fixture`, `.prop`, `.road`, `.water`, `.wall`, `.area`, `.tree`, `.label`, `.symbol`, `.overlay` | as today | *settlement_edit <op>* | |
| `settlement.grid`, `settlement.style` | as today | *settlement_update covers it* | |
| `settlement.symbols`, `settlement.fixtures` | as today | *settlement_list returns them* | |

`settlement_get` takes a boolean `file` today ("include the file"), which clashes with the CLI's `--file <path>`.
The path param is key `path` (`flag: '--file'`, `mcp: false`) in every map operation, so `settlement.show` keeps a
boolean param keyed `file` with `cli: false`. Param keys are MCP names; CLI flags may differ.

## 7. Adding an operation

1. Declare it in `ops/maps.ts` or `ops/art.ts` with `defineOp` (params, effect, run, the three surfaces).
2. `npm run gen:ops` (Python methods and `docs/OPERATIONS.md`).
3. If it is not an MCP tool, the `mcp` field says why. The parity test checks the rest.

## 8. Tests

- **Transcripts (recorded before the refactor).** `packages/artgen-cli/src/transcript.test.ts` runs a fixed list of
  CLI commands (every command and subcommand at least once, human and `--json` for the map kinds, with fixed seeds, in
  a temp project with a copy of `examples/iso-dungeon/art` for the art commands that are quick) and compares exit code,
  thrown message and output with `__golden__/cli-transcript.txt` (temp root → `<root>`, timestamps → `<ts>`).
  `packages/artgen-mcp/src/transcript.test.ts` does the same for one call of each of today's tools (content types,
  text, image sizes and a hash of the image bytes). `UPDATE_GOLDEN=1` rewrites them; the refactor commits must not.
  `--help` text is left out of the transcript (it is regenerated).
- **MCP schema snapshot.** `packages/artgen-mcp/src/tools-r1.json` holds today's tool names, property names and
  `required` lists. A test checks every one is still a tool with at least those properties and the same `required`.
- **Parity** (`packages/artgen-mcp/src/parity.test.ts`): the MCP tool list is exactly the registry's MCP operations, in
  order; every operation is on every surface or names a non-empty reason; every CLI operation resolves through the
  dispatcher and its usage is in `artgen --help` (maps ones also in `artgen-maps.js --help`, and no art operation is
  reachable there); `_ops.py` and `docs/OPERATIONS.md` are current; no CLI command is dispatched outside the registry.
- **Skill examples**: every concrete `{{ARTGEN}} …` line in a code block of `packages/artgen-dist/content/` (no `[`,
  `|`, `…` or `...`; `<x>` replaced by a word) parses against the registry: a known operation, known flags.
- **Registry unit tests** (`ops/registry.test.ts`): each param kind's CLI parsing and errors, JSON Schema, path mode,
  rest positionals, repeated flags, unknown flags.
- The existing CLI, MCP, fixture, dist and Python tests pass unchanged (the MCP test's exact tool list becomes the
  registry's list, which keeps today's 44 in today's order and adds the new ones after their group).

## 9. Stages

1. **Freeze**: the transcripts and the schema snapshot, on today's code. One commit.
2. **Maps**: `registry.ts`, `cli.ts`, `editDungeon` in mapgen, `ops/maps.ts`; `mapCommand`, `dungeonCommand`,
   `settlementCommand`, `formatsCommand` and `mapsMain` dispatch through the registry; MCP's map, dungeon and
   settlement tools come from it. All tests green, transcripts identical.
3. **Art**: `ops/art.ts`; `main()` dispatches everything through the registry; `TOOLS` is fully generated and the
   hand-written list is gone; `USAGE` is generated; `gen.ts`, `_ops.py`, `docs/OPERATIONS.md`, the parity and skill
   tests.

## 10. As built

### Stage 2 (maps)

What stage 2 added or did differently from §3, so stage 3 builds on the code and not on the sketch:

- **Files.** `ops/registry.ts` (types, `p` helpers, JSON Schema, help), `ops/cli.ts` (`parseCli` reads a command line into an operation's values and errors; `runCli` runs it), and the map module's operations in `ops/maps-map.ts`, `maps-dungeon.ts`, `maps-settlement.ts` (shared flag readers in `maps-shared.ts`), joined by `ops/maps.ts` as `MAP_OPS` (+ `MAP_USAGE`, generated from the operations' usage lines). `maps-cli.ts` keeps `mapCommand`, `dungeonCommand`, `settlementCommand`, `formatsCommand` and `mapsMain`, which call `runCli(MAP_OPS, …)` with the Node pieces (`requireProject`, `readFile`, the group's "unknown command" message). The MCP server's `mcpTool(op)` builds its tool from `inputSchema`, `mcpName` and `mcp.content`.
- **Param additions.** `multi` (a flag that takes every value up to the next flag, `map facts --at 3,3 C4`), `error` (what a bad value is told, after `<flag>: `; the defaults are in `convert`), and boolean `style: 'either'` (`--interiors`, or `--interiors on|off`). A `kind` decides how the command line reads a value and `schema` how MCP describes it, so one key can be text on the CLI and an object on MCP (`layers`, `exits`, `number`, `at`); `run` accepts both.
- **Order.** `MAP_OPS` is in MCP order (today's tools in today's order, `map_facts`, `map_check`, `dungeon_facts` after their group, `formats` last) with the CLI-only operations beside their relatives, so `--help` follows it; the old fused usage lines are split per operation.
- **Surface checks.** `ctx.surface` decides the few defaults that differ: `map render --theme` (CLI both, MCP color), the strict "nothing to do" errors of `map edit` and `map overlay` (CLI only), settlement `view` (MCP: a building means a plan).
- **Dungeon edits.** `editDungeon` takes a `reseed: false` on `split_block` (keep the block's seed; the CLI's `block split --min` uses it) and returns the line a command prints. The CLI commands that check an argument first (a corridor index, a room that exists) keep their own messages, then call it.
- **Stricter than before.** Unknown flags, extra positionals and a flag with no value are errors (a trailing `--room` used to read the next flag as its value); `--land` and `--grid` on `map` are checked against their lists.


### Stage 3 (art)

What stage 3 added or did differently from §3–§6, so later phases build on the code:

- **Files.** The art operations are in `ops/art-direction.ts` (`init`, `direction.*`, `palette.*`, `new`, `finish`), `ops/art-asset.ts` (`pass.*`, `render`, `review`, `conformance`, `score`, `variants`, `report`, `voxel`, `anim`, `texture`, `fx`, `bench`) and `ops/art-production.ts` (`brief.*`, `make`, `status`, `gallery`, `feedback`, `approve`, `roster*`, `export`, `restyle`, `import-edit`, `analytics`), with the helpers they share in `ops/art-shared.ts`. `ops/art.ts` puts them in order as `ART_OPS` (+ `ART_USAGE`); `ops/index.ts` exports `OPS = [...ART_OPS, ...MAP_OPS]`. `VERSION` moved to `version.ts` so the operations can use it without importing `cli.ts`. The maps-only bundle still imports none of these.
- **`main()`** has only `--version` and `--help` built in. A command line no operation answers still prints `artgen: unknown command …` to stderr and returns 1 (as before); a `map`, `dungeon` or `settlement` command that does not exist still throws the group's list. `USAGE` is generated: the header and a `usage:` line, every operation's usage lines in registry order, the maps note, the footer. The old lines that fused several commands (`direction tile … | mix … | lock …`) are one line per operation, and `<command> --help` is new for the art commands.
- **Context.** `Ctx` gained `root` (the `--root` of the command line, which `init` creates a project in) and `direction()` (a `direction` argument as the engine takes it: as given on the CLI; a bench name or a file under the project root on MCP). The CLI context's `asset()` and `assetPath()` apply `--direction` / `--ledger`; the MCP context's go through the sandboxed `assetPath` and drop `ledger`.
- **MCP arguments are filtered.** `mcpTool` passes an operation only the arguments its schema lists. A parameter that is `mcp: false` (`path`, `ledger`, `out`, `across`, `apply`, …) names a file outside the `art/` sandbox, and the old tools never read them; without the filter a client could have sent one (this also closes the same gap in the stage-2 map tools, whose `path` is a file by path). `server.test.ts` has a test.
- **One key, two types.** As in stage 2, a parameter can be text on the command line and a number or object on MCP: `score` (`score`), `make` (`parallel`, `wave`), `texture` / `fx` (`size`), `texture` (`ramps`: `base=stone,…` or an object). Where today's message is quoted by a test or a skill, the parameter stays a string and `run` keeps the check (`review --detail`, `feedback --route` / `--by`, `roster --stage`); `importance` is an enum whose error text is today's.
- **Surface checks in `run`.** `ctx.surface` decides what differs and always did: `render` writes its files on the CLI and returns the strip on MCP; `score` says `0–10` or `0-10` and ignores a bad `agent_tokens_in` on MCP; `feedback`, `make`, `brief lint` (locked direction), `texture`/`fx` (direction lookup) and `export` (`generator`) keep each surface's message; `approve` checks `user_approved` on MCP only (`cli: false`).
- **New surfaces (additive).** CLI `conformance <asset> [--version v]` (exit 1 when the gate fails) and `direction show --candidate <name>`; MCP `brief_add`, `brief_list` (after `brief_lint`) and, on `score`, `model`, `effort`, `tokens_in`, `tokens_out`, `ms`. `tools/list` is the old 44 in the old order plus these two, then the maps tools, then `formats`.
- **Stricter than before.** Besides stage 2's unknown flags, extra positionals and flags with no value: a missing positional of an art command is `<command>: <x> is required` (it used to fall through to `unknown command`), a flag value that is not a number is `--x: a number` (`--seed`, `--frames`, `--steps`, `--tokens-in`, `--variant` …, which used to become `NaN`), and `analytics --across` with no value is an error (it used to run the project report). Nothing else changed: a differential run of about 70 CLI commands and 35 MCP calls against the commit before stage 1 differs only in these.
- **`gen.ts`** is pure text (no Node): `pythonOps(OPS)` and `operationsDoc(OPS)`; `src/gen-bin.ts` (`npm run gen:ops`) writes `python/artgen/src/artgen/_ops.py` and `docs/OPERATIONS.md`. Python keywords are the flag in snake case (`--file` → `file`, `--hue-shift` → `hue_shift`, `--from` → `from_`), or the parameter key where that name is taken (`dungeon link`'s `--id`, since `id` is the dungeon). A positional is required only before the first optional one, and not in an operation that takes `--file`. `_op()` writes positionals first, then flags; a `list` / `points` / `size` / `json` given as text passes through (so `@file.json` works), and an `either` flag set to `False` is sent as `off`. `bench` is the only operation without a Python method. `Artgen(Ops)`: the hand-written methods keep their names; `tests/test_ops.py` has the smoke tests.
- **Parity** (`artgen-mcp/src/parity.test.ts`) also checks that each operation answers `<command> --help`, that flags and MCP argument names are unique per operation, and that `cli.ts` has no command branches. The skill-example test in `ops/registry.test.ts` parses every `{{ARTGEN}}` line of a code block (80 concrete ones); all parsed, so no skill text or operation needed a change.
- **Size.** Declaring the human text and usage for every command in the registry grows the bundles: see the stage report (artgen.js 1.35 → 1.48 MB, artgen-mcp.js 1.22 → 1.48 MB, artgen-maps.js 0.53 → 0.62 MB). `gen.ts` is tree-shaken out of both.
