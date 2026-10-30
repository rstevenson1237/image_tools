# One workflow for maps and assets (R5)

Status: built, 2026-10-30 (§15 has what was built and where it differs from this design). This is phase R5 of [`TOOLING-PLAN.md`](TOOLING-PLAN.md) (§7, §10). It builds on the
operation registry ([`OPERATION-REGISTRY.md`](OPERATION-REGISTRY.md)) and the feedback loop (R4).

## 1. Goal

Today only pixel assets have the full loop: versions, review, approval and metrics. Maps (terrain maps, dungeons and
settlements) are edited in place. They have no versions, no approval and no metrics, and the Asset Review tool doesn't
show them.

After R5, every generator goes through the same steps 5–8 of §7 (Iterate, Review, Approve, Metrics). These steps live
in one new package, `artgen-workflow`. artgen and mapgen each supply a **subject**, which knows how to check and
describe itself. Maps also get the earlier steps that art already has: a brief (Prompt), a locked map direction
(Theme), a one-page data sheet, and references.

**Accept (plan §10):** a map goes through v1 → review → approve in the CLI and in the web UI, and analytics include
maps. Also (§10 for every phase): `npm run check`, `npm test`, `check:packages`, `test:packages`, the strict boundary
lint and the bench stay green, and existing behaviour is unchanged (§11).

## 2. Decisions

1. **A new package, `packages/artgen-workflow`, on the `workflow` layer.** It depends on `artgen-primitives` only. It
   holds the ledger format, the asset and subject status rules, versions and diffs, analytics, generator metrics and
   the data sheet. It has no Node or DOM imports, like every engine package. `artgen-core` keeps re-exporting what moved,
   so no import elsewhere has to change (the facade rule from R1).
2. **mapgen may import workflow** (the arrow §6 planned for R5). The boundary lint's `ALLOWED.mapgen` becomes
   `['primitives', 'workflow']`. The maps-only bundle may hold `artgen-workflow` files (`maps-graph.test.ts`).
3. **One ledger.** Maps write to the same `art/ledger.jsonl` as art, with the same entry shape. A map's entries use
   a **subject key** in the `asset` field: `map:<id>`, `dungeon:<id>` or `settlement:<id>`. Brief ids can't contain
   `:` (`validateBrief`), so a map never collides with an asset. Every existing art reader matches `asset` against a
   brief id exactly, so it never sees map entries.
4. **The working file keeps its name.** `art/maps/<id>/map.json` (and `dungeon.json`, `settlement.json`) stays the
   file that editors, the CLI, the web tools and consumers read and write. A version is a frozen copy beside it:
   `map.v1.json`, `map.v2.json`… Nothing a consumer writes is renamed (plan §12, risk 1).
5. **Workflow commands need a project.** Versions, review, approval and the data sheet are project features (they
   write the ledger). Path mode (`--file`) is not offered on them. A maps-only install already has
   `art/artgen.config.json` (the installer writes `{}`), so it is a project.
