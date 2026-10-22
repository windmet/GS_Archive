import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {stepLifetimeLimit,sampleLifetimeLimitDistance,LIFETIME_LIMIT_PROFILE} from '../src/core/chibiParticleLimit.js'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url))
const proof=JSON.parse(read('scripts/fixtures/chibi-limit-curve-native.json'))
assert.equal(proof.binarySha256,'acb1c40952097cb3b377de1e377f30de84c63d6b8dceeab4d1f35a2a3ddcaef0')
assert.equal(proof.clampFunction,'0x6f8e28');assert.equal(proof.integrateFunction,'0x6d1e9c')
assert.equal(proof.cases.length,108)
for(const w of proof.sourceWindows)assert.equal(crypto.createHash('sha256').update(Buffer.from(w.bytes,'hex')).digest('hex'),w.sha256)
let maxDelta=0,steps=0
for(const c of proof.cases){
  const bound=proof.models[c.asset].systems.find(s=>s.source.pathId===c.source.pathId)
  assert.deepEqual(bound.source,c.source)
  const raw=bound.limit,curve=raw.magnitude,limit={profile:LIFETIME_LIMIT_PROFILE,dampen:raw.dampen,curve:{mode:curve.minMaxState,scalar:curve.scalar,keys:curve.maxCurve.m_Curve}}
  assert.equal(raw.separateAxis,false);assert.equal(raw.inWorldSpace,false);assert.equal(raw.drag.scalar,0)
  const initial=Math.hypot(...c.velocity)
  let speed=initial,distance=0
  for(const [i,expected] of c.expected.entries()){
    const age=(i+1)*c.dt
    assert.equal(expected.phase,age/c.life)
    speed=stepLifetimeLimit(speed,limit,age/c.life,c.dt);distance+=speed*c.dt
    for(let j=0;j<3;j++){
      const unit=initial?c.velocity[j]/initial:0
      for(const delta of [Math.abs(unit*distance-expected.position[j]),Math.abs(unit*speed-expected.velocity[j])]){maxDelta=Math.max(maxDelta,delta);assert.ok(delta<1e-5,JSON.stringify({case:c.asset,step:i,delta}))}
    }
    if(c.dt===1/60)assert.ok(Math.abs(sampleLifetimeLimitDistance(initial,limit,age,c.life)-distance)<1e-10)
    steps++
  }
  // Rewind and subframe probes exercise the cached integration boundary.
  if(c.dt===1/60){
    const age=.209,whole=Math.floor(age*60),dt=age-whole/60
    let v=initial,d=0
    for(let i=1;i<=whole;i++){v=stepLifetimeLimit(v,limit,i/60/c.life,1/60);d+=v/60}
    d+=stepLifetimeLimit(v,limit,age/c.life,dt)*dt
    assert.ok(Math.abs(sampleLifetimeLimitDistance(initial,limit,age,c.life)-d)<1e-10)
  }
}
assert.throws(()=>sampleLifetimeLimitDistance(4,{curve:{mode:0,scalar:1},dampen:.1},1,2),/Unbound/)
assert.equal(steps,3312)
console.log(`Native lifetime limits: 4 RAW resources / 12 systems / 108 trajectories / ${steps} steps; max geometry/velocity delta ${maxDelta}`)
