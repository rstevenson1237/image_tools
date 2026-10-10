#!/usr/bin/env node
// P7 release acceptance, end to end on this machine: "tagging a release and running `update` in a fixture repo moves
// it to the new version with local edits preserved".
//
//   npm run build -w artgen-dist && node scripts/artgen-release-acceptance.mjs [--fixture swamp-topdown] [--keep]
//
// 1. A scratch git repo stands in for GitHub: a bare remote, and a clone that publishes with the same script the
//    workflows use (scripts/artgen-publish-dist.sh): the current build as release A, tagged artgen-dist-v<A>.
// 2. A copy of a fixture game is installed from that tag through npx (`npx -y git+file://…#artgen-dist-v<A> init`),
//    committed, and given local edits: the art-reviewer agent and the managed CLAUDE.md section.
// 3. Release B: the next patch version (one skill changed, one command dropped), published and tagged.
// 4. `npx -y git+file://…#artgen-dist-v<B> update` in the game: VERSION moves to B, the changed skill is replaced,
//    the dropped command removed, both local edits kept; `status` lists them.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..'), out = join(root, 'packages/artgen-dist/out');
const fixture = process.argv.includes('--fixture') ? process.argv[process.argv.indexOf('--fixture') + 1] : 'swamp-topdown';
if (!existsSync(join(out, 'install.mjs'))) throw new Error('build the distribution first: npm run build -w artgen-dist');
const tmp = mkdtempSync(join(tmpdir(), 'artgen-release-')), remote = join(tmp, 'remote.git'), pub = join(tmp, 'publisher'), game = join(tmp, 'game');
const sh = (cmd, args, cwd, env = {}) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} (in ${cwd}) exited ${r.status}\n${r.stdout}\n${r.stderr}`);
  return r.stdout.trim();
};
const git = (cwd, ...a) => sh('git', ['-c', 'user.name=release-test', '-c', 'user.email=release-test@example.com', ...a], cwd);
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) process.exitCode = 1; };

// 1. remote + publisher clone (the script runs `git worktree` in the repo it is called from)
sh('git', ['init', '-q', '--bare', remote], tmp);
sh('git', ['init', '-q', pub], tmp);
git(pub, 'commit', '-q', '--allow-empty', '-m', 'main');
git(pub, 'remote', 'add', 'origin', remote);
// like GitHub, the remote has a default branch (npm resolves git refs against HEAD)
git(pub, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
sh('git', ['--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main'], tmp);
const A = readFileSync(join(out, 'dist/tools/artgen/VERSION'), 'utf8').trim();
const publish = (dir, tag) => sh(join(root, 'scripts/artgen-publish-dist.sh'), [dir, tag], pub, { GIT_AUTHOR_NAME: 'release-test', GIT_AUTHOR_EMAIL: 'r@example.com', GIT_COMMITTER_NAME: 'release-test', GIT_COMMITTER_EMAIL: 'r@example.com' });
console.log(publish(out, `artgen-dist-v${A}`));

// 2. a fixture game repo, installed from the release tag through npx
cpSync(join(root, 'examples', fixture), game, { recursive: true, filter: f => !/[\\/](node_modules|tools|\.claude)([\\/]|$)/.test(f.slice(join(root, 'examples', fixture).length)) });
for (const f of ['CLAUDE.md', '.mcp.json']) rmSync(join(game, f), { force: true });
git(tmp, 'init', '-q', game);
const npx = (ref, ...a) => sh('npx', ['-y', `git+file://${remote}#${ref}`, ...a], game, { npm_config_cache: join(tmp, 'npm-cache') });
console.log(npx(`artgen-dist-v${A}`, 'init').split('\n').slice(0, 2).join('\n'));
check(readFileSync(join(game, 'tools/artgen/VERSION'), 'utf8').trim() === A, `init from tag artgen-dist-v${A} installs ${A}`);
git(game, 'add', '-A'); git(game, 'commit', '-qm', `artgen ${A}`);
writeFileSync(join(game, '.claude/agents/art-reviewer.md'), readFileSync(join(game, '.claude/agents/art-reviewer.md'), 'utf8') + '\nHouse rule: never score above 8 without a blind re-score.\n');
writeFileSync(join(game, 'CLAUDE.md'), readFileSync(join(game, 'CLAUDE.md'), 'utf8').replace('## Art pipeline (artgen)', '## Art pipeline (artgen) — edited by the team'));

// 3. release B: next patch, one skill changed, one command dropped
const [ma, mi, pa] = A.split('.').map(Number), B = `${ma}.${mi}.${pa + 1}`, outB = join(tmp, 'out-b');
cpSync(out, outB, { recursive: true });
writeFileSync(join(outB, 'dist/tools/artgen/VERSION'), B + '\n');
for (const f of ['package.json', 'dist/tools/artgen/package.json']) writeFileSync(join(outB, f), readFileSync(join(outB, f), 'utf8').replace(`"version": "${A}"`, `"version": "${B}"`));
writeFileSync(join(outB, 'dist/claude/skills/artgen/SKILL.md'), readFileSync(join(outB, 'dist/claude/skills/artgen/SKILL.md'), 'utf8') + `\n<!-- changed in ${B} -->\n`);
rmSync(join(outB, 'dist/claude/commands/artgen-restyle.md'));
console.log(publish(outB, `artgen-dist-v${B}`));
check(git(pub, 'ls-remote', '--tags', 'origin').includes(`refs/tags/artgen-dist-v${B}`), `tag artgen-dist-v${B} on the remote`);
const again = spawnSync(join(root, 'scripts/artgen-publish-dist.sh'), [outB, `artgen-dist-v${B}`], { cwd: pub, encoding: 'utf8' });
check(again.status !== 0 && /immutable/.test(again.stderr), 'an existing release tag is never moved');

// 4. update in the game from release B
const up = npx(`artgen-dist-v${B}`, 'update');
console.log(up);
check(readFileSync(join(game, 'tools/artgen/VERSION'), 'utf8').trim() === B, `update moves the game to ${B}`);
check(up.includes(`${A} → ${B}`), 'the version change is shown');
check(readFileSync(join(game, '.claude/skills/artgen/SKILL.md'), 'utf8').includes(`changed in ${B}`), 'an untouched file is replaced');
check(!existsSync(join(game, '.claude/commands/artgen-restyle.md')), 'a file the new release dropped is removed');
check(readFileSync(join(game, '.claude/agents/art-reviewer.md'), 'utf8').includes('House rule'), 'a locally edited agent is kept');
check(readFileSync(join(game, 'CLAUDE.md'), 'utf8').includes('edited by the team'), 'an edited CLAUDE.md section is kept');
const st = npx(`artgen-dist-v${B}`, 'status');
check(/installed: .*\n.*available: /.test(st) && st.includes('.claude/agents/art-reviewer.md'), '`status` lists the local edits');
check(existsSync(join(game, 'art/direction.json')) && git(game, 'status', '--porcelain', 'art').length === 0, 'art/ is untouched by update');
console.log(process.exitCode ? 'release acceptance FAILED' : `release acceptance passed (${A} → ${B}, fixture ${fixture})`);
if (!process.argv.includes('--keep')) rmSync(tmp, { recursive: true, force: true }); else console.log(`kept ${tmp}`);

