import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import './verify-chibi-limit-curve.mjs'
import './verify-chibi-color-pair.mjs'
import {execFileSync} from 'node:child_process'
import {attachObjectEmitters,emitterMatrix,emitterSpatialMatrix,sampleObjectEmitter,sampleEmitterShape,sampleObjectCurve,sampleObjectVelocityDisplacement,emitterRenderBasis} from '../src/core/chibiObjectEmitters.js'
import {sampleNoiseDerivatives,sampleCurlNoise,stepNoiseMotion} from '../src/core/chibiParticleNoise.js'
import {createNoiseClock} from '../src/core/chibiParticleNoiseClock.js'
import {reciprocalSqrtEstimate,samplePlanarStretch,transformStretchVelocity,sampleSpatialStretch} from '../src/core/chibiParticleStretch.js'
import {objectSpatialContext,spatialEmitterQuads,OBJECT_SPATIAL_PROFILE,OBJECT_SPATIAL_BINDING} from '../src/core/chibiObjectSpatialContext.js'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url)),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const data=JSON.parse(read('public/data/stage-object-emitters.json'))
const colorPairProof=JSON.parse(read('scripts/fixtures/chibi-color-pair-native.json'))
const uniformSizeProof=JSON.parse(read('scripts/fixtures/chibi-uniform-size-native.json'))
const electric=data.assets.fx_in_tktkkt_electric,electricBound=colorPairProof.models.fx_in_tktkkt_electric
assert.equal(electric.bundleSha256,electricBound.bundleSha256)
assert.equal(electric.bundleSha256,uniformSizeProof.models.fx_in_tktkkt_electric.bundleSha256)
assert.equal(electric.systems.length,14);assert.equal(electric.nonEmitting.length,3);assert.equal(electric.particleCount,17)
assert.deepEqual(electric.nonEmitting,electricBound.nonEmitting)
assert.deepEqual(electric.nonEmittingProof,{profile:'native-static-disabled-emission-v1',proofSha256:sha(read('scripts/fixtures/chibi-color-pair-native.json')),components:electricBound.staticComponents})
for(const source of electricBound.systems){
  const system=electric.systems.find(s=>s.source.pathId===source.source.pathId)
  assert.deepEqual(system.source,source.source);assert.deepEqual(system.chain,source.chain)
  assert.deepEqual(system.colorOverLifePair,{profile:'native-two-gradient-bytes-v1',cache:source.cache,proofSha256:sha(read('scripts/fixtures/chibi-color-pair-native.json'))})
}
for(const source of uniformSizeProof.models.fx_in_tktkkt_electric.systems){
  const system=electric.systems.find(s=>s.source.pathId===source.source.pathId)
  assert.deepEqual(system.source,source.source);assert.deepEqual(system.chain,source.chain)
  assert.deepEqual(system.rendererBounds,{profile:'native-uniform-screen-size-v1',min:0,max:1,proofSha256:sha(read('scripts/fixtures/chibi-uniform-size-native.json'))})
}
assert.equal(uniformSizeProof.cases.length,252)
for(const row of uniformSizeProof.sourceWindows)assert.equal(sha(Buffer.from(row.bytes,'hex')),row.sha256)
for(const c of uniformSizeProof.cases){
  const source=electric.systems.find(s=>s.source.pathId===c.source.pathId)
  const scalar=v=>({mode:0,scalar:v,minScalar:v})
  const probe={...source,chain:c.chain,alignment:c.alignment,noise:null,stretch:null,velocity:null,gravity:null,limit:null,parentProjection:null,speed:scalar(0),size:scalar(c.size),sizeY:null,sizeOverLife:null,sizeOverLifeY:null,rotation:scalar(c.angle),rotationX:null,rotationY:null,angularVelocity:null,
    shape:{type:0,radius:{value:0},radiusThickness:0,m_Rotation:{x:0,y:0,z:0},m_Position:{x:.2,y:-.3,z:0}},lifetime:scalar(2),looping:false,duration:2,delay:{mode:0,value:0,min:0},bursts:[{time:0,count:1}],rate:0}
  const sample=sampleObjectEmitter(probe,0,0,Infinity,{height:c.viewHeight})[0]
  for(const [i,[u,v]] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].entries()){
    assert.ok(Math.abs(sample.x+sample.a*u+sample.c*v-c.expected[i].position[0]*100)<.003,'Native uniform size corner X')
    assert.ok(Math.abs(sample.y+sample.b*u+sample.d*v+c.expected[i].position[1]*100)<.003,'Native uniform size corner Y')
  }
}
const localParentProof=JSON.parse(read('scripts/fixtures/chibi-local-parent-native.json'))
const localSizeProof=JSON.parse(read('scripts/fixtures/chibi-local-size-native.json'))
const bloomParentProof=JSON.parse(read('scripts/fixtures/chibi-bloom-parent-native.json'))
const limitCurveProof=JSON.parse(read('scripts/fixtures/chibi-limit-curve-native.json'))
assert.equal(bloomParentProof.cases.length,36)
assert.equal(limitCurveProof.choreographySha256,sha(read('public/assets/live-chibi/choreography/index.json')))
const limitSong=JSON.parse(read('public/assets/live-chibi/choreography/index.json')).songs.find(s=>s.id==='pcuslv_live_effect')
assert.equal(limitCurveProof.nonbindingSizeEnvelope.minViewHeight,10000/Math.max(...limitSong.cameraEvents.map(e=>e.zoom||1000)))
assert.equal(limitCurveProof.nonbindingSizeEnvelope.maxObjectScale,Math.max(...limitSong.objectLayerEvents.filter(e=>e.asset.includes('pcuslv_bloom')&&!e.hide).map(e=>e.scale))/1000)
for(const [name,bound] of Object.entries(limitCurveProof.models)){
  assert.equal(data.assets[name].bundleSha256,bound.bundleSha256)
  for(const [i,s] of data.assets[name].systems.entries()){
    const raw=bound.systems[i]
    assert.deepEqual(s.source,raw.source);assert.deepEqual(s.chain,raw.chain)
    assert.equal(s.limit.profile,'native-lifetime-magnitude-v1')
    assert.equal(s.limit.proofSha256,sha(read('scripts/fixtures/chibi-limit-curve-native.json')))
    assert.equal(s.limit.dampen,raw.limit.dampen)
    assert.equal(s.limit.curve.mode,raw.limit.magnitude.minMaxState)
    assert.equal(s.limit.curve.scalar,raw.limit.magnitude.scalar)
    if(s.limit.curve.mode===1)assert.deepEqual(s.limit.curve.keys,raw.limit.magnitude.maxCurve.m_Curve.map(k=>Object.fromEntries(['time','value','inSlope','outSlope'].map(f=>[f,k[f]]))))
    assert.ok(raw.sizeUpperBound*limitCurveProof.nonbindingSizeEnvelope.maxObjectScale*limitCurveProof.nonbindingSizeEnvelope.stageScaleUpperBound<raw.sizeBounds[1]*limitCurveProof.nonbindingSizeEnvelope.minViewHeight)
    if(s.alignment===2){
      const parent=bloomParentProof.models[name].systems[0]
      assert.deepEqual({source:s.source,chain:s.chain,alignment:s.alignment},parent)
      assert.deepEqual(s.parentProjection,{profile:'native-local-orthographic-v1',proofSha256:sha(read('scripts/fixtures/chibi-bloom-parent-native.json'))})
    }
  }
}
for(const c of limitCurveProof.cases.filter(c=>c.dt===1/60&&c.velocity[0]===0&&c.velocity[1]===8&&c.velocity[2]===0)){
  const source=data.assets[c.asset].systems.find(s=>s.source.pathId===c.source.pathId)
  const scalar=v=>({mode:0,scalar:v,minScalar:v})
  const probe={...source,chain:[],alignment:0,parentProjection:null,shape:{type:12,radius:{value:0},m_Rotation:{x:0,y:0,z:0},m_Position:{x:0,y:0,z:0}},speed:scalar(8),lifetime:scalar(1),looping:false,duration:2,delay:{mode:0,value:0,min:0},bursts:[{time:0,count:1}],rate:0}
  for(const [i,e] of c.expected.entries()){
    if(i===59)continue // A lifetime-one particle retires exactly at one second.
    const sample=sampleObjectEmitter(probe,(i+1)*1000/60,0)[0]
    assert.ok(Math.abs(sample.y+e.position[1]*100)<.001,'Consumer lifetime limit must receive actual particle lifetime')
  }
}
assert.equal(localParentProof.cases.length,90)
assert.equal(localSizeProof.cases.length,36)
assert.equal(localSizeProof.choreographySha256,sha(read('public/assets/live-chibi/choreography/index.json')))
const sizeSong=JSON.parse(read('public/assets/live-chibi/choreography/index.json')).songs.find(s=>s.id===localSizeProof.nonbindingSizeEnvelope.arrangement)
const sizeEnvelope=localSizeProof.nonbindingSizeEnvelope
assert.equal(sizeEnvelope.maxZoom,Math.max(...sizeSong.cameraEvents.map(e=>e.zoom||1000)))
assert.equal(sizeEnvelope.minViewHeight,10000/sizeEnvelope.maxZoom)
assert.equal(sizeEnvelope.maxObjectScale,Math.max(...sizeSong.objectLayerEvents.filter(e=>e.asset==='fx_in_jfhtmk_panel_1'&&!e.hide).map(e=>e.scale))/1000)
assert.ok(sizeEnvelope.maxSourceSize*sizeEnvelope.stageScaleUpperBound*sizeEnvelope.maxObjectScale<50*sizeEnvelope.minViewHeight)
for(const [name,bound] of Object.entries(localSizeProof.models)) {
  const asset=data.assets[name]
  assert.equal(asset.bundleSha256,bound.bundleSha256)
  for(const [i,s] of asset.systems.entries()) {
    assert.deepEqual({source:s.source,chain:s.chain,alignment:s.alignment},Object.fromEntries(['source','chain','alignment'].map(k=>[k,bound.systems[i][k]])))
    assert.equal(Boolean(s.sizeY),bound.systems[i].size3D)
    assert.deepEqual(bound.systems[i].sizeBounds,[0,50])
    assert.deepEqual(s.parentProjection,{profile:'native-local-size-orthographic-v1',proofSha256:sha(read('scripts/fixtures/chibi-local-size-native.json'))})
    assert.ok(Math.max(s.size.scalar,s.size.minScalar,s.sizeY?.scalar||0)<=sizeEnvelope.maxSourceSize)
  }
}
for(const [name,bound] of Object.entries(localParentProof.models)) {
  const asset=data.assets[name]
  assert.equal(asset.bundleSha256,bound.bundleSha256)
  assert.deepEqual(asset.systems.map(s=>({source:s.source,chain:s.chain,alignment:s.alignment})),bound.systems)
  for(const s of asset.systems)assert.deepEqual(s.parentProjection,{profile:'native-local-orthographic-v1',proofSha256:sha(read('scripts/fixtures/chibi-local-parent-native.json'))})
}
for(const row of [...localParentProof.sourceWindows,...localSizeProof.sourceWindows,...bloomParentProof.sourceWindows])assert.equal(sha(Buffer.from(row.bytes,'hex')),row.sha256)
let legacyLocalParentMismatches=0
for(const c of [...localParentProof.cases,...localSizeProof.cases,...bloomParentProof.cases]) {
  const matrix=emitterSpatialMatrix(c.chain)
  for(let i=0;i<16;i++)assert.ok(Math.abs(matrix.full[i]-c.expectedFullMatrix[i])<2e-5,'Native full parent matrix')
  const scalar=v=>({mode:0,scalar:v,minScalar:v})
  const s={...data.assets.fx_in_rote77_meter.systems[0],chain:c.chain,alignment:2,
    parentProjection:{profile:c.nonuniform?'native-local-size-orthographic-v1':'native-local-orthographic-v1'},rotation:scalar(c.angles[2]),rotationX:null,rotationY:null,angularVelocity:null,
    noise:null,stretch:null,velocity:null,gravity:null,limit:null,speed:scalar(0),size:scalar(c.size[0]),sizeY:c.nonuniform?scalar(c.size[1]):null,sizeOverLife:null,sizeOverLifeY:null,
    shape:{type:0,radius:{value:0},radiusThickness:0,m_Rotation:{x:0,y:0,z:0},m_Position:Object.fromEntries(['x','y','z'].map((k,i)=>[k,c.position[i]]))},
    lifetime:scalar(2),looping:false,duration:2,delay:{mode:0,value:0,min:0},bursts:[{time:0,count:1}],rate:0}
  const sample=sampleObjectEmitter(s,0,0)[0]
  const legacy=sampleObjectEmitter({...s,parentProjection:null},0,0)[0]
  if(Math.max(...[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].flatMap(([u,v],i)=>[
    Math.abs(legacy.x+legacy.a*u+legacy.c*v-c.expected[i].position[0]*100),
    Math.abs(legacy.y+legacy.b*u+legacy.d*v+c.expected[i].position[1]*100)]))>.003)legacyLocalParentMismatches++
  for(const [i,[u,v]] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].entries()) {
    assert.ok(Math.abs(sample.x+sample.a*u+sample.c*v-c.expected[i].position[0]*100)<.003,'Local parent native corner X '+JSON.stringify({asset:c.asset,angles:c.angles,pos:c.position,sample,expected:c.expected}))
    assert.ok(Math.abs(sample.y+sample.b*u+sample.d*v+c.expected[i].position[1]*100)<.003,'Local parent native corner Y including local Z')
  }
}
assert.equal(legacyLocalParentMismatches,102,'Nonzero local Z exposes the old planar parent loss')
function samplePreviewSystem(system,time,activatedAt,stoppedAt=Infinity) {
  const spatial=system.stretch?.profile===OBJECT_SPATIAL_PROFILE?objectSpatialContext({verified:true,focusSlot:0,orthoSize:5,x:0,y:360,rotation:0},{x:0,y:360,scale:1000},'pfofos_live_effect'):null
  return sampleObjectEmitter(system,time,activatedAt,stoppedAt,{spatial})
}
const nativeProof=JSON.parse(read('scripts/fixtures/chibi-shape-native.json'))
const noiseProof=JSON.parse(read('scripts/fixtures/chibi-noise-kernel-native.json'))
const torusProof=JSON.parse(read('scripts/fixtures/chibi-torus-native.json'))
assert.equal(torusProof.binarySha256,noiseProof.binarySha256)
assert.equal(torusProof.cases.length,30)
let torusParticles=0
for(const window of torusProof.sourceWindows)assert.equal(sha(Buffer.from(window.bytes,'hex')),window.sha256)
for(const c of torusProof.cases)for(let lane=0;lane<4;lane++) {
  const actual=sampleEmitterShape(c.shape,channel=>c.uniforms[lane][channel-1])
  for(const [i,axis] of ['x','y','z'].entries()) {
    assert.ok(Math.abs(actual.position[axis]-c.expected[lane].position[i])<2e-5,'Native torus birth position including tube fraction and shape scale')
    assert.ok(Math.abs(actual.direction[axis]-c.expected[lane].rawDirection[i])<2e-5,'Observed native torus raw direction')
    assert.ok(Math.abs(actual.direction[axis]*c.shape.m_Scale[axis]-c.expected[lane].direction[i])<2e-5,'Retain transformed helper vector evidence, without claiming moving-torus support')
  }
  torusParticles++
}
assert.equal(torusParticles,120)
for(const [name,bound] of Object.entries(torusProof.models)) {
  const asset=data.assets[name]
  assert.equal(asset.bundleSha256,bound.bundleSha256)
  assert.deepEqual(asset.systems.map(s=>({source:s.source,chain:s.chain,shape:s.shape,alignment:s.alignment})),bound.systems.map(s=>Object.fromEntries(['source','chain','shape','alignment'].map(k=>[k,s[k]]))))
  for(const s of asset.systems.filter(s=>s.shape?.type===17)) {
    assert.deepEqual(s.shapeBinding,{profile:'native-random-torus-v1',proofSha256:sha(read('scripts/fixtures/chibi-torus-native.json'))})
    assert.ok([0,3].includes(s.speed.mode));assert.equal(s.speed.scalar,0);if(s.speed.mode===3)assert.equal(s.speed.minScalar,0)
    assert.throws(()=>sampleObjectEmitter({...s,shapeBinding:null},1000,0),/Unbound torus/)
  }
}
assert.equal(localParentProof.binarySha256,noiseProof.binarySha256)
assert.equal(localSizeProof.binarySha256,noiseProof.binarySha256)
const velocityProof=JSON.parse(read('scripts/fixtures/chibi-velocity-curve-native.json'))
assert.equal(velocityProof.binarySha256,noiseProof.binarySha256)
assert.equal(velocityProof.cases.length,8)
for(const window of velocityProof.sourceWindows)assert.equal(sha(Buffer.from(window.bytes,'hex')),window.sha256)
for(const c of velocityProof.cases)for(const [i,phase] of c.phases.entries())for(const [axis,curve] of c.curves.entries()) {
  assert.ok(Math.abs(sampleObjectCurve(curve,phase,0)-c.expected[i][axis])<2e-7,'RAW-bound native Velocity worker sample')
}
const stretchProof=JSON.parse(read('scripts/fixtures/chibi-stretch-kernel-native.json'))
const spatialContext=JSON.parse(read('scripts/fixtures/chibi-spatial-context-native.json'))
assert.equal(spatialContext.unityDataSha256,stretchProof.cameraBinding.unityDataSha256)
assert.deepEqual(spatialContext.camera.chain,stretchProof.cameraBinding.chain)
assert.deepEqual(spatialContext.cameraScript.gameObject,spatialContext.camera.gameObject)
assert.deepEqual(spatialContext.stage.base,spatialContext.container.parent,'Container must bind the exact LiveStage Base, not a similarly named object')
assert.deepEqual(spatialContext.container.chain.slice(1),spatialContext.stage.chain)
assert.deepEqual(spatialContext.camera.chain.slice(1),spatialContext.stage.chain.slice(1),'Camera and Stage are siblings below the same parent')
for(const entry of spatialContext.instructionWindows)assert.equal(sha(Buffer.from(entry.bytes,'hex')),entry.sha256)
for(const entry of Object.values(spatialContext.constants))assert.equal(Buffer.from(entry.bytes,'hex').readFloatLE(),entry.value)
assert.deepEqual(spatialContext.basePos,[0,360,0])
assert.equal(spatialContext.constants.pixelToStage.value,Math.fround(.01))
assert.equal(spatialContext.constants.scriptDivisor.value,100)
assert.equal(spatialContext.constants.wideStageScale.value,Math.fround(1000/720))
for(const [key,z] of [['camera',2],['stage',4],['container',14]]) {
  const chain=spatialContext[key].chain
  assert.ok(chain.every(t=>t.rotation.x===0&&t.rotation.y===0&&t.rotation.z===0&&t.rotation.w===1&&t.scale.z===1))
  assert.equal(chain.reduce((sum,t)=>sum+t.position.z,0),z,'Serialized initial depth only, not a runtime constant')
}
assert.equal(spatialContext.arrangement.cameraEvents.length,152)
assert.ok(spatialContext.arrangement.cameraEvents.every(e=>!e.focusSlot),'This bound pfofos track uses the free-camera branch')
assert.equal(spatialContext.arrangement.fireEvents.length,200)
const cameraMatrixProof=JSON.parse(read('scripts/fixtures/chibi-camera-matrix-native.json'))
assert.equal(cameraMatrixProof.binarySha256,stretchProof.binarySha256)
assert.equal(cameraMatrixProof.sourceContextSha256,sha(read('scripts/fixtures/chibi-spatial-context-native.json')))
assert.equal(cameraMatrixProof.cases.length,153)
for(const window of cameraMatrixProof.instructionWindows)assert.equal(sha(Buffer.from(window.bytes,'hex')),window.sha256)
assert.equal(cameraMatrixProof.pixelToCamera,Math.fround(spatialContext.constants.wideStageScale.value/100))
let cameraMatrixError=0
for(const c of cameraMatrixProof.cases) {
  const event=c.eventIndex<0?null:spatialContext.arrangement.cameraEvents[c.eventIndex]
  assert.equal(c.time,event?.time??null)
  assert.deepEqual(c.chain.slice(1),spatialContext.camera.chain.slice(1))
  if(event) {
    const x=event.reset?0:event.x,y=event.reset?360:event.y
    assert.equal(c.chain[0].position.x,Math.fround(x*cameraMatrixProof.pixelToCamera))
    assert.equal(c.chain[0].position.y,Math.fround((y-360)*cameraMatrixProof.pixelToCamera))
    assert.equal(c.chain[0].position.z,0)
  }
  const q=c.chain[0].rotation,x=c.chain[0].position.x,y=c.chain[0].position.y
  const co=1-2*q.z*q.z,si=2*q.w*q.z,z=c.chain.reduce((sum,t)=>sum+t.position.z,0)
  const expected=[co,-si,0,0,si,co,0,0,0,0,-1,0,-co*x-si*y,si*x-co*y,z,1]
  for(let i=0;i<16;i++)cameraMatrixError=Math.max(cameraMatrixError,Math.abs(c.expected[i]-expected[i]))
}
assert.ok(cameraMatrixError<2e-5,'Source camera target matrices retain native Z flip and world-to-local translation')
const joinedProof=JSON.parse(read('scripts/fixtures/chibi-source-stretch-native.json'))
assert.equal(OBJECT_SPATIAL_BINDING.sourceContextSha256,sha(read('scripts/fixtures/chibi-spatial-context-native.json')))
assert.throws(()=>objectSpatialContext({verified:true,focusSlot:1,orthoSize:5},{scale:1000}),/free camera/)
assert.equal(joinedProof.binarySha256,stretchProof.binarySha256)
for(const [name,hash] of Object.entries(joinedProof.dependencies))assert.equal(sha(read('scripts/fixtures/'+name)),hash)
const joinedAudit=JSON.parse(execFileSync(process.execPath,['scripts/audit-chibi-source-stretch.mjs'],{cwd:new URL('../',import.meta.url),encoding:'utf8'}))
assert.equal(joinedAudit.sourceFrames,104)
assert.equal(joinedAudit.totalCases,1664)
assert.equal(joinedAudit.matches,1664,'Actual spatial implementation must match both native writers for every source Show placement')
assert.equal(joinedAudit.planarMatches,832,'Zero-Z rays can match; nonzero-Z cases still need the spatial path')
assert.ok(joinedAudit.maxPlanarError>.008,'The old planar projection still misses the source-bound spatial cases')
for(const value of Object.values(joinedAudit.byAsset))assert.equal(value.cases,208)
for(const row of joinedProof.cases)assert.deepEqual(row.expected.map(v=>v.uv),[[0,1],[1,1],[1,0],[0,0]])
for(const frame of joinedProof.frames){
  const event=spatialContext.arrangement.fireEvents[frame.eventIndex]
  assert.equal(event.hide,false);assert.equal(frame.asset,event.asset)
  assert.deepEqual(frame.input.cameraMatrix,cameraMatrixProof.cases[frame.cameraIndex].expected)
}
let bridgeCases=0,maxBridgeError=0
for(const row of joinedProof.cases){
  const frame=joinedProof.frames[row.frameIndex],event=spatialContext.arrangement.fireEvents[frame.eventIndex]
  const ce=spatialContext.arrangement.cameraEvents[cameraMatrixProof.cases[frame.cameraIndex].eventIndex]
  const camera=ce?{verified:true,focusSlot:0,orthoSize:ce.reset?5:5/(ce.zoom/1000),x:ce.reset?0:ce.x,y:ce.reset?360:ce.y,rotation:ce.reset?0:ce.rotation}
    :{verified:true,focusSlot:0,orthoSize:5,x:0,y:360,rotation:0}
  const context=objectSpatialContext(camera,event,'pfofos_live_effect')
  const system=data.assets[frame.asset]?.systems.find(s=>s.stretch?.profile===OBJECT_SPATIAL_PROFILE)
  if(!system)continue
  const quad=spatialEmitterQuads(system,emitterMatrix(system.chain),emitterRenderBasis(system.chain,system.alignment),
    Object.fromEntries(['x','y','z'].map((k,i)=>[k,row.position[i]])),Object.fromEntries(['x','y','z'].map((k,i)=>[k,row.velocity[i]])),system.size.scalar,context)
  for(const [i,q] of quad.entries())for(const [j,axis] of ['x','y'].entries())maxBridgeError=Math.max(maxBridgeError,
    Math.abs((q[axis]*context.outer+context.offset[axis])*context.xyScale-row.expected[i].position[j]))
  bridgeCases++
}
assert.equal(bridgeCases,1664,'All spatial sources must enter the actual object bridge')
assert.ok(maxBridgeError<2e-5,'Actual source camera/placement bridge must recover native world corners')
const sampleFrame=joinedProof.frames[0].input
const spatialInput={...sampleFrame,position:{x:0,y:0,z:20},velocity:{x:1,y:2,z:.1},scaleX:sampleFrame.particleScale[0],scaleY:sampleFrame.particleScale[1]}
assert.throws(()=>sampleSpatialStretch({...spatialInput,cameraMatrix:[1,0,.1,0,0,1,0,0,0,0,-1,0,0,0,2,1]}),/camera view/)
assert.throws(()=>sampleSpatialStretch({...spatialInput,minSize:.1}),/clamp/)
assert.throws(()=>sampleSpatialStretch({...spatialInput,maxSize:.0001}),/clamp/)
const coneProof=JSON.parse(read('scripts/fixtures/chibi-cone-stretch-native.json'))
assert.equal(coneProof.binarySha256,stretchProof.binarySha256)
assert.equal(coneProof.objectIndexSha256,data.objectIndexSha256)
assert.deepEqual(coneProof.cameraBinding,stretchProof.cameraBinding)
for(const window of coneProof.sourceWindows)assert.equal(sha(Buffer.from(window.bytes,'hex')),window.sha256)
const coneAudit=JSON.parse(execFileSync(process.execPath,['scripts/audit-chibi-cone-stretch.mjs'],{cwd:new URL('../',import.meta.url),encoding:'utf8'}))
assert.equal(coneAudit.sourceSystems,8)
assert.equal(coneAudit.totalCases,2304)
assert.equal(coneAudit.spatialMatches,2304,'Full source XYZ, flipped parents and native camera context must agree with spatial reference')
assert.equal(coneAudit.planarMatches,0,'Planar runtime cannot silently admit the complete source cone contexts')
assert.ok(coneAudit.maxPlanarError>.6,'Identity-position evidence must not hide the source-depth corner/UV mismatch')
assert.deepEqual(Object.keys(coneAudit.byAsset).sort(),Object.keys(coneProof.models).sort())
for(const value of Object.values(coneAudit.byAsset))assert.equal(value.cases,288,'Every source has both writers, all rays, ages and camera conditions')
for(const row of coneProof.cases)assert.deepEqual(row.expected.map(v=>v.uv),[[0,1],[1,1],[1,0],[0,0]])
assert.equal(stretchProof.binarySha256,noiseProof.binarySha256)
assert.equal(stretchProof.cameraBinding.cameraPathId,'45565')
assert.equal(stretchProof.cameraBinding.scriptPathId,'111805')
assert.equal(stretchProof.cameraBinding.orthographic,true)
assert.equal(stretchProof.cameraBinding.orthographicSize,5)
assert.deepEqual(stretchProof.cameraBinding.chain.map(t=>t.pathId),['40921','39065','38270'])
assert.equal(stretchProof.cameraBinding.chain.reduce((n,t)=>n+t.position.z,0),2)
assert.equal(stretchProof.cases.filter(c=>c.sameViewMatrices).length,38)
assert.equal(stretchProof.cases.filter(c=>c.position).length,16)
for(const window of stretchProof.cameraSourceWindows)assert.equal(sha(Buffer.from(window.bytes,'hex')),window.sha256)
for(const [row,exponent] of [127,128].entries())for(let bucket=0;bucket<128;bucket++) {
  const buffer=new DataView(new ArrayBuffer(4));buffer.setUint32(0,exponent<<23|bucket<<16,true)
  assert.equal(reciprocalSqrtEstimate(buffer.getFloat32(0,true)),stretchProof.reciprocalSqrtEstimate.normalizedBuckets[row][bucket])
}
for(const c of stretchProof.cases.filter(c=>c.packedContext&&!c.position)) {
  assert.deepEqual(c.expected.map(v=>v.uv),[[0,1],[1,1],[1,0],[0,0]],'Bound zero-flip native renderer UV orientation')
  const fp=Math.fround,[a,b,k,d,tx,ty]=(c.matrix||[1,0,0,1,0,0]).map(fp)
  const vx=fp(c.velocity[0]+(c.animatedVelocity?.[0]||0)),vy=fp(c.velocity[1]+(c.animatedVelocity?.[1]||0))
  const [scaleX,scaleY]=c.particleScale||[1,1]
  const actual=samplePlanarStretch({position:{x:tx,y:ty},velocity:transformStretchVelocity({a,b,c:k,d},{x:vx,y:vy},c.cameraRotation||0),
    size:c.size,scaleX,scaleY,lengthScale:c.lengthScale,velocityScale:c.velocityScale,maxSize:c.maxParticleSize??100,cameraRotation:c.cameraRotation||0})
  for(const [i,p] of actual.entries())for(const [axis,j] of [['x',0],['y',1]])assert.ok(Math.abs(p[axis]-c.expected[i].position[j])<2e-5,`Native stretch ${c.function} ${c.name} corner ${i}.${axis}`)
}
// Nonplanar native evidence is checked separately: the runtime still admits
// only its planar profile. These synthetic camera inputs are not a stage binding.
for(const c of stretchProof.cases.filter(c=>c.position)) {
  const f=Math.fround,[a,b,k,d,tx,ty]=(c.matrix||[1,0,0,1,0,0]).map(f)
  const [px,py,pz]=c.position,[sz,tz]=c.depthMatrix||[1,0]
  const p={x:f(f(a*px)+f(k*py)+tx),y:f(f(b*px)+f(d*py)+ty),z:f(f(sz*pz)+tz)}
  const velocity=transformStretchVelocity({a,b,c:k,d},{x:c.velocity[0],y:c.velocity[1]},c.cameraRotation||0)
  const vz=f(sz*c.velocity[2]),speed2=f(velocity.speedSquared+f(vz*vz))
  const factor=f(f(c.velocityScale)+f(f(f(c.lengthScale*(c.particleScale?.[0]||1))*c.size)*f(reciprocalSqrtEstimate(speed2)*f(1.0019569))))
  const crossX=p.y*vz-(p.z-10)*velocity.y,crossY=(p.z-10)*velocity.x-p.x*vz,norm=Math.hypot(crossX,crossY)
  const side={x:crossX/norm*c.size/2*(c.particleScale?.[0]||1),y:crossY/norm*c.size/2*(c.particleScale?.[1]||1),z:0}
  const tail={x:f(p.x-f(velocity.x*factor)),y:f(p.y-f(velocity.y*factor)),z:f(p.z-f(vz*factor))}
  const actual=[p,tail,tail,p].map((v,i)=>Object.fromEntries(['x','y','z'].map(axis=>[axis,v[axis]+side[axis]*(i<2?1:-1)])))
  assert.deepEqual(c.expected.map(v=>v.uv),[[0,1],[1,1],[1,0],[0,0]])
  for(const [i,v] of actual.entries())for(const [j,axis] of ['x','y','z'].entries())assert.ok(Math.abs(v[axis]-c.expected[i].position[j])<2e-5,`Nonplanar native evidence ${c.function} ${c.name} ${i}.${axis}`)
  if(c.sameViewMatrices){
    const angle=c.cameraRotation||0,co=Math.cos(angle),si=Math.sin(angle)
    const spatial=sampleSpatialStretch({position:p,velocity:{...velocity,z:vz,speedSquared:speed2},size:c.size,
      scaleX:c.particleScale?.[0]||1,scaleY:c.particleScale?.[1]||1,lengthScale:c.lengthScale,velocityScale:c.velocityScale,
      maxSize:c.maxParticleSize??100,cameraMatrix:[co,si,0,0,-si,co,0,0,0,0,1,0,0,0,-10,1]})
    for(const [i,v] of spatial.entries())for(const [j,axis] of ['x','y','z'].entries())assert.ok(Math.abs(v[axis]-c.expected[i].position[j])<2e-5,`Spatial implementation legacy XYZ ${c.name}`)
  }
}
assert.equal(noiseProof.binarySha256,nativeProof.binary.sha256)
const point=([x,y,z])=>({x,y,z})
for(const c of noiseProof.scalingProof.cases) {
  if(c.scalingMode!==0)continue // Other scaling modes are rejected by extraction.
  const actual=emitterMatrix(c.chain)
  for(const k of ['a','b','c','d','tx','ty'])assert.ok(Math.abs(actual[k]-c.expectedMatrix[k])<2e-5,`Native hierarchy matrix mismatch: ${k}`)
}
const clock=createNoiseClock(1)
let wall=0
for(const event of noiseProof.clockProof.sequence) {
  if(event.advance) {
    if(event.count)assert.equal(clock.admit(wall,event.dt),true)
    wall+=event.dt
  }
  assert.ok(Math.abs(clock.timeAt(wall)*noiseProof.clockProof.scrollSpeed-event.expectedScroll)<1e-6,'Native empty/nonempty clock gate mismatch')
}
assert.equal(createNoiseClock(1).timeAt(0),noiseProof.clockProof.resetExpected)
const gaps=createNoiseClock(20)
for(const t of [0,.05,1,1.05])for(let i=0;i<10;i++)assert.equal(gaps.admit(t,.2),true)
assert.ok(Math.abs(gaps.timeAt(.9)-.25)<1e-12,'Empty gaps must not advance scroll')
assert.ok(Math.abs(gaps.timeAt(1.1)-.35)<1e-12,'Later burst resumes the held phase')
gaps.discardBefore(.8)
assert.ok(Math.abs(gaps.timeAt(1.1)-.35)<1e-12,'Pruning must preserve accumulated phase')
assert.throws(()=>gaps.timeAt(.1),/retained history/)
const capped=createNoiseClock(1)
assert.equal(capped.admit(0,.2),true)
assert.equal(capped.admit(.1,5),false,'At capacity native emission drops new births')
assert.equal(capped.timeAt(2),.2,'A dropped birth must not extend the clock')
for(const c of noiseProof.gradientCases) {
  const actual=sampleNoiseDerivatives(point(c.point),c.frequency)
  for(const [i,axis] of ['x','y'].entries())assert.ok(Math.abs(actual[axis]-c.expected[i])<.00002,`Native derivative mismatch ${JSON.stringify(c)}`)
}
for(const c of noiseProof.workerCases) {
  const n={quality:2,octaveCount:1,frequency:c.frequency,strength:c.strength,damping:c.damping,remapEnabled:false,separateAxes:false}
  const actual=sampleCurlNoise(n,point(c.point),c.scroll,point(c.offset))
  for(const [i,axis] of ['x','y','z'].entries())assert.ok(Math.abs(actual[axis]-c.expected[i])<.00002,`Native curl mismatch ${JSON.stringify(c)}`)
}
assert.throws(()=>sampleCurlNoise({quality:0},point([0,0,0]),0,point([0,0,0])),/Unsupported native curl profile/)
for(const c of noiseProof.trajectoryProof.cases) {
  let state={position:point(c.point),velocity:point(c.velocity)}
  const n={quality:2,octaveCount:1,frequency:c.frequency,strength:c.strength,damping:true,scroll:c.scrollSpeed,remapEnabled:false,separateAxes:false}
  for(let i=0;i<c.steps;i++)state=stepNoiseMotion(state,n,{dt:c.dt,phase:c.phase+(i+1)*c.dt,offset:point(c.offset),velocity:point(c.animatedVelocity),gravity:point([0,0,0]),limit:c.limit})
  for(const field of ['position','velocity'])for(const [i,axis] of ['x','y','z'].entries())assert.ok(Math.abs(state[field][axis]-c.expected[field][i])<.00002,`Native trajectory mismatch ${field}.${axis}: ${JSON.stringify(c)}`)
}
const nativeBinaryArg=process.argv.indexOf('--native-engine')
if(nativeBinaryArg>=0) {
  assert.ok(process.argv[nativeBinaryArg+1],'--native-engine needs the local libunity path')
  const binary=fs.readFileSync(process.argv[nativeBinaryArg+1])
  assert.equal(sha(binary),nativeProof.binary.sha256,'Native shape binary identity changed')
  for(const proof of [nativeProof.sphereThicknessInstructions,nativeProof.initialModuleProof.instructions,nativeProof.distanceEmissionProof.instructions,nativeProof.startDelayProof.instructions]) {
    const offset=Number(proof.elfOffset)
    assert.equal(binary.subarray(offset,offset+proof.bytes.length/2).toString('hex'),proof.bytes)
  }
  console.log('Native particle proof: libunity SHA-256, shape, initial curves, distance and startDelay instructions match')
}
// Geometric constraints from libunity's random-arc shape generators, independent of Web RNG.
const shape={type:0,radius:{mode:0,value:2},radiusThickness:1,arc:{value:360,mode:0,spread:0},m_Scale:{x:1,y:1,z:1}}
const fixed=channel=>({1:0,2:.5,3:.125}[channel]??0)
const volume=sampleEmitterShape(shape,fixed)
assert.ok(Math.abs(Math.hypot(...Object.values(volume.position))-1)<1e-12,'Thickness 1 emits inside the sphere, not on its surface')
assert.deepEqual(volume.direction,{x:1,y:0,z:0})
assert.equal(Math.hypot(...Object.values(sampleEmitterShape({...shape,radiusThickness:0},fixed).position)),2,'Thickness 0 emits on the sphere surface')
const shell=sampleEmitterShape({...shape,radiusThickness:.5},()=>0)
assert.equal(Math.hypot(...Object.values(shell.position)),1,'Half thickness retains an inner half-radius shell')
const hemisphere=sampleEmitterShape({...shape,type:2},fixed)
assert.equal(hemisphere.direction.z,.5,'Hemisphere is along local +Z')
const circle=sampleEmitterShape({...shape,type:10,radiusThickness:0},fixed)
assert.deepEqual(circle.position,{x:2,y:0,z:0});assert.deepEqual(circle.direction,{x:1,y:0,z:0})
const halfArc=sampleEmitterShape({...shape,type:10,arc:{value:180},radiusThickness:0},c=>c===1?.5:0)
assert.ok(Math.abs(halfArc.position.x)<1e-12);assert.ok(Math.abs(halfArc.position.y-2)<1e-12)
const cone=sampleEmitterShape({...shape,type:4,angle:45},fixed)
assert.ok(Math.abs(cone.position.x-2*Math.sqrt(.5005))<1e-12,'Cone area fraction has native 0.001 inner clamp')
assert.ok(cone.direction.x>0&&cone.direction.z>0);assert.ok(Math.abs(Math.hypot(...Object.values(cone.direction))-1)<1e-12)
assert.ok(Math.abs(cone.direction.x/cone.direction.z-Math.sqrt(.5005))<1e-12,'Cone initial direction uses radius fraction and angle')
assert.deepEqual(sampleEmitterShape({...shape,type:12},fixed).direction,{x:0,y:1,z:0})
const published=process.argv.includes('--published-assets')
const index=published?JSON.parse(read('public/assets/live-chibi/object-layers/index.json')):{assets:Object.fromEntries(Object.entries(data.assets).map(([k,v])=>[k,{bundle:v.bundle,particleCount:v.particleCount}]))}
const hash=published?sha(read('public/assets/live-chibi/object-layers/index.json')):data.objectIndexSha256
const choreographyHash=published?sha(read('public/assets/live-chibi/choreography/index.json')):data.choreographyIndexSha256
assert.equal(Object.values(attachObjectEmitters(index,data,hash,choreographyHash).assets).filter(a=>a.nativeParticleAnimation).length,111)
for(const change of [m=>m.nonEmitting[0].emission.enabled=true,m=>m.nonEmitting[0].subEmitters.enabled=true,m=>m.nonEmitting[0].source.pathId=m.systems[0].source.pathId,m=>m.nonEmittingProof=null]){
  const broken=structuredClone(data);change(broken.assets.fx_in_tktkkt_electric)
  assert.throws(()=>attachObjectEmitters(index,broken,hash,choreographyHash),/inactive emitters/)
}
assert.throws(()=>attachObjectEmitters(index,data,'0'.repeat(64)))
assert.throws(()=>attachObjectEmitters(index,data,hash),/choreography binding/)
assert.throws(()=>attachObjectEmitters(index,data,hash,'0'.repeat(64)),/choreography binding/)
const unproven=structuredClone(data)
delete unproven.assets.fx_in_pavetl_crystal_1.distanceMotionProof
assert.throws(()=>attachObjectEmitters(index,unproven,hash,choreographyHash),/Unproven distance emitter motion/)
assert.equal(Object.values(data.assets).reduce((n,a)=>n+a.systems.length,0),873)
assert.equal(Object.values(data.assets).reduce((n,a)=>n+a.deferred.length,0),0)
for(const a of Object.values(data.textures))assert.equal(sha(read('public'+a.file)),a.pngSha256)
const meter=data.assets.fx_in_rote77_meter.systems[0]
assert.equal(sampleObjectEmitter(meter,0,0).length,1)
assert.equal(sampleObjectEmitter(meter,2000,0).length,1,'A single native burst starts each system loop')
// Birth IDs differ across loops, but this fixed emitter has no random fields.
const at500=sampleObjectEmitter(meter,500,0)[0],at2500=sampleObjectEmitter(meter,2500,0)[0]
for(const k of ['x','y','a','b','c','d','frame','alpha'])assert.equal(at500[k],at2500[k])
assert.equal(at500.x,-546.0000038146973)
assert.ok(Math.abs(at500.y+117.99999475479126)<1e-10)
assert.ok(sampleObjectEmitter(meter,1900,0,500).length>0)
assert.equal(sampleObjectEmitter(meter,2000,0,500).length,0,'StopEmitting blocks the next burst')
const turn=emitterMatrix([{position:{x:2,y:3},rotation:{x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2},scale:{x:2,y:3}}])
assert.ok(Math.abs(turn.a)<1e-12);assert.ok(Math.abs(turn.b-2)<1e-12);assert.equal(turn.tx,2);assert.equal(turn.ty,3)
for(const model of Object.values(data.assets))for(const system of model.systems) {
  for(const time of [0,100,499,900,1300,2000,3900]) {
    const samples=samplePreviewSystem(system,time,0)
    assert.ok(samples.length<=system.capacity)
    assert.deepEqual(samples,samplePreviewSystem(system,time,0))
    for(const s of samples){assert.ok(Object.values(s).every(Number.isFinite));assert.ok(s.frame>=0 && s.frame<(system.uv?system.uv.columns*system.uv.rows:1))}
  }
}
// Independent delayed bulbs must have distinct live phases, not one group alpha.
const line=data.assets.fx_in_tkstp1_linelight_1.systems
assert.equal(line.length,35)
assert.equal(Object.entries(data.assets).filter(([name])=>name.startsWith('fx_in_tkstp1_linelight_')).reduce((n,[,a])=>n+a.systems.length,0),247)
const phases=line.map(s=>sampleObjectEmitter(s,650,0)[0]?.alpha??0)
assert.ok(new Set(phases.map(n=>n.toFixed(5))).size>2)
assert.equal(line[1].delay.value,.05000000074505806)
const mirror=emitterMatrix([{position:{x:0,y:0},rotation:{x:0,y:1,z:0,w:0},scale:{x:1,y:1}}])
assert.deepEqual(mirror,{a:-1,b:0,c:0,d:1,tx:0,ty:0})
const beam=data.assets.fx_in_plmask_incidentlight_1.systems[0]
assert.equal(beam.shape.type,12)
assert.equal(beam.sizeY.scalar,6)
const probe={...beam,chain:[{position:{x:0,y:0},rotation:{x:0,y:0,z:0,w:1},scale:{x:1,y:1}}],shape:{...beam.shape,radius:{value:0},m_Scale:{x:1,y:1,z:1}},size:{mode:0,scalar:2},sizeY:{mode:0,scalar:6},sizeOverLife:null,sizeOverLifeY:null,rotation:{mode:0,scalar:0},rate:1,lifetime:{mode:0,scalar:4,minScalar:4},bursts:[],limit:null}
const movingNoise={...probe,shape:null,looping:false,delay:0,bursts:[{time:0,count:1}],rate:0,speed:{mode:0,scalar:0},noise:{quality:2,octaveCount:1,frequency:.5,strength:1,damping:true,scroll:1,remapEnabled:false,separateAxes:false}}
assert.equal(sampleObjectEmitter(movingNoise,0,0)[0].x,0,'Noise is velocity: no instantaneous birth displacement')
assert.ok(sampleObjectEmitter(movingNoise,0,0)[0].y===0)
const noiseAt700=sampleObjectEmitter(movingNoise,700,0)
sampleObjectEmitter(movingNoise,3300,0)
assert.deepEqual(sampleObjectEmitter(movingNoise,700,0),noiseAt700,'Rewind resets the integrated trajectory')
assert.deepEqual(sampleObjectEmitter(structuredClone(movingNoise),700,0),noiseAt700,'Cached and cold integration must agree')
assert.deepEqual(sampleObjectEmitter(movingNoise,700,0,300),noiseAt700,'StopEmitting must not freeze Noise on a surviving particle')
const cappedNoise={...movingNoise,capacity:1,lifetime:{mode:0,scalar:.2},bursts:[{time:0,count:1},{time:.1,count:1}]}
assert.equal(sampleObjectEmitter(cappedNoise,150,0)[0].birth,0,'Actual consumer must retain the old particle and reject an overflowing birth')
const gravityNoise={...movingNoise,noise:{...movingNoise.noise,strength:0},gravity:{mode:0,scalar:1},chain:[{position:{x:0,y:0},rotation:{x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2},scale:{x:2,y:3}}]}
const falling=sampleObjectEmitter(gravityNoise,1000,0)[0]
assert.ok(Math.abs(falling.x)<1e-9,'World gravity must stay vertical through a rotated/scaled emitter plane')
assert.ok(Math.abs(falling.y-9.81*(61/120)*100)<1e-8,'Gravity uses semi-implicit integration and is not added again after projection')
for(const c of noiseProof.gravitySpaceProof.cases) {
  const m=c.matrix,det=m.a*m.d-m.b*m.c
  const gravity=c.space===1?{x:0,y:-9.81,z:0}:{x:m.c*9.81/det,y:-m.a*9.81/det,z:0}
  for(const [i,axis] of ['x','y','z'].entries())assert.ok(Math.abs(gravity[axis]*c.dt-c.expectedVelocity[i])<2e-7,'Native gravity simulation-space branch mismatch')
  if(c.space!==0 || c.dt!==1/60)continue // Object profile only admits local simulation.
  const rotated=m.b!==0
  const system={...gravityNoise,velocity:null,chain:[{position:{x:0,y:0},rotation:{x:0,y:0,z:rotated?Math.SQRT1_2:0,w:rotated?Math.SQRT1_2:1},scale:{x:rotated?m.b:m.a,y:rotated?-m.c:m.d}}]}
  const actual=sampleObjectEmitter(system,1000,0)[0]
  const [vx,vy]=c.expectedVelocity,steps=60,integral=c.dt*steps*(steps+1)/2*100
  assert.ok(Math.abs(actual.x-(m.a*vx+m.c*vy)*integral)<.0002,'Object gravity projection differs from native velocity replay')
  assert.ok(Math.abs(actual.y+(m.b*vx+m.d*vy)*integral)<.0002,'Object gravity accumulated displacement differs from native replay')
}
const keys=(a,b,slope=b-a)=>[{time:0,value:a,inSlope:slope,outSlope:slope},{time:1,value:b,inSlope:slope,outSlope:slope}]
const linearVelocity={mode:1,scalar:1,keys:keys(0,1)}
for(const age of [0,.1,.5,.731,1,1.99])assert.ok(Math.abs(sampleObjectVelocityDisplacement(linearVelocity,age,2,0)-age*age/4)<1e-12,'Integrate the velocity rate, not endpoint velocity times age')
for(const c of velocityProof.cases)for(const curve of c.curves) {
  const life=c.lifetime.scalar
  // Independent continuous Hermite antiderivative: midpoint replay converges
  // to this polynomial integral, including the three-key reversal segments.
  let integral=0
  for(let i=0;i<curve.keys.length-1;i++) {
    const a=curve.keys[i],b=curve.keys[i+1],span=b.time-a.time
    integral+=span*((a.value+b.value)/2+span*(a.outSlope-b.inSlope)/12)*curve.scalar*life
  }
  assert.ok(Math.abs(sampleObjectVelocityDisplacement(curve,life,life,0)-integral)<2e-6,'Native-source Hermite displacement on the Web 60 Hz grid')
  const earlier=sampleObjectVelocityDisplacement(curve,life*.3,life,0)
  sampleObjectVelocityDisplacement(curve,life*.9,life,0)
  assert.equal(sampleObjectVelocityDisplacement(curve,life*.3,life,0),earlier,'Cached rate integral survives rewind')
  assert.equal(sampleObjectVelocityDisplacement(structuredClone(curve),life*.3,life,0),earlier,'Cold and cached rate integrals agree')
}
const curvedFlow={...movingNoise,noise:null,lifetime:{mode:0,scalar:2,minScalar:2},velocity:{x:{mode:0,scalar:0},y:linearVelocity,z:{mode:0,scalar:0}}}
assert.ok(Math.abs(sampleObjectEmitter(curvedFlow,1000,0)[0].y+25)<1e-10,'Actual particle consumer integrates lifetime velocity')
const curvedAt731=sampleObjectEmitter(curvedFlow,731,0)
sampleObjectEmitter(curvedFlow,1800,0)
assert.deepEqual(sampleObjectEmitter(curvedFlow,731,0),curvedAt731,'Curved particle rewind')
assert.deepEqual(sampleObjectEmitter(structuredClone(curvedFlow),731,0),curvedAt731,'Curved particle cold seek')
assert.deepEqual(sampleObjectEmitter(curvedFlow,731,0,300),curvedAt731,'StopEmitting preserves the living particle velocity')
const twoCurves={mode:2,scalar:2,minScalar:100,keys:keys(.5,1),minKeys:keys(.2,.4)}
assert.ok(Math.abs(sampleObjectCurve(twoCurves,.5,.5)-1.05)<1e-12,'Two curves share the multiplier and ignore constantMin')
const frozen={...probe,shape:null,looping:false,duration:2,bursts:[{time:.5,count:1}],rate:0,sizeY:null,size:{mode:1,scalar:1,keys:keys(0,4)},lifetime:{mode:0,scalar:4,minScalar:4}}
assert.equal(sampleObjectEmitter(frozen,750,0)[0].a,100,'Initial size uses the birth system phase, not zero')
assert.equal(sampleObjectEmitter(frozen,1500,0)[0].a,100,'Initial size is frozen for that birth, not sampled at particle age')
const longCurve={...frozen,looping:true,duration:1,bursts:[{time:.5,count:1}],lifetime:{mode:1,scalar:1,keys:[{time:0,value:1,inSlope:0,outSlope:18},{time:1,value:1,inSlope:-18,outSlope:0}]}}
assert.equal(sampleObjectEmitter(longCurve,4000,0).length,4,'Tangent overshoot must not discard older living births')
const rectangle=sampleObjectEmitter(probe,1500,0)[0]
assert.equal(rectangle.a,200);assert.equal(rectangle.d,600);assert.equal(rectangle.x,0);assert.ok(rectangle.y===0)
const smoke=data.assets.fx_in_inndgn_smoke_1.systems.find(s=>s.velocity)
assert.ok(smoke)
const flow={...probe,velocity:{x:{mode:0,scalar:2},y:{mode:0,scalar:3},z:{mode:0,scalar:0}}}
const drift=sampleObjectEmitter(flow,1500,0)[0]
assert.equal(drift.x,100);assert.equal(drift.y,-150)
// Prewarm: the native system is already mid-cycle on activation, so t=0 is not empty.
const star=data.assets.fx_in_trhorz_star_2.systems[0]
assert.equal(star.prewarm,true)
assert.ok(sampleObjectEmitter(star,0,0).length>0,'Prewarmed star must be visible at activation')
assert.ok(sampleObjectEmitter(data.assets.fx_in_trhorz_starline_1.systems[0],0,0).length>0)
// Random start delay belongs to the system: all births in a burst share it,
// and later loops retain it. No particle may start before the minimum.
const staggered={...probe,capacity:16,looping:false,delay:{mode:3,value:2,min:1},bursts:[{time:0,count:8}],rate:0,lifetime:{mode:0,scalar:4,minScalar:4}}
assert.equal(sampleObjectEmitter(staggered,500,0).length,0)
assert.equal(sampleObjectEmitter(staggered,2100,0).length,8)
for(let t=1000;t<=2000;t+=10)assert.ok([0,8].includes(sampleObjectEmitter(staggered,t,0).length),'A single burst must not acquire per-particle delays')
const randomLoop={...staggered,looping:true,duration:3,lifetime:{mode:0,scalar:.5,minScalar:.5}}
for(let t=1000;t<=2500;t+=10)assert.equal(sampleObjectEmitter(randomLoop,t,0).length,sampleObjectEmitter(randomLoop,t+3000,0).length,'Loop must reuse the system delay')
// A delayed looping emitter must not lose whole loops: the loop window is shifted by startDelay.
const delayedLoop={...probe,looping:true,duration:1,delay:{mode:0,value:1.2,min:0},bursts:[],rate:25,lifetime:{mode:0,scalar:1,minScalar:1},size:{mode:0,scalar:1},sizeOverLife:null}
for(const t of [2000,2500,3000,3500,4000,4500])assert.ok(sampleObjectEmitter(delayedLoop,t,0).length>0,`Delayed loop dropped at ${t} ms`)
// A RotationModule curve is an angular rate; the integrated angle must match a constant 1 rad/s curve.
const turning={...probe,looping:false,bursts:[{time:0,count:1}],rate:0,lifetime:{mode:0,scalar:4,minScalar:4},
  angularVelocity:{mode:1,scalar:1,minScalar:0,keys:[{time:0,value:1,inSlope:0,outSlope:0},{time:1,value:1,inSlope:0,outSlope:0}]}}
