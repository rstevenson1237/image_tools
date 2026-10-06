// Benchmark hero (artlab t1/hero.v2, scored 7.5): mirrored half char map, blush, lowered shield,
// right-side shade pass for the light, sword and shield overlays. Colours are direction tokens.
export const meta = { brief: 'hero', notes: 'artlab t1/hero.v2 ported as-is; PAL lookups became ctx.dir tokens' };

const HALF = [
  '................', '................', '...........OOOOO', '.........OOhhhhh', '........OhhhhhhH', '.......OhhhhhHHh',
  '.......OhhHHHHHH', '.......OHHHHHHHH', '.......OHHSHHHHS', '.......OHSSSSSSS', '.......OHSSSOSSS', '.......OkSSSOSSS',
  '.......OkSpSSSSS', '........OkSSSSSs', '.........OOsssss', '.......OOrOOOOOO', '.....OOaAAOBBBBB', '....OaAAAAOBBbBB',
  '....OmaaamOBBbBB', '.....OmmmOBBBbBB', '.....OSsOrBBBbBB', '.....OOOrrBBBBBB', '......OrrOgGGGGG', '......OrrObBBBBB',
  '......OrrObbbbbb', '......OOOOOOOOOO', '..........OlLLLO', '..........OlLLLO', '.........OddlldO', '.........OOOOOOO',
  '................', '................'];
const SWORD = ['..OO..', '.OWAO.', ...Array(10).fill('.OWaO.'), 'OOOOOO', 'OGGGgO', '.OSSO.', '.OlLO.', '.OGgO.', '..OO..'];
const SHIELD = ['OOOOOOO', 'OaRRRaO', 'OaRGRaO', 'OaGGGaO', 'OaRGRaO', 'OaRRRaO', '.OaRaO.', '..OaO..', '...O...'];

export function render(ctx) {
  const { pal, outline } = ctx.dir, { Grid, blit } = ctx.lib;
  const K = { O: outline, h: pal.hair[0], H: pal.hair[1], S: pal.skin[0], s: pal.skin[1], k: pal.skin[2], p: pal.blush[0],
    A: pal.steel[0], a: pal.steel[1], m: pal.steel[2], B: pal.blue[0], b: pal.blue[1], R: pal.red[0], r: pal.red[1],
    G: pal.gold[0], g: pal.gold[1], L: pal.leather[0], l: pal.leather[1], d: pal.leather[2], W: pal.white[0] };
  const g = new Grid(32, 32);
  blit.blitMirrored(g, HALF, K);
  blit.shadeSide(g, { [pal.skin[0]]: pal.skin[1], [pal.hair[0]]: pal.hair[1], [pal.hair[1]]: pal.hair[2], [pal.blue[0]]: pal.blue[1],
    [pal.steel[0]]: pal.steel[1], [pal.leather[0]]: pal.leather[1], [pal.red[0]]: pal.red[1] });
  blit.blit(g, SWORD, K, 21, 4);
  blit.blit(g, SHIELD, K, 2, 18);
  return g;
}
