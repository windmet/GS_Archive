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

const motion=JSON.parse(read('scripts/fixtures/chibi-smoke-motion-native.json'))
assert.equal(motion.binarySha256,proof.binarySha256)
assert.equal(motion.sourceSha256,sha(sourceBytes))
assert.equal(motion.edgeSha256,sha(read('scripts/fixtures/chibi-smoke-edge-native.json')))
assert.deepEqual(motion.speedCache,{serializedNameAddress:'0xee07c7',serializedName:'startSpeed',curveOffset:0x30,modeOffset:0x34,scalarOffset:0x3c})
for(const window of motion.sourceWindows)assert.equal(sha(Buffer.from(window.bytes,'hex')),window.sha256)
const distanceStart=code.indexOf('function distance('),distanceEnd=code.indexOf('// RotationModule',distanceStart)
assert.ok(distanceStart>=0&&distanceEnd>distanceStart)
const distance=vm.runInNewContext(`(${code.slice(distanceStart,distanceEnd).trim()})`)
assert.equal(motion.cases.length,6)
assert.deepEqual([...new Set(motion.cases.map(c=>c.speed.scalar))].sort((a,b)=>a-b),[-7,1.5,7])
let integrationCount=0
for(const row of motion.cases){
  const particle=source.particles.find(p=>p.pathId===row.source.pathId)
  assert.ok(particle)
  assert.deepEqual(row.source,Object.fromEntries(['serializedFile','pathId','parameterTreeSha256'].map(k=>[k,particle[k]])))
  assert.deepEqual(row.speed,particle.modules.InitialModule.startSpeed)
  const edge=proof.cases.find(c=>c.source.pathId===row.source.pathId&&JSON.stringify(c.seed)===JSON.stringify(row.edgeSeed))
  assert.deepEqual(row.initial,edge.expected)
  for(let lane=0;lane<4;lane++)for(let axis=0;axis<3;axis++){
    near(row.scaled[lane][axis],row.initial[lane][axis],'speed must preserve birth position')
    near(row.scaled[lane][axis+3],row.initial[lane][axis+3]*row.speed.scalar,'native signed speed')
  }
  if(row.trajectories.length){
    assert.equal(particle.main.moveWithTransform,1)
    assert.equal(particle.modules.InitialModule.gravityModifier.scalar,0)
    for(const key of ['ClampVelocityModule','NoiseModule','VelocityModule'])assert.ok(!particle.modules[key])
    assert.equal(row.trajectories.length,3)
  }else assert.ok(particle.modules.ClampVelocityModule,'side limit must not silently disappear')
  for(const trajectory of row.trajectories){
    integrationCount++
    const age=trajectory.dt*trajectory.steps
    assert.ok(age<particle.modules.InitialModule.startLifetime.scalar)
    for(let lane=0;lane<4;lane++)for(let axis=0;axis<3;axis++){
      const expected=row.initial[lane][axis]+row.initial[lane][axis+3]*distance(row.speed.scalar,null,age)
      assert.ok(Math.abs(expected-trajectory.expected[lane][axis])<1e-5,'actual JS force-free distance vs native integration')
      near(trajectory.expected[lane][axis+3],row.scaled[lane][axis+3],'force-free velocity')
    }
  }
}
assert.equal(integrationCount,6)
console.log('PASS Smoke motion: 6 native signed-speed systems, 2 force-free down systems / 6 trajectories; side gravity/limit remain open')
