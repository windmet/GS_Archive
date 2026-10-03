import assert from 'node:assert/strict'
import fs from 'node:fs'
import { sampleSpotbeamParticles } from '../src/core/chibiSpotbeamParticles.js'
import { laserParticleLayout } from '../src/core/chibiLaserParticles.js'

const model=JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-spotbeam-model.json',import.meta.url)))
const state={eventTime:1400,sweepDuration:1800,x:0,y:230,width:500,length:1000,angle:0,color:'#00ccbb',alpha:1}
for(const style of [8,9]) {
  const native=model.styles[style]
  const sample=t=>sampleSpotbeamParticles(native,state,t)
  assert.deepEqual(sample(1399),[])
  const first=sample(1500),second=sample(2400),faded=sample(2118)
  assert(first.length && second.length)
  assert(first.every(p=>p.color===0x00ccbb && p.alpha>.99))
  assert(faded.every(p=>p.alpha>0 && p.alpha<.08))
  assert.deepEqual(sample(2200),[]) // Authored .4 lifetime followed by .06 gap.
  assert.notDeepEqual(first.map(p=>p.systemIndex),second.map(p=>p.systemIndex))
  assert.equal(first.filter(p=>p.frame===0).length,first.filter(p=>p.frame===1).length)
  assert(first.filter(p=>p.frame===0).every(p=>p.anchorY===0))
  assert(first.filter(p=>p.frame===1).every(p=>Math.abs(p.anchorY-.9)<1e-6))
  assert.deepEqual(sample(1500),first) // Rewind after later phases.
  const half=sampleSpotbeamParticles(native,{...state,alpha:.5},1500)
  assert(half.every((p,i)=>p.alpha===first[i].alpha/2))
  const slow=sampleSpotbeamParticles(native,{...state,sweepDuration:3600},1600)
  assert.deepEqual(slow,first) // Shared song clock stretched by director duration.
  assert(sample(100000).length<=native.systems.reduce((n,s)=>n+s.capacity,0))
}
const layout=laserParticleLayout(state,1280,720)
assert.equal(layout.x,640);assert.equal(layout.y,490)
assert.deepEqual(laserParticleLayout(state,640,360),{x:320,y:245,fit:.5})
if(process.argv.includes('--published-assets')) {
  const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url)))
  assert.deepEqual(index.spotbeam,model)
  assert.equal(index.assets.fx_in_ntalon_spotlight.source.pathId,'629')
  assert.equal(index.assets.fx_in_ntalon_spotlight.width,1024)
}
console.log('PASS spotbeam: paired atlas frames, staggered groups, fade/gap, tint, rewind, director clock, scale')
