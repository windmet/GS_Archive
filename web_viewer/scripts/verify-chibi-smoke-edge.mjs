import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import vm from 'node:vm'
import {sampleEmitterShape} from '../src/core/chibiObjectEmitters.js'

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url))
const sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const sourceBytes=read('scripts/fixtures/chibi-smoke-source.json'),source=JSON.parse(sourceBytes)
const proof=JSON.parse(read('scripts/fixtures/chibi-smoke-edge-native.json'))
assert.equal(proof.sourceSha256,sha(sourceBytes))
assert.equal(proof.binarySha256,'acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0')
for(const window of proof.sourceWindows)assert.equal(sha(Buffer.from(window.bytes,'hex')),window.sha256)
assert.equal(proof.initialization.function,'0x1c3d68')
assert.notEqual(proof.initialization.before,proof.initialization.after)
assert.notDeepEqual(proof.initialization.uninitialized.expected,proof.initialization.initialized.expected)
// Execute the actual private helper rather than a copied Euler implementation.
const code=read('src/core/chibiObjectEmitters.js').toString()
const start=code.indexOf('function euler('),end=code.indexOf('// libunity ShapeModule',start)
assert.ok(start>=0&&end>start)
const euler=vm.runInNewContext(`(${code.slice(start,end).trim()})`)
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<2e-6,`${label}: ${a} != ${b}`)
assert.equal(proof.cases.length,source.particles.length*5)
for(const particle of source.particles){
  const cases=proof.cases.filter(row=>row.source.pathId===particle.pathId)
  assert.equal(cases.length,5)
  for(const row of cases){
    assert.deepEqual(row.source,Object.fromEntries(['serializedFile','pathId','parameterTreeSha256'].map(k=>[k,particle[k]])))
    assert.deepEqual(row.shape,particle.modules.ShapeModule)
    for(let lane=0;lane<4;lane++){
      const words=[0,1,2,3].map(i=>row.seed[lane+i*4])
      const t=(words[0]^(words[0]<<11))>>>0
      const next=(words[3]^(words[3]>>>19)^t^(t>>>8))>>>0
      assert.deepEqual([0,1,2,3].map(i=>row.finalSeed[lane+i*4]),[...words.slice(1),next])
      assert.equal(row.draws[lane],(next&0x7fffff)/8388608)
      const raw=sampleEmitterShape(row.shape,()=>row.draws[lane])
      const position=euler(raw.position,row.shape.m_Rotation),direction=euler(raw.direction,row.shape.m_Rotation)
      for(const [i,axis] of [...'xyz'].entries()){
        near(raw.position[axis],row.intermediate.rawPosition[i*4+lane],'raw edge '+axis)
        near(raw.direction[axis],row.intermediate.rawDirection[i*4+lane],'raw direction '+axis)
        near(position[axis]+row.shape.m_Position[axis],row.expected[lane][i],'rotated birth '+axis)
        near(direction[axis],row.expected[lane][i+3],'rotated direction '+axis)
      }
    }
  }
}
console.log('PASS Smoke edge: 6 source systems, 30 native batches / 120 births, startup control, RNG state and actual JS shape/Euler; no renderer admission')
