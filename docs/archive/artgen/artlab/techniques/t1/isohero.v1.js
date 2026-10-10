// T1 iso hero v1: hand-authored 16x48 half char map (hooded rogue, facing camera), mirrored,
// dagger overlay, right-side shade pass, 2:1 ground shadow. Taller proportions than top-down chibi.
const { Grid, PAL } = require('../../lib/core');
const { groundShadow } = require('../../lib/iso');
const K = { O: PAL.outline, e: PAL.green[0], E: PAL.green[1], n: PAL.green[2], S: PAL.skin[0], s: PAL.skin[1], k: PAL.skin[2],
  L: PAL.leather[0], l: PAL.leather[1], d: PAL.leather[2], G: PAL.gold[0], g: PAL.gold[1], A: PAL.steel[0], a: PAL.steel[1] };
const HALF = ['','','','','','',
  '............OOOO','..........OOeeee','.........Oeeeeee','........OeeeeEEE','........OeeEEEEE','.......OeeEEEnnn',
  '.......OeEEnnnnn','.......OeEnnkSSS','.......OeEnnSSSS','.......OEEnkSSOS','.......OEEnkSSOS','.......OEEnnkSSS',
  '......OEEEEnnkss','......OEEEEEnnnn','.....OeEEEEEEEnn','.....OeEEEEEEEnL','....OeeEEEEEEnLL','....OeEEEEEEEnLl',
  '....OeEEEEEEnLLl','...OeeEEEEEEnLLL','...OeEEEEEEEnGGg','...OeEEEEEEnnLLL','...OeEEEEEEnLLLL','...OeEEEEEEnLLLl',
  '...OeEEEEEnnLLLl','...OeEEEEEnLLLLO','...OEEEEEEnlllOn','...OnEEEEEnOddOn','...OnEEEEnnOddOn','....OnnEEnnOddOn',
  '.....OOnnnnOddOO','...........OddO.','...........OLLO.','..........OLLLO.','..........OLLlO.','..........OOOOO.'];
const DAGGER = ['.OO.', 'OSSO', 'OGgO', '.OAO', '.OAO', '.OaO', '..O.'];
const DARKER = { [PAL.green[0]]: PAL.green[1], [PAL.green[1]]: PAL.green[2], [PAL.skin[0]]: PAL.skin[1], [PAL.leather[0]]: PAL.leather[1] };
module.exports = {
  notes: 'Mirrored char map, dagger overlay, shade pass, ground shadow',
  render() {
    const g = new Grid(32, 48); groundShadow(g, 16, 42, 9);
    HALF.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.set(x, y, K[ch]); g.set(31 - x, y, K[ch]); } }));
    const src = g.clone();
    for (let y = 0; y < 48; y++) for (let x = 16; x < 31; x++) { const c = src.get(x, y); if (c && src.get(x + 1, y) === PAL.outline && DARKER[c]) g.set(x, y, DARKER[c]); }
    DAGGER.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && g.set(23 + x, 26 + y, K[ch])));
    return g;
  },
};
