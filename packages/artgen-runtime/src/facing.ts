/**
 * Facing math. Angles are screen angles in radians: x right, y down, so `e` = 0, `s` = π/2 (towards the viewer in
 * top-down and iso), `w` = π, `n` = −π/2. Facings are compass names (4, 8 or 16 of them).
 */

const COMPASS = ['e', 'ese', 'se', 'sse', 's', 'ssw', 'sw', 'wsw', 'w', 'wnw', 'nw', 'nnw', 'n', 'nne', 'ne', 'ene'];
const TAU = Math.PI * 2;

/** Screen angle of a compass facing name. */
export function facingAngle(name: string): number {
  const i = COMPASS.indexOf(name);
  if (i < 0) throw new Error(`unknown facing "${name}"`);
  return (i * TAU) / 16;
}

/** Smallest absolute difference between two angles. */
export function angleDelta(a: number, b: number): number {
  const d = (((a - b) % TAU) + TAU) % TAU;
  return Math.min(d, TAU - d);
}

export interface FacingChoice { index: number; flipX: boolean }

/**
 * Nearest facing to `angle` among the exported facings and their mirrors (mirror-aware: a pack with only east-side
 * facings shows west by flipping). An exported facing always wins over a mirror at the same angle.
 */
export function chooseFacing(facings: readonly string[], angle: number): FacingChoice {
  let best: FacingChoice = { index: 0, flipX: false }, bd = Infinity;
  const angles = facings.map(facingAngle);
  angles.forEach((a, index) => {
    const d = angleDelta(angle, a);
    if (d < bd - 1e-9) { bd = d; best = { index, flipX: false }; }
  });
  angles.forEach((a, index) => {
    const m = Math.PI - a;
    if (angles.some(x => angleDelta(x, m) < 1e-9)) return;
    const d = angleDelta(angle, m);
    if (d < bd - 1e-9) { bd = d; best = { index, flipX: true }; }
  });
  return best;
}

/** Screen angle of a movement vector (dx right, dy down). */
export const angleOf = (dx: number, dy: number): number => Math.atan2(dy, dx);
