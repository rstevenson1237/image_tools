/**
 * Pass state machine (SPEC §6.3, R1, R12; D12): v1 → v2 → v3 (each reviewed and scored) → finishing pass on the
 * best-scoring base (always, or with `finish: auto` only when the review names a finish-level problem or the base clears
 * the bar) → blind re-score by a fresh reviewer (rev 9, when `blind` is set) → ready for the user. The final is the best
 * version, not the newest: gate-passing first, then the best blind score, else the best own score; a version the user
 * approved stays final until something newer is written. Pure logic over the files present and the ledger; the CLI
 * does the I/O.
 */
import type { LedgerEntry } from './qa/ledger.ts';
import { stageState, stageVerdicts, type GateStage, type StageKeys } from 'artgen-workflow/stages.ts';

export interface Version { name: string; kind: 'base' | 'finish'; n: number }

/** `base.v3` → { kind: 'base', n: 3 }; also accepts file names (`base.v3.js`). */
export function parseVersion(s: string): Version | null {
  const m = s.match(/^(base|finish)\.v(\d+)(?:\.js)?$/);
  return m ? { name: `${m[1]}.v${m[2]}`, kind: m[1] as 'base' | 'finish', n: +m[2] } : null;
}

/**
 * Ledger pass id for a version: base.v1..vN → r1..rN, finish.v1 → f, later finishes → f2...
 * Bases after vN are user iterations (`u1..`). When `user` (the versions opened by user feedback) is given, the
 * other bases after vN are extra autonomous revisions (`x1..`, D19) and only the listed ones are `u`.
 */
export function passId(version: string, revisionPasses: number, user?: string[]): string {
  const v = parseVersion(version);
  if (!v) throw new Error(`not a pipeline version: ${version}`);
  if (v.kind === 'finish') return v.n === 1 ? 'f' : `f${v.n}`;
  if (v.n <= revisionPasses) return `r${v.n}`;
  if (!user) return `u${v.n - revisionPasses}`;
  const ub = user.map(parseVersion).filter((u): u is Version => !!u && u.kind === 'base').map(u => u.n).sort((a, b) => a - b);
  const k = ub.indexOf(v.n);
  return k >= 0 ? `u${k + 1}` : `x${v.n - revisionPasses - ub.filter(n => n < v.n).length}`;
}

export type NextStep =
  | { action: 'write-base'; version: string; pass: string; from?: string; why: string }
  | { action: 'review'; version: string; pass: string; why: string }
  | { action: 'write-finish'; version: string; pass: string; base: string; why: string }
  /** A fresh reviewer scores a version from a blind sheet (the version alone: no earlier versions, scores or notes). */
  | { action: 'blind-review'; version: string; pass: 'b'; why: string }
  /** A stage gate (docs/STAGES.md §5.4): the user approves or rejects the stage's result before the pipeline goes on. */
  | { action: 'stage-gate'; stage: GateStage; version?: string; pass: 'g'; key?: string; why: string }
  | {
      action: 'ready'; final: string; best: string; why: string;
      /** Failing gate checks and blind-score issues on the final (listed when it is marked final). */
      issues: string[];
      /** The highest own score of any version, when it is not the final (it lost on the gate or its blind score). */
      top?: { version: string; score: number };
    };

export interface PassRow { version: string; pass: string; score?: number; gate?: boolean; base?: string }

/**
 * Feedback that opened a version (`route: base` → a new base, `finish` → a finish revision), with what was said. `by:
 * user` (default) is the user — typed in Claude Code, or written by the image tools (a note pinned to a region of one
 * cell) — and opens a U-stage iteration; `by: agent` is the agent acting on a roster note (`feedback --by roster`), an
 * extra autonomous revision (`x`) that the user never asked for.
 */
export interface FeedbackOpen { route: 'base' | 'finish'; opens: string; /** The final it was given on. */ on?: string; note?: string; region?: number[]; cell?: string; by?: 'user' | 'agent'; source?: string }

