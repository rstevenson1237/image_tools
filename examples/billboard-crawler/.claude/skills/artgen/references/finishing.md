# Finishing pass (stage F) — `finish.vM.js`

One direct-pixel pass on the best base (R2). It is stored as **ops**, not pixels, so it re-applies after every
re-render and restyle. Colours are tokens.

**Characters and creatures: the face first.** Eyes and mouth are 1–2 px features. The supersampled base cannot draw
them (the downsample vote turns them to mush), and a face that never changes reads as a doll — this is the biggest
single difference the finishing pass makes on a character. `artgen finish` starts characters and creatures from
`finish-character.js`: clean-up ops first, then eyes and mouth painted at the base's `eye` / `eye2` / `mouth`
anchors, with an expression per state (calm idle/walk, fierce attacks and casts, hurt, happy wins). So the base must
export those anchors on every facing where the face shows (the character templates compute them from the same
`layout(ctx)` as the drawing; keep it that way when you change the head). Tune the expressions to the brief; check
them on the review sheet at 1×. Clean-up ops alone rarely move the score — spend the finish on what the review named.

```js
export const base = 'base.v3';                     // bound to one base version
export function finish(g, ctx) {
  const { px } = ctx.lib;
  px.fix.orphans(g); px.fix.jaggies(g, { region: [14, 2, 6, 12] }); px.fix.banding(g);
  px.light.rim(g, { ramps: ['cloth'] });           // lit side from ctx.dir.camera.light
  px.fx.glint(g, ctx.at('blade.tip'), 'glow.0');
  px.outline.selout(g); px.outline.inner(g, { between: ['cloth', 'skin'] });
  if (ctx.key('idle', 0)) px.patch(g, ctx.at('head'), FACE, { b: 'outline', s: 'skin.0' });  // follows the anchor
  return g;
}
```

| Group | Ops |
|---|---|
| `px.fix` | `orphans`, `jaggies`, `pillow`, `banding`, `lines` |
| `px.fx` | `glint(at, token, { shape: 'dot'|'plus'|'x' })`, `spark(at, token, r)`, `glow(at, r)` |
| `px.light` | `rim({ ramps, side })`, `highlight(at, token)`, `tone({ region, ramps, by })`, `shade(o)` |
| `px.outline` | `selout({ side })`, `inner({ between: [a, b] })`, `corners`, `weight({ times })` |
| direct | `set(at, token)`, `fill([x,y,w,h], token)`, `line(a, b, token)`, `patch(at, rows, key, { anchor })`, `tokenAt(at)` (the token already there, e.g. the skin beside an eye) |

Options: `region: [x, y, w, h]`, `ramps: [...]` restrict an op. `ctx.protect([x, y], ...)` keeps intentional single
pixels (eye glints) safe from `fix` ops.

- `ctx` carries `dir`, `state`, `facing`, `frame`, `anchors`, `at`, `key`, `protect`, `lib.px`; the frame size is `g.w` × `g.h`.
- Global ops run on every frame and facing; patches target key frames (`ctx.key(state, frame)`) and follow named
  anchors (`ctx.at('head')`) through the others (D15). West facings of 2D assets are mirrored finished east cells.
- When a finish is scored, `finish.vM.snapshot.json` records the pixels under each patch (as tokens). After a
  re-render, large differences mark the asset **FINISH-STALE** in `pass status` / `render`: re-review it, and write
  `finish.vM+1` if the patch no longer fits.
- A finish never fixes the silhouette or proportions — that is a base revision.
