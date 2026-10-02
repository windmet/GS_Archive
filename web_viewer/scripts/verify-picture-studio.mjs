import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {SkeletonBinary,RegionAttachment,MeshAttachment,BoundingBoxAttachment,PathAttachment,PointAttachment,ClippingAttachment} from '@pixi-spine/runtime-3.8';
import {decodeUnitySpineSkeleton} from '../shared/story/SpineBinary.js';
import {studioExportSize,verifiedStudioPreset,studioAnimationPlan} from '../src/core/PictureStudioPolicy.mjs';

assert.deepEqual(studioExportSize(),{width:1280,height:720});
for(const [w,h] of [[4096,4096],[8000,600],[10,12]]){const size=studioExportSize(w,h);assert.ok(size.width<=w && size.height<=h && size.width<=1920 && size.height<=1080 && size.width*size.height<=2*1024*1024)}
for(const w of [NaN,Infinity,-1,0])assert.throws(()=>studioExportSize(w,720));
const raw=new Uint8Array([200,0,0,0,7]).buffer;assert.equal(decodeUnitySpineSkeleton(raw),raw);
const wrapped=new Uint8Array(17);new DataView(wrapped.buffer).setUint32(0,4,true);wrapped.set([99,111,109,117],4);wrapped.set([5,6,7,8,9],12);
assert.deepEqual([...new Uint8Array(decodeUnitySpineSkeleton(wrapped.buffer))],[5,6,7,8,9]);
assert.throws(()=>decodeUnitySpineSkeleton(new ArrayBuffer(3)),/Truncated/);
assert.throws(()=>decodeUnitySpineSkeleton(wrapped.buffer.slice(0,12)),/payload/);
assert.throws(()=>decodeUnitySpineSkeleton(wrapped.buffer.slice(0,6)),/name/);
const media={entries:{'poses:1':{preset:{status:'script-bound-runtime-pending',modelId:'a'}}},models:{a:{status:'verified-local-files'}}};
assert.equal(verifiedStudioPreset(media,'poses',1,'a'),media.entries['poses:1'].preset);
for(const [kind,id,model] of [['faces',1,'a'],['poses',2,'a'],['poses',1,'b']])assert.throws(()=>verifiedStudioPreset(media,kind,id,model));
assert.throws(()=>studioAnimationPlan({motion:'wait_loop'},{face:null},['wait_loop']),/配置缺失/);
assert.throws(()=>studioAnimationPlan({motion:'missing'},{face:'face_default'},['face_default']),/缺少配置动作/);
assert.throws(()=>studioAnimationPlan({motion:'wait_loop',neck:'missing'},{face:'face_default'},['wait_loop','face_default']),/缺少配置动作/);

// Parse actual mounted skeletons without a GPU; this proves source-animation
// coverage, while Browser separately verifies textures, compositing and export.
class DiagnosticAttachmentLoader{
  newRegionAttachment(_s,n){return new RegionAttachment(n)}
  newMeshAttachment(_s,n){return new MeshAttachment(n)}
  newBoundingBoxAttachment(_s,n){return new BoundingBoxAttachment(n)}
  newPathAttachment(_s,n){return new PathAttachment(n)}
  newPointAttachment(_s,n){return new PointAttachment(n)}
  newClippingAttachment(_s,n){return new ClippingAttachment(n)}
}
let models=0,presets=0;
for(let id=1;id<=49;id++){
  const media=JSON.parse(await fs.readFile(new URL(`../public/data/masterdata/domains/photo_media_idols/${id}.json`,import.meta.url),'utf8'));
  const names=new Map();
  for(const [model,binding] of Object.entries(media.models)){
    assert.match(binding.skeleton.url,/^\/assets\/spines\/[a-z0-9_]+\/comu\.skel$/);
    const bytes=await fs.readFile(new URL('../public'+binding.skeleton.url,import.meta.url));
    const clean=decodeUnitySpineSkeleton(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    const data=new SkeletonBinary(new DiagnosticAttachmentLoader()).readSkeletonData(new Uint8Array(clean));
    names.set(model,data.animations.map(a=>a.name));models++;
  }
  for(const [key,entry] of Object.entries(media.entries)){
    const [kind,id]=key.split(':');const preset=verifiedStudioPreset(media,kind,id,entry.preset.modelId);
    for(const animation of [preset.motion,preset.face,preset.neck].filter(Boolean))assert.ok(names.get(preset.modelId).includes(animation),`${key} missing ${animation}`);
    presets++;
  }
}
console.log(`Picture Studio: bounded export, binary truncation, strict preset identity; ${models} real skeletons and ${presets} source presets resolved`);
