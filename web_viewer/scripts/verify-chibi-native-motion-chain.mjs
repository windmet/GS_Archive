// RAW-backed regression for the normal callback vs skip/immediate branches.
// Requires the local corpus. This is not an original-game video comparison.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { execFileSync } from 'node:child_process'
import { BinaryInput } from '@pixi-spine/base'
import { Skeleton, SkeletonBinary, Skin, AnimationState, AnimationStateData,
  RegionAttachment, MeshAttachment, BoundingBoxAttachment, PathAttachment,
  PointAttachment, ClippingAttachment } from '@pixi-spine/runtime-3.8'

class AttachmentLoader {
  newRegionAttachment(_s,n) { return new RegionAttachment(n) }
  newMeshAttachment(_s,n) { return new MeshAttachment(n) }
  newBoundingBoxAttachment(_s,n) { return new BoundingBoxAttachment(n) }
  newPathAttachment(_s,n) { return new PathAttachment(n) }
  newPointAttachment(_s,n) { return new PointAttachment(n) }
  newClippingAttachment(_s,n) { return new ClippingAttachment(n) }
}
const base = new URL('../public/assets/live-chibi/',import.meta.url)
const catalog=JSON.parse(fs.readFileSync(new URL('choreography/index.json',base),'utf8'))
const flash=catalog.songs.find(s=>s.id==='flslgt_live_effect')
assert.equal(flash.events.filter(e=>e.mode===2).length,80)
assert.equal(flash.events.filter(e=>e.mode===3).length,4)
const source=fs.readFileSync(new URL('../src/utils/liveChibiSpine.js',import.meta.url),'utf8')
const actual={};vm.createContext(actual)
for(const name of ['playLiveChibiMotion','seekLiveChibiMotion'])
  vm.runInContext(source.match(new RegExp(`export function ${name}\\([^]*?\\n\\}(?=\\r?\\n)`))[0].replace('export ',''),actual)
const history=[]
if(process.argv.includes('--compare-history'))for(const ref of ['96294431','5d73443c']) {
  const oldSource=execFileSync('git',['show',`${ref}:web_viewer/src/utils/liveChibiSpine.js`],{encoding:'utf8',maxBuffer:1024*1024})
  const methods={};vm.createContext(methods)
  vm.runInContext(oldSource.match(/export function playLiveChibiMotion\([^]*?\n\}(?=\r?\n)/)[0].replace('export ',''),methods)
  history.push({ref,methods,poses:[]})
}

