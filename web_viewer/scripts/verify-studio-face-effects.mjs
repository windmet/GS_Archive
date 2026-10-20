import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { Container } from 'pixi.js';
import {
  SkeletonBinary, Skeleton, AnimationState, AnimationStateData,
  RegionAttachment, MeshAttachment, BoundingBoxAttachment,
  PathAttachment, PointAttachment, ClippingAttachment,
} from '@pixi-spine/runtime-3.8';
import { decodeUnitySpineSkeleton } from '../shared/story/SpineBinary.js';
import { StudioCompositionStage, studioActorModel } from '../src/core/StudioCompositionStage.js';
import { verifiedStudioPreset } from '../src/core/PictureStudioPolicy.mjs';

// Every Photo Studio face preset, on its real skeleton: the idol_face [4]/[5] flags
// hide sweat/cheek exactly as IdolFigureSkeleton does (attachments cleared after
// Apply), and nothing else on the frame is touched.
class Attachments {
  newRegionAttachment(_s, n) { return new RegionAttachment(n); }
  newMeshAttachment(_s, n) { return new MeshAttachment(n); }
  newBoundingBoxAttachment(_s, n) { return new BoundingBoxAttachment(n); }
  newPathAttachment(_s, n) { return new PathAttachment(n); }
  newPointAttachment(_s, n) { return new PointAttachment(n); }
  newClippingAttachment(_s, n) { return new ClippingAttachment(n); }
}
const MEDIA = 'public/data/masterdata/domains/photo_media_idols';
const stage = Object.create(StudioCompositionStage.prototype);
stage.actorInstances = new Map();
stage.playing = false;
stage.render = () => {};
const skeletons = new Map();
async function skeletonData(url) {
  if (!skeletons.has(url)) {
    const buffer = await fs.readFile(`public${url}`);
    skeletons.set(url, new SkeletonBinary(new Attachments()).readSkeletonData(new Uint8Array(decodeUnitySpineSkeleton(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    ))));
  }
  return skeletons.get(url);
}
const effectNames = slot => slot.data.name.startsWith('cheek') ? 'cheek' : slot.data.name.startsWith('swet') ? 'sweat' : null;
function frame(data, pose, face) {
  const skeleton = new Skeleton(data), state = new AnimationState(new AnimationStateData(data));
  const model = studioActorModel({
    row: { instanceId: 'a', poseTime: null, faceTime: 0, scale: 1, layoutBasis: 'source-bounds' },
    names: data.animations.map(a => a.name),
    spine: Object.assign(new Container(), { skeleton, state, update(delta) { state.update(delta); state.apply(skeleton); skeleton.updateWorldTransform(); } }),
  });
  stage.actorInstances.set('a', model);
  stage.setActorPose('a', pose, face);
  stage.updateModel(model, 0);
  return skeleton.slots.map(slot => ({ effect: effectNames(slot), attachment: slot.getAttachment()?.name ?? null, alpha: slot.color.a }));
}
const withFlags = (face, sweat, cheek) => ({
  ...face,
  commands: face.commands.map(c => c.type === 'idol_face' ? { ...c, values: c.values.map((v, i) => i === 4 ? sweat : i === 5 ? cheek : v) } : c),
});
let presets = 0, hidden = 0, shownWhenOn = 0;
const flags = new Set();
for (const file of (await fs.readdir(MEDIA)).filter(f => f.endsWith('.json'))) {
  const media = JSON.parse(await fs.readFile(`${MEDIA}/${file}`, 'utf8'));
  const poses = new Map();
  for (const [key, entry] of Object.entries(media.entries))
    if (key.startsWith('poses:') && entry.preset?.motion && !poses.has(entry.preset.modelId)) poses.set(entry.preset.modelId, key.slice(6));
  for (const [key, entry] of Object.entries(media.entries)) {
    if (!key.startsWith('faces:')) continue;
    const modelId = entry.preset.modelId, poseId = poses.get(modelId);
    if (!poseId) continue;
    const pose = verifiedStudioPreset(media, 'poses', poseId, modelId), face = verifiedStudioPreset(media, 'faces', key.slice(6), modelId);
    const command = face.commands.find(c => c.type === 'idol_face');
    assert(command, `${key}: face preset without idol_face`);
    flags.add(command.values.slice(4, 6).join('/'));
    const data = await skeletonData(media.models[modelId].skeleton.url);
    const on = frame(data, pose, withFlags(face, '', ''));
    presets++;
    // The real presets are all off/off; the mixed cases pin which column is which.
    for (const [sweat, cheek] of [command.values.slice(4, 6), ['off', ''], ['', 'off']]) {
      const off = frame(data, pose, withFlags(face, sweat, cheek));
      for (const [i, slot] of off.entries()) {
        const sweatOff = sweat === 'off', cheekOff = cheek === 'off';
        if ((slot.effect === 'sweat' && sweatOff) || (slot.effect === 'cheek' && cheekOff)) {
          assert.equal(slot.attachment, null, `${key}: ${slot.effect} slot must be cleared after Apply`);
          if (on[i].attachment) hidden++;
        } else {
          assert.deepEqual(slot, on[i], `${key}: flags must touch only cheek/sweat slots`);
        }
        if (slot.effect) assert.equal(slot.alpha, on[i].alpha, `${key}: hiding clears the attachment, not the slot colour`);
        if (slot.effect && on[i].attachment) shownWhenOn++;
      }
    }
  }
}
assert(presets >= 500, `expected the full face preset set, got ${presets}`);
assert(hidden > 0 && shownWhenOn > 0, 'some preset must show cheek/sweat when its flags are not off, or the check is vacuous');
console.log(`Studio face effects: ${presets} real face presets (flags ${[...flags].join(', ')}), ${hidden} cheek/sweat attachments cleared exactly where idol_face says off; other slots untouched`);
