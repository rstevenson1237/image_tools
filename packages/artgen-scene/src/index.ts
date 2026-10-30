/** Scene layer (docs/TOOLING-PLAN.md §6): the art direction types, Scene2D/Scene3D, procedural layers, voxels, views and cameras, animation, effects, textures. Imports only primitives. */

export * from './direction.ts';
export * from './views/camera.ts';
export * from './views/views.ts';
export * from './views/fp.ts';
export * from './tex/materials.ts';
export * from './tex/iso.ts';
export * from './tex/wfc.ts';
export * from './tex/lsystem.ts';
export { autotile, autotileMask, autotileCount, autotileCovers, autotileSheet, autotileMap, autotileIndexOf, BLOB47 } from './tex/autotile.ts';
export { rasterVoxels, VoxelGrid, VoxelCaster, smoothNormal, bandFor, type VoxelSet, type VoxelCell, type VoxelRaster, type VoxelRasterOptions } from './voxel/raster.ts';
export * from './voxel/vox.ts';
export { greedyMesh, voxelGlb, readGlbJson, type Quad } from './voxel/gltf.ts';
export { Scene2D, type Spec, type Scene2DOptions, type Shade } from './t2/scene.ts';
export { Scene3D, type Spec3, type Render3DOptions } from './t2/scene3d.ts';
export { Proc, LAYERS, valueNoise } from './t2/proc.ts';
export { resolveParams, paramSchema, paramDefault, type ParamSpec } from './t2/params.ts';
export { ease, track, blend, pingpong, rig, solveTwoBone, spring, sweep, cellTiming, type Ease, type BoneDef, type RigDef, type Rig, type Pose, type Bone, type SpringOptions, type SpringChain, type RootAt, type CellTiming } from './anim/anim.ts';
export { RIG_PLANS, BODY_PLAN, PROPORTIONS, bodyRig, facingYaw, type RigPlan, type Proportions, type BodyRig, type BodyRigOptions, type BodyPose } from './anim/rigs.ts';
export { flame, particles, simulate, drawParticles, colorRun, preset, PRESETS, PRESET_NAMES, paletteCycle, type Emitter, type Particle, type ParticleOptions, type PresetOptions, type FlameOptions } from './fx/particles.ts';
