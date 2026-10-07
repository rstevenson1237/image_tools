---
description: Show the finished assets (gallery) with scores, blind scores and open issues, after a roster review
argument-hint: [brief ids]
---
If the finished assets have not had a roster review since their finals were made (asset-production skill §3), run it
first: `{{ARTGEN}} roster`, a fresh art-reviewer subagent in roster mode, `{{ARTGEN}} roster record <file> --reviewer
art-reviewer`. Then run `{{ARTGEN}} gallery $ARGUMENTS`, open every sheet it writes and show it to the user with one
line per asset (final version, score, blind score — `SELF` when only the maker scored it — and open issues). Then ask
which to approve and what to change (asset-production skill §4).
