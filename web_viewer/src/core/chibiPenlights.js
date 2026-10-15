import { sampleStreamedCurve } from './chibiNativeAnimation.js'
import { nativeLightScreenLayout } from './chibiNativeLightProjection.js'

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
const mod = (x, size) => (x % size + size) % size
const identity = () => ({a:1,b:0,c:0,d:1,tx:0,ty:0,z:0,sz:1})
const compiledModels = new WeakMap()
const commands=new Set(['Penlight','Penlight_unit','Penlight_unit_color'])

export function validatePenlightData(data, choreographyHash, modelHash) {
  if(data?.schemaVersion!==1 || !/^[a-f0-9]{64}$/.test(choreographyHash || '') || !/^[a-f0-9]{64}$/.test(modelHash || '') || data.choreographyIndexSha256!==choreographyHash || data.modelSha256!==modelHash)
    throw Error('Penlight commands do not match loaded choreography/resources')
  if(!data.songs || !data.idolColors || !Number.isSafeInteger(data.eventCount))throw Error('Invalid Penlight command index')
  if(Object.values(data.idolColors).some(color=>!penlightColor(color)))throw Error('Invalid native Penlight idol colors')
  let count=0
  for(const track of Object.values(data.songs)) {
    if(!track.songCode || !track.source || !Number.isInteger(track.nativeIdolType) || !Array.isArray(track.events))
      throw Error('Invalid Penlight track identity')
    let previous=null
    for(const event of track.events) {
      if(!commands.has(event.command) || !event.id || !event.prefab || typeof event.erase!=='boolean'
        || !Number.isFinite(event.time) || !Number.isSafeInteger(event.sourceRow)
        || previous && (previous.time>event.time || previous.time===event.time && previous.sourceRow>=event.sourceRow))
        throw Error('Invalid Penlight event identity/order')
      if(!event.erase && (['x','y','speed','scale','depth','animationType','animationId'].some(key=>!Number.isFinite(event[key]))
        || event.command!=='Penlight' && (!Number.isInteger(event.colorMode) || !Array.isArray(event.colors))))
        throw Error('Invalid named Penlight command')
      previous=event;count++
    }
  }
  if(count!==data.eventCount)throw Error('Penlight event count mismatch')
  return data
}

