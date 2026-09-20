import assert from 'node:assert/strict';
import { neckOverlayAnimation } from '../src/core/spineNeckOverlay.js';
import fs from 'node:fs';
import { SkeletonBinary, Skeleton, AnimationState, AnimationStateData, RegionAttachment, MeshAttachment, BoundingBoxAttachment, PathAttachment, PointAttachment, ClippingAttachment } from '@pixi-spine/runtime-3.8';
import { MixBlend } from '@pixi-spine/base';
class DiagnosticAttachmentLoader {
  newRegionAttachment(_skin, name) { return new RegionAttachment(name) }
  newMeshAttachment(_skin, name) { return new MeshAttachment(name) }
  newBoundingBoxAttachment(_skin, name) { return new BoundingBoxAttachment(name) }
  newPathAttachment(_skin, name) { return new PathAttachment(name) }
  newPointAttachment(_skin, name) { return new PointAttachment(name) }
  newClippingAttachment(_skin, name) { return new ClippingAttachment(name) }
}


const bytes=fs.readFileSync(new URL('../public/assets/spines/002sht_002_00/comu.skel',import.meta.url));
const len=bytes.readUInt32LE(0);const offset=4+len+((4-(4+len)%4)%4)+4;
const data=new SkeletonBinary(new DiagnosticAttachmentLoader()).readSkeletonData(new Uint8Array(bytes.subarray(offset)));
const original=data.findAnimation('neck_question');
const overlay=neckOverlayAnimation(original,data);
assert.notEqual(overlay,original);
assert.equal(overlay.duration,original.duration);
assert.equal(neckOverlayAnimation(original,data),overlay);
assert.ok(overlay.timelines.some(t=>data.bones[t.boneIndex]?.name==='head'), 'head motion remains');
const originalCount=original.timelines.length;
for(const fixed of [false,true]) {
 const skeleton=new Skeleton(data);const state=new AnimationState(new AnimationStateData(data));
 state.setAnimation(0,'wait_loop',true);state.setAnimation(1,'face_happy',true);
 const neck=state.setAnimation(3,'neck_question',false);neck.mixBlend=MixBlend.add;
 if(fixed) neck.animation=overlay;
 for(let frame=0;frame<180;frame++){
  for(const t of neck.animation.timelines) if(Number.isInteger(t.boneIndex)) skeleton.bones[t.boneIndex].setToSetupPose();
  state.update(1/60);state.apply(skeleton);
  for(const side of ['L','R']){
   assert.equal(skeleton.findSlot(`eyeclosed_${side}`).attachment?.name, fixed ? `eyeclosed_smile_${side}` : undefined);
   assert.equal(skeleton.findSlot(`eyewhite_${side}`).attachment?.name, fixed ? undefined : `eyewhite_${side}`);
  }
 }
 if(fixed){
  state.setAnimation(1,'face_default',true);state.update(.5);state.apply(skeleton);
  assert.equal(skeleton.findSlot('eyewhite_L').attachment.name,'eyewhite_L','open expression remains available while neck holds');
 }
}
assert.equal(original.timelines.length,originalCount,'source animation is not mutated');
console.log('Real Shota neck/face overlay: original defect reproduced, closed/open expressions preserved for 180 frames, head motion and source data retained');