const turned=sampleObjectEmitter(turning,1000,0)[0]
assert.ok(Math.abs(turned.a-Math.cos(1)*200)<1e-6)
assert.ok(Math.abs(turned.c+Math.sin(1)*600)<1e-6,'Positive angular velocity turns the texture clockwise on screen')
assert.equal(data.assets.fx_in_trhorz_star_1.deferred.length,0)
assert.equal(data.assets.fx_in_trhorz_star_1.systems.length,4)
assert.equal(data.assets.fx_in_trhorz_star_1.systems.filter(s=>s.partial&&s.partial.includes('stretch_omitted')).length,2)
assert.equal(data.assets.fx_in_swyrlv_leaf.deferred.length,0)
assert.equal(data.assets.fx_in_swyrlv_leaf.systems.length,2)
assert.ok(data.assets.fx_in_swyrlv_leaf.systems.some(s=>s.rotationX&&s.gravity))
const partial=Object.values(data.assets).flatMap(m=>m.systems).filter(s=>s.partial)
assert.equal(partial.length,106)
assert.equal(partial.filter(s=>s.partial.includes('noise_preview')).length,90)
for(const s of partial.filter(s=>s.noise)) {
  assert.equal(s.noise.profile,'native-high-curl-v1')
  assert.equal(s.noise.octaveCount,1)
  assert.equal(s.noise.quality,2)
}
assert.equal(partial.filter(s=>s.partial.includes('stretch_omitted')).length,7)
assert.equal(partial.filter(s=>s.partial.includes('stretch_preview')).length,9)
for(const asset of ['fire_1','fire_2','fire_3','turbo_1','turbo_2'].map(s=>'fx_in_rote77_'+s)) {
  const system=data.assets[asset].systems.find(s=>s.partial?.includes('stretch_omitted'))
  assert.equal(system.shape.type,4)
  assert.ok(system.shape.angle>0,'Cone spread retains a nonplanar velocity component')
  assert.equal(system.stretch,undefined,'Nonplanar cone must not enter the planar solver')
}
for(const system of partial.filter(s=>s.stretch?.profile==='native-classic-planar-v1')) {
  assert.equal(system.stretch.profile,'native-classic-planar-v1')
  assert.equal(system.stretch.rendererTreeSha256.length,64)
  const at=sampleObjectEmitter(system,49000,0)
  assert.deepEqual(sampleObjectEmitter(system,49000,0),at,'Stretch seeking must be deterministic')
}
const sharedStretch=data.assets.fx_in_tfmvmt_Incidentlight.systems.find(s=>s.stretch)
const birthModel={...sharedStretch,chain:[],shape:{...sharedStretch.shape,radius:{value:0},arc:{value:0},m_Rotation:{x:0,y:0,z:0}},looping:false,delay:0,rate:0,bursts:[{time:0,count:1}],lifetime:{mode:0,scalar:2},speed:{mode:0,scalar:1},size:{mode:0,scalar:2},sizeOverLife:null,rotation:{mode:0,scalar:0},stretch:{...sharedStretch.stretch,velocityScale:1,lengthScale:2}}
const birthQuad=sampleObjectEmitter(birthModel,0,0,Infinity,{height:10})[0]
const golden=stretchProof.cases.find(c=>c.name==='packed-x').expected
for(const [i,[u,v]] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].entries()) {
  assert.ok(Math.abs((birthQuad.x+birthQuad.a*u+birthQuad.c*v)/100-golden[i].position[0])<2e-5,'Actual consumer stretch X/UV orientation mismatch')
  assert.ok(Math.abs(-(birthQuad.y+birthQuad.b*u+birthQuad.d*v)/100-golden[i].position[1])<2e-5,'Actual consumer stretch Y/UV orientation mismatch')
}
assert.equal(Object.values(data.assets).filter(m=>m.systems.length).length,111)
const rawObjects=JSON.parse(read('scripts/fixtures/chibi-object-emitters-native.json')).objects
for(const r of stretchProof.renderers) {
  const source=rawObjects.find(o=>o.asset===r.asset)
  const particle=source.particles.find(p=>p.renderer.pathId===r.pathId)
  const system=data.assets[r.asset].systems.find(s=>s.source.pathId===particle.pathId)
  if(!system.stretch)continue
  for(const [field,raw] of Object.entries({minSize:'m_MinParticleSize',maxSize:'m_MaxParticleSize',cameraVelocityScale:'m_CameraVelocityScale',velocityScale:'m_VelocityScale',lengthScale:'m_LengthScale'}))assert.equal(system.stretch[field],r.fields[raw],`Unsourced stretch field ${r.asset}.${field}`)
  assert.equal(system.stretch.rendererTreeSha256,particle.renderer.stretch.rendererTreeSha256)
}
for(const [name,count] of Object.entries({fx_in_pavetl_crystal_1:15,fx_in_pavetl_crystal_2:10,fx_in_smlegg_crystal_1:21,fx_in_smlegg_crystal_2:34})) {
  const model=data.assets[name]
  assert.equal(model.systems.length,count*2)
  assert.equal(model.deferred.length,0)
  assert.equal(model.systems.filter(s=>s.name==='glitter').length,count)
  assert.equal(model.distanceMotionProof.profile,'stationary-object-layer-v1')
  assert.ok(model.distanceMotionProof.components.length>0)
  assert.ok(model.distanceMotionProof.arrangements.length>0)
  const source=rawObjects.find(o=>o.asset===name)
  const crystals=model.systems.filter(s=>s.distanceRate)
  assert.equal(crystals.length,count)
  for(const s of crystals) {
    const p=source.particles.find(p=>p.pathId===s.source.pathId)
    assert.equal(p.modules.InitialModule.startLifetime.minMaxState,2)
    assert.equal(p.modules.EmissionModule.rateOverDistance.scalar,1)
    assert.equal(s.distanceRate.scalar,1,'Retain native nonzero rate even though proved displacement is zero')
    assert.equal(s.distanceMode,'stationary-object-layer-v1')
    assert.throws(()=>sampleObjectEmitter({...s,distanceMode:'moving'},2000,0),/Unbound distance emitter motion/)
    assert.ok(Array.from({length:81},(_,i)=>i*50).some(t=>sampleObjectEmitter(s,t,0).length),'Crystal burst must really emit')
    assert.equal(sampleObjectEmitter(s,10000,0,0).length,0,'Stopped crystal must retire')
  }
}
const promotions=JSON.parse(read('scripts/fixtures/chibi-object-emitter-promotions.json'))
assert.equal(promotions.objectIndexSha256,data.objectIndexSha256)
assert.equal(Object.keys(promotions.assets).length,41)
assert.equal(Object.values(promotions.assets).reduce((n,a)=>n+a.systems,0),209)
for(const [name,expected] of Object.entries(promotions.assets)) {
  const model=data.assets[name]
  assert.equal(model.systems.length,expected.systems,name)
  if(expected.sources){assert.equal(model.bundleSha256,expected.bundleSha256,name);assert.deepEqual(model.systems.map(s=>s.source),expected.sources,name)}
  assert.equal(model.deferred.length,0,name)
  assert.ok(model.systems.every(s=>!s.partial?.length),name)
  // Every newly admitted resource must actually emit, survive rewind, and retire after stop.
  const times=[0,100,1000,3000,7000,15000,30000]
  assert.ok(times.some(t=>model.systems.some(s=>sampleObjectEmitter(s,t,0).length)),`${name}: empty across activation samples`)
  for(const system of model.systems) {
    const retire=(Math.max(system.lifetime.scalar,system.lifetime.minScalar)+2)*1000
    assert.equal(sampleObjectEmitter(system,retire,0,0).length,0,`${name}: retained particles after stop`)
  }
}
// Source-bound smoke and sakura previews remain explicitly partial. Preserve
// the RED HOT BEAT reference window; retirement follows each source lifetime.
function previewRetirementMs(system) {
  assert.ok([0,3].includes(system.lifetime.mode),'Preview retirement requires a bounded constant or two-constant lifetime')
  return Math.max(system.lifetime.scalar,system.lifetime.minScalar)*1000+100
}
function previewActivationMs(system) {
  assert.ok([0,3].includes(system.delay.mode),'Preview activation requires a bounded start delay')
  return Math.max(system.delay.value,system.delay.min)*1000+(system.looping?500:Math.min(...system.bursts.map(b=>b.time))*1000+Math.min(system.lifetime.scalar,system.lifetime.minScalar)*500)
}
assert.equal(Object.keys(promotions.previewAssets).length,22)
for(const [name,expected] of Object.entries(promotions.previewAssets)) {
  const model=data.assets[name]
  assert.equal(model.bundleSha256,expected.bundleSha256)
  assert.equal(model.systems.length,expected.systems)
  assert.deepEqual(model.systems.map(s=>s.source),expected.sources)
  assert.deepEqual(model.deferred,[])
  assert.ok(rawObjects.some(o=>o.asset===name),'RAW source record is required')
  for(const [i,system] of model.systems.entries()) {
    assert.deepEqual(system.partial||[],expected.systemPartials?.[i]||expected.partialMarkers)
    if(!system.partial?.length)continue
    if(system.stretch)assert.equal(system.stretch.profile,OBJECT_SPATIAL_PROFILE)
    else assert.equal(system.noise.profile,'native-high-curl-v1')
    if(!system.looping) {
      const at=11000+previewActivationMs(system),active=samplePreviewSystem(system,at,11000)
      assert.ok(active.length>0 && active.length<=system.bursts.reduce((n,b)=>n+b.count,0),'Finite source bursts must emit within their own lifetime')
      assert.equal(samplePreviewSystem(system,12000,11000).length,0,'Single pulse cannot keep spawning without another Play')
      assert.deepEqual(samplePreviewSystem(system,at,11000),active,'Short pulse rewind')
      assert.deepEqual(samplePreviewSystem(structuredClone(system),at,11000),active,'Cold short pulse')
      continue
    }
    const active=samplePreviewSystem(system,20000,11000,24900)
    assert.ok(active.length>0,`${name}: visible at requested 20-second position`)
    assert.ok(samplePreviewSystem(system,25000,11000,24900).length>0,'StopEmitting keeps existing particles alive')
    assert.equal(samplePreviewSystem(system,24900+previewRetirementMs(system),11000,24900).length,0,'Particles retire after their source lifetime')
    if(name.includes('smoke'))assert.equal(samplePreviewSystem(system,26000,11000,24900).length,0,'Existing smoke retires before object hide completes at 27900')
    assert.deepEqual(samplePreviewSystem(system,20000,11000,24900),active,'Rewind after stop must recover smoke')
    assert.deepEqual(samplePreviewSystem(structuredClone(system),20000,11000,24900),active,'Cold seek and cached rewind agree')
    assert.ok(samplePreviewSystem(system,66300+previewActivationMs(system),66300,73050).length>0,'Later activation must emit again after its source start delay')
  }
}
if(published) {
  const songs=JSON.parse(read('public/assets/live-chibi/choreography/index.json')).songs
  assert.equal(sha(read('public/assets/live-chibi/choreography/index.json')),spatialContext.choreographySha256)
  const spatialSong=songs.find(s=>s.id===spatialContext.arrangement.id)
  assert.deepEqual(spatialSong.cameraEvents,spatialContext.arrangement.cameraEvents)
  assert.deepEqual(spatialSong.objectLayerEvents.filter(e=>e.asset.startsWith('fx_in_pfofos_fire_')),spatialContext.arrangement.fireEvents)
  let windows=0
  for(const name of Object.keys(promotions.previewAssets)) {
    const references=songs.filter(s=>(s.objectLayerEvents||[]).some(e=>e.asset===name))
    assert(references.length,`${name}: real choreography reference required`)
    for(const song of references) {
      const events=song.objectLayerEvents.filter(e=>e.asset===name)
      for(const [i,event] of events.entries())if(!event.hide) {
        const stop=events.slice(i+1).find(e=>e.hide)?.time
        for(const system of data.assets[name].systems) {
          const at=Math.min(event.time+previewActivationMs(system),stop===undefined?Infinity:stop-25)
          const active=samplePreviewSystem(system,at,event.time,stop)
          assert(active.length>0,`${name}@${at}: actual activation window must emit`)
          if(stop!==undefined)assert.equal(samplePreviewSystem(system,stop+previewRetirementMs(system),event.time,stop).length,0,'Stopped particles must expire')
          assert.deepEqual(samplePreviewSystem(system,at,event.time,stop),active,'Rewind through actual command history')
          assert.deepEqual(samplePreviewSystem(structuredClone(system),at,event.time,stop),active,'Cold actual-command seek')
        }
        windows++
      }
    }
  }
  assert.equal(windows,164,'All21 preview assets actual show/restart commands across every referencing arrangement')
  for(const name of ['fx_in_mainha_panel_1','fx_in_mainha_panel_2']) {
    const model=data.assets[name],events=songs.find(s=>s.id==='mainha_live_effect').objectLayerEvents.filter(e=>e.asset===name)
    assert.equal(events.length,1);assert.equal(events[0].time,-2000);assert.equal(events[0].hide,false)
    assert.equal(model.masks.length,1,'Every panel has its own RAW-bound mask')
    for(const system of model.systems) {
      assert.ok(system.maskTexture && model.masks.some(m=>m.texture===system.maskTexture))
      assert.ok([0,1000,2500,10000,30000].some(t=>sampleObjectEmitter(system,t,-2000).length),'Every panel system emits during its actual pre-zero history')
      for(const t of [0,1000,10000,30000]) {
        const active=sampleObjectEmitter(system,t,-2000)
        assert.deepEqual(sampleObjectEmitter(structuredClone(system),t,-2000),active,'Cold panel positioning')
        sampleObjectEmitter(system,72000,-2000)
        assert.deepEqual(sampleObjectEmitter(system,t,-2000),active,'Panel rewind after long playback')
      }
      assert.equal(sampleObjectEmitter(system,previewRetirementMs(system),-2000,0).length,0,'Panel retirement after synthetic stop')
    }
  }
  const shock=data.assets.fx_in_remasq_shockwave
  assert.equal(shock.systems.length,3)
  assert.deepEqual(shock.systems.map(s=>s.bursts),Array.from({length:3},()=>[{time:0,count:1}]))
  assert.ok(Math.abs(shock.systems[1].delay.value-.07)<1e-8,'RAW second pulse delay is70ms')
  const counts=t=>shock.systems.reduce((n,s)=>n+sampleObjectEmitter(s,t,0).length,0)
  for(const [time,count] of [[0,2],[50,2],[100,3],[220,2],[270,1],[350,0],[1000,0]])assert.equal(counts(time),count,`RAW shock burst/delay/retirement at${time}`)
  for(const system of shock.systems)assert.equal(sampleObjectEmitter(system,-1,0).length,0)
  const cloud=data.assets.fx_in_ossshd_panel
  const arrangement=songs.find(s=>s.id==='ossshd_live_effect')
  const events=arrangement.objectLayerEvents.filter(e=>e.asset==='fx_in_ossshd_panel')
  assert.equal(events.length,1)
  assert.equal(events[0].time,-2000,'Cloud starts before song zero')
  assert.equal(events[0].hide,false)
  assert.equal(cloud.masks.length,2)
  const curved=cloud.systems.filter(s=>s.velocity)
  assert.equal(curved.length,8)
  for(const [i,system] of curved.entries()) {
    assert.deepEqual(system.source,velocityProof.cases[i].source)
    assert.deepEqual(['x','y','z'].map(axis=>system.velocity[axis]),velocityProof.cases[i].curves)
    assert.deepEqual(system.lifetime,velocityProof.cases[i].lifetime)
  }
  for(const system of cloud.systems) {
    for(const at of [0,10000,25000,72000]) {
      const active=sampleObjectEmitter(system,at,-2000)
      assert.ok(active.length>0,'Every cloud/glitter system must survive its actual pre-zero activation history')
      assert.deepEqual(sampleObjectEmitter(structuredClone(system),at,-2000),active,'Cold cloud seek')
    }
    const before=sampleObjectEmitter(system,10000,-2000)
    sampleObjectEmitter(system,72000,-2000)
    assert.deepEqual(sampleObjectEmitter(system,10000,-2000),before,'Cloud rewind after many loops')
    assert.equal(sampleObjectEmitter(system,26000,-2000,0).length,0,'Synthetic stop retires long-lived cloud without spawning later loops')
  }
}
for(const m of Object.values(data.assets))for(const s of m.systems)if(s.alphaShader)assert.deepEqual(s.alphaShader.blend,{srcBlend:5,destBlend:10,blendOp:0})
console.log('Object emitters: 111 provenance-bound resources / 873 consumed (106 preview), 0 deferred; 80 stationary distance emitters, system startDelay, source binding and geometry/lifecycle checks passed')