// The native game uses System.Random for random clip selection and Unity
// Random for phases/shuffles. Their live seeds are unavailable. Preview uses
// a repeatable stream so pause/seek cannot reshuffle a fixed performance.
function seeded(seed) {
  let state = 2166136261
  for (const c of String(seed)) state = Math.imul(state ^ c.charCodeAt(0), 16777619)
  return () => {state = Math.imul(1664525, state) + 1013904223 | 0; return (state >>> 0) / 4294967296}
}
function shuffle(list, random) {
  for (let i=0;i<list.length-1;i++) {
    const j=i+Math.floor(random()*(list.length-i));[list[i],list[j]]=[list[j],list[i]]
  }
  return list
}
export function penlightColor(text, idolColors = []) {
  const idol = /^#IdolColor([1-5])$/.exec(text || '')
  if (idol) return penlightColor(idolColors[Number(idol[1])-1])
  if (!/^#[\da-f]{6}([\da-f]{2})?$/i.test(text || '')) return null
  return [1,3,5].map(i=>parseInt(text.slice(i,i+2),16)/255)
    .concat(text.length===9?parseInt(text.slice(7,9),16)/255:1)
}
function rgba(value) {return [value.r,value.g,value.b,value.a]}
function matrix(node, pose) {
  const p={...node.position},s={...node.scale},q=node.rotation
  let angle=null
  if (Math.abs(q.x)>1e-6 || Math.abs(q.y)>1e-6) throw Error('Unverified Penlight out-of-plane rotation')
  for (const [channel,value] of Object.entries(pose || {})) {
    const [kind,axis]=channel.split('.')
    if (kind==='position')p[axis]=value
    else if (kind==='scale')s[axis]=value
    else if(kind==='eulerDegrees' && axis==='z')angle=value*Math.PI/180
    else if(kind==='eulerDegrees' && (axis==='x'||axis==='y') && Math.abs(value)<1e-6)continue
    else throw Error('Unverified Penlight animation channel')
  }
  const norm=Math.hypot(q.z,q.w),z=q.z/norm,w=q.w/norm
  const c=angle===null?1-2*z*z:Math.cos(angle),sn=angle===null?2*z*w:Math.sin(angle)
  return {a:c*s.x,b:sn*s.x,c:-sn*s.y,d:c*s.y,tx:p.x,ty:p.y,z:p.z,sz:s.z}
}
function compose(parent, child) {
  return {a:parent.a*child.a+parent.c*child.b,b:parent.b*child.a+parent.d*child.b,
    c:parent.a*child.c+parent.c*child.d,d:parent.b*child.c+parent.d*child.d,
    tx:parent.a*child.tx+parent.c*child.ty+parent.tx,ty:parent.b*child.tx+parent.d*child.ty+parent.ty,
    z:parent.z+parent.sz*child.z,sz:parent.sz*child.sz}
}
export function compilePenlightModel(model) {
  if(compiledModels.has(model))return compiledModels.get(model)
  const result=new Map()
  for(const prefab of model.prefabs) {
    const nodes=new Map(prefab.nodes.map(node=>[node.route,node])),world=new Map(),active=new Map()
    function visit(route) {
      if(world.has(route))return world.get(route)
      const node=nodes.get(route)
      if(!node)throw Error('Missing Penlight Transform')
      const parent=node.parent?visit(node.parent):identity()
      const value=compose(parent,matrix(node))
      world.set(route,value);active.set(route,node.activeSelf && (!node.parent || active.get(node.parent)))
      return value
    }
    for(const route of nodes.keys())visit(route)
    const actors=prefab.actors.map(actor=>({...actor,node:nodes.get(actor.route),
      parentWorld:world.get(nodes.get(actor.route).parent)||identity(),world:world.get(actor.route),
      enabled:active.get(actor.route)&&actor.renderState.Enabled,initialColor:rgba(actor.initialColor)}))
    const shadows=prefab.shadows.map(shadow=>({...shadow,world:world.get(shadow.route),
      enabled:active.get(shadow.route)&&shadow.renderState.Enabled,initialColor:rgba(shadow.initialColor)}))
    result.set(prefab.name,{...prefab,actors,shadows,model})
  }
  compiledModels.set(model,result)
  return result
}
function initialState(event, prefab, registration, random) {
  const colors=prefab.actors.map(actor=>[...actor.initialColor]),offsets=prefab.actors.map(()=>0)
  if(registration.nativeIdolType===4) {
    const palette=[...new Set(registration.idolColors || [])].map(c=>penlightColor(c)).filter(Boolean)
    if(palette.length) {
      // Awake sorts front/middle separately from back by parent world X.
      for(const indices of [prefab.actors.slice(0,prefab.frontMiddleObjCount),prefab.actors.slice(prefab.frontMiddleObjCount)]) {
        indices.sort((a,b)=>a.parentWorld.tx-b.parentWorld.tx || a.index-b.index)
        for(let i=0;i<indices.length;i++) {
          if(i%palette.length===0)shuffle(palette,random)
          colors[indices[i].index]=palette[i%palette.length]
          // Native jitter is ±.1 in world units; LiveStage is scaled 1.3888889.
          offsets[indices[i].index]=(random()*.2-.1)/1.3888889
        }
      }
    }
  }
  return {key:`${event.prefab}:${event.id}`,id:event.id,prefab,colors,offsets,
    x:0,y:0,scale:1,depth:null,time:event.time,speed:1,clipName:'Beat1',
    phases:prefab.actors.map(()=>0),palette:null,colorMode:null,unresolvedColor:false}
}
function applyColors(state,event,registration,random,worldX) {
  if(event.command==='Penlight') {
    const color=penlightColor(event.color)
    if(color)state.colors=state.colors.map(()=>color)
    return // Invalid/empty native HTML color changes sorting only.
  }
  const colors=event.colors.map(c=>penlightColor(c,registration.idolColors)).filter(Boolean)
  if(!colors.length) {state.unresolvedColor=true;return}
  state.unresolvedColor=false
  const signature=JSON.stringify(colors)
  if(state.palette===signature && state.colorMode===event.colorMode)return
  let actors=[...state.prefab.actors]
  if(event.colorMode===1)shuffle(actors,random)
  else if(event.colorMode===2)actors.sort((a,b)=>worldX[a.index]-worldX[b.index] || a.index-b.index)
  else {state.unresolvedColor=true;return}
  for(let i=0;i<actors.length;i++) {
    const index=event.colorMode===1?i%colors.length:Math.floor(i/(actors.length/colors.length))
    state.colors[actors[i].index]=colors[index%colors.length]
  }
  state.palette=signature;state.colorMode=event.colorMode
}
export function penlightsAt(events, time, model, registration={}) {
  const prefabs=compilePenlightModel(model),states=new Map(),randoms=new Map(),poses=new Map()
  const spatialTimes=new Set((events || []).filter(event=>!event.erase && event.command!=='Penlight' && event.colorMode===2)
    .map(event=>`${event.prefab}:${event.id}:${event.time}`))
  for(const event of events || []) {
    if(event.time>time)break
    const prefab=prefabs.get(event.prefab)
    if(!prefab)continue
    const key=`${event.prefab}:${event.id}`
    if(!randoms.has(key))randoms.set(key,seeded(`${registration.seed || ''}:${key}`))
    const random=randoms.get(key)
    let state=states.get(key)
    const created=!state
    if(created) {state=initialState(event,prefab,registration,random);states.set(key,state)}
    // Animator.Play requests a state change without an explicit Animator.Update
    // in the native executor. Preserve the incoming pose for every command at
    // this timestamp rather than immediately sorting by the newly chosen clip.
    // Sampling at the command clock approximates the last native animation frame;
    // native frame scheduling still requires footage/device comparison.
    if(spatialTimes.has(`${key}:${event.time}`) && poses.get(key)?.time!==event.time)poses.set(key,{time:event.time,
      x:prefab.actors.map(actor=>(created?actor.world:penlightActorMatrix(actor,state,event.time)).tx)})
    if(event.erase) {
      state.colors=prefab.actors.map(actor=>[...actor.initialColor])
      continue // Native ResetColor preserves animation, transforms and palette cache.
    }
    const family=[['Beat1','Beat2','Beat3'],['Wiper1','Wiper2','Wiper3','Wiper4'],['Yeah1','Yeah2','Yeah3']][clamp(event.animationType-1,0,2)]
    state.clipName=family[event.animationId===0?Math.floor(random()*family.length):clamp(event.animationId-1,0,family.length-1)]
    state.phases=prefab.actors.map(()=>random()*.1)
    state.time=event.time;state.speed=event.speed
    state.x=event.x;state.y=event.y;state.scale=event.scale;state.depth=event.depth
    // SetTransform runs before the native world-X selector. Translation is
    // common to all actors; signed scale reverses order and zero scale ties it.
    const worldX=event.colorMode===2?poses.get(key).x.map(x=>x*event.scale):null
    applyColors(state,event,registration,random,worldX)
  }
  return [...states.values()]
}
export function createPenlightSampler(events, model, registration={}) {
  let last=-2,states=[]
  return time => {
    let low=0,high=events.length
    while(low<high) {const middle=(low+high)>>>1;if(events[middle].time<=time)low=middle+1;else high=middle}
    const index=low-1
    if(index!==last) {states=penlightsAt(events,time,model,registration);last=index}
    return states
  }
}
export function penlightActorMatrix(actor, state, time) {
  const controller=state.prefab.model.controllers[actor.controllerKey]
  const binding=controller.states.find(s=>s.name===state.clipName)
  if(!binding)throw Error('Missing native Penlight Animator state')
  const clip=state.prefab.model.clips[`${binding.clip.serializedFile}:${binding.clip.pathId}`]
  const phase=state.phases[actor.index]*clip.duration+(time-state.time)/1000*state.speed*binding.stateSpeed
  const seconds=clip.loop?mod(phase,clip.duration):clamp(phase,0,clip.duration)
  const pose=Object.fromEntries(clip.curves.map(curve=>[curve.channel,sampleStreamedCurve(curve,seconds)]))
  const value=compose(actor.parentWorld,matrix(actor.node,pose))
  return {...value,ty:value.ty+state.offsets[actor.index]}
}
export function penlightMeshInput(sprite, texture) {
  const t=sprite.uvTransform
  return {vertices:new Float32Array(sprite.positions.flatMap(p=>p.slice(0,2))),
    uvs:new Float32Array(sprite.positions.flatMap(p=>[(p[0]*t.x+t.y)/texture.width,1-(p[1]*t.z+t.w)/texture.height])),
    indices:new Uint16Array(sprite.indices)}
}
export function penlightScreenMatrix(native, state, width, height, environmentScale=1) {
  const layout=nativeLightScreenLayout({x:state.x,y:state.y,scaleX:state.scale*100,scaleY:state.scale*100,angle:0},width,height,environmentScale)
  return {a:layout.scaleX*native.a,b:-layout.scaleY*native.b,c:layout.scaleX*native.c,d:-layout.scaleY*native.d,
    tx:layout.x+layout.scaleX*native.tx,ty:layout.y-layout.scaleY*native.ty}
}
