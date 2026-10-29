#!/usr/bin/env node
// P7 release acceptance, end to end on this machine: "tagging a release and running `update` in a fixture repo moves
// it to the new version with local edits preserved". Run for both installer module sets (R3): the full install (core, art and
// maps, in a fixture game repo) and a maps-only one (core and maps, in a repo with nothing else), where the maps module's own
// version line moves on its own and no art file ever appears.
//
//   npm run build -w artgen-dist && node scripts/artgen-release-acceptance.mjs [--fixture swamp-topdown] [--only full|maps] [--keep]
//
// 1. A scratch git repo stands in for GitHub: a bare remote, and a clone that publishes with the same script the
//    workflows use (scripts/artgen-publish-dist.sh): the current build as release A, tagged artgen-dist-v<A>.
// 2. A game repo is installed from that tag through npx (`npx -y git+file://…#artgen-dist-v<A> init [--with maps]`),
//    committed, and given local edits: an agent or skill and the managed CLAUDE.md section.
// 3. Release B: the next patch version (one skill changed, one command dropped; for maps-only the maps module moves to its
//    own next patch), published and tagged.
// 4. `npx -y git+file://…#artgen-dist-v<B> update` in the game: VERSION moves to B, the changed skill is replaced,
//    the dropped command removed, both local edits kept; `status` lists them; the module versions follow their own lines.
// 5. The update workflow (the `update-pr` module's artgen-update.yml): its steps run as written, in a clone of the game with a
//    bare repository as `origin` and a stand-in `gh`, against release B: a branch artgen-update-<B> is pushed and a pull request
//    opened whose description holds the changelog since A and the kept files; run again when the pull request exists it edits
//    it; when the game is current it opens nothing. (GitHub itself is not involved: the workflow's shell is the code under test.)
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { parse: parseYaml } = createRequire(import.meta.url)('yaml');
const root = join(import.meta.dirname, '..'), out = join(root, 'packages/artgen-dist/out');
const arg = (name, dflt) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : dflt);
const fixture = arg('--fixture', 'swamp-topdown'), only = arg('--only');
if (!existsSync(join(out, 'install.mjs'))) throw new Error('build the distribution first: npm run build -w artgen-dist');
const sh = (cmd, args, cwd, env = {}) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} (in ${cwd}) exited ${r.status}\n${r.stdout}\n${r.stderr}`);
  return r.stdout.trim();
};
const git = (cwd, ...a) => sh('git', ['-c', 'user.name=release-test', '-c', 'user.email=release-test@example.com', ...a], cwd);
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) process.exitCode = 1; };
const bump = v => { const [ma, mi, pa] = v.split('.').map(Number); return `${ma}.${mi}.${pa + 1}`; };

/** What each module set installs, edits, changes and drops. */
const SETS = {
  full: {
    label: 'full install (core, art, maps, update-pr) in a fixture game', init: ['--with', 'art,maps,update-pr'], skill: '.claude/skills/artgen/SKILL.md', dropped: '.claude/commands/artgen-restyle.md',
    edited: '.claude/agents/art-reviewer.md', editedText: '\nHouse rule: never score above 8 without a blind re-score.\n', present: ['tools/artgen/artgen.js', 'tools/artgen/artgen-maps.js'], absent: [],
  },
  maps: {
    label: 'maps-only install (core, maps, update-pr) in an empty repo', init: ['--with', 'maps,update-pr'], skill: '.claude/skills/terrain-map/SKILL.md', dropped: '.claude/commands/artgen-dungeon.md',
    edited: '.claude/skills/dungeon-map/SKILL.md', editedText: '\nHouse rule: every dungeon gets a wandering monster table.\n', present: ['tools/artgen/artgen-maps.js'],
    absent: ['tools/artgen/artgen.js', 'tools/artgen/artgen-mcp.js', '.claude/skills/artgen', '.claude/agents', '.claude/commands/artgen-make.md', '.mcp.json'],
  },
};

/** Run the steps of the installed artgen-update.yml as written, in a clone of `game`, against release B. */
function rehearseWorkflow({ tmp, game, remote, A, B, set }) {
  const wf = parseYaml(readFileSync(join(game, '.github/workflows/artgen-update.yml'), 'utf8'));
  check(!!wf.on.schedule?.length && 'workflow_dispatch' in wf.on, 'the workflow runs on a schedule and on demand');
  const job = Object.values(wf.jobs)[0], step = id => job.steps.find(s => s.id === id || s.name === id);
  const originDir = join(tmp, 'game-origin.git'), clone0 = join(tmp, 'game-ci'), bin = join(tmp, 'bin'), ghLog = join(tmp, 'gh.log'), runner = join(tmp, 'runner');
  sh('git', ['init', '-q', '--bare', originDir], tmp);
  git(game, 'remote', 'add', 'origin', originDir);
  git(game, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  sh('git', ['--git-dir', originDir, 'symbolic-ref', 'HEAD', 'refs/heads/main'], tmp);
  let clone = clone0;
  sh('git', ['clone', '-q', originDir, clone], tmp);
  mkdirSync(bin); mkdirSync(runner);
  // a stand-in for `gh`: records the call; `pr list` answers with the pull request number in $FAKE_PR (nothing when it is unset)
  writeFileSync(join(bin, 'gh'), `#!/bin/sh\necho "gh $*" >> "${ghLog}"\nif [ "$1 $2" = "pr list" ]; then echo "$FAKE_PR"; fi\n`, { mode: 0o755 });
  let outputs = '';
  const run = (name, { pr = '', versionOutput } = {}) => {
    const s = step(name);
    const script = s.run.replace(/\$\{\{ steps\.update\.outputs\.version \}\}/g, versionOutput ?? '');
    const output = join(runner, 'output');
    writeFileSync(output, '');
    const env = {
      ...process.env, ...Object.fromEntries(Object.entries(job.env ?? {}).map(([k, v]) => [k, String(v).replace(/\$\{\{.*\}\}/, 'x')])),
      ARTGEN_SOURCE: `git+file://${remote}#artgen-dist-v${B}`, RUNNER_TEMP: runner, GITHUB_OUTPUT: output, FAKE_PR: pr, npm_config_cache: join(tmp, 'npm-cache'),
      PATH: `${bin}:${process.env.PATH}`, GIT_CONFIG_GLOBAL: '/dev/null',
    };
    const r = spawnSync('bash', ['-c', script], { cwd: clone, encoding: 'utf8', env });
    if (r.status !== 0) throw new Error(`workflow step "${name}" exited ${r.status}\n${r.stdout}\n${r.stderr}`);
    outputs = readFileSync(output, 'utf8');
    return outputs;
  };
  const gh = () => (existsSync(ghLog) ? readFileSync(ghLog, 'utf8') : '');
  const update = run('update');
  check(/changed=true/.test(update) && update.includes(`version=${B}`), `the update step finds release ${B} and reports a change`);
  check(git(clone, 'status', '--porcelain').length > 0 && readFileSync(join(clone, 'tools/artgen/VERSION'), 'utf8').trim() === B, 'the clone is updated and uncommitted');
  run('Open the pull request', { versionOutput: B });
  check(git(clone, 'rev-parse', '--abbrev-ref', 'HEAD') === `artgen-update-${B}`, `the work is on the branch artgen-update-${B}`);
  check(sh('git', ['--git-dir', originDir, 'branch', '--list', `artgen-update-${B}`], tmp).includes(`artgen-update-${B}`), 'the branch is pushed to origin');
  check(git(clone, 'log', '-1', '--format=%s') === `artgen ${B}`, 'one commit, "artgen <version>"');
  check(sh('git', ['--git-dir', originDir, 'show', `artgen-update-${B}:tools/artgen/VERSION`], tmp) === B, 'the pushed branch carries the new version');
  check(sh('git', ['--git-dir', originDir, 'show', `artgen-update-${B}:${set.edited}`], tmp).includes('House rule'), 'the pushed branch keeps the local edit');
  const create = gh().split('\n').find(l => l.startsWith('gh pr create'));
  check(!!create && create.includes(`--head artgen-update-${B}`) && create.includes(`--title artgen ${B}`) && create.includes('--body-file'), 'a pull request is opened for the branch');
  const notes = readFileSync(join(runner, 'artgen-notes.md'), 'utf8');
  check(notes.startsWith(`artgen ${A} → ${B}`) && notes.includes(`the new thing in ${B}`) && !notes.includes('Settlement maps') && notes.includes(set.edited), 'its description has the version change, the changelog since the installed version and the kept files');
  // the next run (a fresh checkout, as on GitHub), the pull request open: edited, not opened again
  clone = join(tmp, 'game-ci-next');
  sh('git', ['clone', '-q', '--branch', 'main', originDir, clone], tmp);
  writeFileSync(ghLog, '');
  run('update');
  run('Open the pull request', { pr: '7', versionOutput: B });
  check(/gh pr edit 7 /.test(gh()) && !/gh pr create/.test(gh()), 'with the pull request open, it is edited and not opened again');
  // a game that is current opens nothing
  const current = join(tmp, 'game-current');
  sh('git', ['clone', '-q', originDir, current], tmp);
  git(current, 'checkout', '-q', `artgen-update-${B}`);
  const cur = spawnSync('bash', ['-c', step('update').run], { cwd: current, encoding: 'utf8', env: { ...process.env, ARTGEN_SOURCE: `git+file://${remote}#artgen-dist-v${B}`, RUNNER_TEMP: runner, GITHUB_OUTPUT: join(runner, 'output2'), npm_config_cache: join(tmp, 'npm-cache') } });
  check(cur.status === 0 && /changed=false/.test(readFileSync(join(runner, 'output2'), 'utf8')) && /is current/.test(cur.stdout), 'a game that is already current changes nothing and opens no pull request');
}

