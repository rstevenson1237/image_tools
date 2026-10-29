## Review in the browser (artgen ui)
- `{{ARTGEN}} ui` (`artgen-maps.js ui` where only the maps module is installed) serves the review UI in
  `tools/artgen/ui/` on this machine and opens this repo's `art/` in it. Approvals and feedback recorded there are the
  same files and ledger lines the CLI writes (`"via": "image-tools"`). Start it for the user during `{{CMD}}review` and
  give them the link; stop it when they are done. In a cloud session the user can't reach it: review on the pull
  request instead.
