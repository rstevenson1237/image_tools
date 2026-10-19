/** Iso-lines on a sampled field (marching squares), joined into polylines, plus the smoothing that keeps maps calm. */

export interface Line { pts: number[]; closed: boolean }

/**
 * Marching squares over `f` (`w × h` samples) at level `t`. Returns joined polylines in sample coordinates (sample
 * (i, j) at (i, j)); lines that reach the edge of the field stay open. Saddles are resolved by the cell's mean.
 */
export function isolines(f: Float32Array, w: number, h: number, t: number): Line[] {
  const segs: [string, number, number, string, number, number][] = [];
  const hk = (i: number, j: number) => `h${j * w + i}`, vk = (i: number, j: number) => `v${j * w + i}`;
  const lerp = (a: number, b: number) => (a === b ? 0.5 : (t - a) / (b - a));
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const a = f[j * w + i], b = f[j * w + i + 1], c = f[(j + 1) * w + i + 1], d = f[(j + 1) * w + i];
    const k = (a >= t ? 8 : 0) | (b >= t ? 4 : 0) | (c >= t ? 2 : 0) | (d >= t ? 1 : 0);
    if (k === 0 || k === 15) continue;
    const T = (): [string, number, number] => [hk(i, j), i + lerp(a, b), j];
    const R = (): [string, number, number] => [vk(i + 1, j), i + 1, j + lerp(b, c)];
    const B = (): [string, number, number] => [hk(i, j + 1), i + lerp(d, c), j + 1];
    const L = (): [string, number, number] => [vk(i, j), i, j + lerp(a, d)];
    const add = (p: [string, number, number], q: [string, number, number]) => segs.push([...p, ...q]);
    const mid = (a + b + c + d) / 4 >= t;
    switch (k) {
      case 1: case 14: add(L(), B()); break;
      case 2: case 13: add(B(), R()); break;
      case 3: case 12: add(L(), R()); break;
      case 4: case 11: add(T(), R()); break;
      case 6: case 9: add(T(), B()); break;
      case 7: case 8: add(L(), T()); break;
      case 5: if (mid) { add(L(), T()); add(B(), R()); } else { add(T(), R()); add(L(), B()); } break;
      case 10: if (mid) { add(T(), R()); add(L(), B()); } else { add(L(), T()); add(B(), R()); } break;
    }
  }
  const at = new Map<string, number[]>();
  segs.forEach((s, n) => { for (const key of [s[0], s[3]]) { const l = at.get(key); if (l) l.push(n); else at.set(key, [n]); } });
  const used = new Uint8Array(segs.length), lines: Line[] = [];
  /** Walk from `key` away from segment `from`, appending points to `out`; returns the key it stopped at. */
  const walk = (key: string, from: number, out: number[]): string => {
    for (let cur = from, k = key; ;) {
      const next = (at.get(k) ?? []).find(n => n !== cur && !used[n]);
      if (next === undefined) return k;
      used[next] = 1;
      const s = segs[next], far = s[0] === k ? 3 : 0;
      out.push(s[far + 1] as number, s[far + 2] as number);
      cur = next; k = s[far] as string;
    }
  };
  for (let n = 0; n < segs.length; n++) {
    if (used[n]) continue;
    used[n] = 1;
    const s = segs[n], fwd = [s[1], s[2], s[4], s[5]];
    const endKey = walk(s[3], n, fwd);
    if (endKey === s[0]) { fwd.length -= 2; lines.push({ pts: fwd, closed: true }); continue; }
    const back: number[] = [];
    walk(s[0], n, back);
    const pts: number[] = [];
    for (let q = back.length - 2; q >= 0; q -= 2) pts.push(back[q], back[q + 1]);
    lines.push({ pts: pts.concat(fwd), closed: false });
  }
  return lines;
}

/** Chaikin corner cutting; open lines keep their end points. */
export function chaikin(l: Line, passes = 2): Line {
  let p = l.pts;
  for (let k = 0; k < passes && p.length >= 6; k++) {
    const n = p.length / 2, out: number[] = [];
    if (!l.closed) out.push(p[0], p[1]);
    for (let i = 0; i < (l.closed ? n : n - 1); i++) {
      const j = (i + 1) % n, x0 = p[i * 2], y0 = p[i * 2 + 1], x1 = p[j * 2], y1 = p[j * 2 + 1];
      out.push(x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25, x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75);
    }
    if (!l.closed) out.push(p[p.length - 2], p[p.length - 1]);
    p = out;
  }
  return { pts: p, closed: l.closed };
}

/** Douglas–Peucker: drop points within `eps` of the line through their neighbours (keeps files small). */
export function simplifyLine(l: Line, eps: number): Line {
  const p = l.pts, n = p.length / 2;
  if (n < 4) return l;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!, ax = p[a * 2], ay = p[a * 2 + 1], dx = p[b * 2] - ax, dy = p[b * 2 + 1] - ay, len = Math.hypot(dx, dy) || 1;
    let best = -1, far = 0;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((p[i * 2] - ax) * dy - (p[i * 2 + 1] - ay) * dx) / len;
      if (d > far) { far = d; best = i; }
    }
    if (best >= 0 && far > eps) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 2], p[i * 2 + 1]);
  return { pts: out, closed: l.closed };
}

export const lineLength = (p: number[]): number => {
  let s = 0;
  for (let i = 2; i < p.length; i += 2) s += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
  return s;
};

/** SVG path data for lines, coordinates multiplied by `k`, one decimal. */
export function pathData(lines: Line[], k = 1): string {
  const f = (v: number) => (Math.round(v * k * 10) / 10).toString();
  return lines.map(l => {
    let d = `M${f(l.pts[0])} ${f(l.pts[1])}`;
    for (let i = 2; i < l.pts.length; i += 2) d += `L${f(l.pts[i])} ${f(l.pts[i + 1])}`;
    return l.closed ? d + 'Z' : d;
  }).join('');
}
