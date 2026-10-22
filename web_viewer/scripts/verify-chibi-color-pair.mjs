import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {COLOR_PAIR_PROFILE,samplePackedColorPair} from '../src/core/chibiParticleColorPair.js'
const proof=JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-color-pair-native.json',import.meta.url)))
assert.equal(proof.binarySha256,'acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0')
assert.equal(proof.cacheFunction,'0x65a708');assert.equal(proof.moduleFunction,'0x6ea298');assert.equal(proof.pairFunction,'0x6f77a8')
for(const row of proof.sourceWindows)assert.equal(crypto.createHash('sha256').update(Buffer.from(row.bytes,'hex')).digest('hex'),row.sha256)
const model=proof.models.fx_in_tktkkt_electric
assert.equal(model.systems.length,12);assert.equal(model.nonEmitting.length,3);assert.equal(proof.cases.length,216)
let samples=0
for(const c of proof.cases){
  const system=model.systems.find(s=>s.source.pathId===c.source.pathId)
  assert.deepEqual(c.source,system.source)
  for(let i=0;i<4;i++){
    assert.deepEqual(samplePackedColorPair({profile:COLOR_PAIR_PROFILE,cache:system.cache},c.phases[i],c.weights[i],c.colors[i]),c.expected[i],JSON.stringify({source:c.source.pathId,phase:c.phases[i],weight:c.weights[i]}));samples++
  }
}
assert.throws(()=>samplePackedColorPair({cache:model.systems[0].cache},.3,.5),/Unbound/)
console.log(`Native paired gradients: 12 RAW systems / 216 batches / ${samples} exact RGBA32 outputs; 3 disabled-emission nodes recorded`)
