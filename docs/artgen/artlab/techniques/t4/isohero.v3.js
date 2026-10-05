// T4 iso hero v3 (from v2): edge-light off (it became speckle after downsampling), face pushed forward,
// wider hood opening so the face reads.
// T4 iso hero v2: "3D->pixel pipeline": same rogue authored in coarse units but k=2 finer voxels,
// ellipsoid hood/head, flared cloak; rendered at 2x then majority-downsampled; outline + shadow at final res.
const { PAL } = require('../../lib/core');
const { Voxels, face } = require('../../lib/voxel');
module.exports = {
  notes: 'v3: no edge-light, face forward; k=2 voxels, ellipsoid hood, ss=2 downsample, final-res outline',
  render() {
    const v = new Voxels({ k: 2 }), skin = face(PAL.skin), gr = face(PAL.green), grd = face(PAL.green.slice(1)), lea = face(PAL.leather), lead = face(PAL.leather.slice(1));
    v.box(-0.5, -0.5, 1.5, 4.5, 0, 4, grd); v.box(0, -0.5, 4, 4, 0, 11, grd);                   // cloak back, flared hem
    v.box(1, 1, 0, 1.5, 2, 0.5, lea); v.box(2.5, 1, 0, 3, 2, 0.5, lea);                         // boots
    v.box(1, 1, 1, 1.5, 2, 4.5, lead); v.box(2.5, 1, 1, 3, 2, 4.5, lead);                       // legs
    v.box(1, 0.5, 5, 3, 2, 10, lea); v.box(1, 2, 6.5, 3, 2.5, 6.5, face(PAL.gold));              // tunic, belt
    v.box(-0.5, 0, 3, 0.5, 2.5, 11, gr); v.box(3.5, 0, 3, 4.5, 2.5, 11, gr);                    // cloak sides
    v.ellipsoid(2.2, 1.3, 13.2, 2.6, 2.4, 2.7, gr);                                              // hood
    v.box(0.8, 1.8, 11.3, 3.4, 4, 13.8, null);                                                         // carve opening
    v.ellipsoid(2.2, 2, 12.4, 1.5, 1.2, 1.5, skin);                                            // face
    for (const x of [3, 6]) { const z = 25; let y = 0; while (v.has(x, y + 1, z)) y++; v.set(x, y, z, face([PAL.outline, PAL.outline])); }
    v.ellipsoid(4.6, 2.6, 6.2, 0.6, 0.6, 0.6, skin); v.line([4.6, 2.9, 5.5], [4.6, 2.9, 3], face(PAL.steel)); // hand + dagger
    return v.render(32, 48, { ox: 15, oy: 33, ss: 2, shadowAt: [16, 43, 9], edgeLight: false });
  },
};
