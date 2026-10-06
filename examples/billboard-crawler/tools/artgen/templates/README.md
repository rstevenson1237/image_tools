# artgen templates

Starting points for `artgen new` (asset sources) and the W1 probe set (`artgen direction candidates`). Each
`<view>/<kind>/` holds `brief.json` (defaults) and `base.js` (copied as `base.v1.js`); `finish.js` is the
finishing-pass template (`artgen finish`). Templates only use role ramps (`skin`, `hair`, `cloth`, `leather`,
`metal`, `wood`, `stone`, `dirt`, `grass`, `accent`, `glow`) and draw in coordinates relative to `ctx.size`, so they
render under every generated direction at any size. Views without a template for a kind fall back to `topdown`.
