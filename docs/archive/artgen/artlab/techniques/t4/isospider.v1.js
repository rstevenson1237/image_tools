// T4 iso spider v1: ellipsoid abdomen + thorax, 8 legs as 3D polylines (knee up, foot down), facing +x+y.
const { PAL } = require('../../lib/core');
const { Voxels, face } = require('../../lib/voxel');
module.exports = {
  notes: 'Ellipsoids + 3D leg polylines mirrored x<->y',
  render() {
    const v = new Voxels(), P = face(PAL.purple), Pd = face(PAL.purple.slice(1));
    const legs = [[[4, 3, 2], [6, 1, 3], [7, 0, 0]], [[4, 3, 1], [6, 2, 3], [7, 2, 0]], [[3, 3, 1], [5, 0, 3], [5, -2, 0]], [[3, 2, 2], [3, -1, 3], [2, -2, 0]]];
    for (const [a, b, c] of legs) for (const sw of [false, true]) { const s = p => sw ? [p[1], p[0], p[2]] : p;
      v.line(s(a), s(b), Pd); v.line(s(b), s(c), Pd); }
    v.ellipsoid(1.5, 1.5, 2.5, 2.2, 2.2, 1.8, P);
    v.ellipsoid(4, 4, 1.5, 1.4, 1.4, 1.2, P);
    v.set(5, 4, 2, face([PAL.red[0], PAL.red[1]])); v.set(4, 5, 2, face([PAL.red[0], PAL.red[1]]));
    v.set(1, 1, 4, face([PAL.red[0], PAL.red[1]]));                   // hourglass mark
    return v.render(32, 32, { ox: 16, oy: 12 });
  },
};
