// Vendored by `artgen export --runtime` (artgen-runtime 1.4.0). Local edits are detected and kept;
// re-export with --force to overwrite them. Source: packages/artgen-runtime in rstevenson1237/image_tools.
/**
 * The lighting model of lit sprites, once, in the core (docs/STAGES.md §7.2): point lights over a sprite's normal map.
 * Adapters shade with the same maths in their shader (`pixiLitAdapter`); `shadeTexel` is the reference that tests and
 * the browser acceptance compare it with. Lights and texels live in the parent container's space, the space of
 * `sprite.at(x, y)`: y down, a light's `z` is its height above the sprite plane (the viewer is at +z).
 */

/** A point light: `radius` is where its falloff reaches zero; `color` is 0–1 per channel and `intensity` multiplies it. */
export interface PointLight { x: number; y: number; /** height above the sprite plane, px */ z: number; color: [number, number, number]; intensity: number; radius: number }

/** The lights of a scene. The game mutates it (move a lantern, change `ambient`) and the next frame uses the new values. */
export interface LightRig { ambient: [number, number, number]; lights: PointLight[]; /** 0 = smooth; n = quantise the light to n steps (pixel-art bands) */ bands: number }

/** Lights an adapter's shader takes (the first ones of `LightRig.lights`; the rest are ignored). */
export const MAX_LIGHTS = 8;

/** A unit normal from an atlas pixel (RGB 0–255, OpenGL convention: y up), as screen space (y down). Alpha 0, or no normal, faces the viewer. */
export function decodeNormal(r: number, g: number, b: number, a = 255): [number, number, number] {
  if (a === 0) return [0, 0, 1];
  const x = r / 127.5 - 1, y = -(g / 127.5 - 1), z = b / 127.5 - 1, l = Math.hypot(x, y, z);
  return l > 0 ? [x / l, y / l, z / l] : [0, 0, 1];
}

/**
 * Reference shading of one texel (the shader does the same): `albedo × (ambient + Σ banded Lambert × falloff × colour ×
 * intensity)` over the first `MAX_LIGHTS` lights, with Lambert = max(0, n · l), falloff = max(0, 1 − d / radius)², and
 * `bands` > 0 rounding the Lambert term to that many steps. (`px`, `py`) is the texel centre in the parent's space.
 * Albedo and the result are RGBA 0–255 (rounded, clamped); alpha is kept. `ambient: [1, 1, 1]` with no lights returns the albedo.
 */
export function shadeTexel(albedo: [number, number, number, number], normal: [number, number, number], px: number, py: number, rig: LightRig): [number, number, number, number] {
  let r = rig.ambient[0], g = rig.ambient[1], b = rig.ambient[2];
  const n = Math.min(rig.lights.length, MAX_LIGHTS);
  for (let i = 0; i < n; i++) {
    const L = rig.lights[i];
    if (!(L.radius > 0)) continue;
    const dx = L.x - px, dy = L.y - py, d = Math.hypot(dx, dy, L.z);
    let f = Math.max(0, 1 - d / L.radius);
    f *= f;
    let lam = Math.max(0, (normal[0] * dx + normal[1] * dy + normal[2] * L.z) / Math.max(d, 1e-6));
    if (rig.bands > 0) lam = Math.floor(lam * rig.bands + 0.5) / rig.bands;
    const k = lam * f * L.intensity;
    r += L.color[0] * k; g += L.color[1] * k; b += L.color[2] * k;
  }
  const q = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return [q(albedo[0] * r), q(albedo[1] * g), q(albedo[2] * b), albedo[3]];
}
