import assert from 'node:assert/strict'
import fs from 'node:fs'
import { sampleLaserParticles, laserParticleLayout } from '../src/core/chibiLaserParticles.js'
import { sampleStreamedCurve } from '../src/core/chibiNativeAnimation.js'
const model=JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-turnlaser-model.json',import.meta.url)))
const state={style:5,eventTime:7650,sweepDuration:6000,angle:130,length:1100,x:-880,y:260,color:'#6600cc',width:800,alpha:1}
assert.equal(sampleStreamedCurve({initialValue:2,keys:[{time:1,coefficients:[-2,3,0,2]}]},1.5),2.5)
for(const style of [5,6]) {
  const native=model.styles[style],s={...state,style}
  const early=sampleLaserParticles(native,s,8100),middle=sampleLaserParticles(native,s,10800)
  assert.equal(early.length,4);assert.equal(middle.length,4)
  assert(middle.every(p=>p.alpha>.99 && p.color===0x6600cc))
  assert.notDeepEqual(early.map(p=>p.rotation),middle.map(p=>p.rotation))
  const base=Math.PI/2-s.angle*Math.PI/180
  assert(Math.abs((middle[0].rotation+middle[2].rotation)/2-base)<1e-6)
  assert(Math.abs((middle[1].rotation+middle[3].rotation)/2-base)<1e-6)
  // World simulation: the birth angle is retained until the next .15s burst.
  assert.deepEqual(sampleLaserParticles(native,s,10800).map(p=>p.rotation),
    sampleLaserParticles(native,s,10810).map(p=>p.rotation))
  assert.deepEqual(sampleLaserParticles(native,s,8100),early)
  assert.deepEqual(sampleLaserParticles(native,s,7649),[])
  assert(Math.abs(sampleStreamedCurve(native.systems[0].animation.curve,1.5)-10)<1e-6)
}
assert.deepEqual(laserParticleLayout(state,1280,720),{x:1520,y:460,fit:1})
if(process.argv.includes('--published-assets')) {
  const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url)))
  assert.deepEqual(index.turnlaser,model)
}
console.log('PASS turn laser: streamed cubics, native mirrored sweep, world-space birth angle, color, rewind, fixed origin')
