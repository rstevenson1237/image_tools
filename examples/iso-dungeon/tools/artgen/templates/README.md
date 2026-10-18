# artgen templates

Starting points for `artgen new` (asset sources) and the art-direction probe set (`artgen direction candidates`). Each
`<view>/<kind>/` holds `brief.json` (defaults) and `base.js` (copied as `base.v1.js`); `finish.js` is the
finishing-pass template (`artgen finish`); characters and creatures start from `finish-character.js` instead, which
paints the face (eyes, mouth, per-state expression) at the base's `eye`/`eye2`/`mouth` anchors after the clean-up ops. Templates only use role ramps (`skin`, `hair`, `cloth`, `leather`,
`metal`, `wood`, `stone`, `dirt`, `grass`, `accent`, `glow`) and draw in coordinates relative to `ctx.size`, so they
render under every generated direction at any size. Views without a template for a kind fall back to `topdown`.

`<view>/character-walk/` is the walker: facings s, se, e, ne, n (west ones are mirrored by the engine) and a walk
cycle over `ctx.t`, in `topdown/` and `iso/` (the iso one stands on a 2:1 ground shadow and is reviewed on the iso
floor). `artgen make` starts characters and creatures that have more than one facing or a walk animation from
it; other brief kinds without a template of their own borrow a related one (creature → character, tileset/texture →
tile, viewmodel/ui-icon → prop).

The character templates compute their geometry once in `layout(ctx)`, shared by `render` and `anchors`, so the
anchors land on the drawn pixels: `head`, `hand` (exported in `pack.json`, for effects and held props) and the face
anchors `eye`, `eye2`, `mouth` (only on facings where the face is visible).

Body rigs (`<view>/creature-<body>/`, topdown and iso) for shapes the humanoid walker doesn't cover. A brief picks one
with `body` (`brief add --body quadruped`): `quadruped` (wolf, rat, lizard, kobold on all fours), `serpent` (snake, eel,
naga tail), `flyer` (bat, wasp, bird; hovers over its ground shadow and beats its wings on every state) and `large`
(dragon, giant beast; brief it on a large frame with its real height). Each computes its geometry in `layout(ctx)`,
draws four facings and a walk, and exports `ground` (where it stands), `head` and the face anchors. Low bodies
(quadruped, serpent, flyer) are seen along their length, so the height check only flags them.
