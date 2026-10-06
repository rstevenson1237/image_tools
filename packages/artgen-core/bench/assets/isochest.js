// Benchmark iso chest (artlab t4/isochest.v1, scored 7): one voxel model function, two states (closed | open);
// 7×4×4 box, gold straps, lock, coins when open. Rendered with the artlab 4×4 cube stamp.
export const meta = { brief: 'isochest', notes: 'artlab t4/isochest.v1 ported; states are brief states; tokens for PAL' };

export function render(ctx) {
  const { pal, outline } = ctx.dir, { voxel } = ctx.lib, open = ctx.state === 'open';
  const v = voxel.model(), W = voxel.face(pal.wood), G = voxel.face(pal.gold, pal.white[0]);
  v.box(0, 0, 0, 6, 3, 2, W);
  if (open) {
    v.box(1, 1, 2, 5, 2, 2, G);
    v.box(0, -1, 3, 6, -1, 6, voxel.face(pal.wood.slice(1)));
    v.box(1, -1, 4, 5, -1, 5, voxel.face([pal.wood[2], outline]));
  } else v.box(0, 0, 3, 6, 3, 3, W);
  for (const x of [1, 5]) v.paint((vx, vy, vz, r) => (vx === x && r === W ? G : null));
  if (!open) v.set(3, 3, 2, voxel.face(pal.steel)); else v.set(3, 3, 1, voxel.face(pal.steel));
  return v.render(32, 32, { ox: 13, oy: 17 });
}
