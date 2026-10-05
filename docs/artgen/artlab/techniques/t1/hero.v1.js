// T1 hero v1: hand-authored character map, left half mirrored, then sword/shield overlays.
const { Grid, PAL } = require('../../lib/core');
const K = { O: PAL.outline, h: PAL.hair[0], H: PAL.hair[1], S: PAL.skin[0], s: PAL.skin[1], k: PAL.skin[2],
  A: PAL.steel[0], a: PAL.steel[1], m: PAL.steel[2], B: PAL.blue[0], b: PAL.blue[1], R: PAL.red[0], r: PAL.red[1],
  G: PAL.gold[0], g: PAL.gold[1], L: PAL.leather[0], l: PAL.leather[1], W: '#ffffff' };
const HALF = [
  '................','................','...........OOOOO','.........OOhhhhh','........OhhhhhhH','.......OhhhhhHHh',
  '.......OhhHHHHHH','.......OHHHHHHHH','.......OHHSHHHHS','.......OHSSSSSSS','.......OHSSSOSSS','.......OkSSSOSSS',
  '.......OkSSSSSSS','........OkSSSSSs','.........OOsssss','.......OOrOOOOOO','.....OOaAAOBBBBB','....OaAAAAOBBbBB',
  '....OmaaamOBBbBB','.....OmmmOBBBbBB','.....OSsOrBBBbBB','.....OOOrrBBBBBB','......OrrOgGGGGG','......OrrObBBBBB',
  '......OrrObbbbbb','......OOOOOOOOOO','..........OlLLLO','..........OlLLLO','.........OllLLLO','.........OOOOOOO',
  '................','................'];
const SWORD = ['..OO..', '.OWAO.', ...Array(10).fill('.OWaO.'), 'OOOOOO', 'OGGGgO', '.OSSO.', '.OlLO.', '.OGgO.', '..OO..'];
const SHIELD = ['OOOOOOOO', 'OaRRRRaO', 'OaRGGRaO', 'OaRGGRaO', 'OaGGGGaO', 'OaRGGRaO', '.OaRRaO.', '.OaRRaO.', '..OaaO..', '...OO...'];
function blit(g, rows, ox, oy) { rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && g.set(ox + x, oy + y, K[ch]))); }
module.exports = {
  notes: 'Char-map sprite, mirrored half + overlays',
  render() {
    const g = new Grid(32, 32);
    HALF.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.set(x, y, K[ch]); g.set(31 - x, y, K[ch]); } }));
    blit(g, SWORD, 21, 4); blit(g, SHIELD, 2, 15);
    return g;
  },
};
