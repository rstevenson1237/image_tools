// T4 iso chest v1: two states (closed | open) from one voxel model function; 7x4x4 box, straps, lock, coins.
const { PAL, Grid } = require('../../lib/core');
const { Voxels, face } = require('../../lib/voxel');
function chest(open) {
  const v = new Voxels(), W = face(PAL.wood), G = face(PAL.gold, '#ffffff');
  v.box(0, 0, 0, 6, 3, 2, W);
  if (open) { v.box(1, 1, 2, 5, 2, 2, G); v.box(0, -1, 3, 6, -1, 6, face(PAL.wood.slice(1))); v.box(1, -1, 4, 5, -1, 5, face([PAL.wood[2], PAL.outline])); }
  else v.box(0, 0, 3, 6, 3, 3, W);
  for (const x of [1, 5]) v.paint((vx, vy, vz, r) => vx === x && r === W ? G : null);
  if (!open) v.set(3, 3, 2, face(PAL.steel)); else v.set(3, 3, 1, face(PAL.steel));
  return v.render(32, 32, { ox: 13, oy: 17 });
}
module.exports = { notes: 'Parametric open/closed voxel chest', render: () => new Grid(64, 32).stamp(chest(false)).stamp(chest(true), 32, 0) };
