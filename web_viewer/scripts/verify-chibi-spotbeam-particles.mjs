import assert from 'node:assert/strict'
import fs from 'node:fs'
import { sampleSpotbeamParticles, spotbeamParticleScale } from '../src/core/chibiSpotbeamParticles.js'
import { laserParticleLayout } from '../src/core/chibiLaserParticles.js'

const model=JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-spotbeam-model.json',import.meta.url)))
const state={eventTime:1400,sweepDuration:1800,x:0,y:230,width:500,length:1000,angle:0,style:8,direction:'right',color:'#00ccbb',alpha:1}
for(const style of [8,9]) {
  const native=model.styles[style]
  const s={...state,style}, speed=Math.fround(native.systems[0].period/Math.fround(s.sweepDuration/1000))
  const atSim=t=>s.eventTime+t/speed*1000
  const sample=t=>sampleSpotbeamParticles(native,s,t)
  assert.deepEqual(sample(1399),[])
  const first=sample(atSim(.1)),second=sample(atSim(.56)),faded=sample(atSim(.399))
  assert(first.length && second.length)
  assert(first.every(p=>p.color===0x00ccbb && Math.abs(p.alpha-.5)<1e-7))
  assert(faded.every(p=>p.alpha>0 && p.alpha<.08))
  assert.deepEqual(sample(atSim(.43)),[]) // Authored .4 lifetime followed by .06 gap.
  assert.notDeepEqual(first.map(p=>p.systemIndex),second.map(p=>p.systemIndex))
  assert.equal(first.filter(p=>p.frame===0).length,first.filter(p=>p.frame===1).length)
  assert(first.filter(p=>p.frame===0).every(p=>p.anchorY===0))
  assert(first.filter(p=>p.frame===1).every(p=>Math.abs(p.anchorY-.9)<1e-6))
  assert.deepEqual(sample(atSim(.1)),first) // Rewind after later phases.
  const half=sampleSpotbeamParticles(native,{...s,alpha:.5},atSim(.1))
  assert(half.every((p,i)=>p.alpha===first[i].alpha/2))
  const slow=sampleSpotbeamParticles(native,{...s,sweepDuration:3600},s.eventTime+(atSim(.1)-s.eventTime)*2)
  assert.deepEqual(slow,first) // Each particle main.duration clock stretched by director duration.
  assert(sample(100000).length<=native.systems.reduce((n,s)=>n+s.capacity,0))
}
const layout=laserParticleLayout(state,1280,720)
assert.equal(layout.x,640);assert.equal(layout.y,490)
assert.deepEqual(laserParticleLayout(state,640,360),{x:320,y:245,fit:.5})
const projection=spotbeamParticleScale(state)
assert.deepEqual(projection,{x:1,y:1},'value6 is uniform scale; value10 is alpha')
// Each native tilted beam should still meet its paired oval after the same
// uniform native transform. Rewind and mobile scaling must preserve that seam.
for(const [style,native] of Object.entries(model.styles)) {
  const particles=sampleSpotbeamParticles(native,{...state,style:Number(style)},1500)
  for(let i=0;i<particles.length;i+=2) {
    const beam=particles[i],pool=particles[i+1]
    assert.equal(beam.frame,0);assert.equal(pool.frame,1)
    // Atlas beam fades before the transparent quad boundary (~500/512).
    const end={x:(beam.x+beam.matrix.c*beam.length*(.976-beam.anchorY))*projection.x,
      y:(beam.y+beam.matrix.d*beam.length*(.976-beam.anchorY))*projection.y}
    const center={x:(pool.x+pool.matrix.c*pool.length*(.926-pool.anchorY))*projection.x,
      y:(pool.y+pool.matrix.d*pool.length*(.926-pool.anchorY))*projection.y}
    assert(Math.hypot(end.x-center.x,end.y-center.y)<35)
    const mobile=laserParticleLayout(state,390,219.375)
    assert(Math.abs((mobile.x+pool.x*projection.x*mobile.fit)/390
      -(layout.x+pool.x*projection.x*layout.fit)/1280)<1e-9)
  }
}
assert.equal(spotbeamParticleScale({...state,width:1000}).x/projection.x,1,'Alpha cannot change pool coverage')
assert.equal(spotbeamParticleScale({...state,length:2000}).x/projection.x,2)
if(process.argv.includes('--published-assets')) {
  const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url)))
  assert.deepEqual(index.spotbeam,model)
  assert.equal(index.assets.fx_in_ntalon_spotlight.source.pathId,'629')
  assert.equal(index.assets.fx_in_ntalon_spotlight.width,1024)
}
console.log('PASS spotbeam: paired atlas frames, staggered groups, fade/gap, tint, rewind, director clock, scale')
