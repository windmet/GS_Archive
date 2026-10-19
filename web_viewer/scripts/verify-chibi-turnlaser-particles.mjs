import assert from 'node:assert/strict'
import fs from 'node:fs'
import { sampleLaserParticles, laserParticleLayout } from '../src/core/chibiLaserParticles.js'
import { sampleStreamedCurve } from '../src/core/chibiNativeAnimation.js'
const model=JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-turnlaser-model.json',import.meta.url)))
const state={style:5,eventTime:7650,sweepDuration:6000,angle:130,direction:'right',length:1100,x:-880,y:260,color:'#6600cc',width:800,alpha:1}
assert.equal(sampleStreamedCurve({initialValue:2,keys:[{time:1,coefficients:[-2,3,0,2]}]},1.5),2.5)
for(const style of [5,6]) {
  const native=model.styles[style],s={...state,style}
  const early=sampleLaserParticles(native,s,8100),middle=sampleLaserParticles(native,s,10800)
  assert.equal(early.length,4);assert.equal(middle.length,4)
  assert(middle.every(p=>Math.abs(p.alpha-.8)<1e-7 && p.color===0x6600cc))
  assert.notDeepEqual(early.map(p=>p.rotation),middle.map(p=>p.rotation))
  for(const [i,p] of middle.entries()) {
    const determinant=p.matrix.a*p.matrix.d-p.matrix.b*p.matrix.c
    assert.ok(Math.abs(Math.abs(determinant)-1)<1e-6)
    assert.equal(Math.sign(determinant),i<2?1:-1)
  }
  // Renderer alignment=Local follows the current Transform, even though
  // particle positions are simulated in world space.
  assert.notDeepEqual(sampleLaserParticles(native,s,10800).map(p=>p.matrix),
    sampleLaserParticles(native,s,10850).map(p=>p.matrix))
  assert.deepEqual(sampleLaserParticles(native,s,8100),early)
  assert.deepEqual(sampleLaserParticles(native,s,7649),[])
  assert(Math.abs(sampleStreamedCurve(native.systems[0].animation.curve,1.5)-10)<1e-6)
}
assert.deepEqual(laserParticleLayout(state,1280,720),{x:-240,y:460,fit:1})
if(process.argv.includes('--published-assets')) {
  const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url)))
  assert.deepEqual(index.turnlaser,model)
}
console.log('PASS turn laser: streamed cubics, native mirrored sweep, current local render plane, color, rewind, fixed origin')