6. **Commands stay under each kind's own name** (plan decision 2): `artgen map version keep`, `artgen dungeon approve
   crypt`. One factory declares the same operations for all three kinds.
7. **Map themes become a locked map direction** (`art/map-direction.json`): the theme for each kind, the allowed
   symbol set, a version and a lock. Custom inks and fonts are **not** in R5. The three renderers take only named
   themes today, and inks as data would change every render. That is left for later (§12).
8. **Metrics are part of what every generator must provide.** `generatorMetrics` in workflow computes the same fields
   for art and for each map kind from the ledger. `metrics export` and `metrics pool` move to the `core` module, so a
   maps-only repo exports too. The art-only detail (per-pass gains, blind gap) is added only where the art module is
   installed (§9.3).

## 3. The `artgen-workflow` package

```
packages/artgen-workflow/
  package.json        name artgen-workflow, version 0.0.0 (follows the release, like primitives), deps: artgen-primitives
  tsconfig.json, vitest.config.ts   as artgen-mapgen's
  src/index.ts        re-exports every file below
  src/ledger.ts       moved from artgen-core/src/qa/ledger.ts
  src/check.ts        Check, CheckStatus (moved out of qa/conformance.ts; conformance re-exports them)
  src/status.ts       moved from artgen-core/src/w2/status.ts, plus subjectStatus (§6)
  src/analytics.ts    moved from artgen-core/src/w2/analytics.ts
  src/subject.ts      new: subject keys and the Subject interface (§4)
  src/versions.ts     new: version names, next version, diffJson (§5)
  src/metrics.ts      new: generatorMetrics (§9)
  src/sheet.ts        new: DataSheet, dataSheetMarkdown, renderDataSheet, subjectReviewSheet (§8)
  src/*.test.ts       tests for the new files (the moved files keep their tests where they are; see below)
```

How the moves work:

- Move with `git mv`. Inside a moved file, change only the import paths, plus the type changes below.
- `ledger.ts` imports `ConformanceReport` and `Metrics` from the artgen layer today. In workflow, `LedgerEntry`
  types them structurally: `conformance?: { pass: boolean; checks: Check[] }` and `metrics?: Record<string, number>`.
  If `Metrics` (an interface) isn't assignable to `Record<string, number>`, change `Metrics` to a `type` alias in
  `qa/metrics.ts`. Its fields stay the same.
- `status.ts` imports the type `NextStep` from `pipeline.ts`. Replace it with a structural type in workflow, `StepLike
  = { action: string; version?: string; final?: string; issues?: string[] }`, or with whatever subset `assetStatus`
  reads. `NextStep` must stay assignable to it.
- `artgen-core/src/index.ts` re-exports `artgen-workflow` (`export * from 'artgen-workflow'`) in place of the three
  moved files. Leave a one-line re-export at the old paths only if a test or a package imports them by path.
- Tests: the tests of moved code stay in `artgen-core` (they render through the pipeline). New workflow code gets its
  own tests in `artgen-workflow`.
- Add the package to: the root `tsconfig.json` paths and references (if the other packages are listed there), the
  boundary lint (`LAYERS`, `PACKAGE_LAYER`, comment), `lib-packages.mjs` (`artgen-workflow`, follows the release) and
  the pack-libs test, because `artgen-mapgen`'s package file now depends on it. Also list it in the README's package
  table if the README has one.

## 4. Subjects

```ts
// artgen-workflow/src/subject.ts
export const SUBJECT_KINDS = ['map', 'dungeon', 'settlement'] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];
export const subjectKey = (kind: SubjectKind, id: string): string => `${kind}:${id}`;
export function parseSubjectKey(key: string): { kind: SubjectKind; id: string } | null;
export const isSubjectKey = (asset: string): boolean => parseSubjectKey(asset) !== null;

/** What a generator supplies to the workflow: how to check and describe one of its files. */
export interface Subject<S = unknown> {
  kind: SubjectKind;
  /** Folder under art/ and file name: maps + map.json. */
  dir: string;
  file: string;
  /** Parse and validate; throws like the engine's own parse. */
  parse(raw: unknown): S;
  /** The gate: format errors and lint findings and requirements as checks (fail = blocks approval, flag = warning). */
  check(raw: unknown, o?: { exists?(relPath: string): boolean; symbols?: string[] }): Check[];
  /** The one-page data sheet (§8). */
  sheet(spec: S, checks: Check[]): DataSheet;
}
```

`artgen-mapgen/src/workflow.ts` (new, exported from mapgen's index as `subjects`) defines `SUBJECTS: Record<SubjectKind,
Subject>` for the three engines:

- `check` gives the same verdict as today's `map check`, `dungeon check` and `settlement check`: format errors →
  `fail`; map requirements → one check each (`require:<id>`, `fail` when unmet); dungeon and settlement lint errors →
  `fail` and lint warnings → `flag`. The dungeon underlay file check uses `o.exists` (the CLI passes `existsSync`;
  the web passes a lookup in the snapshot). Check ids are stable and short (`format`, `require:<id>`, `lint:<rule>` or
  `lint` when a finding has no rule, `underlay`, `symbols`).
- `symbols`: when the map direction lists allowed symbol kinds for this kind, a symbol outside the list gives a
  `symbols` check with status `flag`, naming the symbols.
- Refactor the CLI's `checkMapFile` / `checkDungeonFile` / `checkSettlementFile` to use the subject only if their
  output stays byte-identical (the transcripts guard it). Otherwise leave them alone and test that both give the same
  verdict on every fixture case.

Art assets are not a `Subject` in R5. Their gate (conformance) and status already exist. They join `generatorMetrics`
under the kind name `art` (§9).

## 5. Versions and diffs

- Name: `v<N>`, from 1. File: `<dir>/<id>/<file stem>.v<N>.json`, e.g. `art/maps/keep/map.v3.json`.
- `nextVersion(names: string[]): string` gives `v1` for none, else one above the highest.
- A version is a byte copy of the working file at that moment, and the version entry records its `sourceHash`
  (`sourceHash()` from ledger.ts, over the file text). Recording a version when the working file has the same hash as
  the latest version is refused: `keep: no change since v2`.
- `diffJson(a, b): Change[]`, where `Change = { path: string; op: 'added' | 'removed' | 'changed'; from?: unknown; to?:
  unknown }`. Objects are compared key by key. An array whose items all have a string `id` is compared by id
  (`rooms[id=hall]`), and any other array by index. The output is sorted by path, so it is deterministic. The CLI prints
  one line per change and cuts long values to 60 characters.

## 6. Status of a subject

`subjectStatus({ entries, workingHash, direction? })` uses the art status names, so Asset Review groups maps and
assets together. `entries` are that subject's ledger lines in file order. `direction` is the locked map direction
`{ id, version }`, if there is one.

Let V be the latest `version` entry. Then, in order:

| Status | When | `why` (example) |
|---|---|---|
| `in-pipeline` | no version entry yet | `no version recorded yet: artgen map version keep` |
| `revision` | a user `feedback` entry is newer than V (and no version came after it) | `feedback on v2: rework, then record v3` |
| `stale` | an approval of V exists, and the working file has changed since, or the map direction version differs from the approval's | `edited since approved v2: record a version` / `approved under map direction v1, now v2: review and approve again` (approving the same version again is allowed when the file is unchanged) |
| `approved` | the newest approval is of V, is newer than any feedback, and the working hash equals V's | `approved v2` |
| `in-pipeline` | the working file differs from V (no approval involved) | `edited since v2: record a version` |
| `final` | otherwise: V equals the working file and waits for the user | `v2 waiting for the user` |

It returns `{ status, version?: string, approval?: LedgerEntry, why }`. `brief` and `exported` are never used for maps.

## 7. The workflow steps for maps

### 7.1 Ledger entries

All have `ts` and `asset: '<kind>:<id>'`. Add `'version'` to `LedgerType`.

| Step | Entry |
|---|---|
| version | `{ type: 'version', version: 'v3', file: 'maps/keep/map.v3.json', sourceHash, note?, by: 'agent' \| 'user', wallMs? }`. `wallMs` is the time since the subject's previous entry, when there is one. |
| review | `{ type: 'review', version: 'v3', sheet: 'maps/keep/out/review-v3.png', imageTokens, conformance: { pass, checks }, by: 'agent' }` |
| score | `{ type: 'score', version: 'v3', score: 0–10, note?, reviewer, conformance: { pass, checks }, by: 'agent' }` (only with `review --score`) |
| feedback | `{ type: 'feedback', on: 'v3', note, region?: [x, y, w, h], by: 'user', via? }`. The region is in map units for maps and in cells for dungeons and settlements. |
| approve | `{ type: 'approve', version: 'v3', sourceHash, direction?: { id: 'maps', version }, note, by: 'user', via? }` |
| map direction lock | `{ type: 'approve', asset: 'maps:direction', version: 'v2', note, by: 'user', via? }` |

`via` is `image-tools` from the web UI and `pr` from a pull request comment, as for art.

### 7.2 Rules

- **Version:** refused when nothing changed (§5). The working file must pass `parse` (a file that doesn't parse can't
  be a version).
- **Review:** renders a version (default: the latest) into a review sheet (§8) at `<dir>/<id>/out/review-v<N>.png`,
  and logs a `review` entry with the subject's checks. With `--score n --note … --reviewer name` it also logs a
  `score` entry for that version. The map skills' review step tells the reviewer what to look at: labels can be read,
  symbols don't overlap, the legend matches what is drawn, and the requirements are met.
- **Feedback:** user only (like art: an MCP call needs the note to quote the user). It needs a version. It opens
  `revision`.
- **Approve:** user only (MCP: `user_approved: true`, like art's `approve`). It needs the status to be `final`, which
  means a version exists and the working file equals it, and no check of that version may `fail`. Flags are allowed
  and are copied into the entry as `warnings`. A review sheet is **not** required: the user sees the map in the web UI
  or on the pull request.
- **Map direction:** `map direction` shows it; `--theme map=bw,dungeon=color` and `--symbols dungeon=altar,statue`
  change the draft; `--lock` locks it, which is the user's call (MCP: `user_approved`). Locking moves the version up
  by one and logs the lock entry.

### 7.3 Map briefs

`<dir>/<id>/<stem>.brief.md`, e.g. `art/maps/keep/map.brief.md`: what the map is for, in the user's words. It may start
with front matter of plain `key: value` lines between `---` lines. The keys read are `title` and `refs` (comma-separated
paths under `art/`, e.g. `refs: refs/coast.png, refs/old-keep.png`). Parse the front matter by hand, without the
`yaml` package: the maps-only bundle must not grow by the 260 KB `yaml` adds. The map skills' interview writes the
brief before generating.

### 7.4 Map direction file

`art/map-direction.json`:

```json
{ "id": "maps", "version": 1, "status": "locked", "themes": { "map": "bw", "dungeon": "bw", "settlement": "color" },
  "symbols": { "dungeon": ["altar", "statue", "stairs"] }, "note": "printed handouts: black and white" }
