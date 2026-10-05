// T1 hero v2: same char-map, plus: blush, lowered shield (pauldron visible), darker boots,
// and a per-pixel "right-side shade" pass that breaks mirror symmetry with directional light.
const { Grid, PAL, hex } = require('../../lib/core');
const K = { O: PAL.outline, h: PAL.hair[0], H: PAL.hair[1], S: PAL.skin[0], s: PAL.skin[1], k: PAL.skin[2], p: PAL.blush,
  A: PAL.steel[0], a: PAL.steel[1], m: PAL.steel[2], B: PAL.blue[0], b: PAL.blue[1], R: PAL.red[0], r: PAL.red[1],
  G: PAL.gold[0], g: PAL.gold[1], L: PAL.leather[0], l: PAL.leather[1], d: PAL.leather[2], W: '#ffffff' };
const HALF = [
  '................','................','...........OOOOO','.........OOhhhhh','........OhhhhhhH','.......OhhhhhHHh',
  '.......OhhHHHHHH','.......OHHHHHHHH','.......OHHSHHHHS','.......OHSSSSSSS','.......OHSSSOSSS','.......OkSSSOSSS',
  '.......OkSpSSSSS','........OkSSSSSs','.........OOsssss','.......OOrOOOOOO','.....OOaAAOBBBBB','....OaAAAAOBBbBB',
  '....OmaaamOBBbBB','.....OmmmOBBBbBB','.....OSsOrBBBbBB','.....OOOrrBBBBBB','......OrrOgGGGGG','......OrrObBBBBB',
  '......OrrObbbbbb','......OOOOOOOOOO','..........OlLLLO','..........OlLLLO','.........OddlldO','.........OOOOOOO',
  '................','................'];
const SWORD = ['..OO..', '.OWAO.', ...Array(10).fill('.OWaO.'), 'OOOOOO', 'OGGGgO', '.OSSO.', '.OlLO.', '.OGgO.', '..OO..'];
const SHIELD = ['OOOOOOO', 'OaRRRaO', 'OaRGRaO', 'OaGGGaO', 'OaRGRaO', 'OaRRRaO', '.OaRaO.', '..OaO..', '...O...'];
const DARKER = { [PAL.skin[0]]: PAL.skin[1], [PAL.hair[0]]: PAL.hair[1], [PAL.hair[1]]: PAL.hair[2], [PAL.blue[0]]: PAL.blue[1],
  [PAL.steel[0]]: PAL.steel[1], [PAL.leather[0]]: PAL.leather[1], [PAL.red[0]]: PAL.red[1] };
function blit(g, rows, ox, oy) { rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && g.set(ox + x, oy + y, K[ch]))); }
module.exports = {
  notes: 'v1 + blush, smaller lowered shield, boots, right-side shade pass',
  render() {
    const g = new Grid(32, 32);
    HALF.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.set(x, y, K[ch]); g.set(31 - x, y, K[ch]); } }));
    // light from upper-left: pixels touching outline on their right go one ramp step darker
    const src = g.clone();
    for (let y = 0; y < 32; y++) for (let x = 16; x < 31; x++) { const c = src.get(x, y), n = src.get(x + 1, y);
      if (c && n === PAL.outline && DARKER[c]) g.set(x, y, DARKER[c]); }
    blit(g, SWORD, 21, 4); blit(g, SHIELD, 2, 18);
    return g;
  },
};
