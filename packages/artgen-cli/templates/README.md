# artgen templates

Starting points for `artgen new` (asset sources) and the W1 probe set (`artgen direction candidates`). Each
`<view>/<kind>/` holds `brief.json` (defaults) and `base.js` (copied as `base.v1.js`); `finish.js` is the
finishing-pass template (`artgen finish`); characters and creatures start from `finish-character.js` instead, which
paints the face (eyes, mouth, per-state expression) at the base's `eye`/`eye2`/`mouth` anchors after the clean-up ops. Templates only use role ramps (`skin`, `hair`, `cloth`, `leather`,
`metal`, `wood`, `stone`, `dirt`, `grass`, `accent`, `glow`) and draw in coordinates relative to `ctx.size`, so they
render under every generated direction at any size. Views without a template for a kind fall back to `topdown`.

`<view>/character-walk/` is the walker: facings s, se, e, ne, n (west ones are mirrored by the engine) and a walk
cycle over `ctx.t`. `artgen make` starts characters and creatures that have more than one facing or a walk animation from
it; other brief kinds without a template of their own borrow a related one (creature → character, tileset/texture →
tile, viewmodel/ui-icon → prop).

The character templates compute their geometry once in `layout(ctx)`, shared by `render` and `anchors`, so the
anchors land on the drawn pixels: `head`, `hand` (exported in `pack.json`, for effects and held props) and the face
anchors `eye`, `eye2`, `mouth` (only on facings where the face is visible).
