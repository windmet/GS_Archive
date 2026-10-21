import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {sampleObjectEmitter,emitterRenderBasis} from '../src/core/chibiObjectEmitters.js'
import {sampleFloorSystem} from '../src/core/chibiFloorParticles.js'
import {sampleWholeScreen} from '../src/core/chibiWholeScreen.js'
import {sampleBloomSystem} from '../src/core/chibiBloomParticles.js'
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'))
const data=read('public/data/stage-object-emitters.json')
const native=JSON.parse(execFileSync(process.execPath,['scripts/audit-chibi-billboard-rotation.mjs'],{cwd:new URL('../',import.meta.url),encoding:'utf8'}))
assert.equal(native.totalCases,62)
assert.equal(native.matchingCases,native.totalCases,'Actual billboard vertices/UVs must match every 2D/3D native case')
const rotationProof=read('scripts/fixtures/chibi-billboard-rotation-native.json'),parentProof=rotationProof.parentCases
assert.equal(rotationProof.binarySha256,read('scripts/fixtures/chibi-noise-kernel-native.json').binarySha256)
for(const window of rotationProof.sourceWindows)assert.equal(createHash('sha256').update(Buffer.from(window.bytes,'hex')).digest('hex'),window.sha256)
assert.equal(parentProof.filter(c=>c.asset).length,17,'All admitted 3D source parents are bound')
assert.equal(Object.values(data.assets).flatMap(a=>a.systems).filter(s=>s.rotationX).length,parentProof.filter(c=>c.asset).length,'A newly admitted 3D parent needs native replay coverage')
for(const c of parentProof){
  const basis=emitterRenderBasis(c.chain,c.alignment)
  for(const [axis,i] of [['scaleX',0],['scaleY',1]])assert.ok(Math.abs(basis[axis]-c.expectedParticleScale[i])<2e-5,'Signed native hierarchy scale, including reflected ancestors')
}
const constant=scalar=>({mode:0,scalar,minScalar:scalar})
const identity={position:{x:0,y:0},rotation:{x:0,y:0,z:0,w:1},scale:{x:1,y:1}}
const object={...data.assets.fx_in_rote77_meter.systems[0],chain:[identity],shape:null,alignment:0,
  noise:null,stretch:null,velocity:null,gravity:null,size:constant(2),sizeY:null,sizeOverLife:null,
  rotation:constant(.2),rotationX:null,rotationY:null,angularVelocity:constant(.4),
  lifetime:constant(4),looping:false,duration:4,bursts:[{time:0,count:1}],rate:0,delay:{mode:0,value:0,min:0}}
const angle=q=>Math.atan2(q.b,q.a)
for(const [at,expected] of [[0,.2],[500,.4],[1000,.6]]) {
  assert.ok(Math.abs(angle(sampleObjectEmitter(object,at,0)[0])-expected)<1e-10)
}
const at500=sampleObjectEmitter(object,500,0)
sampleObjectEmitter(object,3000,0)
assert.deepEqual(sampleObjectEmitter(object,500,0),at500)
assert.deepEqual(sampleObjectEmitter(structuredClone(object),500,0,250),at500)
// Local emitter Transform rotation has the opposite screen convention to the
// particle angle. Preserve it, including a reflected parent basis.
const parentAngle=.3
for(const mirror of [1,-1]) {
  const local={...object,alignment:2,rotation:constant(.5),angularVelocity:null,
    chain:[{...identity,rotation:{x:0,y:0,z:Math.sin(parentAngle/2),w:Math.cos(parentAngle/2)},scale:{x:mirror,y:1}}]}
  const q=sampleObjectEmitter(local,0,0)[0]
  const expectedX=mirror*Math.cos(parentAngle)*Math.cos(.5)+Math.sin(parentAngle)*Math.sin(.5)
  const expectedY=-mirror*Math.sin(parentAngle)*Math.cos(.5)+Math.cos(parentAngle)*Math.sin(.5)
  assert.ok(Math.abs(q.a/200-expectedX)<1e-12)
  assert.ok(Math.abs(q.b/200-expectedY)<1e-12)
}
const floorSource=read('scripts/fixtures/chibi-floor-model.json').systems[0]
const floor={...floorSource,rotation:constant(.2),angularVelocity:constant(.4),lifetime:constant(4),rate:1,prewarmSeconds:0}
assert.ok(Math.abs(sampleFloorSystem(floor,1000,0)[0].rotation-.6)<1e-12,'Floor clockwise initial angle + spin')
const whole={...read('public/data/stage-whole-screen.json').models[4].systems[0],
  rotation:constant(.2),angularVelocity:constant(.4),lifetime:constant(4),rate:1}
assert.ok(Math.abs(sampleWholeScreen(whole,1500,[{start:0,stop:Infinity}])[0].rotation-.4)<1e-12,'Whole-screen clockwise initial angle + spin')
const bloom={...read('public/data/stage-bloom-particles.json').assets.fx_in_flslgt_bloom_1.systems[1],
  rotation:constant(.5),lifetime:constant(4),delay:0,rate:0,bursts:[{time:0,count:1}]}
assert.equal(sampleBloomSystem(bloom,0,0)[0].rotation,.5,'Bloom clockwise birth angle')
console.log('Particle rotation: 62 native vertex/UV cases including 17 source parents, signed scale, initial/spin, rewind, local/reflected parent and Floor/Whole_screen/Bloom directions passed')
