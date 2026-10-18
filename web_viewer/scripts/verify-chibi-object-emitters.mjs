import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {attachObjectEmitters,emitterMatrix,sampleObjectEmitter,sampleEmitterShape,sampleObjectCurve} from '../src/core/chibiObjectEmitters.js'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url)),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const data=JSON.parse(read('public/data/stage-object-emitters.json'))
const nativeProof=JSON.parse(read('scripts/fixtures/chibi-shape-native.json'))
const nativeBinaryArg=process.argv.indexOf('--native-engine')
if(nativeBinaryArg>=0) {
  assert.ok(process.argv[nativeBinaryArg+1],'--native-engine needs the local libunity path')
  const binary=fs.readFileSync(process.argv[nativeBinaryArg+1])
  assert.equal(sha(binary),nativeProof.binary.sha256,'Native shape binary identity changed')
  for(const proof of [nativeProof.sphereThicknessInstructions,nativeProof.initialModuleProof.instructions]) {
    const offset=Number(proof.elfOffset)
    assert.equal(binary.subarray(offset,offset+proof.bytes.length/2).toString('hex'),proof.bytes)
  }
  console.log('Native particle proof: libunity SHA-256, shape and initial MinMaxCurve instructions match')
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
assert.equal(Object.values(attachObjectEmitters(index,data,hash).assets).filter(a=>a.nativeParticleAnimation).length,78)
assert.throws(()=>attachObjectEmitters(index,data,'0'.repeat(64)))
assert.equal(Object.values(data.assets).reduce((n,a)=>n+a.systems.length,0),629)
assert.equal(Object.values(data.assets).reduce((n,a)=>n+a.deferred.length,0),80)
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
    const samples=sampleObjectEmitter(system,time,0)
    assert.ok(samples.length<=system.capacity)
    assert.deepEqual(samples,sampleObjectEmitter(system,time,0))
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
const keys=(a,b,slope=b-a)=>[{time:0,value:a,inSlope:slope,outSlope:slope},{time:1,value:b,inSlope:slope,outSlope:slope}]
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
// Random start delay (MinMaxCurve mode 3) waits per particle; it must not emit before the minimum.
const staggered={...probe,looping:false,delay:{mode:3,value:2,min:1},bursts:[{time:0,count:8}],rate:0,lifetime:{mode:0,scalar:4,minScalar:4}}
assert.equal(sampleObjectEmitter(staggered,500,0).length,0)
assert.ok(sampleObjectEmitter(staggered,1600,0).length>0)
// A delayed looping emitter must not lose whole loops: the loop window is shifted by startDelay.
const delayedLoop={...probe,looping:true,duration:1,delay:{mode:0,value:1.2,min:0},bursts:[],rate:25,lifetime:{mode:0,scalar:1,minScalar:1},size:{mode:0,scalar:1},sizeOverLife:null}
for(const t of [2000,2500,3000,3500,4000,4500])assert.ok(sampleObjectEmitter(delayedLoop,t,0).length>0,`Delayed loop dropped at ${t} ms`)
// A RotationModule curve is an angular rate; the integrated angle must match a constant 1 rad/s curve.
const turning={...probe,looping:false,bursts:[{time:0,count:1}],rate:0,lifetime:{mode:0,scalar:4,minScalar:4},
  angularVelocity:{mode:1,scalar:1,minScalar:0,keys:[{time:0,value:1,inSlope:0,outSlope:0},{time:1,value:1,inSlope:0,outSlope:0}]}}
const turned=sampleObjectEmitter(turning,1000,0)[0]
assert.ok(Math.abs(turned.a-Math.cos(1)*200)<1e-6)
assert.ok(Math.abs(turned.c-Math.sin(1)*600)<1e-6)
assert.equal(data.assets.fx_in_trhorz_star_1.deferred.length,0)
assert.equal(data.assets.fx_in_trhorz_star_1.systems.length,4)
assert.equal(data.assets.fx_in_trhorz_star_1.systems.filter(s=>s.partial&&s.partial.includes('stretch_omitted')).length,2)
assert.equal(data.assets.fx_in_swyrlv_leaf.deferred.length,0)
assert.equal(data.assets.fx_in_swyrlv_leaf.systems.length,2)
assert.ok(data.assets.fx_in_swyrlv_leaf.systems.some(s=>s.rotationX&&s.gravity))
const partial=Object.values(data.assets).flatMap(m=>m.systems).filter(s=>s.partial)
assert.equal(partial.length,28)
assert.equal(partial.filter(s=>s.partial.includes('noise_preview')).length,20)
assert.equal(partial.filter(s=>s.partial.includes('stretch_omitted')).length,8)
assert.equal(Object.values(data.assets).filter(m=>m.systems.length).length,78)
const rawObjects=JSON.parse(read('scripts/fixtures/chibi-object-emitters-native.json')).objects
for(const [name,count] of Object.entries({fx_in_pavetl_crystal_1:15,fx_in_pavetl_crystal_2:10,fx_in_smlegg_crystal_1:21,fx_in_smlegg_crystal_2:34})) {
  const model=data.assets[name]
  assert.equal(model.systems.length,count)
  assert.equal(model.deferred.length,count,'Distance emitters must remain explicit, not converted into zero-rate particles')
  assert.ok(model.systems.every(s=>s.name==='glitter'),'Only companion glitter is currently renderable')
  assert.ok(model.deferred.every(d=>d.reasons.includes('unsupported_source_profile: Rate-over-distance requires emitter motion history')))
  const source=rawObjects.find(o=>o.asset===name)
  for(const d of model.deferred) {
    const p=source.particles.find(p=>p.pathId===d.source.pathId)
    assert.equal(p.modules.InitialModule.startLifetime.minMaxState,2)
    assert.equal(p.modules.EmissionModule.rateOverDistance.scalar,1)
  }
}
const promotions=JSON.parse(read('scripts/fixtures/chibi-object-emitter-promotions.json'))
assert.equal(promotions.objectIndexSha256,data.objectIndexSha256)
assert.equal(Object.keys(promotions.assets).length,30)
assert.equal(Object.values(promotions.assets).reduce((n,a)=>n+a.systems,0),155)
for(const [name,expected] of Object.entries(promotions.assets)) {
  const model=data.assets[name]
  assert.equal(model.systems.length,expected.systems,name)
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
for(const m of Object.values(data.assets))for(const s of m.systems)if(s.alphaShader)assert.deepEqual(s.alphaShader.blend,{srcBlend:5,destBlend:10,blendOp:0})
console.log('Object emitters: 78 provenance-bound resources / 629 consumed (28 preview) + 80 distance-emission deferred; initial two-curve lifetime, frozen birth values, tangent bounds and existing geometry/lifecycle checks passed')
