---
description: Show the finished assets (gallery) with scores, blind scores and open issues, after a roster review
argument-hint: [--pr] [brief ids]
---
If the finished assets have not had a roster review since their finals were made (asset-production skill §3), run it
first: `node tools/artgen/artgen.js roster`, a fresh art-reviewer subagent in roster mode, `node tools/artgen/artgen.js roster record <file> --reviewer
art-reviewer`. Then run `node tools/artgen/artgen.js gallery $ARGUMENTS`, open every sheet it writes and show it to the user with one
line per asset (final version, score, blind score — `SELF` when only the maker scored it — and open issues). Show
assets labelled BELOW BAR separately, after the others, and ask about each one on its own. Then ask which to approve
and what to change (asset-production skill §4).

**`--pr` (or when this is a cloud session and the user is not at the machine):** the user can't open `node tools/artgen/artgen.js ui` here, so review on the
pull request (asset-production skill §4). Run `node tools/artgen/artgen.js pr prepare [ids]`, which copies each final's review sheet (and the sheet of the
version their last feedback was on, as the "before") to `art/review/` and writes `art/review/REVIEW.md`. Commit `art/review/` to this
session's pull request and push. Then post one comment on the pull request with the table (use `pr prepare --base
https://github.com/<owner>/<repo>/blob/<branch>/art/review` for image links that work in a comment) that asks the user to answer with one
line per asset: `approve goblin`, or `goblin: arms too long`. Watch the pull request; when the user's comment arrives, read it with
`node tools/artgen/artgen.js pr parse --file <comment>` and make each call it lists with `--via pr`.
