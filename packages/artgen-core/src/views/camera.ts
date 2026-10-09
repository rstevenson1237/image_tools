/**
 * View cameras (SPEC §7, §8): one orthographic projection per view, used by the voxel `raster` renderer and the view
 * modules. A camera works in the model's frame after the facing yaw: x right, y toward the viewer (south), z up. It
 * maps a point to screen pixels with a 2×3 matrix `M` (pixel-art projections are affine, not rotations: iso is exactly
 * 2:1, oblique and side keep heights at full size), says which way is nearer (`dv`, the depth functional) and gives an
 * orthonormal screen basis (`R` right, `D` down, `V` toward the viewer) to light normals with the direction's
 * screen-space light ([x right, y down, z toward the viewer]).
 */
export type V3 = [number, number, number];

export interface Camera {
  view: string;
  /** Screen px per voxel unit: row 0 → x, row 1 → y. */
  M: [V3, V3];
  /** Depth functional: larger = nearer the viewer for points on one screen pixel. */
  dv: V3;
  /** Screen basis in model (yawed) space, orthonormal. */
  R: V3;
  D: V3;
  V: V3;
  /** Normal (model space) of the surface that takes the middle band; default V (what faces the viewer). Oblique and
   * billboard cameras look at walls from above, so the wall facing the camera (+y) is the mid tone and tops are lit. */
  ref?: V3;
}

const norm = (v: V3): V3 => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export interface CameraOptions {
  /** Pixels per voxel unit along screen x (default 2: one voxel step is 2 px across in every view, as in `cubes`). */
  scale?: number;
  /** oblique: share of a cube's height taken by its front face (direction `camera.oblique.frontRatio`, default 0.5). */
  frontRatio?: number;
  /** billboard: camera elevation in degrees (default 15). */
  elevation?: number;
}

/** Views a camera exists for (`stack` renders z-slices top-down; `fp` assets are textures and billboards). */
export const CAMERA_VIEWS = ['iso', 'topdown', 'oblique', 'side', 'billboard'] as const;

export function camera(view: string, o: CameraOptions = {}): Camera {
  const s = o.scale ?? 1;
  const sc = (m: [V3, V3]): [V3, V3] => [m[0].map(v => v * s) as V3, m[1].map(v => v * s) as V3];
  switch (view) {
    case 'iso': // 2:1 dimetric: x → (2, 1), y → (−2, 1), z → (0, −2) px; seen from +x +y +z
      return { view, M: sc([[2, -2, 0], [1, 1, -2]]), dv: [1, 1, 1], R: norm([1, -1, 0]), D: norm([1, 1, -2]), V: norm([1, 1, 1]) };
    case 'topdown':
    case 'stack':
      return { view, M: sc([[2, 0, 0], [0, 2, 0]]), dv: [0, 0, 1], R: [1, 0, 0], D: [0, 1, 0], V: [0, 0, 1] };
    case 'side':
      return { view, M: sc([[2, 0, 0], [0, 0, -2]]), dv: [0, 1, 0], R: [1, 0, 0], D: [0, 0, -1], V: [0, 1, 0] };
    case 'oblique':
    case 'billboard':
    case 'fp': {
      // ground foreshortened by g, heights at full size; a cube shows top : front = g : 1
      const g = view === 'oblique' ? 1 / Math.min(0.95, Math.max(0.05, o.frontRatio ?? 0.5)) - 1 : Math.tan(((o.elevation ?? 15) * Math.PI) / 180);
      return { view, M: sc([[2, 0, 0], [0, 2 * g, -2]]), dv: [0, 1, g], R: [1, 0, 0], D: norm([0, g, -1]), V: norm([0, 1, g]), ref: [0, 1, 0] };
    }
    default: throw new Error(`no camera for view ${JSON.stringify(view)} (have: ${CAMERA_VIEWS.join(', ')})`);
  }
}

/** Facing → yaw in degrees (clockwise from `s` in 1/4/8/16 steps, matching FACINGS order and `cubes` rotations). */
export function facingYaw(facing: string): number {
  const ring16 = ['s', 'ssw', 'sw', 'wsw', 'w', 'wnw', 'nw', 'nnw', 'n', 'nne', 'ne', 'ene', 'e', 'ese', 'se', 'sse'];
  const i = ring16.indexOf(facing);
  if (i < 0) throw new Error(`unknown facing ${JSON.stringify(facing)}`);
  return i * 22.5;
}

/** Light vector in model (yawed) space from the direction's screen-space light. */
export function lightIn(cam: Camera, light: readonly number[]): V3 {
  const [lx, ly, lz] = light, l: V3 = [0, 0, 0];
  for (let i = 0; i < 3; i++) l[i] = lx * cam.R[i] + ly * cam.D[i] + lz * cam.V[i];
  return norm(l);
}

/** A model-space normal expressed in screen terms (x right, y down, z toward the viewer). */
export const toScreen = (cam: Camera, n: V3): V3 => [dot3(n, cam.R), dot3(n, cam.D), dot3(n, cam.V)];