```

Parse and validate it in mapgen (`artgen-mapgen/src/direction.ts`): themes must be names the engine has, and symbols
must be kinds the engine has. No file means no direction: review renders in `color`, no symbol set applies, and
approvals carry no `direction`. `map render` keeps its own defaults and flags. The direction applies to review sheets,
checks and staleness only, so no consumer's render changes.

## 8. Data sheet and review sheet

```ts
// artgen-workflow/src/sheet.ts
export interface DataSheet {
  title: string;                         // "keep — terrain map", "goblin — character"
  subject: string;                       // ledger key: 'map:keep' or the brief id
  rows: { label: string; value: string }[];
  must?: { text: string; met?: boolean }[];   // what must hold: map requirements; for art, the animation contract
  swatches?: string[];                   // '#rrggbb', art only (the kind's palette)
  refs?: string[];                       // reference files, relative to art/
  notes?: string;                        // the brief's text, cut to a few lines
}
export function dataSheetMarkdown(s: DataSheet): string;
export function renderDataSheet(s: DataSheet, o?: { refs?: { label: string; grid: Grid }[]; maxEdge?: number }): Grid;
export function subjectReviewSheet(o: { title: string; render: Grid; sheet: DataSheet; refs?: { label: string; grid: Grid }[]; maxEdge?: number }): Grid;
```

- Draw with the pixel font in `artgen-primitives/lib/font.ts`, in the same dark style as `qa/sheet.ts`. Keep the
  long edge at most 1568 px (the review-image cap).
- **Map sheet rows** (`Subject.sheet`), drawn from what each engine already computes (`facts`, `describe`, the
  spec): size and scale, grid, preset or kind, seed, counts (edits, rooms, corridors, buildings, labels, symbols),
  theme, and `must` = requirements with met or unmet.
- **Asset sheet** (`assetDataSheet(brief, dir, budget, contract?)` in `artgen-core`, art layer): kind, importance,
  view, size in pixels and px per metre, states, facings, frames and fps per state, template, budget (revision passes,
  user iterations, image-token cap), `swatches` = the kind's palette, `must` = the animation contract's lines when
  there is one, `refs` = `brief.refs`.
- **References on review sheets:** art briefs may list `refs: [refs/goblin-1.png]` (add it to `BriefEntry` and
  `validateBrief`: a list of paths under `refs/`). `reviewSheet` in `qa/sheet.ts` takes `refs?: { label, grid }[]` and
  draws them in a REFERENCES row under the anchors. The CLI's `review` and the map `review` load the PNG refs; a ref
  that isn't a PNG, or is missing, is skipped with a warning in the result. A map review sheet is the render (in the
  direction's theme) on the left, the data sheet on the right, and the refs underneath.

## 9. Metrics

### 9.1 Generator metrics

`generatorMetrics(ledger, subjects: { generator: string; key: string }[]): Record<string, GeneratorMetrics>`, with
the same fields for every generator:

```ts
interface GeneratorMetrics {
  subjects: number;          // assets or maps of this generator in the repo
  started: number;           // with at least one version (art: a scored pass; maps: a version entry)
  final: number;             // reached final at least once (art: a status final entry or an approval; maps: an approval or currently final)
  approved: number;          // with an approval
  passesPerApproved?: number;  // art: score entries; maps: version entries, per approved subject
  firstPassApproval: { approved: number; untouched: number; rate?: number };  // untouched = no user feedback
  feedback: number;          // user feedback entries
  imageTokens: number;       // review images
  outTokens: number;
  wallMinutes: number;       // sum of wallMs
  checkFailures: Record<string, number>;   // check id → count of failing checks on review, score and render entries
}
```

Art's subjects are the brief ids (generator `art`). Map subjects are the working files found under `art/maps`,
`art/dungeons` and `art/settlements` (generators `map`, `dungeon`, `settlement`).

### 9.2 Art analytics ignore subject keys

`analytics()` and `passRecords()` skip entries whose `asset` is a subject key (`isSubjectKey`). Art numbers then stay
exactly what they were, whatever maps add to the ledger. `artgen analytics` (and the web Analytics panel) adds a
**Generators** table from `generatorMetrics`, with one row per generator. This meets "analytics include maps".

### 9.3 Export and pool move to `core`

- `metrics.export` and `metrics.pool` change module to `core` (CLI words, flags and MCP names unchanged). They move
  from `ops/art-loop.ts` into `ops/core.ts`, and `loop/metrics.ts` stops importing `artgen-core` and `w2.ts`.
- `METRICS_SCHEMA` becomes 2. The export gains `generators: Record<string, GeneratorMetrics>`. The art fields
  (`assets`, `byKind`, `passes`, `totals`, `firstPassApproval`, `userRevisionRate`, `gateFailures`, `blind`) are
  filled by a new optional `Ctx.artMetrics?(project)`. The art CLI and MCP contexts provide it (today's `metricsOf`
  code), and the maps-only bundle doesn't, so a maps-only export has `generators` and `maps` only.
- `pool` reads schemas 1 and 2. The pooled markdown adds a per-generator table (approved, passes per approved, first
  pass rate, image tokens, minutes) for schema 2 exports. Schema 1 exports show as before.
- Existing exports in `docs/metrics/pool/` stay valid. Re-run `npm run metrics:pool` only if the pooled markdown
  changes for them (it shouldn't).

## 10. Operations

A factory in `packages/artgen-cli/src/ops/maps-workflow.ts` declares these for each kind K in map, dungeon and
settlement, all `module: 'maps'`. The Node side (reading versions, appending to the ledger, rendering a review PNG
through the existing render functions) goes in `packages/artgen-cli/src/workflow.ts`. Both must be maps-bundle-safe:
add them to `ALLOWED_CLI` in `maps-graph.test.ts`. `appendLedger` in `node.ts` imports `artgen-core`. Write a lean
copy over `formatLedgerLine` from workflow in `workflow.ts`, and have `node.ts` re-export it so there is one
implementation.

| Operation | CLI | Effect | MCP |
|---|---|---|---|
| `K.brief` | `artgen K brief <id> [--text "…"] [--refs a,b]`: show, or write the brief | write | yes |
| `K.version` | `artgen K version <id> [--note "…"]` | write | yes |
| `K.diff` | `artgen K diff <id> [a] [b]` (default: latest version → working file) | read | yes |
| `K.review` | `artgen K review <id> [version] [--score n --note "…" --reviewer name]` | render (+ write with `--score`) | yes, returns the PNG |
| `K.feedback` | `artgen K feedback <id> --note "…" [--region x,y,w,h] [--via pr]` | write | yes |
| `K.approve` | `artgen K approve <id> [--note "…"] [--via pr]` | write | yes, `user_approved` required |
| `K.status` | `artgen K status [ids]`: one row per subject; with one id, also its history (versions with notes, reviews, feedback, approvals) | read | yes |
| `K.sheet` | `artgen K sheet <id>`: writes `<dir>/<id>/out/sheet.png` and `sheet.json` | render | yes, returns the PNG |
| `map.direction` | `artgen map direction [--theme k=t,…] [--symbols k=a,b] [--lock] [--note "…"]` | write | yes, `user_approved` for `--lock` |
| `sheet` (art) | `artgen sheet <id>`: the asset's data sheet to `art/assets/<kind>/<id>/out/sheet.png` and `.json` | render | yes |

MCP names come from the registry's default (`map_version`, `dungeon_approve`…). The Python methods are generated
(`npm run gen:ops`). The parity test then covers every one. Add the new words to `GROUP_HELP` in `maps-cli.ts`.

The art side: add `sheet` to `ops/art-production.ts` (or a sibling). `artgen review` passes the brief's refs to the
review sheet.

## 11. Web UI

- `src/core/project/engine.ts` (`ArtProject`) gains:
  - `subjects()`: rows for every map, dungeon and settlement in the snapshot (kind, id, status, version, why, check
    pass).
  - `subjectDetail(kind, id)`: the versions with their notes, reviews, feedback, approvals, the checks, the data sheet
    and the brief.
  - `approveSubject(kind, id, note)` and `feedbackSubject(kind, id, { note, region? })`: the same rules as the CLI.
    They return `FileOp[]` (ledger appends, `via: 'image-tools'`).

  These use only `artgen-workflow` and `artgen-mapgen` (the snapshot is the file system). `engine.test.ts` checks them
  against the CLI on a fixture project, as it does for assets.
- `status()` and the subject listing must work **without a locked art direction**: a maps-only repo has none. Art
  rows are empty then, but maps are still listed.
- The worker gets the calls the review page needs (`subjects`, `subjectDetail`, `approveSubject`, `feedbackSubject`).
  It renders a version through the existing `mapPng` / `dungeonPng` / `settlementPng` with the raw JSON of that version
  file.
- **Asset Review** lists maps in the same status groups as assets, with a small kind badge (map, dungeon,
  settlement). Selecting a map shows the render of the latest version (or of the working file when there is none),
  the versions list (pick any two to see them side by side, with the `diffJson` lines below), the checks, the data
  sheet and the brief, then approve and request-changes (a note only; the region field is optional). The same
  approval rules apply, and their messages show as they do for assets.
- Asset Review also shows an asset's data sheet (the same `assetDataSheet`) and its reference images, if it has any.
- `toolsFor` / `moduleOf` in `src/core/tools/registry.ts`: Asset Review is available when **either** `art` or `maps`
  is installed. In a maps-only install it lists maps only.
- The Analytics panel shows the Generators table.

## 12. Not in R5

- Custom map inks and fonts in the map direction (the renderers take named themes only).
- Pull request review of maps (`pr prepare` and `pr parse` stay asset-only). The ledger entries take `via: 'pr'`
  already, so this can follow without a format change.
- Region pins drawn on map renders in Asset Review (the region is stored when given, but not drawn).
- Art assets as a `Subject` (their stage graph comes in R6, and they may join the interface then).

## 13. What must stay unchanged (guards)

- Bench golden hashes, consumer fixtures (`npm run consumers` after `node packages/artgen-dist/build.mjs --no-ui`) and
  every existing test's expectations. An expectation is never edited to make it pass, except where a test lists the
  CLI help, the MCP tool list, `OPERATIONS.md`, the generated Python or a bundle's allowed-files list. There the new
  operations are **added** to what is recorded, and nothing recorded before changes.
- The transcripts (`transcript.test.ts`): only the usage lines of the new commands may be added. Every recorded
  command's output stays the same.
- Art ledger semantics: no existing entry type changes shape. Art status, analytics and metrics give the same numbers
  on ledgers with no map entries.
- Bundle sizes: say in the summary how much `artgen.js`, `artgen-mcp.js` and `artgen-maps.js` grow. The maps bundle
  must not pull in `yaml` or the pixel pipeline.
- `npm run check`, `npm test`, `npm run check:packages`, `npm run test:packages`, `npm run lint:boundaries -- --strict`,
  `npm run build`, and the Python tests (`pip install -e 'python/artgen[test]' && python -m pytest python/artgen -q`,
  if Python is available).

## 14. Docs to update

- `docs/TOOLING-PLAN.md`: the status line, and a **Built** list under R5 (as R1–R4 have), including what wasn't
  done or wasn't run.
- `docs/OPERATIONS.md` (generated), `docs/metrics/README.md` (schema 2, generators).
- The map skills (`packages/artgen-dist/content/maps/skills/*/SKILL.md`) and `content/maps/claude-md.md`: the
  workflow steps (brief → generate and edit → `version` → `review` → show the user → `approve` or `feedback`), with
  the rule that only the user approves. The art skill's review section mentions `refs` and `artgen sheet`.
- This file: the status line, and a short §15 "What was built", with any place the build differs from this design.

## 15. What was built

Everything in §3 to §11 is built as written, with the differences below. The tooling plan's R5 section lists what was measured and what
was not run.

**Package and moves (§3).** `artgen-workflow` has the files the design lists, and two more: `decide.ts` (the approval and feedback
rules as ledger entries, one function each, so the CLI, MCP and the web engine give the same entries and the same messages) and
`brief.ts` (the map brief's front matter, parsed by hand, and `subjectDataSheet`, which adds the version, the theme, the brief's
title, references and notes to an engine's sheet). `qa/ledger.ts`, `w2/status.ts` and `w2/analytics.ts` stay in `artgen-core` as one-line
re-exports, because tests, `recommend.ts` and `scripts/metrics-baseline.mjs` import them by path. `Metrics` is a `type` alias now so it
is assignable to `Record<string, number>`; `StepLike` has an index signature so the tests' step literals (which carry `pass`) fit it.
`artgen-core/maps` (the maps-only facade) also re-exports `artgen-workflow`, and `artgen-mapgen` exports `subjects`, `mapDirection`,
`decodePNG` and `Grid` for the maps CLI.

**Subjects (§4).** Check ids: a format error is one `format` check each (`fail`), a clean file one `format` check that passes; each lint
finding is one `lint` check (`fail` for an error, `flag` for a warning), because findings carry no rule name, so `lint:<rule>` is not used;
each requirement is `require:<id>`; an underlay map that is missing is `underlay`; symbols outside the direction's set are `symbols`
(`flag`). `checkMapFile`, `checkDungeonFile` and `checkSettlementFile` are unchanged; a test holds the subjects to their verdict on every
fixture case (the same errors, unmet requirements and warnings).

**Map direction (§7.4).** A dungeon is drawn in black and white only, so its only theme name is `bw` (`--theme dungeon=color` is refused).
Only a **locked** direction applies: a draft changes nothing. Changing a locked direction makes it a draft again (same version) until
`--lock`, which moves the version up. The first lock gives v1, so the file starts at version 0. A theme that is given again for a kind
replaces it; `--symbols dungeon=` (an empty list) clears a kind's set.

**Operations (§10).** 26 new operations (eight for each kind, `map.direction`, and the art `sheet`), all on the CLI, MCP and Python.
Versions are recorded `by: 'agent'` (there is no flag to say otherwise). `review --score` logs the score for the version it has just reviewed;
a review sheet is written even when a check fails (`pass: false`), so the user can see why. `status` rows carry the number of failing and
flagged checks, computed fresh. `brief add` has no `--refs` flag: `refs:` is written in `briefs.yaml` (the design adds the field and its
validation only). A blind review of an asset has no references (it is the version alone).

**Metrics (§9).** `generatorMetrics` counts a map as `final` when it has an approval or its status without the working file is final
(a version waits for the user). `imageTokens` is the sum over `review` entries. The Generators table of `analytics` (CLI and web) appears
once the ledger holds an entry of a map, dungeon or settlement, so art-only repos read exactly as before: the recorded CLI transcript
shows `analytics` for a project that has maps but no map work in its ledger. `metrics export` writes schema 2; in a repo with the art module
its art fields are the ones schema 1 had. Pooling a schema 1 export and a schema 2 export of the same version works; the pooled
markdown for the three example exports is unchanged.

**Web (§11).** `ArtProject.status()` returns no rows when no art direction is locked (it used to throw), `analytics()` works without one,
and `subjects()` lists the maps either way. With nothing to list, the page says what makes assets and maps appear. A dungeon's `underlay` is not drawn in Asset Review (the web renderer for dungeons takes no
underlay map); a settlement's is. The approval notice does not repeat the warnings the entry carries. The engine's subject code
is checked against the CLI's on the same files (`src/core/project/engine.test.ts`).

**Recorded lists that changed.** Where a test lists the CLI help, the MCP tools or a bundle's files, the new words were added. Four
changes were not additions, and each follows from the design: `metrics_export` moved after the maps tools in the MCP tool list
(it is a `core` operation now, and the registry orders art, maps, core); the loop tests pass the art numbers in (`art: artMetricsOf`) and
expect schema 2; the web tool registry test lists Asset Review for a maps-only install; the `libs` test lists `artgen-workflow` and
its dependency on primitives, and mapgen's on both.

**Approving again after a direction change (§6, §7.2).** A map approved and then made `stale` by a new map direction alone has an
unchanged file, so no new version can be recorded. `isApprovable` lets the user approve the same version again under the new direction;
a map edited since its approval still needs a new version. Rows carry `approvable`, which the page uses for its Approve button.

**Acceptance.** `npm run accept:ui` (headless Chromium) records a map's v1 with `artgen-maps.js` in a maps-only repo, opens it in Asset
Review, waits for its render, approves it there, and checks that `map status` shows it approved with `"via": "image-tools"`. It passes.

**Not done or not run.** Firefox (not installed where this was built), a review on a real machine, and the first real use in a game repo. The pull request flow
for maps (§12) and region pins on map renders (§12) are not built, as designed.
