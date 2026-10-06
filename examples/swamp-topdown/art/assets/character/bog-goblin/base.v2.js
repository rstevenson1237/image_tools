// bog-goblin base.v2 (r2) — v1 + thicker ears with an inner tone, a lighter belly so torso and head separate.
// From the humanoid template: hunched bog goblin, mud-green skin (cloth ramp: the
// direction's greens), oversized ears, a rusty cleaver. Head sits low and forward over a small body; bowed legs.
export const meta = { brief: 'bog-goblin', pass: 'r2', notes: 'hunched goblin, big ears, cleaver' };

export const params = {
  ears: { type: 'range', min: 0.8, max: 1.3, default: 1 },
  rag: { type: 'swap', options: ['leather', 'dirt'], default: 'leather' },
};

export function render(ctx) {
  const { pal } = ctx.dir, P = ctx.params, [w, h] = ctx.size, s = ctx.lib.t2.scene(w, h), cx = w / 2, X = v => (v * w) / 32;
  const skin = pal.cloth, foot = h * 0.95, hip = h * 0.74, sh = h * 0.47;
  // bowed legs
  s.add({ type: 'group', name: 'legs', underlay: true, mat: skin, shade: 'cyl', children: [
    { type: 'capsule', a: [cx - X(3), hip], b: [cx - X(5), foot - X(1)], r: Math.max(1, X(1.6)) },
    { type: 'capsule', a: [cx + X(3), hip], b: [cx + X(5), foot - X(1)], r: Math.max(1, X(1.6)) },
  ] });
  // hunched torso and a rag loincloth
  s.add({ type: 'group', name: 'body', underlay: true, children: [
    { type: 'ellipse', name: 'torso', cx, cy: (sh + hip) / 2 + X(1), rx: X(6.5), ry: (hip - sh) / 2 + X(1.5), mat: skin, shade: 'normal' },
    { type: 'ellipse', name: 'belly', cx: cx - X(0.5), cy: (sh + hip) / 2 + X(2.5), rx: X(3.5), ry: (hip - sh) / 2 - X(0.5), mat: skin, shade: 'flat', band: 0 },
    { type: 'path', name: 'rag', d: `M${cx - X(6)} ${hip - X(2)} H${cx + X(6)} L${cx + X(3)} ${hip + X(3)} L${cx} ${hip + X(1.5)} L${cx - X(3)} ${hip + X(3)} Z`, mat: pal[P.rag], shade: 'flat', band: 1 },
  ] });
  // long arms; the cleaver in the viewer-left hand
  s.add({ type: 'group', name: 'arms', underlay: true, mirrorX: cx, children: [
    { type: 'capsule', a: [cx - X(5.5), sh + X(2)], b: [cx - X(8), hip + X(1)], r: Math.max(1, X(1.4)), mat: skin, shade: 'cyl' },
  ] });
  const hx = cx - X(8.5), hy = hip + X(1);
  s.add({ type: 'group', name: 'cleaver', underlay: true, children: [
    { type: 'rect', name: 'handle', x: hx - X(0.7), y: hy - X(2), w: X(1.4), h: X(4), mat: pal.leather, shade: 'flat', band: 1 },
    { type: 'path', name: 'blade', d: `M${hx - X(3.5)} ${hy - X(9)} H${hx + X(0.8)} V${hy - X(2)} H${hx - X(3.5)} Z`, mat: pal.metal, shade: 'bevel', round: X(1) },
  ] });
  // big head, low and forward; ears sweep out to the sides
  const headY = sh - X(2), er = P.ears;
  s.add({ type: 'group', name: 'head', underlay: true, children: [
    { type: 'path', name: 'ears', d: `M${cx - X(4)} ${headY - X(3)} L${cx - X(4) - X(9) * er} ${headY - X(5) * er} L${cx - X(3)} ${headY + X(3)} Z M${cx + X(4)} ${headY - X(3)} L${cx + X(4) + X(9) * er} ${headY - X(5) * er} L${cx + X(3)} ${headY + X(3)} Z`, mat: skin, shade: 'flat', band: 1 },
    { type: 'path', name: 'inner-ears', d: `M${cx - X(5)} ${headY - X(1.5)} L${cx - X(4) - X(7) * er} ${headY - X(4.2) * er} L${cx - X(4.5)} ${headY + X(1)} Z M${cx + X(5)} ${headY - X(1.5)} L${cx + X(4) + X(7) * er} ${headY - X(4.2) * er} L${cx + X(4.5)} ${headY + X(1)} Z`, mat: pal.skin, shade: 'flat', band: 2 },
    { type: 'ellipse', name: 'skull', cx, cy: headY, rx: X(6), ry: X(5.5), mat: skin, shade: 'sphere' },
    { type: 'ellipse', name: 'snout', cx, cy: headY + X(2.5), rx: X(3), ry: X(2), mat: skin, shade: 'flat', band: 1 },
  ] });
  s.add({ type: 'rect', name: 'eye', x: Math.round(cx - X(3)), y: Math.round(headY - X(1)), w: 1, h: 1, mat: pal.accent, shade: 'flat', band: 0, mirrorX: cx });
  s.add({ type: 'rect', name: 'mouth', x: cx - X(2), y: headY + X(3.5), w: X(4), h: 1, color: 'outline' });
  return ctx.lib.proc(s).add('materialNoise', { part: 'torso', amount: 0.2 }).render();
}

export const anchors = ctx => ({ head: [ctx.size[0] >> 1, Math.round(ctx.size[1] * 0.4)] });
