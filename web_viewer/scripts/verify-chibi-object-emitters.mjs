import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {attachObjectEmitters,emitterMatrix,sampleObjectEmitter} from '../src/core/chibiObjectEmitters.js'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url)),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const data=JSON.parse(read('public/data/stage-object-emitters.json'))
const published=process.argv.includes('--published-assets')
const index=published?JSON.parse(read('public/assets/live-chibi/object-layers/index.json')):{assets:Object.fromEntries(Object.entries(data.assets).map(([k,v])=>[k,{bundle:v.bundle,particleCount:v.particleCount}]))}
const hash=published?sha(read('public/assets/live-chibi/object-layers/index.json')):data.objectIndexSha256
assert.equal(Object.values(attachObjectEmitters(index,data,hash).assets).filter(a=>a.nativeParticleAnimation).length,44)
assert.throws(()=>attachObjectEmitters(index,data,'0'.repeat(64)))
assert.equal(Object.values(data.assets).reduce((n,a)=>n+a.systems.length,0),394)
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
assert.equal(partial.filter(s=>s.partial.includes('noise_omitted')).length,20)
assert.equal(partial.filter(s=>s.partial.includes('stretch_omitted')).length,8)
assert.equal(Object.values(data.assets).filter(m=>m.systems.length).length,44)
for(const m of Object.values(data.assets))for(const s of m.systems)if(s.alphaShader)assert.deepEqual(s.alphaShader.blend,{srcBlend:5,destBlend:10,blendOp:0})
console.log('Object emitters: 44 provenance-bound resources / 394 consumed (28 partial) + 0 deferred; 247 lamps, edge XY beams, mirror, prewarm, random start delay, integrated rotation, burst loops, stop tails, UV and rewind passed')
