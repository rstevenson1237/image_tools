// T4 iso hero v1: voxel model (rogue) built from boxes, facing +y (screen down-left), rendered 2:1 iso.
const { PAL } = require('../../lib/core');
const { Voxels, face } = require('../../lib/voxel');
module.exports = {
  notes: 'Box-built voxel hooded rogue (carved hood), 4px cubes, painter order, auto outline + ground shadow',
  render() {
    const v = new Voxels(), skin = face(PAL.skin), gr = face(PAL.green), grd = face(PAL.green.slice(1)), lea = face(PAL.leather);
    v.box(0, -1, 2, 4, -1, 10, grd);                                    // cloak back
    v.box(1, 1, 0, 1, 2, 1, face(PAL.leather.slice(1))); v.box(3, 1, 0, 3, 2, 1, face(PAL.leather.slice(1))); // boots
    v.box(1, 1, 2, 1, 2, 4, face(PAL.leather.slice(1))); v.box(3, 1, 2, 3, 2, 4, face(PAL.leather.slice(1))); // legs
    v.box(1, 0, 5, 3, 2, 10, lea); v.box(1, 2, 6, 3, 2, 6, face(PAL.gold));                  // tunic + belt
    v.box(0, 0, 3, 0, 2, 10, gr); v.box(4, 0, 3, 4, 2, 10, gr); v.box(1, 0, 5, 3, 0, 10, gr); // cloak sides/back
    v.set(4, 3, 6, skin); v.box(4, 3, 3, 4, 3, 5, face(PAL.steel));                           // hand + dagger
    v.box(1, 0, 11, 3, 2, 13, skin);                                                        // head
    v.box(0, -1, 11, 4, 2, 14, gr); v.box(1, 1, 11, 3, 3, 13, null);                        // hood shell, carve face
    v.box(1, 2, 11, 3, 2, 13, skin); v.box(1, 1, 11, 3, 1, 13, skin);
    v.set(1, 2, 12, face([PAL.outline, PAL.outline])); v.set(3, 2, 12, face([PAL.outline, PAL.outline])); // eyes
    v.box(0, 3, 11, 4, 3, 14, null); v.box(1, -1, 15, 3, 1, 15, gr);                        // hood top
    return v.render(32, 48, { ox: 16, oy: 34 });
  },
};