function accept(name, set) {
  console.log(`\n== ${set.label}`);
  const tmp = mkdtempSync(join(tmpdir(), `artgen-release-${name}-`)), remote = join(tmp, 'remote.git'), pub = join(tmp, 'publisher'), game = join(tmp, 'game');
  // 1. remote + publisher clone (the script runs `git worktree` in the repo it is called from)
  sh('git', ['init', '-q', '--bare', remote], tmp);
  sh('git', ['init', '-q', pub], tmp);
  // tracked files, like the CI checkout of main: the first publish starts an orphan branch with them still staged
  writeFileSync(join(pub, 'README.md'), 'main\n');
  git(pub, 'add', 'README.md');
  git(pub, 'commit', '-q', '-m', 'main');
  git(pub, 'remote', 'add', 'origin', remote);
  // like GitHub, the remote has a default branch (npm resolves git refs against HEAD)
  git(pub, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  sh('git', ['--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main'], tmp);
  const A = readFileSync(join(out, 'dist/tools/artgen/VERSION'), 'utf8').trim();
  const idxA = JSON.parse(readFileSync(join(out, 'dist/modules.json'), 'utf8')), mapsA = idxA.modules.maps.version;
  const publish = (dir, tag) => sh(join(root, 'scripts/artgen-publish-dist.sh'), [dir, tag], pub, { GIT_AUTHOR_NAME: 'release-test', GIT_AUTHOR_EMAIL: 'r@example.com', GIT_COMMITTER_NAME: 'release-test', GIT_COMMITTER_EMAIL: 'r@example.com' });
  console.log(publish(out, `artgen-dist-v${A}`));

  // 2. a game repo, installed from the release tag through npx
  if (name === 'full') {
    cpSync(join(root, 'examples', fixture), game, { recursive: true, filter: f => !/[\\/](node_modules|tools|\.claude)([\\/]|$)/.test(f.slice(join(root, 'examples', fixture).length)) });
    for (const f of ['CLAUDE.md', '.mcp.json']) rmSync(join(game, f), { force: true });
  } else mkdirSync(game);
  git(tmp, 'init', '-q', game);
  const npx = (ref, ...a) => sh('npx', ['-y', `git+file://${remote}#${ref}`, ...a], game, { npm_config_cache: join(tmp, 'npm-cache') });
  console.log(npx(`artgen-dist-v${A}`, 'init', ...set.init).split('\n').slice(0, 3).join('\n'));
  check(readFileSync(join(game, 'tools/artgen/VERSION'), 'utf8').trim() === A, `init from tag artgen-dist-v${A} installs ${A}`);
  const manifest = () => JSON.parse(readFileSync(join(game, 'tools/artgen/MANIFEST.json'), 'utf8'));
  check(Object.keys(manifest().modules).join() === (name === 'full' ? 'core,art,maps,update-pr' : 'core,maps,update-pr'), `the manifest records the modules (${Object.keys(manifest().modules).join(', ')})`);
  check(set.present.every(f => existsSync(join(game, f))) && set.absent.every(f => !existsSync(join(game, f))), 'the install holds its modules\' files and none of the others\'');
  git(game, 'add', '-A'); git(game, 'commit', '-qm', `artgen ${A}`);
  writeFileSync(join(game, set.edited), readFileSync(join(game, set.edited), 'utf8') + set.editedText);
  writeFileSync(join(game, 'CLAUDE.md'), readFileSync(join(game, 'CLAUDE.md'), 'utf8').replace(/^## (Art pipeline|Tabletop maps) \(artgen\)/m, '## $1 (artgen) — edited by the team'));

  // 3. release B: next patch, one skill changed, one command dropped; the maps module moves along its own version line
  const B = bump(A), mapsB = bump(bump(mapsA)), outB = join(tmp, 'out-b');
  cpSync(out, outB, { recursive: true });
  writeFileSync(join(outB, 'dist/tools/artgen/VERSION'), B + '\n');
  for (const f of ['package.json', 'dist/tools/artgen/package.json']) writeFileSync(join(outB, f), readFileSync(join(outB, f), 'utf8').replace(`"version": "${A}"`, `"version": "${B}"`));
  const rel = f => f.replace(/^\.claude\//, 'claude/');
  const idxB = JSON.parse(readFileSync(join(outB, 'dist/modules.json'), 'utf8'));
  idxB.release = B;
  for (const [n, m] of Object.entries(idxB.modules)) { m.version = n === 'maps' ? mapsB : B; m.files = m.files.filter(f => f !== rel(set.dropped)); }
  writeFileSync(join(outB, 'dist/modules.json'), JSON.stringify(idxB, null, 2) + '\n');
  writeFileSync(join(outB, 'dist', rel(set.skill)), readFileSync(join(outB, 'dist', rel(set.skill)), 'utf8') + `\n<!-- changed in ${B} -->\n`);
  rmSync(join(outB, 'dist', rel(set.dropped)));
  writeFileSync(join(outB, 'CHANGELOG.md'), `# artgen changelog\n\n## ${B} — 2030-01-01\n\n- the new thing in ${B}\n\n${readFileSync(join(out, 'CHANGELOG.md'), 'utf8').replace(/^# artgen changelog\n\n/, '')}`);
  console.log(publish(outB, `artgen-dist-v${B}`));
  check(git(pub, 'ls-remote', '--tags', 'origin').includes(`refs/tags/artgen-dist-v${B}`), `tag artgen-dist-v${B} on the remote`);
  // from the same commit a repeat is a release run run again (it does nothing); from another commit the tag is never moved
  const again = () => spawnSync(join(root, 'scripts/artgen-publish-dist.sh'), [outB, `artgen-dist-v${B}`], { cwd: pub, encoding: 'utf8' });
  check(again().status === 0, 'publishing a release again from the commit it was made from does nothing');
  git(pub, 'commit', '-q', '--allow-empty', '-m', 'a later commit of main');
  const later = again();
  check(later.status !== 0 && /immutable/.test(later.stderr), 'an existing release tag is never moved');

  // 5 (first, while the game is still on A). the scheduled workflow, from a clone of the committed game
  git(game, 'add', '-A'); git(game, 'commit', '-qm', 'local edits');
  rehearseWorkflow({ tmp, game, remote, A, B, set });

  // 4. update in the game from release B
  const up = npx(`artgen-dist-v${B}`, 'update');
  console.log(up);
  check(readFileSync(join(game, 'tools/artgen/VERSION'), 'utf8').trim() === B, `update moves the game to ${B}`);
  check(up.includes(`${A} → ${B}`), 'the version change is shown');
  check(manifest().modules.core === B && manifest().modules.maps === mapsB, `the modules follow their own version lines (core ${B}, maps ${mapsB})`);
  check(Object.keys(manifest().modules).join() === Object.keys(idxA.modules).filter(n => n in manifest().modules).join(), 'update adds no module that was not installed');
  check(readFileSync(join(game, set.skill), 'utf8').includes(`changed in ${B}`), 'an untouched file is replaced');
  check(!existsSync(join(game, set.dropped)), 'a file the new release dropped is removed');
  check(readFileSync(join(game, set.edited), 'utf8').includes('House rule'), 'a locally edited skill or agent is kept');
  check(readFileSync(join(game, 'CLAUDE.md'), 'utf8').includes('edited by the team'), 'an edited CLAUDE.md section is kept');
  check(set.absent.every(f => !existsSync(join(game, f))), 'no file of a module that was not installed appears');
  const st = npx(`artgen-dist-v${B}`, 'status');
  check(/installed: .*\n.*available: /.test(st) && st.includes(set.edited), '`status` lists the local edits');
  check(existsSync(join(game, 'art/artgen.config.json')) && git(game, 'status', '--porcelain', 'art').length === 0, 'art/ is untouched by update');
  console.log(`release acceptance (${name}) ${process.exitCode ? 'FAILED' : `passed (${A} → ${B}${name === 'maps' ? `, maps ${mapsA} → ${mapsB}` : ''})`}`);
  if (!process.argv.includes('--keep')) rmSync(tmp, { recursive: true, force: true }); else console.log(`kept ${tmp}`);
}

for (const [name, set] of Object.entries(SETS)) if (!only || only === name) accept(name, set);
console.log(process.exitCode ? '\nrelease acceptance FAILED' : '\nrelease acceptance passed');
