import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {attachObjectEmitters,emitterMatrix,sampleObjectEmitter} from '../src/core/chibiObjectEmitters.js'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url)),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const data=JSON.parse(read('public/data/stage-object-emitters.json'))
const published=process.argv.includes('--published-assets')
const index=published?JSON.parse(read('public/assets/live-chibi/object-layers/index.json')):{assets:Object.fromEntries(Object.entries(data.assets).map(([k,v])=>[k,{bundle:v.bundle,particleCount:v.particleCount}]))}
const hash=published?sha(read('public/assets/live-chibi/object-layers/index.json')):data.objectIndexSha256
assert.equal(Object.values(attachObjectEmitters(index,data,hash).assets).filter(a=>a.nativeParticleAnimation).length,6)
assert.throws(()=>attachObjectEmitters(index,data,'0'.repeat(64)))
assert.equal(Object.values(data.assets).reduce((n,a)=>n+a.systems.length,0),12)
assert.equal(Object.values(data.assets).reduce((n,a)=>n+a.deferred.length,0),20)
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
const turn=emitterMatrix([{position:{x:2,y:3},rotation:{z:Math.SQRT1_2,w:Math.SQRT1_2},scale:{x:2,y:3}}])
assert.ok(Math.abs(turn.a)<1e-12);assert.ok(Math.abs(turn.b-2)<1e-12);assert.equal(turn.tx,2);assert.equal(turn.ty,3)
for(const model of Object.values(data.assets))for(const system of model.systems) {
  for(const time of [0,100,499,900,1300,2000,3900]) {
    const samples=sampleObjectEmitter(system,time,0)
    assert.ok(samples.length<=system.capacity)
    assert.deepEqual(samples,sampleObjectEmitter(system,time,0))
    for(const s of samples){assert.ok(Object.values(s).every(Number.isFinite));assert.ok(s.frame>=0 && s.frame<(system.uv?system.uv.columns*system.uv.rows:1))}
  }
}
console.log('Object emitters: 6 native resources / 12 consumed + 20 explicitly deferred; meter loop, stop tails, affine geometry, UV and rewind passed')
