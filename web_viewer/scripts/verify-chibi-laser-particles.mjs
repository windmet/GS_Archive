import assert from 'node:assert/strict'
import fs from 'node:fs'
import { integrateLaserCurve, sampleLaserParticles, laserParticleLayout } from '../src/core/chibiLaserParticles.js'
const model = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-laser-model.json',import.meta.url)))
const state = { eventTime:1800,style:7,sweepDuration:1500,angle:0,length:1300,x:-648,y:298,color:'#ffccff',width:300,alpha:1 }
assert.equal(sampleLaserParticles(model.styles[7],state,1799).length,0)
const early = sampleLaserParticles(model.styles[7],state,3000)
const later = sampleLaserParticles(model.styles[7],state,4000)
assert(early.length>=16 && later.length>early.length)
assert(new Set(later.map(p=>p.rotation.toFixed(3))).size>=6)
assert(later.every(p=>p.alpha>=0 && p.alpha<=1 && p.asset==='laserlight_3'))
assert(later.some(p=>p.width>100 && p.alpha<.24)) // Separate native low-alpha glow emitter.
assert.deepEqual(sampleLaserParticles(model.styles[7],state,3000),early) // Backward seek after later sample.
const origin = laserParticleLayout(state,1280,720)
assert.deepEqual(origin,{x:1288,y:422,fit:1})
assert.equal(laserParticleLayout(state,640,360).x,origin.x/2)
// The emitter stays fixed; particles' angles change independently.
assert.deepEqual(laserParticleLayout(state,1280,720),origin)
const zero = {mode:0,scalar:2,keys:[]}
assert.equal(integrateLaserCurve(zero,.5),1)
const linear = {mode:1,scalar:1,keys:[{time:0,value:1,outSlope:-1},{time:1,value:0,inSlope:-1}]}
assert(Math.abs(integrateLaserCurve(linear,1)-.5)<1e-12)
const red = {...state,style:3,eventTime:1750,sweepDuration:1200,angle:280,color:'#dc291e',width:600,length:800}
const burst = sampleLaserParticles(model.styles[3],red,1800)
assert(burst.length>0 && burst.every(p=>p.color===0xdc291e)) // No artificial white line core.
assert(sampleLaserParticles(model.styles[3],red,2500).length===0) // Authored gap between flickers.
if(process.argv.includes('--published-assets')) {
  const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url)))
  assert.deepEqual(index.laserlight,model)
  assert.equal(index.assets.laserlight_3.source.pathId,'885')
}
console.log('PASS laser particles: fixed origins, burst fan angles, soft native glow, tint, flicker gaps, seek, scale')
