import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {attachObjectEmitters,emitterMatrix,sampleObjectEmitter,sampleEmitterShape,sampleObjectCurve} from '../src/core/chibiObjectEmitters.js'
import {sampleNoiseDerivatives,sampleCurlNoise,stepNoiseMotion} from '../src/core/chibiParticleNoise.js'
import {createNoiseClock} from '../src/core/chibiParticleNoiseClock.js'
import {reciprocalSqrtEstimate,samplePlanarStretch,transformStretchVelocity} from '../src/core/chibiParticleStretch.js'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url)),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const data=JSON.parse(read('public/data/stage-object-emitters.json'))
const nativeProof=JSON.parse(read('scripts/fixtures/chibi-shape-native.json'))
const noiseProof=JSON.parse(read('scripts/fixtures/chibi-noise-kernel-native.json'))
const stretchProof=JSON.parse(read('scripts/fixtures/chibi-stretch-kernel-native.json'))
assert.equal(stretchProof.binarySha256,noiseProof.binarySha256)
for(const [row,exponent] of [127,128].entries())for(let bucket=0;bucket<128;bucket++) {
  const buffer=new DataView(new ArrayBuffer(4));buffer.setUint32(0,exponent<<23|bucket<<16,true)
  assert.equal(reciprocalSqrtEstimate(buffer.getFloat32(0,true)),stretchProof.reciprocalSqrtEstimate.normalizedBuckets[row][bucket])
}
for(const c of stretchProof.cases.filter(c=>c.packedContext)) {
  assert.deepEqual(c.expected.map(v=>v.uv),[[0,1],[1,1],[1,0],[0,0]],'Bound zero-flip native renderer UV orientation')
  const fp=Math.fround,[a,b,k,d,tx,ty]=(c.matrix||[1,0,0,1,0,0]).map(fp)
  const vx=fp(c.velocity[0]+(c.animatedVelocity?.[0]||0)),vy=fp(c.velocity[1]+(c.animatedVelocity?.[1]||0))
  const [scaleX,scaleY]=c.particleScale||[1,1]
  const actual=samplePlanarStretch({position:{x:tx,y:ty},velocity:transformStretchVelocity({a,b,c:k,d},{x:vx,y:vy},c.cameraRotation||0),
    size:c.size,scaleX,scaleY,lengthScale:c.lengthScale,velocityScale:c.velocityScale,maxSize:c.maxParticleSize??100,cameraRotation:c.cameraRotation||0})
  for(const [i,p] of actual.entries())for(const [axis,j] of [['x',0],['y',1]])assert.ok(Math.abs(p[axis]-c.expected[i].position[j])<2e-5,`Native stretch ${c.function} ${c.name} corner ${i}.${axis}`)
}
assert.equal(noiseProof.binarySha256,nativeProof.binary.sha256)
const point=([x,y,z])=>({x,y,z})
for(const c of noiseProof.scalingProof.cases) {
  if(c.scalingMode!==0)continue // Other scaling modes are rejected by extraction.
  const actual=emitterMatrix(c.chain)
  for(const k of ['a','b','c','d','tx','ty'])assert.ok(Math.abs(actual[k]-c.expectedMatrix[k])<2e-5,`Native hierarchy matrix mismatch: ${k}`)
}
const clock=createNoiseClock(1)
let wall=0
for(const event of noiseProof.clockProof.sequence) {
  if(event.advance) {
    if(event.count)assert.equal(clock.admit(wall,event.dt),true)
    wall+=event.dt
  }
  assert.ok(Math.abs(clock.timeAt(wall)*noiseProof.clockProof.scrollSpeed-event.expectedScroll)<1e-6,'Native empty/nonempty clock gate mismatch')
}
assert.equal(createNoiseClock(1).timeAt(0),noiseProof.clockProof.resetExpected)
const gaps=createNoiseClock(20)
for(const t of [0,.05,1,1.05])for(let i=0;i<10;i++)assert.equal(gaps.admit(t,.2),true)
assert.ok(Math.abs(gaps.timeAt(.9)-.25)<1e-12,'Empty gaps must not advance scroll')
assert.ok(Math.abs(gaps.timeAt(1.1)-.35)<1e-12,'Later burst resumes the held phase')
gaps.discardBefore(.8)
assert.ok(Math.abs(gaps.timeAt(1.1)-.35)<1e-12,'Pruning must preserve accumulated phase')
assert.throws(()=>gaps.timeAt(.1),/retained history/)
const capped=createNoiseClock(1)
assert.equal(capped.admit(0,.2),true)
assert.equal(capped.admit(.1,5),false,'At capacity native emission drops new births')
assert.equal(capped.timeAt(2),.2,'A dropped birth must not extend the clock')
for(const c of noiseProof.gradientCases) {
  const actual=sampleNoiseDerivatives(point(c.point),c.frequency)
  for(const [i,axis] of ['x','y'].entries())assert.ok(Math.abs(actual[axis]-c.expected[i])<.00002,`Native derivative mismatch ${JSON.stringify(c)}`)
}
for(const c of noiseProof.workerCases) {
  const n={quality:2,octaveCount:1,frequency:c.frequency,strength:c.strength,damping:c.damping,remapEnabled:false,separateAxes:false}
  const actual=sampleCurlNoise(n,point(c.point),c.scroll,point(c.offset))
  for(const [i,axis] of ['x','y','z'].entries())assert.ok(Math.abs(actual[axis]-c.expected[i])<.00002,`Native curl mismatch ${JSON.stringify(c)}`)
}
assert.throws(()=>sampleCurlNoise({quality:0},point([0,0,0]),0,point([0,0,0])),/Unsupported native curl profile/)
for(const c of noiseProof.trajectoryProof.cases) {
  let state={position:point(c.point),velocity:point(c.velocity)}
  const n={quality:2,octaveCount:1,frequency:c.frequency,strength:c.strength,damping:true,scroll:c.scrollSpeed,remapEnabled:false,separateAxes:false}
  for(let i=0;i<c.steps;i++)state=stepNoiseMotion(state,n,{dt:c.dt,phase:c.phase+(i+1)*c.dt,offset:point(c.offset),velocity:point(c.animatedVelocity),gravity:point([0,0,0]),limit:c.limit})
  for(const field of ['position','velocity'])for(const [i,axis] of ['x','y','z'].entries())assert.ok(Math.abs(state[field][axis]-c.expected[field][i])<.00002,`Native trajectory mismatch ${field}.${axis}: ${JSON.stringify(c)}`)
}
const nativeBinaryArg=process.argv.indexOf('--native-engine')
if(nativeBinaryArg>=0) {
  assert.ok(process.argv[nativeBinaryArg+1],'--native-engine needs the local libunity path')
  const binary=fs.readFileSync(process.argv[nativeBinaryArg+1])
  assert.equal(sha(binary),nativeProof.binary.sha256,'Native shape binary identity changed')
  for(const proof of [nativeProof.sphereThicknessInstructions,nativeProof.initialModuleProof.instructions,nativeProof.distanceEmissionProof.instructions,nativeProof.startDelayProof.instructions]) {
    const offset=Number(proof.elfOffset)
    assert.equal(binary.subarray(offset,offset+proof.bytes.length/2).toString('hex'),proof.bytes)
  }
  console.log('Native particle proof: libunity SHA-256, shape, initial curves, distance and startDelay instructions match')
}
// Geometric constraints from libunity's random-arc shape generators, independent of Web RNG.
const shape={type:0,radius:{mode:0,value:2},radiusThickness:1,arc:{value:360,mode:0,spread:0},m_Scale:{x:1,y:1,z:1}}
const fixed=channel=>({1:0,2:.5,3:.125}[channel]??0)
const volume=sampleEmitterShape(shape,fixed)
assert.ok(Math.abs(Math.hypot(...Object.values(volume.position))-1)<1e-12,'Thickness 1 emits inside the sphere, not on its surface')
assert.deepEqual(volume.direction,{x:1,y:0,z:0})
assert.equal(Math.hypot(...Object.values(sampleEmitterShape({...shape,radiusThickness:0},fixed).position)),2,'Thickness 0 emits on the sphere surface')
const shell=sampleEmitterShape({...shape,radiusThickness:.5},()=>0)
assert.equal(Math.hypot(...Object.values(shell.position)),1,'Half thickness retains an inner half-radius shell')
const hemisphere=sampleEmitterShape({...shape,type:2},fixed)
assert.equal(hemisphere.direction.z,.5,'Hemisphere is along local +Z')
const circle=sampleEmitterShape({...shape,type:10,radiusThickness:0},fixed)
assert.deepEqual(circle.position,{x:2,y:0,z:0});assert.deepEqual(circle.direction,{x:1,y:0,z:0})
const halfArc=sampleEmitterShape({...shape,type:10,arc:{value:180},radiusThickness:0},c=>c===1?.5:0)
assert.ok(Math.abs(halfArc.position.x)<1e-12);assert.ok(Math.abs(halfArc.position.y-2)<1e-12)
const cone=sampleEmitterShape({...shape,type:4,angle:45},fixed)
assert.ok(Math.abs(cone.position.x-2*Math.sqrt(.5005))<1e-12,'Cone area fraction has native 0.001 inner clamp')
assert.ok(cone.direction.x>0&&cone.direction.z>0);assert.ok(Math.abs(Math.hypot(...Object.values(cone.direction))-1)<1e-12)
assert.ok(Math.abs(cone.direction.x/cone.direction.z-Math.sqrt(.5005))<1e-12,'Cone initial direction uses radius fraction and angle')
assert.deepEqual(sampleEmitterShape({...shape,type:12},fixed).direction,{x:0,y:1,z:0})
const published=process.argv.includes('--published-assets')
const index=published?JSON.parse(read('public/assets/live-chibi/object-layers/index.json')):{assets:Object.fromEntries(Object.entries(data.assets).map(([k,v])=>[k,{bundle:v.bundle,particleCount:v.particleCount}]))}
const hash=published?sha(read('public/assets/live-chibi/object-layers/index.json')):data.objectIndexSha256
const choreographyHash=sha(read('public/assets/live-chibi/choreography/index.json'))
assert.equal(Object.values(attachObjectEmitters(index,data,hash,choreographyHash).assets).filter(a=>a.nativeParticleAnimation).length,78)
assert.throws(()=>attachObjectEmitters(index,data,'0'.repeat(64)))
assert.throws(()=>attachObjectEmitters(index,data,hash),/choreography binding/)
assert.throws(()=>attachObjectEmitters(index,data,hash,'0'.repeat(64)),/choreography binding/)
const unproven=structuredClone(data)
delete unproven.assets.fx_in_pavetl_crystal_1.distanceMotionProof
assert.throws(()=>attachObjectEmitters(index,unproven,hash,choreographyHash),/Unproven distance emitter motion/)
assert.equal(Object.values(data.assets).reduce((n,a)=>n+a.systems.length,0),709)
assert.equal(Object.values(data.assets).reduce((n,a)=>n+a.deferred.length,0),0)
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
const turn=emitterMatrix([{position:{x:2,y:3},rotation:{x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2},scale:{x:2,y:3}}])
assert.ok(Math.abs(turn.a)<1e-12);assert.ok(Math.abs(turn.b-2)<1e-12);assert.equal(turn.tx,2);assert.equal(turn.ty,3)
for(const model of Object.values(data.assets))for(const system of model.systems) {
  for(const time of [0,100,499,900,1300,2000,3900]) {
    const samples=sampleObjectEmitter(system,time,0)
    assert.ok(samples.length<=system.capacity)
    assert.deepEqual(samples,sampleObjectEmitter(system,time,0))
    for(const s of samples){assert.ok(Object.values(s).every(Number.isFinite));assert.ok(s.frame>=0 && s.frame<(system.uv?system.uv.columns*system.uv.rows:1))}
  }
}
// Independent delayed bulbs must have distinct live phases, not one group alpha.
const line=data.assets.fx_in_tkstp1_linelight_1.systems
assert.equal(line.length,35)
assert.equal(Object.entries(data.assets).filter(([name])=>name.startsWith('fx_in_tkstp1_linelight_')).reduce((n,[,a])=>n+a.systems.length,0),247)
const phases=line.map(s=>sampleObjectEmitter(s,650,0)[0]?.alpha??0)
assert.ok(new Set(phases.map(n=>n.toFixed(5))).size>2)
assert.equal(line[1].delay.value,.05000000074505806)
const mirror=emitterMatrix([{position:{x:0,y:0},rotation:{x:0,y:1,z:0,w:0},scale:{x:1,y:1}}])
assert.deepEqual(mirror,{a:-1,b:0,c:0,d:1,tx:0,ty:0})
const beam=data.assets.fx_in_plmask_incidentlight_1.systems[0]
assert.equal(beam.shape.type,12)
assert.equal(beam.sizeY.scalar,6)
const probe={...beam,chain:[{position:{x:0,y:0},rotation:{x:0,y:0,z:0,w:1},scale:{x:1,y:1}}],shape:{...beam.shape,radius:{value:0},m_Scale:{x:1,y:1,z:1}},size:{mode:0,scalar:2},sizeY:{mode:0,scalar:6},sizeOverLife:null,sizeOverLifeY:null,rotation:{mode:0,scalar:0},rate:1,lifetime:{mode:0,scalar:4,minScalar:4},bursts:[],limit:null}
const movingNoise={...probe,shape:null,looping:false,delay:0,bursts:[{time:0,count:1}],rate:0,speed:{mode:0,scalar:0},noise:{quality:2,octaveCount:1,frequency:.5,strength:1,damping:true,scroll:1,remapEnabled:false,separateAxes:false}}
assert.equal(sampleObjectEmitter(movingNoise,0,0)[0].x,0,'Noise is velocity: no instantaneous birth displacement')
assert.ok(sampleObjectEmitter(movingNoise,0,0)[0].y===0)
const noiseAt700=sampleObjectEmitter(movingNoise,700,0)
sampleObjectEmitter(movingNoise,3300,0)
assert.deepEqual(sampleObjectEmitter(movingNoise,700,0),noiseAt700,'Rewind resets the integrated trajectory')
assert.deepEqual(sampleObjectEmitter(structuredClone(movingNoise),700,0),noiseAt700,'Cached and cold integration must agree')
assert.deepEqual(sampleObjectEmitter(movingNoise,700,0,300),noiseAt700,'StopEmitting must not freeze Noise on a surviving particle')
const cappedNoise={...movingNoise,capacity:1,lifetime:{mode:0,scalar:.2},bursts:[{time:0,count:1},{time:.1,count:1}]}
assert.equal(sampleObjectEmitter(cappedNoise,150,0)[0].birth,0,'Actual consumer must retain the old particle and reject an overflowing birth')
const gravityNoise={...movingNoise,noise:{...movingNoise.noise,strength:0},gravity:{mode:0,scalar:1},chain:[{position:{x:0,y:0},rotation:{x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2},scale:{x:2,y:3}}]}
const falling=sampleObjectEmitter(gravityNoise,1000,0)[0]
assert.ok(Math.abs(falling.x)<1e-9,'World gravity must stay vertical through a rotated/scaled emitter plane')
assert.ok(Math.abs(falling.y-9.81*(61/120)*100)<1e-8,'Gravity uses semi-implicit integration and is not added again after projection')
for(const c of noiseProof.gravitySpaceProof.cases) {
  const m=c.matrix,det=m.a*m.d-m.b*m.c
  const gravity=c.space===1?{x:0,y:-9.81,z:0}:{x:m.c*9.81/det,y:-m.a*9.81/det,z:0}
  for(const [i,axis] of ['x','y','z'].entries())assert.ok(Math.abs(gravity[axis]*c.dt-c.expectedVelocity[i])<2e-7,'Native gravity simulation-space branch mismatch')
  if(c.space!==0 || c.dt!==1/60)continue // Object profile only admits local simulation.
  const rotated=m.b!==0
  const system={...gravityNoise,velocity:null,chain:[{position:{x:0,y:0},rotation:{x:0,y:0,z:rotated?Math.SQRT1_2:0,w:rotated?Math.SQRT1_2:1},scale:{x:rotated?m.b:m.a,y:rotated?-m.c:m.d}}]}
  const actual=sampleObjectEmitter(system,1000,0)[0]
  const [vx,vy]=c.expectedVelocity,steps=60,integral=c.dt*steps*(steps+1)/2*100
  assert.ok(Math.abs(actual.x-(m.a*vx+m.c*vy)*integral)<.0002,'Object gravity projection differs from native velocity replay')
  assert.ok(Math.abs(actual.y+(m.b*vx+m.d*vy)*integral)<.0002,'Object gravity accumulated displacement differs from native replay')
}
const keys=(a,b,slope=b-a)=>[{time:0,value:a,inSlope:slope,outSlope:slope},{time:1,value:b,inSlope:slope,outSlope:slope}]
const twoCurves={mode:2,scalar:2,minScalar:100,keys:keys(.5,1),minKeys:keys(.2,.4)}
assert.ok(Math.abs(sampleObjectCurve(twoCurves,.5,.5)-1.05)<1e-12,'Two curves share the multiplier and ignore constantMin')
const frozen={...probe,shape:null,looping:false,duration:2,bursts:[{time:.5,count:1}],rate:0,sizeY:null,size:{mode:1,scalar:1,keys:keys(0,4)},lifetime:{mode:0,scalar:4,minScalar:4}}
assert.equal(sampleObjectEmitter(frozen,750,0)[0].a,100,'Initial size uses the birth system phase, not zero')
assert.equal(sampleObjectEmitter(frozen,1500,0)[0].a,100,'Initial size is frozen for that birth, not sampled at particle age')
const longCurve={...frozen,looping:true,duration:1,bursts:[{time:.5,count:1}],lifetime:{mode:1,scalar:1,keys:[{time:0,value:1,inSlope:0,outSlope:18},{time:1,value:1,inSlope:-18,outSlope:0}]}}
assert.equal(sampleObjectEmitter(longCurve,4000,0).length,4,'Tangent overshoot must not discard older living births')
const rectangle=sampleObjectEmitter(probe,1500,0)[0]
assert.equal(rectangle.a,200);assert.equal(rectangle.d,600);assert.equal(rectangle.x,0);assert.ok(rectangle.y===0)
const smoke=data.assets.fx_in_inndgn_smoke_1.systems.find(s=>s.velocity)
assert.ok(smoke)
const flow={...probe,velocity:{x:{mode:0,scalar:2},y:{mode:0,scalar:3},z:{mode:0,scalar:0}}}
const drift=sampleObjectEmitter(flow,1500,0)[0]
assert.equal(drift.x,100);assert.equal(drift.y,-150)
// Prewarm: the native system is already mid-cycle on activation, so t=0 is not empty.
const star=data.assets.fx_in_trhorz_star_2.systems[0]
assert.equal(star.prewarm,true)
assert.ok(sampleObjectEmitter(star,0,0).length>0,'Prewarmed star must be visible at activation')
assert.ok(sampleObjectEmitter(data.assets.fx_in_trhorz_starline_1.systems[0],0,0).length>0)
// Random start delay belongs to the system: all births in a burst share it,
// and later loops retain it. No particle may start before the minimum.
const staggered={...probe,capacity:16,looping:false,delay:{mode:3,value:2,min:1},bursts:[{time:0,count:8}],rate:0,lifetime:{mode:0,scalar:4,minScalar:4}}
assert.equal(sampleObjectEmitter(staggered,500,0).length,0)
assert.equal(sampleObjectEmitter(staggered,2100,0).length,8)
for(let t=1000;t<=2000;t+=10)assert.ok([0,8].includes(sampleObjectEmitter(staggered,t,0).length),'A single burst must not acquire per-particle delays')
const randomLoop={...staggered,looping:true,duration:3,lifetime:{mode:0,scalar:.5,minScalar:.5}}
for(let t=1000;t<=2500;t+=10)assert.equal(sampleObjectEmitter(randomLoop,t,0).length,sampleObjectEmitter(randomLoop,t+3000,0).length,'Loop must reuse the system delay')
// A delayed looping emitter must not lose whole loops: the loop window is shifted by startDelay.
const delayedLoop={...probe,looping:true,duration:1,delay:{mode:0,value:1.2,min:0},bursts:[],rate:25,lifetime:{mode:0,scalar:1,minScalar:1},size:{mode:0,scalar:1},sizeOverLife:null}
for(const t of [2000,2500,3000,3500,4000,4500])assert.ok(sampleObjectEmitter(delayedLoop,t,0).length>0,`Delayed loop dropped at ${t} ms`)
// A RotationModule curve is an angular rate; the integrated angle must match a constant 1 rad/s curve.
const turning={...probe,looping:false,bursts:[{time:0,count:1}],rate:0,lifetime:{mode:0,scalar:4,minScalar:4},
  angularVelocity:{mode:1,scalar:1,minScalar:0,keys:[{time:0,value:1,inSlope:0,outSlope:0},{time:1,value:1,inSlope:0,outSlope:0}]}}
