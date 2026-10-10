# artgen-mcp

The artgen MCP server (SPEC §14): JSON-RPC 2.0 over stdio, newline-delimited, no SDK. The build bundles it into the
committed install as `tools/artgen/artgen-mcp.js`, and the installer adds it to the game's `.mcp.json`
(`node tools/artgen/artgen-mcp.js`). Run from the game repo root: it finds the project (`art/artgen.config.json`)
from its working directory.

| Tool | What it does | Images |
|---|---|---|
| `direction_get` | locked direction + candidate names (or one candidate) | |
| `direction_tile` | style tile of the probe set under each candidate | sheet |
| `pass_status` | versions, scores, gate, best base, next step of an asset | |
| `render` | render a version + conformance gate | strip |
| `review` | review sheet (logged); `blind` for a fresh reviewer's re-score | sheet |
| `conformance` | the gate report for a version | |
| `score` | record a 0–10 score (`reviewer`, `blind`) | |
| `finish` | write the next `finish.vM.js`, bound to the best base | |
| `make` | one autonomous tick; `parallel: n` adds a round of maker packets | |
| `status` | W2 status of every brief | |
| `gallery` | finished assets for the user (logged) | sheets |
| `feedback` | the user's feedback, `route` base / finish, `region`, `cell` | |
| `approve` | the user's approval — needs `user_approved: true` (D10) | |
| `texture` | material recipe → `art/sheets/textures/` + seam / repetition metrics; `list` | 3×3 preview, normal map |
| `fx` | particle preset → `art/sheets/fx/` + solid-fill numbers; `list` | strip, onion skin |
| `export` | approved assets → packs, `assets.ts`; `runtime` vendors the runtime | |
| `restyle` | re-render finals under the new direction | diff sheet |
| `analytics` | the project's pipeline analytics (markdown) | |

**Sandbox.** Asset arguments resolve inside `art/` only. They can be a brief id, a directory relative to the project
root or to `art/`, or a bare name under `art/assets/[<kind>/]`; the first candidate that exists wins. `direction`
is a file relative to the root or a bench direction name (`benchmark`, `alt`). Errors come back as tool results with
`isError`.

```
npm test -w artgen-mcp                                    # protocol, every tool, sandbox, stdio framing
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node packages/artgen-mcp/src/bin.ts   # from sources
npx @modelcontextprotocol/inspector --cli node tools/artgen/artgen-mcp.js --method tools/list  # in a game repo
```
