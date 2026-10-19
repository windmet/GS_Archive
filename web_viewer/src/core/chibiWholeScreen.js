import { sampleParticleCurve } from './chibiParticleTimeline.js'
import { sampleFloorGradient } from './chibiFloorParticles.js'

export function attachWholeScreen(index, data, hash) {
  if(data?.contract!=='native-whole-screen-v1' || data.choreographyIndexSha256!==hash)
    throw new Error('Whole_screen source binding mismatch')
  const songs=index.songs.map(song=> {
    const source=data.songs[song.id]
    if(source?.songCode!==song.songCode || source.source!==song.source || !/^[a-f0-9]{64}$/.test(source.textSha256))
      throw new Error(`Whole_screen identity mismatch: ${song.id}`)
    if(!source.events.every(e=>Number.isFinite(e.time) && Number.isFinite(e.duration) && (data.models[e.type] || e.unresolvedReason)))
      throw new Error(`Whole_screen invalid command: ${song.id}`)
    return {...song,wholeScreenEvents:source.events}
  })
  return {...index,songs,wholeScreen:data}
}

const tweenAt=(tween,time)=> {
  if(!tween)return 0
  const t=tween.duration>0?Math.max(0,Math.min(1,(time-tween.time)/tween.duration)):1
  return tween.from+(tween.to-tween.from)*(1-(1-t)**2)
}

// Resource instances are keyed by Type, not by row. Erase schedules a native
// delayed SetActive(false); Play does not kill that callback or fade particles.
export function wholeScreenAt(events,time,models) {
  const states=new Map(), actions=(events||[]).filter(e=>e.time<=time).map((e,i)=>({...e,order:i})).sort((a,b)=>a.time-b.time||a.order-b.order)
  for(let i=0;i<actions.length;i++) {
    const e=actions[i], model=models?.[e.type]
    if(!model || model.kind==='unsupported')continue
    let s=states.get(e.type)
    if(!s){s={type:e.type,active:false,playing:false,epochs:[],depth:model.initialDepth||0,tween:null};states.set(e.type,s)}
    if(e.deactivate){s.active=false;s.playing=false;s.epochs=[];continue}
    if(e.hide) {
      if(model.kind==='particle') {
        if(s.playing)s.epochs.at(-1).stop=e.time
        s.playing=false
      } else s.tween={from:tweenAt(s.tween,e.time),to:0,time:e.time,duration:e.duration}
      const end=e.time+Math.max(0,e.duration)
      if(end<=time){actions.push({time:end,type:e.type,deactivate:true,order:e.order+.5});actions.sort((a,b)=>a.time-b.time||a.order-b.order)}
    } else {
      s.active=true;s.depth=e.depth
      if(model.kind==='particle') {
        if(!s.playing)s.epochs.push({start:e.time,stop:Infinity})
        s.playing=true
      } else s.tween={from:tweenAt(s.tween,e.time),to:1,time:e.time,duration:e.duration}
    }
  }
  for(const s of states.values())s.alpha=models[s.type].kind==='sprite'?tweenAt(s.tween,time):1
  return states
}

const curve=(c,t,r)=>c.mode===3?c.minScalar+(c.scalar-c.minScalar)*r:sampleParticleCurve(c,t)
function rotate(p,q) {
  const tx=2*(q.y*p.z-q.z*p.y),ty=2*(q.z*p.x-q.x*p.z),tz=2*(q.x*p.y-q.y*p.x)
  return {x:p.x+q.w*tx+q.y*tz-q.z*ty,y:p.y+q.w*ty+q.z*tx-q.x*tz,z:p.z+q.w*tz+q.x*ty-q.y*tx}
}
const random=(birth,channel,seed)=> {
  let n=Math.imul(birth+1,0x45d9f3b)^Math.imul(channel+1,0x27d4eb2d)^seed
  n=Math.imul(n^(n>>>16),0x45d9f3b)
  return ((n^(n>>>16))>>>0)/4294967296
}

// Box emission, world simulation, view billboards, native curves and UV sheet.
// Rewind-stable web seed is deliberately not claimed as Unity autoRandomSeed.
// NoiseModule is preserved in the model and reported as deferred, never faked.
export function sampleWholeScreen(system,time,epochs) {
  const result=[],seed=Number(system.source.pathId)
  for(const epoch of epochs) {
    const elapsed=(time-epoch.start)/1000,cutoff=(epoch.stop-epoch.start)/1000
    const last=Math.floor(Math.min(elapsed,cutoff)*system.rate)
    const first=Math.max(1,Math.floor((elapsed-Math.max(system.lifetime.scalar,system.lifetime.minScalar??system.lifetime.scalar))*system.rate))
    for(let birth=first;birth<=last;birth++) {
      const rnd=c=>random(birth,c,seed),age=elapsed-birth/system.rate,life=curve(system.lifetime,0,rnd(0))
      if(age<0 || age>=life)continue
      const t=age/life,shape=system.shape.m_Scale
      let p={x:(rnd(1)-.5)*shape.x,y:(rnd(2)-.5)*shape.y,z:(rnd(3)-.5)*shape.z}
      let velocity={x:0,y:0,z:curve(system.speed,0,rnd(4))}
      for(const tr of system.chain) {
        p=rotate({x:p.x*tr.scale.x,y:p.y*tr.scale.y,z:p.z*tr.scale.z},tr.rotation)
        p={x:p.x+tr.position.x,y:p.y+tr.position.y,z:p.z+tr.position.z}
        velocity=rotate(velocity,tr.rotation)
      }
      const initial=system.colorMode===4?Object.fromEntries(['r','g','b','a'].map(k=>[k,k==='a'?sampleFloorGradient(system.colorGradient.alphas,rnd(5)):sampleFloorGradient(system.colorGradient.colors,rnd(5),k)])):system.color
      const color=[16,8,0].reduce((v,shift,c)=>v|(Math.round(Math.max(0,Math.min(1,initial[['r','g','b'][c]]*sampleFloorGradient(system.colorOverLife.colors,t,['r','g','b'][c])))*255)<<shift),0)
      const uv=system.uv,n=uv?uv.columns*uv.rows:1
      const frame=uv?((Math.floor((curve(uv.startFrame,0,rnd(6))+curve(uv.frameOverTime,(t*uv.cycles)%1,rnd(7)))*n)%n)+n)%n:0
      result.push({birth,epoch:epoch.start,x:p.x*100+velocity.x*age*100,y:-p.y*100-velocity.y*age*100,
        size:curve(system.size,0,rnd(8))*(system.scalingMode===1?72:100)*(system.sizeOverLife?curve(system.sizeOverLife,t,rnd(9)):1),
        rotation:-curve(system.rotation,0,rnd(10))-(system.angularVelocity?curve(system.angularVelocity,t,rnd(11))*age:0),
        color,alpha:initial.a*sampleFloorGradient(system.colorOverLife.alphas,t),frame})
    }
  }
  return result.slice(-system.capacity)
}