const turned=sampleObjectEmitter(turning,1000,0)[0]
assert.ok(Math.abs(turned.a-Math.cos(1)*200)<1e-6)
assert.ok(Math.abs(turned.c-Math.sin(1)*600)<1e-6)
assert.equal(data.assets.fx_in_trhorz_star_1.deferred.length,0)
assert.equal(data.assets.fx_in_trhorz_star_1.systems.length,4)
assert.equal(data.assets.fx_in_trhorz_star_1.systems.filter(s=>s.partial&&s.partial.includes('stretch_omitted')).length,2)
assert.equal(data.assets.fx_in_swyrlv_leaf.deferred.length,0)
assert.equal(data.assets.fx_in_swyrlv_leaf.systems.length,2)
assert.ok(data.assets.fx_in_swyrlv_leaf.systems.some(s=>s.rotationX&&s.gravity))
const partial=Object.values(data.assets).flatMap(m=>m.systems).filter(s=>s.partial)
assert.equal(partial.length,28)
assert.equal(partial.filter(s=>s.partial.includes('noise_preview')).length,20)
for(const s of partial.filter(s=>s.noise)) {
  assert.equal(s.noise.profile,'native-high-curl-v1')
  assert.equal(s.noise.octaveCount,1)
  assert.equal(s.noise.quality,2)
}
assert.equal(partial.filter(s=>s.partial.includes('stretch_omitted')).length,7)
assert.equal(partial.filter(s=>s.partial.includes('stretch_preview')).length,1)
for(const asset of ['fire_1','fire_2','fire_3','turbo_1','turbo_2'].map(s=>'fx_in_rote77_'+s)) {
  const system=data.assets[asset].systems.find(s=>s.partial?.includes('stretch_omitted'))
  assert.equal(system.shape.type,4)
  assert.ok(system.shape.angle>0,'Cone spread retains a nonplanar velocity component')
  assert.equal(system.stretch,undefined,'Nonplanar cone must not enter the planar solver')
}
for(const system of partial.filter(s=>s.stretch)) {
  assert.equal(system.stretch.profile,'native-classic-planar-v1')
  assert.equal(system.stretch.rendererTreeSha256.length,64)
  const at=sampleObjectEmitter(system,49000,0)
  assert.deepEqual(sampleObjectEmitter(system,49000,0),at,'Stretch seeking must be deterministic')
}
const sharedStretch=data.assets.fx_in_tfmvmt_Incidentlight.systems.find(s=>s.stretch)
const birthModel={...sharedStretch,chain:[],shape:{...sharedStretch.shape,radius:{value:0},arc:{value:0},m_Rotation:{x:0,y:0,z:0}},looping:false,delay:0,rate:0,bursts:[{time:0,count:1}],lifetime:{mode:0,scalar:2},speed:{mode:0,scalar:1},size:{mode:0,scalar:2},sizeOverLife:null,rotation:{mode:0,scalar:0},stretch:{...sharedStretch.stretch,velocityScale:1,lengthScale:2}}
const birthQuad=sampleObjectEmitter(birthModel,0,0,Infinity,{height:10})[0]
const golden=stretchProof.cases.find(c=>c.name==='packed-x').expected
for(const [i,[u,v]] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].entries()) {
  assert.ok(Math.abs((birthQuad.x+birthQuad.a*u+birthQuad.c*v)/100-golden[i].position[0])<2e-5,'Actual consumer stretch X/UV orientation mismatch')
  assert.ok(Math.abs(-(birthQuad.y+birthQuad.b*u+birthQuad.d*v)/100-golden[i].position[1])<2e-5,'Actual consumer stretch Y/UV orientation mismatch')
}
assert.equal(Object.values(data.assets).filter(m=>m.systems.length).length,78)
const rawObjects=JSON.parse(read('scripts/fixtures/chibi-object-emitters-native.json')).objects
for(const r of stretchProof.renderers) {
  const source=rawObjects.find(o=>o.asset===r.asset)
  const particle=source.particles.find(p=>p.renderer.pathId===r.pathId)
  const system=data.assets[r.asset].systems.find(s=>s.source.pathId===particle.pathId)
  if(!system.stretch)continue
  for(const [field,raw] of Object.entries({minSize:'m_MinParticleSize',maxSize:'m_MaxParticleSize',cameraVelocityScale:'m_CameraVelocityScale',velocityScale:'m_VelocityScale',lengthScale:'m_LengthScale'}))assert.equal(system.stretch[field],r.fields[raw],`Unsourced stretch field ${r.asset}.${field}`)
  assert.equal(system.stretch.rendererTreeSha256,particle.renderer.stretch.rendererTreeSha256)
}
for(const [name,count] of Object.entries({fx_in_pavetl_crystal_1:15,fx_in_pavetl_crystal_2:10,fx_in_smlegg_crystal_1:21,fx_in_smlegg_crystal_2:34})) {
  const model=data.assets[name]
  assert.equal(model.systems.length,count*2)
  assert.equal(model.deferred.length,0)
  assert.equal(model.systems.filter(s=>s.name==='glitter').length,count)
  assert.equal(model.distanceMotionProof.profile,'stationary-object-layer-v1')
  assert.ok(model.distanceMotionProof.components.length>0)
  assert.ok(model.distanceMotionProof.arrangements.length>0)
  const source=rawObjects.find(o=>o.asset===name)
  const crystals=model.systems.filter(s=>s.distanceRate)
  assert.equal(crystals.length,count)
  for(const s of crystals) {
    const p=source.particles.find(p=>p.pathId===s.source.pathId)
    assert.equal(p.modules.InitialModule.startLifetime.minMaxState,2)
    assert.equal(p.modules.EmissionModule.rateOverDistance.scalar,1)
    assert.equal(s.distanceRate.scalar,1,'Retain native nonzero rate even though proved displacement is zero')
    assert.equal(s.distanceMode,'stationary-object-layer-v1')
    assert.throws(()=>sampleObjectEmitter({...s,distanceMode:'moving'},2000,0),/Unbound distance emitter motion/)
    assert.ok(Array.from({length:81},(_,i)=>i*50).some(t=>sampleObjectEmitter(s,t,0).length),'Crystal burst must really emit')
    assert.equal(sampleObjectEmitter(s,10000,0,0).length,0,'Stopped crystal must retire')
  }
}
const promotions=JSON.parse(read('scripts/fixtures/chibi-object-emitter-promotions.json'))
assert.equal(promotions.objectIndexSha256,data.objectIndexSha256)
assert.equal(Object.keys(promotions.assets).length,30)
assert.equal(Object.values(promotions.assets).reduce((n,a)=>n+a.systems,0),155)
for(const [name,expected] of Object.entries(promotions.assets)) {
  const model=data.assets[name]
  assert.equal(model.systems.length,expected.systems,name)
  assert.equal(model.deferred.length,0,name)
  assert.ok(model.systems.every(s=>!s.partial?.length),name)
  // Every newly admitted resource must actually emit, survive rewind, and retire after stop.
  const times=[0,100,1000,3000,7000,15000,30000]
  assert.ok(times.some(t=>model.systems.some(s=>sampleObjectEmitter(s,t,0).length)),`${name}: empty across activation samples`)
  for(const system of model.systems) {
    const retire=(Math.max(system.lifetime.scalar,system.lifetime.minScalar)+2)*1000
    assert.equal(sampleObjectEmitter(system,retire,0,0).length,0,`${name}: retained particles after stop`)
  }
}
for(const m of Object.values(data.assets))for(const s of m.systems)if(s.alphaShader)assert.deepEqual(s.alphaShader.blend,{srcBlend:5,destBlend:10,blendOp:0})
console.log('Object emitters: 78 provenance-bound resources / 709 consumed (28 preview), 0 deferred; 80 stationary distance emitters, system startDelay, source binding and geometry/lifecycle checks passed')
