// {{ID}} base.v1 (r1) — template: serpent (snake, eel, naga tail, worm) with four facings and a slither over ctx.t
// (iso camera: a 2D sprite per facing on a 2:1 ground shadow). The body is a chain of discs along a travelling wave on the ground; the head rises from the
// front end — at the side in profile (e/w), towards the viewer (s), hidden behind the coils from the back (n). It lies
// on the `ground` anchor: length and girth come from the brief (`height` is how high the head rears), not the frame.
// For a naga, put a humanoid torso on the head end. Adapt the head, the frill or fins, the pattern; role ramps only (R11).
export const meta = { brief: '{{ID}}', pass: 'r1', notes: 'template iso serpent rig' };

export const params = {
  scales: { type: 'swap', options: ['grass', 'skin', 'leather', 'cloth'], default: 'grass' },
  girth: { type: 'range', min: 0.7, max: 1.4, default: 1 },
  belly: { type: 'toggle', default: true },
};

const YAW = { s: 0, se: 45, e: 90, ne: 135, n: 180, sw: -45, w: -90, nw: -135 };

function layout(ctx) {
  const [w, h] = ctx.size, yaw = (YAW[ctx.facing] ?? 0) * Math.PI / 180, sx = Math.sin(yaw), front = Math.cos(yaw), side = Math.abs(sx);
  const X = v => (v * w) / 32, cx = w / 2, ground = Math.round(h * 0.95), r = X(2.6) * (ctx.params?.girth ?? 1);
  const ph = ctx.t * Math.PI * 2, moving = ctx.state === 'walk';
  // the coil: n discs from the tail (i = 0) to the neck, a wave travelling headward while it moves
  const n = 9, len = X(22) * (0.45 + 0.55 * side), depth = X(6) * (1 - 0.6 * side);
  const pts = Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1), wave = Math.sin(u * Math.PI * 2.2 - (moving ? ph : 0)) * X(2.2);
    // profile: along x; end-on: the body runs into the screen (up the frame), the wave goes sideways
    const x = cx + (side > 0.5 ? sx * (u - 0.5) * len : wave), y = ground - r - (side > 0.5 ? wave * 0.35 + X(0.5) : (front > 0 ? 1 - u : u) * depth);
    return [x, y];
  });
  const neck = pts[n - 1], rear = X(7) + (moving ? Math.sin(ph) * 0.5 : 0);
  const headR = r * 1.25, headX = neck[0] + sx * X(2), headY = neck[1] - rear;
  const showFace = front > -0.3;
  const eyeY = Math.round(headY - headR * 0.1);
  const eyes = !showFace ? [] : side > 0.9 ? [Math.round(headX + sx * headR * 0.35)] : [Math.round(headX - headR * 0.45), Math.round(headX + headR * 0.35)];
  const mouth = showFace ? [Math.round(side > 0.9 ? headX + sx * headR * 0.7 : headX - 0.5), Math.round(headY + headR * 0.45)] : null;
  return { w, h, X, cx, ground, sx, front, side, r, pts, neck, headR, headX, headY, showFace, eyes, eyeY, mouth };
}

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, s = ctx.lib.t2.scene(...ctx.size), L = layout(ctx), skin = pal[P.scales];
  const { X, front, r, pts, neck, headR, headX, headY, eyes, eyeY, sx } = L;
  // coils back to front: the far end first (from behind, the head end is the far end)
  const order = front < -0.2 ? [...pts.keys()].reverse() : [...pts.keys()];
  const coil = order.map(i => ({ type: 'circle', name: 'coil', cx: pts[i][0], cy: pts[i][1], r: r * (0.6 + 0.4 * (i / (pts.length - 1))), mat: skin, shade: 'sphere' }));
  const body = { type: 'group', name: 'body', underlay: true, children: [
    ...coil,
    ...(P.belly ? [{ type: 'ellipse', name: 'belly', cx: neck[0], cy: neck[1] + r * 0.35, rx: r * 0.7, ry: r * 0.3, mat: skin, shade: 'flat', band: 0 }] : []),
  ] };
  const head = { type: 'group', name: 'head', underlay: true, children: [
    { type: 'capsule', name: 'neck', a: [neck[0], neck[1]], b: [headX, headY], r: r * 0.85, mat: skin, shade: 'cyl' },
    { type: 'ellipse', name: 'skull', cx: headX + sx * headR * 0.2, cy: headY, rx: headR * (1 + 0.3 * Math.abs(sx)), ry: headR * 0.85, mat: skin, shade: 'sphere' },
  ] };
  if (front < -0.2) { s.add(head); s.add(body); } else { s.add(body); s.add(head); }
  for (const ex of eyes) s.add({ type: 'rect', name: 'eye', x: ex, y: eyeY, w: 1, h: Math.max(1, Math.round(X(1.2))), color: 'outline' });
  return ctx.lib.proc(s).add('materialNoise', { part: 'coil', amount: 0.2 }).add('groundShadow', {}).render();
}

export const anchors = ctx => {
  const L = layout(ctx), a = { ground: [Math.round(L.cx), L.ground], head: [Math.round(L.headX), Math.round(L.headY)], hand: [Math.round(L.headX), Math.round(L.headY)] };
  if (L.front > -0.2) L.eyes.forEach((x, i) => { a[i ? 'eye2' : 'eye'] = [x, L.eyeY]; });
  if (L.mouth && L.front > -0.2) a.mouth = L.mouth;
  return a;
};
