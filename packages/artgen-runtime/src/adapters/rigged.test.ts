// Runtime 1.5 (R7b): `riggedModel` plays a rigged .glb's clips by state (looping as exported, one-shots hold their last
// pose) and shows the level of detail for the camera's distance. The loader is a stand-in returning what GLTFLoader
// gives (a scene, its animations, the file's extras as userData); the browser acceptance loads a real file.
import { AnimationClip, Bone, Group, Object3D, PerspectiveCamera, QuaternionKeyframeTrack, Quaternion, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { riggedModel, type RiggedInfo } from './three.js';

function fake() {
  const scene = new Group(), bone = new Bone();
  bone.name = 'armR_up';
  scene.add(bone);
  for (const n of ['hero_LOD0', 'hero_LOD1']) { const o = new Object3D(); o.name = n; scene.add(o); }
  const q = (deg: number) => new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (deg * Math.PI) / 180).toArray();
  const clip = (name: string, d: number, to: number) => new AnimationClip(name, d, [new QuaternionKeyframeTrack('armR_up.quaternion', [0, d / 2, d], [...q(0), ...q(to), ...q(0)])]);
  const info: RiggedInfo = {
    rig: { plan: 'biped', set: 'biped', height: 18, bones: ['armR_up'] }, metresPerUnit: 0.1,
    lods: [{ node: 2, name: 'hero_LOD0', triangles: 4000, budget: 4000, distance: 0 }, { node: 3, name: 'hero_LOD1', triangles: 1000, budget: 1000, distance: 8 }],
    clips: { idle: { duration: 2, loop: true, keys: 16 }, attack: { duration: 0.5, loop: false, keys: 16 } },
  };
  return { bone, loader: { loadAsync: async () => ({ scene, animations: [clip('idle', 2, 10), clip('attack', 0.5, 90)], userData: { artgen: info } }) } };
}

describe('riggedModel', () => {
  test('starts on idle, plays a state\'s clip, and a one-shot holds its end', async () => {
    const { bone, loader } = fake(), m = await riggedModel(loader, 'hero.rigged.glb');
    expect(m.state).toBe('idle');
    expect(Object.keys(m.clips)).toEqual(['idle', 'attack']);
    m.update(1000);
    expect(bone.quaternion.x).toBeGreaterThan(0.05); // half way through idle: the arm is turned
    m.play('attack', { fade: 0 }).update(250);
    expect(m.done).toBe(false);
    expect(new Vector3(1, 0, 0).applyQuaternion(bone.quaternion).x).toBeCloseTo(1, 5);
    expect(2 * Math.acos(Math.min(1, bone.quaternion.w)) * (180 / Math.PI)).toBeCloseTo(90, 0);
    m.update(400);
    expect(m.done).toBe(true);
    m.update(500);
    expect(m.state).toBe('attack');
    expect(() => m.play('dance')).toThrow(/no clip dance \(has idle, attack\)/);
  });

  test('picks the level of detail by the camera\'s distance; moves and turns as one object', async () => {
    const { loader } = fake(), m = await riggedModel(loader, 'hero.rigged.glb'), cam = new PerspectiveCamera();
    const shown = () => m.lods.map(l => l.object.visible);
    expect(shown()).toEqual([true, false]);
    cam.position.set(0, 0, 3); m.update(16, cam);
    expect([m.lod, ...shown()]).toEqual([0, true, false]);
    cam.position.set(0, 0, 20); m.update(16, cam);
    expect([m.lod, ...shown()]).toEqual([1, false, true]);
    // scaled down to half, it switches at half the distance
    m.object.scale.setScalar(0.5); m.object.updateMatrixWorld();
    cam.position.set(0, 0, 6); m.update(16, cam);
    expect(m.lod).toBe(1);
    m.object.scale.setScalar(1); m.object.updateMatrixWorld();
    m.at(1, 0, 2).face(Math.PI / 2);
    expect(m.object.position.toArray()).toEqual([1, 0, 2]);
    expect(m.object.rotation.y).toBeCloseTo(Math.PI / 2, 9);
  });

  test('a .glb that artgen rig did not write is refused', async () => {
    await expect(riggedModel({ loadAsync: async () => ({ scene: new Group(), animations: [], userData: {} }) }, 'x.glb')).rejects.toThrow(/not a rigged model/);
  });
});
