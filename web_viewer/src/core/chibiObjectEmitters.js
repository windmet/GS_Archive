import { sampleParticleCurve } from './chibiParticleTimeline.js'
import { sampleFloorGradient } from './chibiFloorParticles.js'
const sample=(c,t,r)=>c.mode===3?c.minScalar+(c.scalar-c.minScalar)*r:sampleParticleCurve(c,t)
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
// ShapeModule sampling: box(5), edge(12), sphere(0), hemisphere(2), circle(10), cone(4).
// Sphere surface vs volume follows radiusThickness; cone uses its base radius.
function shapePosition(shape,rnd) {
  const scale=shape.m_Scale||{x:1,y:1,z:1},radius=(shape.radius&&shape.radius.value)||0
  switch(shape.type) {
    case 12:return {x:(rnd(1)*2-1)*radius*scale.x,y:0,z:0}
    case 5:return {x:(rnd(1)-.5)*scale.x,y:(rnd(2)-.5)*scale.y,z:(rnd(3)-.5)*scale.z}
    case 10:{const phi=rnd(1)*Math.PI*2,r=radius*Math.sqrt(rnd(2));return {x:Math.cos(phi)*r*scale.x,y:Math.sin(phi)*r*scale.y,z:0}}
    case 4:{const phi=rnd(1)*Math.PI*2,r=radius*Math.sqrt(rnd(2));return {x:Math.cos(phi)*r*scale.x,y:Math.sin(phi)*r*scale.y,z:0}}
    case 0:
    case 2:{
      const u=rnd(1)*2-1,phi=rnd(2)*Math.PI*2,s=Math.sqrt(Math.max(0,1-u*u)),surface=Number(shape.radiusThickness)>=.999
      const r=radius*(surface?1:Math.cbrt(rnd(3)))
      const d={x:s*Math.cos(phi),y:shape.type===2?Math.abs(u):u,z:s*Math.sin(phi)}
      return {x:d.x*r*scale.x,y:d.y*r*scale.y,z:d.z*r*scale.z}
    }
    default:return {x:0,y:0,z:0}
  }
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
  const delay=typeof system.delay==='number'?{mode:0,value:system.delay,min:system.delay}:(system.delay||{mode:0,value:0,min:0})
  const prewarm=system.prewarm?Number(system.duration)||0:0
  const base=(time-activatedAt)/1000+prewarm,cutoff=(stoppedAt-activatedAt)/1000+prewarm
  // Births carry startDelay; the loop window must be shifted too or delayed loops drop out.
  const shift=Number(delay.mode===3?delay.min:delay.value)||0
  const probe=base-shift
  if(probe<0 || cutoff<0)return []
  const maxLife=Math.max(system.lifetime.scalar,system.lifetime.minScalar),period=system.duration
  const last=system.looping?Math.floor(Math.min(probe,cutoff)/period):0
  const first=system.looping?Math.max(0,Math.floor((probe-maxLife)/period)):0
  const matrix=emitterMatrix(system.chain),seed=[...system.source.pathId].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0)|0,7),out=[]
  for(let loop=first;loop<=last;loop++) {
    const births=system.bursts.flatMap(b=>Array.from({length:b.count},()=>b.time))
    if(system.rate)for(let i=1;i<=Math.ceil(period*system.rate);i++)if(i/system.rate<=period)births.push(i/system.rate)
    for(const [index,birth] of births.entries()) {
      const id=loop*100000+index,rnd=c=>random(seed,id,c),life=sample(system.lifetime,0,rnd(0))
      const wait=delay.mode===3?delay.min+(delay.value-delay.min)*rnd(20):delay.value
      const born=loop*period+birth+wait,age=base-born
      if(age<0 || age>=life || born>cutoff)continue
      const t=age/life,shape=system.shape
      let p=shape?euler(shapePosition(shape,rnd),shape.m_Rotation):{x:0,y:0,z:0}
      const v=shape?euler({x:0,y:0,z:1},shape.m_Rotation):{x:0,y:0,z:1},d=distance(sample(system.speed,0,rnd(4)),system.limit,age)
      p={x:p.x+(shape?.m_Position.x||0)+v.x*d+(system.velocity?sample(system.velocity.x,t,rnd(14))*age:0),y:p.y+(shape?.m_Position.y||0)+v.y*d+(system.velocity?sample(system.velocity.y,t,rnd(15))*age:0),z:p.z+(shape?.m_Position.z||0)+v.z*d+(system.velocity?sample(system.velocity.z,t,rnd(16))*age:0)}
      const size=sample(system.size,0,rnd(5))*(system.sizeOverLife?sample(system.sizeOverLife,t,rnd(6)):1)*100
      const sizeY=system.sizeY?sample(system.sizeY,0,rnd(10))*(system.sizeOverLifeY?sample(system.sizeOverLifeY,t,rnd(11)):system.sizeOverLife?sample(system.sizeOverLife,t,rnd(6)):1)*100:size
      const rz=sample(system.rotation,0,rnd(7))+rotationAt(system.angularVelocity,age,life,rnd(13))
      let A,B,C,D
      if(system.rotationX){
        // rotation3D: Unity Euler order Z, then X, then Y; project world axes onto the screen plane.
        const rx=sample(system.rotationX,0,rnd(17))+rotationAt(system.angularX,age,life,rnd(21)),ry=sample(system.rotationY,0,rnd(18))+rotationAt(system.angularY,age,life,rnd(22))
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
      const g=(system.gravity?sample(system.gravity,0,rnd(19)):0)*-9.81
      const wx=matrix.a*p.x+matrix.c*p.y+matrix.tx,wy=matrix.b*p.x+matrix.d*p.y+matrix.ty+0.5*g*age*age
      out.push({birth:born,frame:((Math.floor(f*n)%n)+n)%n,alpha:rgba.a*sampleFloorGradient(over.alphas,t),color,
        x:wx*100,y:-wy*100,
        a:A*size,b:B*size,c:C*sizeY,d:D*sizeY})
    }
  }
  return out.slice(-system.capacity)
}

export function attachObjectEmitters(index,data,hash) {
  if(data?.schemaVersion!==1 || data.objectIndexSha256!==hash)throw new Error('Object emitter source binding mismatch')
  const assets={...index.assets}
  for(const [name,model] of Object.entries(data.assets)) {
    const source=assets[name]
    if(source?.bundle!==model.bundle || source.particleCount!==model.particleCount || model.systems.length+model.deferred.length!==source.particleCount)throw new Error(`Object emitter identity mismatch ${name}`)
    assets[name]=model.systems.length?{...source,nativeParticleAnimation:{...model,textures:data.textures}}:{...source,nativeParticleDeferred:model}
  }
  return {...index,assets}
}
