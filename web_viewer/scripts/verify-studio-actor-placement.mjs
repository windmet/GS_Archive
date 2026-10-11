import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { BaseTexture, Container, Point } from 'pixi.js';
import { TextureAtlas } from '@pixi-spine/base';
import { Skeleton, SkeletonBinary, AtlasAttachmentLoader, AnimationState, AnimationStateData } from '@pixi-spine/runtime-3.8';
import { decodeUnitySpineSkeleton } from '../shared/story/SpineBinary.js';
import { decodeSpineAtlasText } from '../shared/story/SpineAtlasPages.js';
import { studioActorPlacement, studioActorSelectionBounds } from '../src/core/StudioActorPlacement.mjs';
import { StudioCompositionStage } from '../src/core/StudioCompositionStage.js';

// Source atlas dimensions and actual attachment geometry, with no image copy,
// GPU, fake animation data or replacement bones.
let count = 0;
for (let idol = 1; idol <= 49; idol++) {
  const leaf = JSON.parse(await fs.readFile(`public/data/masterdata/domains/photo_costumes/${idol}.json`));
  for (const [modelId, binding] of Object.entries(leaf.models)) {
    const atlas = new TextureAtlas(decodeSpineAtlasText(await fs.readFile(`public${binding.atlas.url}`)), (_page, done) => done(new BaseTexture()));
    const bytes = await fs.readFile(`public${binding.skeleton.url}`);
    const data = new SkeletonBinary(new AtlasAttachmentLoader(atlas)).readSkeletonData(new Uint8Array(decodeUnitySpineSkeleton(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))));
    const placement = studioActorPlacement(data);
    assert(placement.baseScale > 0 && Number.isFinite(placement.pivotX) && Number.isFinite(placement.pivotY), modelId);
    if (['005kao_002_00','004ter_001_00','006tsu_005_00','038tak_005_00','040ren_005_00'].includes(modelId)) {
      const stage = Object.create(StudioCompositionStage.prototype);
      stage.playing = false;
      stage.actorInstances = new Map();
      const model = basis => {
        const skeleton = new Skeleton(data), state = new AnimationState(new AnimationStateData(data));
        const spine = Object.assign(new Container(), {
          skeleton, state,
          update(dt) { state.update(dt); state.apply(skeleton); skeleton.updateWorldTransform(); },
          getLocalBounds() { const offset = new Point(), size = new Point(); skeleton.getBounds(offset, size); return {x:offset.x,y:offset.y,width:size.x,height:size.y}; },
        });
        return {row:{instanceId:'a',layoutBasis:basis,scale:2.1,x:.3,y:2,rotation:8,poseTime:null,faceTime:3.4},spine,names:data.animations.map(a=>a.name),neckBones:[],neckSlots:[],flags:{}};
      };
      const set = (value, motion) => {
        stage.actorInstances.set('a',value);
        stage.setActorPose('a',{motion,commands:[],label:motion},{face:'face_trouble',commands:[],label:'face'});
        stage.setActorTransform('a',value.row);
      };
      const snapshot = value => ({
        scale:value.spine.scale.x,pivot:[value.spine.pivot.x,value.spine.pivot.y],
        selection:studioActorSelectionBounds(value.spine),
        bones:value.spine.skeleton.bones.map(bone=>{const p=value.spine.toGlobal(new Point(bone.worldX,bone.worldY));return [p.x,p.y];}),
      });
      for (const basis of ['source-bounds','pose-bounds']) {
        const warm=model(basis);set(warm,'weight');const originalScale=warm.baseScale,originalPivot=[warm.spine.pivot.x,warm.spine.pivot.y];
        set(warm,'angry');set(warm,'hello');const result=snapshot(warm);
        const fresh=model(basis);set(fresh,'hello');assert.deepEqual(snapshot(fresh),result,`${modelId}/${basis}: warm and fresh document coordinates agree`);
        if(basis==='source-bounds') {
          assert.equal(warm.baseScale,originalScale);
          assert.deepEqual([warm.spine.pivot.x,warm.spine.pivot.y],originalPivot,'New documents keep one model anchor across poses');
        }
        warm.spine.destroy();fresh.spine.destroy();
      }
    }
    atlas.dispose();count++;
  }
}
assert.equal(count,690);
for (const data of [{x:0,y:0,width:0,height:1},{x:0,y:NaN,width:1,height:1},{x:0,y:0,width:1,height:-1}]) assert.throws(()=>studioActorPlacement(data));
console.log(`Studio placement: ${count} real source bounds, fresh/warm actual bone coordinates for five reference actors, fixed new anchors and legacy pose-bounds restoration passed; no GPU/device claim`);
