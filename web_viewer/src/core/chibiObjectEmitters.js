import { stepNoiseMotion } from './chibiParticleNoise.js'
import { createNoiseClock } from './chibiParticleNoiseClock.js'
import { samplePlanarStretch, transformStretchVelocity } from './chibiParticleStretch.js'
import {spatialEmitterQuads,OBJECT_SPATIAL_PROFILE} from './chibiObjectSpatialContext.js'
import { sampleParticleCurve } from './chibiParticleTimeline.js'
import { sampleFloorGradient } from './chibiFloorParticles.js'
export function sampleObjectCurve(c,t,r) {
  if(c.mode===3)return c.minScalar+(c.scalar-c.minScalar)*r
  if(c.mode===2){const min=sampleParticleCurve({...c,keys:c.minKeys},t);return min+(sampleParticleCurve(c,t)-min)*r}
  return sampleParticleCurve(c,t)
}
const sample=sampleObjectCurve
// VelocityModule evaluates a lifetime rate, then the position integrator adds
// velocity * dt. Match this viewer's replayable 60 Hz boundary. Curves and
// source lifetimes are immutable; bound the per-curve lifetime cache for reuse.
const velocityIntegrals=new WeakMap()
export function sampleObjectVelocityDisplacement(curve,age,life,randomValue) {
  if(age<=0)return 0
  if(curve.mode!==1)return sample(curve,0,randomValue)*age
  let lifetimes=velocityIntegrals.get(curve)
  if(!lifetimes){lifetimes=new Map();velocityIntegrals.set(curve,lifetimes)}
  let sums=lifetimes.get(life)
  if(!sums){
    if(lifetimes.size>=8)lifetimes.delete(lifetimes.keys().next().value)
    sums=[0];lifetimes.set(life,sums)
  }
  const steps=Math.floor(age*60)
  for(let i=sums.length-1;i<steps;i++)sums.push(sums[i]+sample(curve,Math.min(1,(i+.5)/(60*life)),randomValue)/60)
  const remainder=age-steps/60
  return sums[steps]+(remainder>0?sample(curve,Math.min(1,(steps/60+remainder/2)/life),randomValue)*remainder:0)
}
// A Hermite segment lies inside its Bezier control hull. Include tangent overshoot
// when selecting old birth loops, or long-lived particles can disappear early.
function curveUpperBound(c) {
  if(c.mode===0)return c.scalar
  if(c.mode===3)return Math.max(c.scalar,c.minScalar)
  const values=[]
  for(const keys of [c.keys,...(c.mode===2?[c.minKeys]:[])]) {
    for(let j=0;j<keys.length;j++) {
      const a=keys[j];values.push(a.value*c.scalar)
      if(j+1<keys.length){const b=keys[j+1],dt=b.time-a.time;values.push((a.value+dt*a.outSlope/3)*c.scalar,(b.value-dt*b.inSlope/3)*c.scalar)}
    }
  }
  return Math.max(...values)
}
const random=(seed,birth,channel)=> {
  let n=seed^Math.imul(birth+1,0x9e3779b1)^Math.imul(channel+1,0x85ebca77)
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b)
  return ((n^(n>>>16))>>>0)/4294967296
}
export function emitterMatrix(chain) {
  let m={a:1,b:0,c:0,d:1,tx:0,ty:0}
  for(const t of chain) {
    const {x,y,z,w}=t.rotation,a=(1-2*(y*y+z*z))*t.scale.x,b=2*(x*y+w*z)*t.scale.x,k=2*(x*y-w*z)*t.scale.y,d=(1-2*(x*x+z*z))*t.scale.y
    m={a:a*m.a+k*m.b,b:b*m.a+d*m.b,c:a*m.c+k*m.d,d:b*m.c+d*m.d,tx:a*m.tx+k*m.ty+t.position.x,ty:b*m.tx+d*m.ty+t.position.y}
  }
  return m
}
// Preserve local Z through the complete static hierarchy before projecting XY.
// Admission is source-bound to Local billboards without 3D particle rotation.
export function emitterSpatialMatrix(chain) {
  let m=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
  for(const t of chain) {
    const {x,y,z,w}=t.rotation,s=t.scale,p=t.position
    const a=[(1-2*(y*y+z*z))*s.x,2*(x*y+w*z)*s.x,2*(x*z-w*y)*s.x,0,
      2*(x*y-w*z)*s.y,(1-2*(x*x+z*z))*s.y,2*(y*z+w*x)*s.y,0,
      2*(x*z+w*y)*s.z,2*(y*z-w*x)*s.z,(1-2*(x*x+y*y))*s.z,0,p.x,p.y,p.z,1]
    m=Array.from({length:16},(_,i)=>{const row=i%4,col=Math.floor(i/4);return [0,1,2,3].reduce((v,k)=>v+a[k*4+row]*m[col*4+k],0)})
  }
  return {a:m[0],b:m[1],c:m[4],d:m[5],zx:m[8],zy:m[9],tx:m[12],ty:m[13],full:m}
}
// View-aligned billboards use signed native lossy scale, not column lengths.
// A reflected ancestor conjugates descendant rotations. Local alignment keeps
// the complete hierarchy matrix, including shear, for both orientation and position.
export function emitterRenderBasis(chain,alignment,matrix=emitterMatrix(chain)) {
  let q={x:0,y:0,z:0,w:1},signX=1,signY=1,signZ=1
  for(let i=chain.length-1;i>=0;i--) {
    const {rotation:r,scale}=chain[i],rx=r.x*signY*signZ,ry=r.y*signX*signZ,rz=r.z*signX*signY
    const {x,y,z,w}=q
    q={x:w*rx+x*r.w+y*rz-z*ry,y:w*ry-x*rz+y*r.w+z*rx,
      z:w*rz+x*ry-y*rx+z*r.w,w:w*r.w-x*rx-y*ry-z*rz}
    signX*=Math.sign(scale.x)||1;signY*=Math.sign(scale.y)||1;signZ*=Math.sign(scale.z)||1
  }
  const {x,y,z,w}=q
  const a=1-2*(y*y+z*z),b=2*(x*y+w*z),c=2*(x*y-w*z),d=1-2*(x*x+z*z)
  const scaleX=a*matrix.a+b*matrix.b,scaleY=c*matrix.c+d*matrix.d
  return alignment===2?{a:matrix.a,b:matrix.b,c:matrix.c,d:matrix.d,scaleX,scaleY}:
    {a:scaleX,b:0,c:0,d:scaleY,scaleX,scaleY}
}
function euler(p,r) {
  let {x,y,z}=p
  for(const axis of ['z','x','y']) {
    const a=r[axis]*Math.PI/180,c=Math.cos(a),s=Math.sin(a)
    if(axis==='x')[y,z]=[c*y-s*z,s*y+c*z]
    if(axis==='y')[x,z]=[c*x+s*z,-s*x+c*z]
    if(axis==='z')[x,y]=[c*x-s*y,s*x+c*y]
  }
  return {x,y,z}
}
// libunity ShapeModule random-arc generators: 0x8590a8 sphere, 0x85a818 hemisphere,
// 0x85bfac cone base, 0x85f500 circle (Ghidra VA). Position and direction are separate.
export function sampleEmitterShape(shape,rnd) {
  const scale=shape.m_Scale||{x:1,y:1,z:1},radius=(shape.radius&&shape.radius.value)||0
  const thickness=Math.max(0,Math.min(1,Number(shape.radiusThickness??1)))
  const phi=rnd(1)*Number(shape.arc?.value??360)*Math.PI/180
  const unit={x:Math.cos(phi),y:Math.sin(phi)}
  let position,direction={x:0,y:0,z:1}
  switch(shape.type) {
    case 12:position={x:(rnd(1)*2-1)*radius,y:0,z:0};direction={x:0,y:1,z:0};break
    case 5:position={x:rnd(1)-.5,y:rnd(2)-.5,z:rnd(3)-.5};break
    case 10:{
      const inner=(1-thickness)**2,r=radius*Math.sqrt(inner+(1-inner)*rnd(2))
      position={x:unit.x*r,y:unit.y*r,z:0};direction={...unit,z:0};break
    }
    case 4:{
      // Native cone uses an area fraction and clamps its inner term to 0.001;
      // unlike Circle it does not square (1-thickness).
      const inner=Math.max(0.001,1-thickness),fraction=Math.sqrt(inner+(1-inner)*rnd(2))
      const angle=Number(shape.angle||0)*Math.PI/180,sin=Math.sin(angle)
      position={x:unit.x*radius*fraction,y:unit.y*radius*fraction,z:0}
      direction={x:unit.x*fraction*sin,y:unit.y*fraction*sin,z:Math.cos(angle)}
      const length=Math.hypot(direction.x,direction.y,direction.z)
      if(length>0)direction={x:direction.x/length,y:direction.y/length,z:direction.z/length}
      break
    }
    case 0:
    case 2:{
      const z=shape.type===2?rnd(2):rnd(2)*2-1,s=Math.sqrt(Math.max(0,1-z*z)),inner=(1-thickness)**3
      const r=radius*Math.cbrt(inner+(1-inner)*rnd(3))
      direction={x:s*unit.x,y:s*unit.y,z}
      position={x:direction.x*r,y:direction.y*r,z:direction.z*r};break
    }
    default:position={x:0,y:0,z:0}
  }
  return {position:{x:position.x*scale.x,y:position.y*scale.y,z:position.z*scale.z},direction}
}
function distance(speed,limit,age) {
  if(!limit)return speed*age
  let t=0,d=0,v=Math.abs(speed)
  while(t<age){const dt=Math.min(1/60,age-t);if(v>limit.speed)v+=(limit.speed-v)*(1-Math.pow(1-limit.dampen,dt*30));d+=v*dt;t+=dt}
  return Math.sign(speed)*d
}
// RotationModule curves are an angular rate over particle lifetime; integrate on the same 60 Hz boundary as distance().
function rotationAt(c,age,life,r) {
  if(!c)return 0
  if(c.mode!==1)return sample(c,0,r)*age
  let a=0,t=0
  while(t<age){const dt=Math.min(1/60,age-t);a+=sample(c,life>0?Math.min(1,(t+dt/2)/life):0,r)*dt;t+=dt}
  return a
}
// Replay from birth on a deterministic Web 60 Hz grid. Keep only completed
// grid states so fractional renders and rewind never change future samples.
// This grid is a Web integration boundary, not Unity's recorded frame schedule.
const noiseMotionCache=new WeakMap()
const noiseTimelineCache=new WeakMap()
function noiseTimeline(system,births,last,cutoff,wait,maxLife,seed) {
  let timeline=noiseTimelineCache.get(system)
  if(!timeline || timeline.cutoff!==cutoff || last<timeline.last) {
    timeline={last:-1,cutoff,clock:createNoiseClock(system.capacity),records:[]}
    noiseTimelineCache.set(system,timeline)
  }
  const ordered=births.map((birth,index)=>({birth,index})).sort((a,b)=>a.birth-b.birth || a.index-b.index)
  for(let loop=timeline.last+1;loop<=last;loop++)for(const {birth,index} of ordered) {
    const id=loop*100000+index,born=loop*system.duration+birth+wait
    if(born>cutoff)continue
    const life=Math.max(.00001,sample(system.lifetime,Math.max(0,Math.min(1,birth/system.duration)),random(seed,id,0)))
    if(timeline.clock.admit(born,life))timeline.records.push({id,born,end:born+life})
  }
  timeline.last=last
  const start=last*system.duration+wait
  timeline.records=timeline.records.filter(r=>r.end>start)
  timeline.clock.discardBefore(Math.max(0,start-maxLife))
  return {clock:timeline.clock,ids:new Set(timeline.records.map(r=>r.id))}
}
function noiseMotion(system,id,initial,age,born,options) {
  let savedCache=noiseMotionCache.get(system)
  if(!savedCache || savedCache.clock!==options.clock){savedCache={clock:options.clock,entries:new Map()};noiseMotionCache.set(system,savedCache)}
  const cache=savedCache.entries
  const steps=Math.floor(age*60)
  let saved=cache.get(id)
  if(!saved || saved.steps>steps)saved={steps:0,state:initial}
  while(saved.steps<steps) {
    saved={steps:saved.steps+1,state:stepNoiseMotion(saved.state,system.noise,{...options,dt:1/60,phase:options.clock.timeAt(born+(saved.steps+1)/60)})}
  }
  cache.set(id,saved)
  while(cache.size>Math.max(32,system.capacity*2))cache.delete(cache.keys().next().value)
  const rest=age-steps/60
  return rest>1e-12?stepNoiseMotion(saved.state,system.noise,{...options,dt:rest,phase:options.clock.timeAt(born+age)}).position:saved.state.position
}
export function sampleObjectEmitter(system,time,activatedAt,stoppedAt=Infinity,view={}) {
  if(system.parentProjection && (!['native-local-orthographic-v1','native-local-size-orthographic-v1'].includes(system.parentProjection.profile) || system.alignment!==2 || system.rotationX || (system.sizeY && system.parentProjection.profile!=='native-local-size-orthographic-v1') || system.noise || system.stretch))
    throw Error('Unsupported local parent projection')
  // Nonzero distance rates are retained. This profile proves the world emitter
  // stays fixed after placement/Play, so native dt*|velocity| contributes zero.
  // Never apply that reduction to an unproven moving emitter.
  if(system.distanceRate && system.distanceMode!=='stationary-object-layer-v1')throw Error('Unbound distance emitter motion')
  const delay=typeof system.delay==='number'?{mode:0,value:system.delay,min:system.delay}:(system.delay||{mode:0,value:0,min:0})
  const seed=[...system.source.pathId].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0)|0,7)
  // MainModule.startDelay delays system playback once. It is not a fresh
  // per-particle or per-loop random draw.
  const wait=delay.mode===3?delay.min+(delay.value-delay.min)*random(seed,0,20):delay.value
  const prewarm=system.prewarm?Number(system.duration)||0:0
  const base=(time-activatedAt)/1000+prewarm,cutoff=(stoppedAt-activatedAt)/1000+prewarm
  // Births carry startDelay; the loop window must be shifted too or delayed loops drop out.
  const shift=Number(wait)||0
  const probe=base-shift
  if(probe<0 || cutoff<0)return []
  const maxLife=Math.max(.00001,curveUpperBound(system.lifetime)),period=system.duration
  const last=system.looping?Math.floor(Math.min(probe,cutoff)/period):0
  const first=system.looping?Math.max(0,Math.floor((probe-maxLife)/period)):0
  const matrix=system.parentProjection?emitterSpatialMatrix(system.chain):emitterMatrix(system.chain),renderBasis=emitterRenderBasis(system.chain,system.alignment,matrix),out=[]
  const births=system.bursts.flatMap(b=>Array.from({length:b.count},()=>b.time))
  if(system.rate)for(let i=1;i<=Math.ceil(period*system.rate);i++)if(i/system.rate<=period)births.push(i/system.rate)
  const timeline=system.noise?noiseTimeline(system,births,last,cutoff,wait,maxLife,seed):null
  for(let loop=first;loop<=last;loop++) {
    for(const [index,birth] of births.entries()) {
      const id=loop*100000+index,rnd=c=>random(seed,id,c),birthPhase=Math.max(0,Math.min(1,birth/period))
      if(timeline && !timeline.ids.has(id))continue
      const life=Math.max(.00001,sample(system.lifetime,birthPhase,rnd(0)))
      const born=loop*period+birth+wait,age=base-born
      if(age<0 || age>=life || born>cutoff)continue
      const t=age/life,shape=system.shape
      const emitted=shape?sampleEmitterShape(shape,rnd):{position:{x:0,y:0,z:0},direction:{x:0,y:0,z:1}}
      let p=shape?euler(emitted.position,shape.m_Rotation):emitted.position
      const v=shape?euler(emitted.direction,shape.m_Rotation):emitted.direction,d=system.noise?0:distance(sample(system.speed,birthPhase,rnd(4)),system.limit,age)
      const g=(system.gravity?sample(system.gravity,birthPhase,rnd(19)):0)*-9.81
      if(system.noise) {
        const speed=sample(system.speed,birthPhase,rnd(4)),det=matrix.a*matrix.d-matrix.b*matrix.c
        if(Math.abs(det)<1e-12)throw Error('Singular noise emitter gravity plane')
        const initial={position:{x:p.x+(shape?.m_Position.x||0),y:p.y+(shape?.m_Position.y||0),z:p.z+(shape?.m_Position.z||0)},velocity:{x:v.x*speed,y:v.y*speed,z:v.z*speed}}
        p=noiseMotion(system,id,initial,age,born,{clock:timeline.clock,offset:{x:random(seed,0,31),y:random(seed,0,32),z:random(seed,0,33)},
          velocity:system.velocity?{x:sample(system.velocity.x,t,rnd(14)),y:sample(system.velocity.y,t,rnd(15)),z:sample(system.velocity.z,t,rnd(16))}:{x:0,y:0,z:0},
          gravity:{x:-matrix.c*g/det,y:matrix.a*g/det,z:0},limit:system.limit})
      } else {
        p={x:p.x+(shape?.m_Position.x||0)+v.x*d+(system.velocity?sampleObjectVelocityDisplacement(system.velocity.x,age,life,rnd(14)):0),y:p.y+(shape?.m_Position.y||0)+v.y*d+(system.velocity?sampleObjectVelocityDisplacement(system.velocity.y,age,life,rnd(15)):0),z:p.z+(shape?.m_Position.z||0)+v.z*d+(system.velocity?sampleObjectVelocityDisplacement(system.velocity.z,age,life,rnd(16)):0)}
      }
      const size=sample(system.size,birthPhase,rnd(5))*(system.sizeOverLife?sample(system.sizeOverLife,t,rnd(6)):1)*100
      const sizeY=system.sizeY?sample(system.sizeY,birthPhase,rnd(10))*(system.sizeOverLifeY?sample(system.sizeOverLifeY,t,rnd(11)):system.sizeOverLife?sample(system.sizeOverLife,t,rnd(6)):1)*100:size
      // Particle angles are clockwise in Unity's billboard builder. Convert
      // them separately from emitter Transform rotations, which stay unchanged.
      const rz=-(sample(system.rotation,birthPhase,rnd(7))+rotationAt(system.angularVelocity,age,life,rnd(13)))
      let A,B,C,D
      if(system.rotationX){
        // rotation3D: Unity Euler order Z, then X, then Y; project world axes onto the screen plane.
        const rx=-(sample(system.rotationX,birthPhase,rnd(17))+rotationAt(system.angularX,age,life,rnd(21))),ry=-(sample(system.rotationY,birthPhase,rnd(18))+rotationAt(system.angularY,age,life,rnd(22)))
        const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz)
        // Native UV(0,1) is the PNG/Pixi top-left corner: include both texture
        // and screen Y conversions, as in the ordinary 2D branch below.
        A=cy*cz+sy*sx*sz;B=-(cx*sz);C=cy*sz-sy*sx*cz;D=cx*cz
        ;[A,B,C,D]=[renderBasis.a*A-renderBasis.c*B,-renderBasis.b*A+renderBasis.d*B,renderBasis.a*C-renderBasis.c*D,-renderBasis.b*C+renderBasis.d*D]
      } else {
        const c=Math.cos(rz),s=Math.sin(rz)
        A=renderBasis.a*c+renderBasis.c*s;B=-(renderBasis.b*c+renderBasis.d*s);C=renderBasis.a*s-renderBasis.c*c;D=-(renderBasis.b*s-renderBasis.d*c)
      }
      const mix=system.colorMode===2&&system.colorMin?rnd(12):null
      const rgba=system.colorMode===4?Object.fromEntries(['r','g','b','a'].map(k=>[k,k==='a'?sampleFloorGradient(system.colorGradient.alphas,rnd(12)):sampleFloorGradient(system.colorGradient.colors,rnd(12),k)])):mix===null?system.color:Object.fromEntries(['r','g','b','a'].map(k=>[k,system.colorMin[k]+(system.color[k]-system.colorMin[k])*mix])),over=system.colorOverLife
      const color=['r','g','b'].reduce((v,k,i)=>v|(Math.round(Math.max(0,Math.min(1,rgba[k]*sampleFloorGradient(over.colors,t,k)))*255)<<(16-8*i)),0)
      const u=system.uv,n=u?u.columns*u.rows:1,f=u?sample(u.startFrame,0,rnd(8))+sample(u.frameOverTime,(t*u.cycles)%1,rnd(9)):0
      // World gravity (Unity default -9.81 y) after the emitter matrix; screen y is negated.
      const wx=matrix.a*p.x+matrix.c*p.y+(matrix.zx||0)*p.z+matrix.tx,wy=matrix.b*p.x+matrix.d*p.y+(matrix.zy||0)*p.z+matrix.ty+(system.noise?0:0.5*g*age*age)
      let geometry={x:wx*100,y:-wy*100,a:A*size,b:B*size,c:C*sizeY,d:D*sizeY}
      if(system.stretch) {
        const fp=Math.fround,speed=fp(sample(system.speed,birthPhase,rnd(4)))
        const vx=fp(v.x*speed),vy=fp(v.y*speed),vz=fp(v.z*speed)
        let quad
        if(system.stretch.profile===OBJECT_SPATIAL_PROFILE) {
          quad=spatialEmitterQuads(system,matrix,renderBasis,p,{x:vx,y:vy,z:vz},size/100,view.spatial)
        } else if(system.stretch.profile==='native-classic-planar-v1') {
          const velocity=transformStretchVelocity(matrix,{x:vx,y:vy},view.rotation??0)
          quad=samplePlanarStretch({position:{x:wx,y:wy},velocity,size:size/100,
          scaleX:Math.hypot(matrix.a,matrix.b),scaleY:Math.hypot(matrix.c,matrix.d),...system.stretch,
          viewHeight:view.height??7.2,cameraRotation:view.rotation??0})
        } else throw Error('Unknown stretch profile')
        // PNG extraction flips Unity texture Y. Native (0,1),(1,1),(1,0),(0,0)
        // maps to the four Pixi corners in that order; texture X follows the tail.
        geometry={x:(quad[0].x+quad[2].x)*50,y:-(quad[0].y+quad[2].y)*50,
          a:(quad[1].x-quad[0].x)*100,b:-(quad[1].y-quad[0].y)*100,
          c:(quad[3].x-quad[0].x)*100,d:-(quad[3].y-quad[0].y)*100}
      }
      out.push({birth:born,frame:((Math.floor(f*n)%n)+n)%n,alpha:rgba.a*sampleFloorGradient(over.alphas,t),color,...geometry})
    }
  }
  return out.slice(-system.capacity)
}

export function attachObjectEmitters(index,data,hash,choreographyHash) {
  if(data?.schemaVersion!==1 || data.objectIndexSha256!==hash)throw new Error('Object emitter source binding mismatch')
  if(data.choreographyIndexSha256 && data.choreographyIndexSha256!==choreographyHash)throw new Error('Distance emitter choreography binding mismatch')
  const assets={...index.assets}
  for(const [name,model] of Object.entries(data.assets)) {
    const source=assets[name]
    if(source?.bundle!==model.bundle || source.particleCount!==model.particleCount || model.systems.length+model.deferred.length!==source.particleCount)throw new Error(`Object emitter identity mismatch ${name}`)
    if(model.systems.some(s=>s.distanceRate)) {
      const proof=model.distanceMotionProof
      if(!data.choreographyIndexSha256 || proof?.profile!=='stationary-object-layer-v1' || !proof.components?.length || !proof.arrangements?.length || model.systems.some(s=>s.distanceRate && s.distanceMode!==proof.profile))throw new Error(`Unproven distance emitter motion ${name}`)
    }
    assets[name]=model.systems.length?{...source,nativeParticleAnimation:{...model,textures:data.textures}}:{...source,nativeParticleDeferred:model}
  }
  return {...index,assets}
}
