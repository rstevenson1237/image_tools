// Benchmark iso hero (artlab t1/isohero.v1, scored 7): hooded rogue facing camera, mirrored half char map,
// right-side shade pass, dagger overlay, 2:1 ground shadow. Colours are direction tokens.
export const meta = { brief: 'isohero', notes: 'artlab t1/isohero.v1 ported as-is; PAL lookups became ctx.dir tokens' };

const HALF = ['', '', '', '', '', '',
  '............OOOO', '..........OOeeee', '.........Oeeeeee', '........OeeeeEEE', '........OeeEEEEE', '.......OeeEEEnnn',
  '.......OeEEnnnnn', '.......OeEnnkSSS', '.......OeEnnSSSS', '.......OEEnkSSOS', '.......OEEnkSSOS', '.......OEEnnkSSS',
  '......OEEEEnnkss', '......OEEEEEnnnn', '.....OeEEEEEEEnn', '.....OeEEEEEEEnL', '....OeeEEEEEEnLL', '....OeEEEEEEEnLl',
  '....OeEEEEEEnLLl', '...OeeEEEEEEnLLL', '...OeEEEEEEEnGGg', '...OeEEEEEEnnLLL', '...OeEEEEEEnLLLL', '...OeEEEEEEnLLLl',
  '...OeEEEEEnnLLLl', '...OeEEEEEnLLLLO', '...OEEEEEEnlllOn', '...OnEEEEEnOddOn', '...OnEEEEnnOddOn', '....OnnEEnnOddOn',
  '.....OOnnnnOddOO', '...........OddO.', '...........OLLO.', '..........OLLLO.', '..........OLLlO.', '..........OOOOO.'];
const DAGGER = ['.OO.', 'OSSO', 'OGgO', '.OAO', '.OAO', '.OaO', '..O.'];

export function render(ctx) {
  const { pal, outline } = ctx.dir, { Grid, blit, iso } = ctx.lib;
  const K = { O: outline, e: pal.green[0], E: pal.green[1], n: pal.green[2], S: pal.skin[0], s: pal.skin[1], k: pal.skin[2],
    L: pal.leather[0], l: pal.leather[1], d: pal.leather[2], G: pal.gold[0], g: pal.gold[1], A: pal.steel[0], a: pal.steel[1] };
  const g = new Grid(32, 48);
  iso.groundShadow(g, 16, 42, 9);
  blit.blitMirrored(g, HALF, K);
  blit.shadeSide(g, { [pal.green[0]]: pal.green[1], [pal.green[1]]: pal.green[2], [pal.skin[0]]: pal.skin[1], [pal.leather[0]]: pal.leather[1] });
  blit.blit(g, DAGGER, K, 23, 26);
  return g;
}
