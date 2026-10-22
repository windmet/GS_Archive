import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {emitterMatrix,emitterRenderBasis,sampleObjectEmitter} from '../src/core/chibiObjectEmitters.js'
import {objectSpatialContext,spatialEmitterQuads} from '../src/core/chibiObjectSpatialContext.js'
import {sampleSpatialStretch,transformSpatialStretchVelocity} from '../src/core/chibiParticleStretch.js'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url)),json=p=>JSON.parse(read(p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const fire=json('scripts/fixtures/chibi-bnckgy-fire-native.json'),size=json('scripts/fixtures/chibi-fire-uniform-size-native.json'),camera=json('scripts/fixtures/chibi-fire-camera-native.json'),scene=json('scripts/fixtures/chibi-fire-scene-native.json'),data=json('public/data/stage-object-emitters.json')
const name='fx_in_bnckgy_fire',model=data.assets[name],bound=fire.models[name],f=Math.fround
for(const proof of [fire,size,camera,scene])assert.equal(proof.binarySha256,'acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0')
for(const proof of [fire,size,camera])for(const w of proof.sourceWindows||proof.instructionWindows)assert.equal(sha(Buffer.from(w.bytes,'hex')),w.sha256)
for(const [file,identity] of Object.entries(scene.dependencies))assert.equal(sha(read('scripts/fixtures/'+file)),identity)
assert.equal(model.bundleSha256,bound.bundleSha256);assert.equal(size.models[name].bundleSha256,bound.bundleSha256)
assert.equal(model.particleCount,42);assert.equal(model.systems.length,36);assert.equal(model.nonEmitting.length,6)
assert.deepEqual(model.nonEmitting,bound.nonEmitting)
assert.deepEqual(model.nonEmittingProof,{profile:'native-static-disabled-emission-v1',proofSha256:sha(read('scripts/fixtures/chibi-bnckgy-fire-native.json')),components:bound.staticComponents})
assert.deepEqual(model.systems.map(s=>s.source),bound.systems.map(s=>s.source))
assert.equal(fire.choreographySha256,data.choreographyIndexSha256);assert.equal(camera.choreographySha256,fire.choreographySha256)
assert.equal(fire.arrangement.id,'bnckgy_live_effect');assert.equal(camera.arrangementId,fire.arrangement.id)
assert.equal(fire.arrangement.fireEvents.length,49);assert.equal(camera.cases.length,90)
const makeCamera=ce=>ce&&!ce.reset?{verified:true,focusSlot:0,orthoSize:5/(ce.zoom/1000),x:ce.x,y:ce.y,rotation:ce.rotation}:{verified:true,focusSlot:0,orthoSize:5,x:0,y:360,rotation:0}
for(const c of camera.cases){
  const context=objectSpatialContext(makeCamera(fire.arrangement.cameraEvents[c.eventIndex]),{x:0,y:360,scale:1000},fire.arrangement.id)
  for(let i=0;i<16;i++)assert.ok(Math.abs(context.cameraMatrix[i]-c.expected[i])<2e-5,'Source camera getter matrix')
}
for(const source of bound.stretchSystems){
  const s=model.systems.find(s=>s.source.pathId===source.system.source.pathId)
  assert.deepEqual(s.chain,source.system.chain)
  assert.deepEqual(s.stretch,{...source.renderer,profile:'native-source-spatial-v1',binding:{arrangements:[fire.arrangement.id],sourceContextSha256:sha(read('scripts/fixtures/chibi-spatial-context-native.json')),sceneProofSha256:sha(read('scripts/fixtures/chibi-fire-scene-native.json'))}})
}
let maxConeError=0,maxBridgeError=0
for(const c of fire.cases){
  const i=c.input,[a,b,k,d,tx,ty]=i.matrix.map(f),[sz,tz]=i.depthMatrix
  const position={x:f(f(a*i.position[0])+f(k*i.position[1])+tx),y:f(f(b*i.position[0])+f(d*i.position[1])+ty),z:f(f(sz*i.position[2])+tz)}
  const angle=i.cameraRotation,co=f(Math.cos(angle)),si=f(Math.sin(angle))
  // Match the native harness's controlled view, including its -10 Z offset.
  const cameraMatrix=[co,si,0,0,-si,co,0,0,0,0,1,0,0,0,-10,1]
  const velocity=transformSpatialStretchVelocity({a,b,c:k,d},{x:i.velocity[0],y:i.velocity[1],z:i.velocity[2]},cameraMatrix,sz)
  const actual=sampleSpatialStretch({...i,position,velocity,scaleX:i.particleScale[0],scaleY:i.particleScale[1],maxSize:i.maxParticleSize,cameraMatrix,viewHeight:10})
  const error=Math.max(...actual.flatMap((v,j)=>['x','y','z'].map((axis,l)=>Math.abs(v[axis]-c.expected[j].position[l]))))
  maxConeError=Math.max(maxConeError,error)
}
assert.equal(fire.cases.length,1728)
assert.ok(maxConeError<2e-5,`Native cone error ${maxConeError}`)
for(const row of scene.cases){
  const frame=scene.frames[row.frameIndex],event=fire.arrangement.fireEvents[frame.eventIndex],ce=fire.arrangement.cameraEvents[camera.cases[frame.cameraIndex].eventIndex]
  assert.equal(event.hide,false);assert.deepEqual(frame.input.cameraMatrix,camera.cases[frame.cameraIndex].expected)
  const system=model.systems.find(s=>s.source.pathId===frame.source.pathId),context=objectSpatialContext(makeCamera(ce),event,fire.arrangement.id)
  const quad=spatialEmitterQuads(system,emitterMatrix(system.chain),emitterRenderBasis(system.chain,system.alignment),Object.fromEntries('xyz'.split('').map((k,i)=>[k,row.position[i]])),Object.fromEntries('xyz'.split('').map((k,i)=>[k,row.velocity[i]])),system.size.scalar,context)
  for(const [i,q] of quad.entries())for(const [j,axis] of ['x','y'].entries())maxBridgeError=Math.max(maxBridgeError,Math.abs((q[axis]*context.outer+context.offset[axis])*context.xyScale-row.expected[i].position[j]))
}
assert.equal(scene.frames.length,150);assert.equal(scene.cases.length,2400);assert.ok(maxBridgeError<2e-5,`Native scene bridge error ${maxBridgeError}`)
for(const s of size.models[name].systems){
  const system=model.systems.find(p=>p.source.pathId===s.source.pathId)
  assert.deepEqual(system.source,s.source);assert.deepEqual(system.chain,s.chain)
  assert.deepEqual(system.rendererBounds,{profile:'native-scaled-uniform-screen-size-v1',min:0,max:1,proofSha256:sha(read('scripts/fixtures/chibi-fire-uniform-size-native.json'))})
}
for(const c of size.cases){
  const source=model.systems.find(s=>s.source.pathId===c.source.pathId),scalar=v=>({mode:0,scalar:v,minScalar:v})
  const system={...source,noise:null,stretch:null,velocity:null,gravity:null,limit:null,speed:scalar(0),size:scalar(c.size),sizeY:null,sizeOverLife:null,sizeOverLifeY:null,rotation:scalar(c.angle),rotationX:null,rotationY:null,angularVelocity:null,shape:{type:0,radius:{value:0},radiusThickness:0,m_Rotation:{x:0,y:0,z:0},m_Position:{x:.2,y:-.3,z:0}},lifetime:scalar(2),looping:false,duration:2,delay:{mode:0,value:0,min:0},bursts:[{time:0,count:1}],rate:0}
  const sample=sampleObjectEmitter(system,0,0,Infinity,{height:c.viewHeight})[0]
  for(const [j,[u,v]] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].entries()){
    assert.ok(Math.abs(sample.x+sample.a*u+sample.c*v-c.expected[j].position[0]*100)<.003,'Scaled uniform native corner X')
    assert.ok(Math.abs(sample.y+sample.b*u+sample.d*v+c.expected[j].position[1]*100)<.003,'Scaled uniform native corner Y')
  }
}
assert.equal(size.cases.length,540)
console.log(`Native fire: 42 nodes /36emitters /6disabled, 1728 cone +2400 scene +540size cases; max cone ${maxConeError}, scene ${maxBridgeError}`)
