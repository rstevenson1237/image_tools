## Sending feedback back to artgen
- A render that is wrong, or something artgen can't do yet: `{{ARTGEN}} report --file <map, dungeon or settlement file> --note "what is wrong" --made-by "<the command that wrote the file>"`
  writes `artgen-feedback/<date>-<id>/` at the repo root (git ignores it): the file, its render, the versions and a `case.md`, plus `ISSUE.md`, the
  text of the issue. Nothing is sent: show the user the folder, and only when they agree run it again with `--issue` (or give them the link it prints).
- A fix you made to an installed skill or command (`{{CMD}}upstream`): `{{ARTGEN}} upstream` writes your local edits as a patch against their
  sources in the artgen repo, so the edit is not lost at the next `update`.
