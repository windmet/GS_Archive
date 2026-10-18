import { sampleParticleCurve } from './chibiParticleTimeline.js'
import { sampleFloorGradient } from './chibiFloorParticles.js'
export function sampleObjectCurve(c,t,r) {
  if(c.mode===3)return c.minScalar+(c.scalar-c.minScalar)*r
  if(c.mode===2){const min=sampleParticleCurve({...c,keys:c.minKeys},t);return min+(sampleParticleCurve(c,t)-min)*r}
  return sampleParticleCurve(c,t)
}
const sample=sampleObjectCurve
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
// Unity particle noise: Ken Perlin's permutation table, read from libunity .rodata 0xdf8134 (uint32).
const PERM=new Uint8Array([151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180])
function fade(t){return t*t*t*(t*(t*6-15)+10)}
function lerp(a,b,t){return a+(b-a)*t}
function grad(h,x,y,z){const g=h&15,u=g<8?x:y,v=g<4?y:(g===12||g===14?x:z);return ((g&1)?-u:u)+((g&2)?-v:v)}
function perlin(x,y,z){
  const X=Math.floor(x)&255,Y=Math.floor(y)&255,Z=Math.floor(z)&255
  x-=Math.floor(x);y-=Math.floor(y);z-=Math.floor(z)
  const u=fade(x),v=fade(y),w=fade(z),A=PERM[X]+Y,B=PERM[X+1]+Y
  const AA=PERM[A]+Z,AB=PERM[A+1]+Z,BA=PERM[B]+Z,BB=PERM[B+1]+Z
  return lerp(lerp(lerp(grad(PERM[AA],x,y,z),grad(PERM[BA],x-1,y,z),u),lerp(grad(PERM[AB],x,y-1,z),grad(PERM[BB],x-1,y-1,z),u),v),
    lerp(lerp(grad(PERM[AA+1],x,y,z-1),grad(PERM[BA+1],x-1,y,z-1),u),lerp(grad(PERM[AB+1],x,y-1,z-1),grad(PERM[BB+1],x-1,y-1,z-1),u),v),w)
}
// NoiseModule displacement over the particle lifetime: frequency, scroll, octaves and strength.
// Damping and Unity's remap curve are not reproduced yet (see partial marker).
function noiseOffset(n,p,age){
  const f=Number(n.frequency)||1,scroll=Number(n.scroll)||0,oct=Math.max(1,Math.min(4,Number(n.octaveCount)||1)),s=Number(n.strength)||0
  const x=p.x*f+scroll*age,y=p.y*f,z=p.z*f-scroll*age
  let ax=0,ay=0,az=0,amp=1,freq=1
  for(let k=0;k<oct;k++){
    ax+=amp*perlin(x*freq,y*freq,z*freq)
    ay+=amp*perlin(x*freq+31.4,y*freq+47.2,z*freq+13.7)
    az+=amp*perlin(x*freq+67.1,y*freq+89.3,z*freq+5.9)
    amp*=Number(n.octaveMultiplier)||0.5;freq*=Number(n.octaveScale)||2
  }
  return {x:ax*s,y:ay*s,z:az*s}
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
export function sampleObjectEmitter(system,time,activatedAt,stoppedAt=Infinity) {
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
  const matrix=emitterMatrix(system.chain),out=[]
  for(let loop=first;loop<=last;loop++) {
    const births=system.bursts.flatMap(b=>Array.from({length:b.count},()=>b.time))
    if(system.rate)for(let i=1;i<=Math.ceil(period*system.rate);i++)if(i/system.rate<=period)births.push(i/system.rate)
    for(const [index,birth] of births.entries()) {
      const id=loop*100000+index,rnd=c=>random(seed,id,c),birthPhase=Math.max(0,Math.min(1,birth/period))
      const life=Math.max(.00001,sample(system.lifetime,birthPhase,rnd(0)))
      const born=loop*period+birth+wait,age=base-born
      if(age<0 || age>=life || born>cutoff)continue
      const t=age/life,shape=system.shape
      const emitted=shape?sampleEmitterShape(shape,rnd):{position:{x:0,y:0,z:0},direction:{x:0,y:0,z:1}}
      let p=shape?euler(emitted.position,shape.m_Rotation):emitted.position
      if(system.noise){const d=noiseOffset(system.noise,p,age);p={x:p.x+d.x,y:p.y+d.y,z:p.z+d.z}}
      const v=shape?euler(emitted.direction,shape.m_Rotation):emitted.direction,d=distance(sample(system.speed,birthPhase,rnd(4)),system.limit,age)
      p={x:p.x+(shape?.m_Position.x||0)+v.x*d+(system.velocity?sample(system.velocity.x,t,rnd(14))*age:0),y:p.y+(shape?.m_Position.y||0)+v.y*d+(system.velocity?sample(system.velocity.y,t,rnd(15))*age:0),z:p.z+(shape?.m_Position.z||0)+v.z*d+(system.velocity?sample(system.velocity.z,t,rnd(16))*age:0)}
      const size=sample(system.size,birthPhase,rnd(5))*(system.sizeOverLife?sample(system.sizeOverLife,t,rnd(6)):1)*100
      const sizeY=system.sizeY?sample(system.sizeY,birthPhase,rnd(10))*(system.sizeOverLifeY?sample(system.sizeOverLifeY,t,rnd(11)):system.sizeOverLife?sample(system.sizeOverLife,t,rnd(6)):1)*100:size
      const rz=sample(system.rotation,birthPhase,rnd(7))+rotationAt(system.angularVelocity,age,life,rnd(13))
      let A,B,C,D
      if(system.rotationX){
        // rotation3D: Unity Euler order Z, then X, then Y; project world axes onto the screen plane.
        const rx=sample(system.rotationX,birthPhase,rnd(17))+rotationAt(system.angularX,age,life,rnd(21)),ry=sample(system.rotationY,birthPhase,rnd(18))+rotationAt(system.angularY,age,life,rnd(22))
        const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz)
        A=cy*cz+sy*sx*sz;B=-(cx*sz);C=-cy*sz+sy*sx*cz;D=-(cx*cz)
      } else {
        const c=Math.cos(rz),s=Math.sin(rz)
        const base=system.alignment===2?matrix:{a:Math.hypot(matrix.a,matrix.b),b:0,c:0,d:Math.hypot(matrix.c,matrix.d)}
        A=base.a*c+base.c*s;B=-(base.b*c+base.d*s);C=base.a*s-base.c*c;D=-(base.b*s-base.d*c)
      }
      const mix=system.colorMode===2&&system.colorMin?rnd(12):null
      const rgba=system.colorMode===4?Object.fromEntries(['r','g','b','a'].map(k=>[k,k==='a'?sampleFloorGradient(system.colorGradient.alphas,rnd(12)):sampleFloorGradient(system.colorGradient.colors,rnd(12),k)])):mix===null?system.color:Object.fromEntries(['r','g','b','a'].map(k=>[k,system.colorMin[k]+(system.color[k]-system.colorMin[k])*mix])),over=system.colorOverLife
      const color=['r','g','b'].reduce((v,k,i)=>v|(Math.round(Math.max(0,Math.min(1,rgba[k]*sampleFloorGradient(over.colors,t,k)))*255)<<(16-8*i)),0)
      const u=system.uv,n=u?u.columns*u.rows:1,f=u?sample(u.startFrame,0,rnd(8))+sample(u.frameOverTime,(t*u.cycles)%1,rnd(9)):0
      // World gravity (Unity default -9.81 y) after the emitter matrix; screen y is negated.
      const g=(system.gravity?sample(system.gravity,birthPhase,rnd(19)):0)*-9.81
      const wx=matrix.a*p.x+matrix.c*p.y+matrix.tx,wy=matrix.b*p.x+matrix.d*p.y+matrix.ty+0.5*g*age*age
      out.push({birth:born,frame:((Math.floor(f*n)%n)+n)%n,alpha:rgba.a*sampleFloorGradient(over.alphas,t),color,
        x:wx*100,y:-wy*100,
        a:A*size,b:B*size,c:C*sizeY,d:D*sizeY})
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