/** The feedback's words for a step's `why`: ` — user: "…" (region x,y,w,h of idle/s/0)`, or ` — roster: "…"`. */
const userWords = (f: FeedbackOpen): string => {
  if (!f.note) return '';
  const where = f.region ? ` (region x,y,w,h ${f.region.join(',')}${f.cell ? ` of ${f.cell}` : ''})` : f.cell ? ` (${f.cell})` : '';
  return ` — ${f.by === 'agent' ? f.source ?? 'agent' : 'user'}: "${f.note}"${where}`;
};

/** Words in a review note that name a finish-level problem: what a direct-pixel pass fixes and a base revision doesn't. */
const FINISH_WORDS = /\b(outlines?|line weight|lines? (?:too )?(?:thick|thin|heavy|broken)|band(?:s|ing)?|clusters?|jagg(?:y|ies)|stair[- ]?steps?|orphans?|stray pixels?|speckles?|pillow(?:ed|ing)?|anti-?alias(?:ing|ed)?|aa|selout|rim ?light)\b/i;

/**
 * Should the finishing pass run on this base (`review.finish: auto`)? In the first production run the finish lost
 * more often than it gained, so it runs only when the review note names a finish-level problem (outline, banding,
 * clusters, jaggies, pillow shading, stray pixels…) or when the base already clears the approval bar and only polish is left.
 */
export function wantsFinish(note: string | undefined, score: number, approveMin: number): boolean {
  return score >= approveMin || (!!note && FINISH_WORDS.test(note));
}

export interface PassState {
  asset: string;
  rows: PassRow[];
  /** Best-scoring base version so far (R12). */
  best?: { version: string; score: number };
  next: NextStep;
}

export interface PlanInput {
  asset: string;
  /** Version names present (`base.v1`, `finish.v1`, …). */
  versions: string[];
  /** Ledger entries for this asset (score entries carry `version` + `score`). */
  ledger: LedgerEntry[];
  revisionPasses: number;
  finishPass: boolean;
  /** Base each finish version is bound to. */
  finishBase?: Record<string, string>;
  /** Extra autonomous revisions allowed when the final still fails the gate (D19 budget). */
  extraRevisions?: number;
  /**
   * User feedback in ledger order. When given (even empty), bases after vN that no feedback opened are extra
   * autonomous revisions (`x1..`); when absent, every base after vN counts as a user iteration (P1b behaviour).
   */
  feedback?: FeedbackOpen[];
  /**
   * Blind re-score (rev 9): the final must also be scored blind (`score --blind`) before it is ready. A blind score under
   * `minScore`, or more than `maxGap` below the final's own score, is an open issue and — while the extra autonomous
   * revision budget lasts — starts one. Finals the user already approved are not asked for one.
   */
  blind?: { minScore: number; maxGap: number };
  /**
   * Finishing pass policy (`review.finish` in artgen.config.json): `always` finishes the base the final comes from;
   * `auto` only when its review note names a finish-level problem or it scores at least `approveMin` (`wantsFinish`).
   * Omitted = `always`. The direction's `finishPass: false` turns it off whatever this says.
   */
  finish?: 'auto' | 'always' | 'never';
  /** The approval bar for `finish: auto` (defaults to the blind `minScore`, else 6.5). */
  approveMin?: number;
  /** Extra autonomous revisions for a blind re-score that disagrees, on top of `extraRevisions` (`review.blindRevisions`). */
  blindRevisions?: number;
  /** Stage gates of this asset (`gatesFor`). Absent or empty: the pass machine behaves exactly as without stages. */
  gates?: GateStage[];
  /** Stage keys per version name, as recorded on score entries (missing = unknown). */
  stageKeys?: Record<string, StageKeys>;
  /** Key of the current placeholder (the file, else the defaults). */
  placeholderKey?: string;
}

