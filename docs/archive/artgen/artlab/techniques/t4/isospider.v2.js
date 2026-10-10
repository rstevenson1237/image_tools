// T4 iso spider v2: k=2 finer voxels (legs become 1 fine voxel thick = 2px), smoother ellipsoids,
// painted hourglass + eyes found by surface search; ss=2 downsample, final-res outline + shadow.
const { PAL } = require('../../lib/core');
const { Voxels, face } = require('../../lib/voxel');
module.exports = {
  notes: 'k=2, thin legs, surface-painted marks, ss=2',
  render() {
    const v = new Voxels({ k: 2 }), P = face(PAL.purple), Pd = face(PAL.purple.slice(1)), R = face([PAL.red[0], PAL.red[1], PAL.red[2]]);
    const legs = [[[4, 3, 2], [6.5, 1, 3.5], [7.5, -0.5, 0]], [[4, 3, 1.5], [6.5, 2, 3.5], [7.5, 2, 0]], [[3, 3, 1.5], [5, -0.5, 3.5], [5, -2, 0]], [[3, 2, 2], [3, -1.5, 3.5], [1.5, -2.5, 0]]];
    for (const [a, b, c] of legs) for (const sw of [false, true]) { const s = p => sw ? [p[1], p[0], p[2]] : p; v.line(s(a), s(b), Pd); v.line(s(b), s(c), Pd); }
    v.ellipsoid(1.5, 1.5, 2.6, 2.3, 2.3, 1.9, P); v.ellipsoid(4, 4, 1.6, 1.5, 1.5, 1.2, P);
    v.paint((x, y, z, r) => r === P && z >= 8 && Math.abs(x - y) <= 1 && x + y >= 4 && x + y <= 8 ? R : null);       // hourglass
    for (const [x, y] of [[10, 11], [11, 10], [9, 11], [11, 9]]) { let z = 6; while (z > 0 && !v.has(x, y, z)) z--; if (z > 0) v.set(x, y, z, R); } // eyes
    return v.render(32, 32, { ox: 16, oy: 11, ss: 2, shadowAt: [16, 22, 10] });
  },
};
