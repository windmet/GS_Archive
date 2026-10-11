import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Container } from 'pixi.js';
import {
  SkeletonBinary, Skeleton, AnimationState, AnimationStateData,
  RegionAttachment, MeshAttachment, BoundingBoxAttachment,
  PathAttachment, PointAttachment, ClippingAttachment,
} from '@pixi-spine/runtime-3.8';
import { decodeUnitySpineSkeleton } from '../shared/story/SpineBinary.js';
import { StudioCompositionStage } from '../src/core/StudioCompositionStage.js';

// Real animation/skeleton state; no GPU, HTTP, or replacement animation data.
class Attachments {
  newRegionAttachment(_s, n) { return new RegionAttachment(n); }
  newMeshAttachment(_s, n) { return new MeshAttachment(n); }
  newBoundingBoxAttachment(_s, n) { return new BoundingBoxAttachment(n); }
  newPathAttachment(_s, n) { return new PathAttachment(n); }
  newPointAttachment(_s, n) { return new PointAttachment(n); }
  newClippingAttachment(_s, n) { return new ClippingAttachment(n); }
}
const stage = Object.create(StudioCompositionStage.prototype);
stage.actorInstances = new Map();
stage.playing = false;
stage.render = () => {};
for (const [idolId, modelId, motion, neck, faceTime] of [
  [5, '005kao_002_00', 'angry', null, 3.4],
  [4, '004ter_001_00', 'hello', null, 0],
  [40, '040ren_005_00', 'weight', null, 0],
  [5, '005kao_002_00', 'sad', 'neck_question', 3.4],
]) {
  const bindings = JSON.parse(await fs.readFile(`public/data/masterdata/domains/photo_costumes/${idolId}.json`, 'utf8'));
  const buffer = await fs.readFile(`public${bindings.models[modelId].skeleton.url}`);
  const data = new SkeletonBinary(new Attachments()).readSkeletonData(new Uint8Array(decodeUnitySpineSkeleton(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  )));
  const skeleton = new Skeleton(data), state = new AnimationState(new AnimationStateData(data));
  const id = `actor-${stage.actorInstances.size}`;
  const row = { instanceId: id, poseTime: null, faceTime, scale: 1, layoutBasis: 'source-bounds' };
  const model = {
    row, names: data.animations.map(a => a.name), neckBones: [], neckSlots: [], flags: {},
    spine: Object.assign(new Container(), { skeleton, state, update(delta) { state.update(delta); state.apply(skeleton); skeleton.updateWorldTransform(); } }),
  };
  stage.actorInstances.set(id, model);
  stage.setActorPose(id, { motion, neck, commands: [], label: id }, { face: 'face_trouble', commands: [], label: 'face' });
}
function snapshot(model) {
  return {
    body: model.spine.state.getCurrent(0).animation.name,
    bones: model.spine.skeleton.bones.map(b => [b.x, b.y, b.rotation, b.scaleX, b.scaleY, b.shearX, b.shearY]),
    slots: model.spine.skeleton.slots.map(s => [s.getAttachment()?.name, s.color.r, s.color.g, s.color.b, s.color.a, [...s.deform]]),
  };
}
const originalRows = JSON.stringify([...stage.actorInstances.values()].map(m => m.row));
for (const poseTime of [null, 0.42]) {
  for (const [id, model] of stage.actorInstances) {
    model.row.poseTime = poseTime;
    stage.setActorPose(id, model.pose, model.face);
  }
  const frames = [...stage.actorInstances.values()].map(snapshot);
  stage.setPlaying(true);
  for (const model of stage.actorInstances.values()) {
    const body = model.spine.state.getCurrent(0);
    assert.equal(body.animation.name, model.pose.motion, 'Preview must start the source main clip, rather than replaying the static loop');
    assert.equal(body.trackTime, 0);
    assert.equal(body.next?.animation.name, `${model.pose.motion}_loop`);
    assert.equal(model.spine.state.getCurrent(1).trackTime, 0, 'Expression previews start independently of the saved blink frame');
    stage.updateModel(model, body.animation.duration + 0.1);
    stage.updateModel(model, 0.1);
    assert.equal(model.spine.state.getCurrent(0).animation.name, `${model.pose.motion}_loop`);
  }
  stage.setPlaying(false);
  assert.deepEqual([...stage.actorInstances.values()].map(snapshot), frames, 'Stop must restore exact body, face, neck and attachment state for every instance');
  for (const model of stage.actorInstances.values()) {
    assert.equal(model.spine.state.getCurrent(1).trackTime, model.row.faceTime);
    stage.updateModel(model, 0);
  }
  assert.deepEqual([...stage.actorInstances.values()].map(snapshot), frames, 'Repeated static updates must not accumulate neck transforms');
}
for (const model of stage.actorInstances.values()) model.row.poseTime = null;
assert.equal(JSON.stringify([...stage.actorInstances.values()].map(m => m.row)), originalRows, 'Preview must never rewrite the saved document');
console.log('Studio animation: real multi-actor main→loop preview, exact saved body/face/neck restoration and stable static frame passed');