/** Latest blind score per version (`score --blind` records). */
export function blindScores(ledger: LedgerEntry[]): Map<string, { score: number; note?: string; reviewer?: string }> {
  const m = new Map<string, { score: number; note?: string; reviewer?: string }>();
  for (const e of ledger) if (e.type === 'score' && e.blind && e.version && typeof e.score === 'number')
    m.set(e.version, { score: e.score, ...(typeof e.note === 'string' && e.note && { note: e.note }), ...(typeof e.reviewer === 'string' && { reviewer: e.reviewer }) });
  return m;
}

/** Open issues a blind score raises against the final's own score (empty when it holds up). */
export function blindIssues(own: number, blind: { score: number; note?: string } | undefined, o: { minScore: number; maxGap: number }): string[] {
  if (!blind) return [];
  const out: string[] = [], note = blind.note ? `: ${blind.note}` : '';
  if (own - blind.score > o.maxGap) out.push(`blind re-score ${blind.score} vs ${own} (gap ${+(own - blind.score).toFixed(2)})${note}`);
  else if (blind.score < o.minScore) out.push(`blind re-score ${blind.score} is under ${o.minScore}${note}`);
  return out;
}

/** Latest score (and gate result, failing checks) per version from the ledger. */
export function latestScores(ledger: LedgerEntry[]): Map<string, { score: number; gate?: boolean; failing?: string[]; note?: string }> {
  const m = new Map<string, { score: number; gate?: boolean; failing?: string[]; note?: string }>();
  for (const e of ledger) if (e.type === 'score' && !e.blind && e.version && typeof e.score === 'number')
    m.set(e.version, { score: e.score, gate: e.conformance?.pass, failing: e.conformance?.checks?.filter(c => c.status === 'fail').map(c => `${c.id}: ${c.detail}`), ...(typeof e.note === 'string' && e.note && { note: e.note }) });
  return m;
}

/** Roster findings recorded against a version (`roster record`): what a lineup of the whole set showed about it. */
export function rosterNotes(ledger: LedgerEntry[], version: string): string[] {
  const last = [...ledger].reverse().find(e => e.type === 'roster' && e.version === version && Array.isArray(e.issues));
  return (last?.issues as string[] | undefined) ?? [];
}

const lastIdx = <T>(xs: T[], f: (x: T) => boolean) => { for (let i = xs.length - 1; i >= 0; i--) if (f(xs[i])) return i; return -1; };

