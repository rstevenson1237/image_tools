# Instructions for Claude Code
This repo runs an iterate-and-review loop for procedural sprite generation. See README.md and FINDINGS.md.
Loop: create `techniques/<tech>/<asset>.v<N+1>.js` (copy + edit the previous version; keep the header comment
describing what changed) -> `node run.js render ...` -> `node run.js review <asset> <tech>` -> open the PNG in out/
and look at it -> `node run.js score ...` with an honest 0-10 and a note -> repeat. Compare against v(N): regressions are common.
Never edit an old version file; the ledger diffs consecutive versions to estimate edit tokens.
Prefer `review <asset> latest` when comparing techniques (smaller image, fewer tokens).
Token counts are chars/3.5 estimates; if ANTHROPIC_API_KEY is set, replace `tok()` in run.js with /v1/messages/count_tokens.