// Independent oracle from the complete native call chain:
// OnUpdate -> DoEffect(skip=false) -> PlayMotion -> delayed b__0 (0x1bbe040)
// Seek -> SkipEffect(skip=true) -> PlayMotionInner immediate (0x221c094).
// Both take isLoop separately. AddAnimationByPrefix forwards delay=0.
function nativeCalls(names,mode,skip=false) {
  const fragment=part=>names.find(n=>n.includes(`_${part}_`))
  if(skip||mode===3) return [{name:fragment(mode===2||mode===3?'4loop':'3dance')||fragment('2after'),loop:mode===2||mode===3}]
  const calls=fragment('3dance') ? [{name:fragment('3dance'),loop:false}]
    : [{name:fragment('1before'),loop:false},{name:fragment('2after'),loop:false}]
  if(mode===2)calls.push({name:fragment('4loop'),loop:true})
  return calls
}
const pose=r=>r.spine.skeleton.bones.flatMap(b=>[b.x,b.y,b.rotation,b.scaleX,b.scaleY])
const advance=(r,seconds)=>{let left=seconds;while(left>1e-9){const step=Math.min(left,1/60);r.spine.update(step);left-=step}}
let commands=0,samples=0,deltaFromWrongLoop=0
for(const body of [1,2,3,4,5]) {
  const setup=new Uint8Array(fs.readFileSync(new URL(`setup/body-${body}.skel`,base)))
  const parser=new SkeletonBinary(new AttachmentLoader()),data=parser.readSkeletonData(setup)
  const input=new BinaryInput(setup);input.readString();input.readString();for(let i=0;i<4;i++)input.readFloat()
  if(input.readBoolean()){input.readFloat();input.readString();input.readString()}
  const strings=Array.from({length:input.readInt(true)},()=>input.readString())
  const namesById=new Map()
  for(const id of new Set(flash.events.map(e=>e.motion))) {
    const reader=new BinaryInput(new Uint8Array(fs.readFileSync(new URL(`motions/choreography/${body}/${id}.motion`,base))),strings)
    const names=[]
    for(let i=0,count=reader.readInt(true);i<count;i++) {const name=reader.readString();data.animations.push(parser.readAnimation(reader,name,data));names.push(name)}
    namesById.set(id,names)
  }
  const actor=()=>{
    const skeleton=new Skeleton(data),stateData=new AnimationStateData(data);stateData.defaultMix=0
    const skin=new Skin('native-chain-base')
    for(const name of ['body','head','cos_defo']){const source=data.findSkin(name);if(source)skin.addSkin(source)}
    skeleton.setSkin(skin);skeleton.setToSetupPose()
    const state=new AnimationState(stateData)
    return {skeletonData:data,spine:{skeleton,state,stateData,update(dt){state.update(dt);state.apply(skeleton);skeleton.updateWorldTransform()}}}
  }
  for(const event of flash.events) {
    const calls=nativeCalls(namesById.get(event.motion),event.mode)
    assert(calls.every(c=>c.name),`Missing native chain fragment: body ${body}, motion ${event.motion}`)
    const a=actor()
    const plan=actual.playLiveChibiMotion(a,namesById.get(event.motion),{mode:event.mode,nativeCommand:true,reset:true})
    assert.deepEqual([...plan.sequence],calls.map(c=>c.name),'Implementation must match normal callback, not just isLoop')
    commands++
  }
  const event=flash.events.find(e=>e.time===2800),names=namesById.get(event.motion)
  for(const songElapsed of [0,.05,.2,.5,1,6.25,7]) {
    const a=actor(),reference=actor(),wrong=actor()
    // Seed the same preceding mode-3 pose to exercise the native .15s mix.
    for(const r of [a,reference,wrong]){r.spine.state.setAnimation(0,namesById.get(32001).find(n=>n.includes('_4loop')),true);r.spine.update(0)}
    actual.playLiveChibiMotion(a,names,{mode:2,nativeCommand:true})
    const calls=nativeCalls(names,2)
    reference.spine.state.setAnimation(0,calls[0].name,false).mixDuration=.15
    reference.spine.state.addAnimation(0,calls[1].name,true,0)
    reference.spine.update(0)
    wrong.spine.state.setAnimation(0,calls[1].name,true);wrong.spine.update(0)
    const clipElapsed=songElapsed*event.speed/1000
    actual.seekLiveChibiMotion(a,clipElapsed);advance(reference,clipElapsed);advance(wrong,clipElapsed)
    assert.equal(a.spine.state.getCurrent(0).animation.name,reference.spine.state.getCurrent(0).animation.name)
    const target=pose(reference),result=pose(a)
    assert(Math.max(...result.map((x,i)=>Math.abs(x-target[i])))<1e-6,'Actual native file pose must match callback oracle')
    if(songElapsed===.5){const wrongPose=pose(wrong);deltaFromWrongLoop=Math.max(deltaFromWrongLoop,...result.map((x,i)=>Math.abs(x-wrongPose[i])))}
    if(songElapsed===.5)for(const entry of history){
      const r=actor();r.spine.state.setAnimation(0,namesById.get(32001).find(n=>n.includes('_4loop')),true);r.spine.update(0)
      entry.methods.playLiveChibiMotion(r,names,{mode:2,nativeCommand:true});advance(r,clipElapsed)
      const oldPose=pose(r)
      entry.poses.push({body,firstFragment:r.currentMotionPlayback.mainName,
        deltaFromCallbackOracle:Math.max(...oldPose.map((x,i)=>Math.abs(x-target[i])))})
    }
    samples++
  }
}
assert(deltaFromWrongLoop>10,'Real FLASH LIGHT must distinguish skipped dance from its held loop')
console.log(JSON.stringify({status:'pass_source_chain_not_original_video_acceptance',bodyTypes:5,
  commands,samples,flashMode2Rows:80,flashMode3Rows:4,maxPoseDeltaFromWrongLoop:deltaFromWrongLoop,
  history:history.map(({ref,poses})=>({ref,poses}))}))
