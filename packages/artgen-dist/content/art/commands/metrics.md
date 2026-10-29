---
description: Write this repo's counts and ratios (assets, passes, tokens, minutes, gate failures) to art/metrics/ for the artgen pool
argument-hint: [--name repo]
---
Run `{{ARTGEN}} metrics export $ARGUMENTS`. It writes `art/metrics/<artgen version>.json`: counts and ratios from the ledger and briefs per kind
and per pass. It holds no images, asset ids, notes or paths. Open the file, tell the user what it holds in two lines, and let them decide whether
to commit it or send it to the artgen repo; it is theirs to share. To see several repos side by side per artgen version:
`{{ARTGEN}} metrics pool <file or folder>…`.