export function planPasses(input: PlanInput): PassState {
  const { asset, revisionPasses: N, finishPass } = input, gates = input.gates ?? [];
  const vs = input.versions.map(parseVersion).filter((v): v is Version => !!v);
  const bases = vs.filter(v => v.kind === 'base').sort((a, b) => a.n - b.n), finishes = vs.filter(v => v.kind === 'finish').sort((a, b) => a.n - b.n);
  const scores = latestScores(input.ledger), fb = input.feedback, userFb = fb?.filter(f => f.by !== 'agent'), userOpened = userFb?.map(f => f.opens);
  const pid = (v: string) => passId(v, N, userOpened);
  const isUserBase = (b: Version) => b.n > N && (!fb || !!userFb?.some(f => f.opens === b.name));
  const isAgentOpened = (v: string) => !!fb?.some(f => f.by === 'agent' && f.opens === v);
  const rows: PassRow[] = [...bases, ...finishes].map(v => ({
    version: v.name, pass: pid(v.name), score: scores.get(v.name)?.score, gate: scores.get(v.name)?.gate,
    ...(v.kind === 'finish' && input.finishBase?.[v.name] && { base: input.finishBase[v.name] }),
  }));
  // a silhouette the user rejected (and has not approved since) never counts as the best base or the final while another remains
  const sh = gates.includes('shape') ? stageState(input.ledger, 'shape') : undefined;
  const rejectedShapes = new Set(sh ? stageVerdicts(input.ledger, 'shape').filter(v => v.verdict === 'reject' && v.key !== sh.approvedKey).map(v => v.key) : []);
  const shapeRejected = (v: string) => { const k = input.stageKeys?.[v]?.shape; return k !== undefined && rejectedShapes.has(k); };
  const bestOf = (upTo: number) => {
    let best: { version: string; score: number } | undefined;
    const skip = bases.some(b => b.n <= upTo && scores.has(b.name) && !shapeRejected(b.name));
    for (const b of bases) {
      if (b.n > upTo) break;
      if (skip && shapeRejected(b.name)) continue;
      const s = scores.get(b.name)?.score;
      if (s !== undefined && (!best || s >= best.score)) best = { version: b.name, score: s }; // ties → the later, more refined version
    }
    return best;
  };
  const state = (next: NextStep): PassState => ({ asset, rows, best: bestOf(Infinity), next });
  const roster = (v: string | undefined) => { const n = v ? rosterNotes(input.ledger, v) : []; return n.length ? `; the roster review of ${v} found: ${n.join('; ')}` : ''; };

  // placeholder gate: before the first base, the user approves the placeholder as it is now (§5.4 rule 1)
  if (gates.includes('placeholder') && !bases.length) {
    const ph = stageState(input.ledger, 'placeholder');
    if (ph.approvedKey === undefined || ph.approvedKey !== input.placeholderKey)
      return state({
        action: 'stage-gate', stage: 'placeholder', pass: 'g', ...(input.placeholderKey && { key: input.placeholderKey }),
        why: `waiting for the user: write the placeholder with \`artgen placeholder ${asset}\` if it is missing, export it with \`artgen export --placeholders\` if the game wants it now, show the user out/placeholder.png and wait for \`artgen stage approve ${asset} placeholder\`${ph.latest?.verdict === 'reject' ? `; the user rejected the last one${ph.latest.note ? `: "${ph.latest.note}"` : ''}` : ''}`,
      });
  }
  // shape gate (§5.4 rule 3): `cand` is the base the next step builds on. Passed when the approved shape key is its key.
  const shapeGate = (cand: string, next: string, nextPass: string): NextStep | undefined => {
    const sh = stageState(input.ledger, 'shape'), key = input.stageKeys?.[cand]?.shape;
    if (key !== undefined && sh.approvedKey === key) return undefined;
    const iReject = sh.latest?.verdict === 'reject' ? lastIdx(input.ledger, e => e.type === 'stage' && e.stage === 'shape' && e.verdict === 'reject') : -1;
    if (iReject >= 0 && iReject > lastIdx(input.ledger, e => e.type === 'score' && !e.blind && e.version === cand))
      return { action: 'write-base', version: next, pass: nextPass, from: cand, why: `the user rejected the shape of ${cand}${sh.latest?.note ? `: "${sh.latest.note}"` : ''} — redraw the silhouette and form before any decoration` };
    const old = [...input.ledger].reverse().find(e => e.type === 'stage' && e.stage === 'shape' && e.verdict === 'approve');
    return {
      action: 'stage-gate', stage: 'shape', version: cand, pass: 'g', ...(key && { key }),
      why: `waiting for the user: shape gate on ${cand}: build the shape sheet (\`artgen review ${asset} --version ${cand} --stage shape\`), show it to the user, wait for \`artgen stage approve ${asset} shape\` or \`artgen stage reject ${asset} shape --note …\`${old && key !== undefined && old.key !== key ? `; the silhouette changed since the approved one (${String(old.version ?? 'earlier version')})` : ''}`,
    };
  };

  // any written but unscored version is reviewed first
  const unscored = [...bases, ...finishes].find(v => !scores.has(v.name));
  if (unscored) return state({ action: 'review', version: unscored.name, pass: pid(unscored.name), why: 'render it, build the review sheet (v(n−1) beside v(n)), score it' });
  for (let i = 1; i <= N; i++) {
    if (bases.some(b => b.n === i)) continue;
    const from = bestOf(i - 1);
    if (from && gates.includes('shape') && i >= 2) { const g = shapeGate(from.version, `base.v${i}`, `r${i}`); if (g) return state(g); }
    return state({
      action: 'write-base', version: `base.v${i}`, pass: `r${i}`, from: from?.version,
      why: (from ? `revise from the best-scoring version so far, ${from.version} (${from.score}) — R12` : 'first build: T2+ base + procedural pass from the brief and direction') + roster(from?.version),
    });
  }
  const best = bestOf(Infinity)!;
  const lastFinish = finishes[finishes.length - 1], bound = lastFinish && input.finishBase?.[lastFinish.name];
  const nextBase = `base.v${(bases[bases.length - 1]?.n ?? 0) + 1}`, nextFinish = `finish.v${(lastFinish?.n ?? 0) + 1}`;
  const baseOf = (v: string) => (parseVersion(v)?.kind === 'finish' ? input.finishBase?.[v] ?? best.version : v);
  // feedback that opened a version not written yet (U stage, or the agent acting on a roster note)
  const open = fb?.filter(f => !vs.some(v => v.name === f.opens)).pop();
  if (open) {
    const shown = open.on && vs.some(v => v.name === open.on) ? baseOf(open.on) : bound ?? best.version, who = open.by === 'agent' ? `${open.source ?? 'agent'} note` : 'user feedback';
    if (open.route === 'base') return state({ action: 'write-base', version: open.opens, pass: pid(open.opens), from: shown, why: `${who} (form, proportion, colour): new base from ${shown}, the version ${open.by === 'agent' ? 'the note is about' : 'the user saw'}${userWords(open)}` });
    return state({ action: 'write-finish', version: open.opens, pass: pid(open.opens), base: shown, why: `${who} (pixels): finish revision on ${shown}${userWords(open)}` });
  }
  // a final the user approved stays the final until something newer is written (new defaults never reopen it)
  const iApprove = input.ledger.map(e => e.type === 'approve' && e.by === 'user').lastIndexOf(true);
  const approved = iApprove >= 0 ? input.ledger[iApprove].version : undefined;
  if (approved && vs.some(v => v.name === approved) && !input.ledger.slice(iApprove + 1).some(e => e.type === 'score' && !e.blind && e.version !== approved)) {
    const a = scores.get(approved)!;
    return state({ action: 'ready', final: approved, best: best.version, issues: a.gate === false ? a.failing ?? ['gate failed'] : [], why: 'approved by the user; nothing newer since' });
  }

  // the base to finish: the latest user iteration (the user asked for it), else the best-scoring base (R12)
  const userBases = bases.filter(isUserBase), target = userBases.length ? { version: userBases[userBases.length - 1].name, score: scores.get(userBases[userBases.length - 1].name)!.score } : best;
  if (gates.includes('shape')) { const g = shapeGate(target.version, nextBase, pid(nextBase)); if (g) return state(g); }
  const mode = !finishPass ? 'never' : input.finish ?? 'always', bar = input.approveMin ?? input.blind?.minScore ?? 6.5;
  // a finish whose base is unknown counts as finishing the target (older callers pass no bindings)
  const finishedTarget = finishes.some(f => (input.finishBase?.[f.name] ?? target.version) === target.version);
  if (!finishedTarget && (mode === 'always' || (mode === 'auto' && wantsFinish(scores.get(target.version)!.note, target.score, bar)))) {
    if (!lastFinish) return state({ action: 'write-finish', version: 'finish.v1', pass: 'f', base: target.version, why: `one direct-pixel pass on the best base, ${target.version} (${target.score}) — R2, R12${mode === 'auto' ? (target.score >= bar ? ': it clears the bar, so only polish is left' : ': its review names a finish-level problem') : ''}` });
    const why = userBases.some(b => b.name === target.version) ? `a user iteration produced ${target.version}; re-finish it`
      : `${target.version} (${target.score}) now beats ${bound}, which ${lastFinish.name} finishes; re-finish the best — R12`;
    return state({ action: 'write-finish', version: nextFinish, pass: pid(nextFinish), base: target.version, why });
  }

  // the final: the best scored version, not the newest. After a user iteration only what the user asked for counts.
  const lastUser = [...(userFb ?? [])].reverse().find(f => vs.some(v => v.name === f.opens))?.opens;
  let cands: string[];
  if (lastUser && parseVersion(lastUser)!.kind === 'base') cands = [lastUser, ...finishes.filter(f => input.finishBase?.[f.name] === lastUser).map(f => f.name)];
  else if (lastUser) cands = finishes.filter(f => f.n >= parseVersion(lastUser)!.n && input.finishBase?.[f.name] === input.finishBase?.[lastUser]).map(f => f.name);
  else cands = [...bases, ...finishes].map(v => v.name);
  if (cands.some(v => !shapeRejected(v))) cands = cands.filter(v => !shapeRejected(v));
  const passing = cands.filter(v => scores.get(v)!.gate !== false), pool = passing.length ? passing : cands;
  // ties: a finish over a base, a later version over an earlier one
  const order = (v: string) => { const p = parseVersion(v)!; return (p.kind === 'finish' ? 1000 : 0) + p.n; };
  const rank = (val: (v: string) => number | undefined) => (xs: string[]) => xs.filter(v => val(v) !== undefined).sort((a, b) => val(b)! - val(a)! || order(b) - order(a))[0];
  const own = (v: string) => scores.get(v)!.score, ownBest = rank(own)(pool)!;
  const extrasUsed = bases.filter(b => b.n > N && !isUserBase(b) && !isAgentOpened(b.name)).length;
  const extraOk = (budget: number) => !userBases.length && extrasUsed < budget;
  if (!passing.length && extraOk(input.extraRevisions ?? 0)) {
    const f = scores.get(ownBest)!;
    return state({ action: 'write-base', version: nextBase, pass: pid(nextBase), from: best.version, why: `the final still fails the gate (${(f.failing ?? []).join('; ') || 'see conformance'}): one extra autonomous revision from ${best.version} (budget)` });
  }
  let final = ownBest, blindOpen: string[] = [];
  if (input.blind) {
    const bls = blindScores(input.ledger);
    if (!bls.has(ownBest)) return state({ action: 'blind-review', version: ownBest, pass: 'b', why: `a fresh reviewer scores ${ownBest}, the best-scoring version, from the blind sheet (\`review --blind\`, then \`score --blind --reviewer <name>\`): self-scores drift upward, so the final is chosen and gated on the blind score` });
    final = rank(v => bls.get(v)?.score)(pool)!;
    blindOpen = blindIssues(own(final), bls.get(final), input.blind);
    if (blindOpen.length && extraOk((input.extraRevisions ?? 0) + (input.blindRevisions ?? 0)))
      return state({ action: 'write-base', version: nextBase, pass: pid(nextBase), from: best.version, why: `${blindOpen.join('; ')}: one extra autonomous revision from ${best.version} that fixes what the blind reviewer named (budget)` });
  }
  const fin = scores.get(final)!, issues = [...(fin.gate === false ? fin.failing ?? ['gate failed'] : []), ...blindOpen];
  const top = rank(own)([...bases, ...finishes].map(v => v.name))!;
  return state({
    action: 'ready', final, best: best.version, issues, ...(top !== final && own(top) > own(final) && { top: { version: top, score: own(top) } }),
    why: issues.length ? 'pipeline complete with open issues: mark it final and list them for the user' : 'pipeline complete: show the finished asset to the user (approve or give feedback)',
  });
}
