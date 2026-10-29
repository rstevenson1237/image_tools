---
description: Open the artgen review UI in the browser for this repo (approve assets, give feedback, edit maps)
argument-hint: [--port N]
---
Start the review UI: run `{{ARTGEN}} ui $ARGUMENTS` in the background (use `node tools/artgen/artgen-maps.js ui` where
`tools/artgen/artgen.js` is not installed). It keeps running until stopped. Read the address it prints
(`http://127.0.0.1:<port>/?t=<token>`) and give the user that link. Tell them what it does: Asset Review shows the
finished assets and writes approvals and feedback to `art/ledger.jsonl`, Art Direction and Asset Lab edit `art/`, and the
map editors save the map files. Everything they do there is on disk at once; read `{{ARTGEN}} status` afterwards instead
of asking what they decided. Stop the server when they say they are done.

If this is a cloud session (the user cannot open a link to this container), don't start it: review on the pull request
instead (`{{CMD}}review`).
