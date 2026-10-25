import hitEffectsConfig from '../../config/song-hit-effects.v1.json' with { type: 'json' }
import geometry from '../../config/song-track-native-geometry.v1.json' with { type: 'json' }
import { rotateParticleEuler as euler, particleRuntimeScale, projectParticlePoint, projectParticleQuad } from './SongChartHitProjection.js'
export { hitEffectsConfig }

const clamp = x => Math.max(0, Math.min(1, x))
const mix = (a, b, t) => a + (b - a) * t
const mod = (a, b) => ((a % b) + b) % b
const WHITE = { r: 1, g: 1, b: 1, a: 1 }
const DEFAULT_IDS = [14650, 37973, 19171, 34995, 32265, 11316, 15053]
const textureSizes = Object.fromEntries(Object.values(hitEffectsConfig.assets).map(a => [a.pathId, a]))

// Authored unweighted Hermite curves, plus weighted Bezier handles when present.
export function evaluateNativeCurve(curve, time, component) {
  const keys = curve?.m_Curve ?? curve ?? []
  if (!keys.length) return 0
  const val = (key, field) => component ? key[field]?.[component] : key[field]
  if (time <= keys[0].time) return val(keys[0], 'value')
  if (time >= keys.at(-1).time) return val(keys.at(-1), 'value')
  const i = keys.findIndex(k => k.time > time), a = keys[i - 1], b = keys[i]
  const duration = b.time - a.time, t = (time - a.time) / duration
  const y0 = val(a, 'value'), y1 = val(b, 'value')
  const m0 = val(a, 'outSlope'), m1 = val(b, 'inSlope')
  if (!Number.isFinite(m0) || !Number.isFinite(m1)) return y0
  const bezier = (p0, p1, p2, p3, u) => (1-u)**3*p0 + 3*(1-u)**2*u*p1 + 3*(1-u)*u*u*p2 + u**3*p3
  if ((a.weightedMode & 2) || (b.weightedMode & 1)) {
    const w0 = (a.weightedMode & 2) ? val(a, 'outWeight') : 1/3
    const w1 = (b.weightedMode & 1) ? val(b, 'inWeight') : 1/3
    let lo = 0, hi = 1
    for (let n = 0; n < 24; n++) {
      const u = (lo + hi) / 2
      if (bezier(0, w0, 1-w1, 1, u) < t) lo = u; else hi = u
    }
    return bezier(y0, y0+m0*duration*w0, y1-m1*duration*w1, y1, (lo+hi)/2)
  }
  return (2*t**3-3*t*t+1)*y0 + (t**3-2*t*t+t)*duration*m0
    + (-2*t**3+3*t*t)*y1 + (t**3-t*t)*duration*m1
}
export function sampleMinMax(value, time = 0, random = .5) {
  if (!value) return 0
  switch (value.minMaxState) {
    case 1: return value.scalar * evaluateNativeCurve(value.maxCurve, time)
    case 2: return value.scalar * mix(evaluateNativeCurve(value.minCurve, time), evaluateNativeCurve(value.maxCurve, time), random)
    case 3: return mix(value.minScalar, value.scalar, random)
    default: return value.scalar ?? 0
  }
}
const gradientCache = new WeakMap()
function gradient(g, t) {
  let channels = gradientCache.get(g)
  if (!channels) {
    channels = Object.fromEntries(['r','g','b','a'].map(channel => {
      const alpha = channel === 'a', prefix = alpha ? 'atime' : 'ctime'
      const count = alpha ? g.m_NumAlphaKeys : g.m_NumColorKeys
      return [channel, Array.from({length:count},(_,i)=>({t:g[prefix+i]/65535,v:g['key'+i][channel]})).sort((a,b)=>a.t-b.t)]
    }))
    gradientCache.set(g, channels)
  }
  const sample = (prefix, count, channel) => {
    const keys = channels[channel]
    if (!keys.length) return 1
    if (t <= keys[0].t) return keys[0].v
    const end = keys.findIndex(k=>k.t>t)
    if (end < 0) return keys.at(-1).v
    const a=keys[end-1],b=keys[end]
    return g.m_Mode === 1 ? a.v : mix(a.v,b.v,(t-a.t)/(b.t-a.t))
  }
  return {r:sample('ctime',g.m_NumColorKeys,'r'),g:sample('ctime',g.m_NumColorKeys,'g'),b:sample('ctime',g.m_NumColorKeys,'b'),a:sample('atime',g.m_NumAlphaKeys,'a')}
}
export function sampleNativeColor(value, time, random = .5) {
  if (!value) return WHITE
  if (value.minMaxState === 0) return value.maxColor
  if (value.minMaxState === 1) return gradient(value.maxGradient,time)
  if (value.minMaxState === 4) return gradient(value.maxGradient,random)
  const a = value.minMaxState === 3 ? value.minColor : gradient(value.minGradient,time)
  const b = value.minMaxState === 3 ? value.maxColor : gradient(value.maxGradient,time)
  return Object.fromEntries(['r','g','b','a'].map(k=>[k,mix(a[k],b[k],random)]))
}
function rng(seed, channel) {
  let x = (seed ^ Math.imul(channel+1, 0x9e3779b9)) >>> 0
  x = Math.imul(x ^ x>>>16, 0x21f0aaad); x = Math.imul(x ^ x>>>15, 0x735a2d97)
  return ((x ^ x>>>15) >>> 0) / 4294967296
}
function seedFor(event, node, ordinal) {
  let h = node | 0
  for (const c of String(event.eventId ?? event.sourceIndex ?? 0)) h = Math.imul(h ^ c.charCodeAt(0),16777619)
  return h ^ Math.imul(ordinal+1, 73856093)
}
function rotate(v, q) {
  if (!q) return v
  const u = [q.x,q.y,q.z], w=q.w
  const c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
  const d=[u[1]*c[2]-u[2]*c[1],u[2]*c[0]-u[0]*c[2],u[0]*c[1]-u[1]*c[0]]
  return v.map((x,i)=>x+2*(w*c[i]+d[i]))
}
function shapeBirth(shape, seed) {
  if (!shape) return {position:[0,0,0],direction:[0,0,0]}
  const angle=rng(seed,1)*(shape.arc?.value ?? 360)*Math.PI/180
  const z=2*rng(seed,2)-1, rxy=Math.sqrt(1-z*z)
  let direction=[rxy*Math.cos(angle),rxy*Math.sin(angle),z], position
  if (shape.type===0) {
    const inner=1-(shape.radiusThickness??1), radius=(shape.radius?.value??1)*Math.cbrt(mix(inner**3,1,rng(seed,3)))
    position=direction.map(x=>x*radius)
  } else if (shape.type===5 || shape.type===16) {
    position=[rng(seed,3)-.5,rng(seed,4)-.5,rng(seed,5)-.5]
    if (shape.type===16) {const axis=Math.floor(rng(seed,6)*3);position=position.map((v,i)=>i===axis?v:(v<0?-.5:.5))}
    direction=[0,0,1]
  } else throw Error('Unsupported native particle shape '+shape.type)
  const scale=shape.m_Scale, rotation=shape.m_Rotation, offset=shape.m_Position
  position=position.map((v,i)=>v*(scale?.[['x','y','z'][i]]??1))
  const rot=v=>euler(v,(rotation?.x??0)*Math.PI/180,(rotation?.y??0)*Math.PI/180,(rotation?.z??0)*Math.PI/180)
  return {position:rot(position).map((v,i)=>v+(offset?.[['x','y','z'][i]]??0)),direction:rot(direction)}
}
const trajectoryCache = new WeakMap()
function sampleMotion(layer, age, lifetime, seed, birth) {
  const m=layer.modules, initial=m.InitialModule, shape=shapeBirth(m.ShapeModule,seed)
  const velocity=shape.direction.map(v=>v*sampleMinMax(initial.startSpeed,birth,rng(seed,7)))
  const position=[...shape.position], axes=['x','y','z']
  if (!m.ForceModule && !m.VelocityModule && !m.ClampVelocityModule) {
    return { position: position.map((v,i)=>v+velocity[i]*age), speed: velocity }
  }
  // Fixed 60Hz steps are memoized by source layer/particle birth. Repeated rAF,
  // pause and backward samples reuse the same trajectory, rather than replaying
  // its full lifetime every frame. Keep at most 64 births per source layer.
  let cache = trajectoryCache.get(layer)
  if (!cache) { cache = new Map(); trajectoryCache.set(layer, cache) }
  const key = `${seed}:${birth}:${lifetime}`
  let states = cache.get(key)
  if (!states) {
    states = [{position, velocity, speed:velocity}]
    if (cache.size >= 64) cache.delete(cache.keys().next().value)
    cache.set(key, states)
  } else { cache.delete(key); cache.set(key, states) }
  function step(state, start, dt) {
    const position = [...state.position], velocity = [...state.velocity]
    const t=(start+dt/2)/lifetime, force=m.ForceModule, vel=m.VelocityModule, limit=m.ClampVelocityModule
    if(force) for(let i=0;i<3;i++) velocity[i]+=sampleMinMax(force[axes[i]],t,rng(seed,20+i))*dt
    let extra=axes.map((axis,i)=>vel?sampleMinMax(vel[axis],t,rng(seed,30+i)):0)
    if(vel?.inWorldSpace) extra=rotate(extra,{...layer.transform.m_LocalRotation,x:-layer.transform.m_LocalRotation.x,y:-layer.transform.m_LocalRotation.y,z:-layer.transform.m_LocalRotation.z})
    let speed=velocity.map((v,i)=>(v+extra[i])*(vel?sampleMinMax(vel.speedModifier,t,rng(seed,34)):1))
    if(limit) {
      const damp=1-(1-clamp(limit.dampen))**(dt*60)
      if(limit.separateAxis) speed=speed.map((v,i)=>{const max=sampleMinMax(limit[axes[i]],t,rng(seed,40+i));return Math.sign(v)*mix(Math.abs(v),Math.min(Math.abs(v),max),damp)})
      else {const magnitude=Math.hypot(...speed),max=sampleMinMax(limit.magnitude,t,rng(seed,40));if(magnitude>max) speed=speed.map(v=>v*mix(1,max/magnitude,damp))}
      // Retain the limited base velocity for the next integration step.
      for(let i=0;i<3;i++) velocity[i]=speed[i]-extra[i]
    }
    for(let i=0;i<3;i++) position[i]+=speed[i]*dt
    return {position,velocity,speed}
  }
  const whole=Math.floor(age*60), remainder=age-whole/60
  while(states.length<=whole) states.push(step(states.at(-1),(states.length-1)/60,1/60))
  return remainder>1e-10?step(states[whole],whole/60,remainder):states[whole]
}
function births(layer, age) {
  const result=[]
  for (const [index,burst] of layer.bursts.entries()) if(burst.time<=age)
    for(let j=0;j<burst.count;j++) result.push({time:burst.time,ordinal:index*65536+j})
  const rate=layer.rateOverTime
  if(rate>0) {
    const life=layer.lifetime, first=Math.max(1,Math.floor((age-life)*rate)+1), last=Math.floor((age+1e-8)*rate)
    for(let j=first;j<=last;j++) if(layer.looping || j/rate<layer.duration) result.push({time:j/rate,ordinal:j})
  }
  return result
}
function integratedRotation(curve, age, lifetime, random) {
  if (!curve) return 0
  const steps = Math.max(1, Math.ceil(age * 60)), dt = age / steps
  let angle = 0
  for (let i = 0; i < steps; i++) angle += sampleMinMax(curve, (i + .5) * dt / lifetime, random) * dt
  return angle
}
function birthLaneOffset(event, layer, born) {
  if (layer.simulationSpace !== 0 || !event.knots?.length) return 0
  const seconds = event.startSeconds + born / layer.simulationSpeed
  const after = event.knots.findIndex(k => k.seconds > seconds)
  const a = event.knots[after < 0 ? event.knots.length - 1 : Math.max(0, after - 1)]
  const b = event.knots[after]
  const lane = b ? mix(a.lane, b.lane, (seconds - a.seconds) / (b.seconds - a.seconds)) : a.lane
  return (lane - event.lane) * (geometry.target.rightX - geometry.target.leftX) / 4 * geometry.target.laneWidthRate
}
function sampleContract(event, age, contract) {
  if(!event || !contract || age<0) return []
  const instructions=[], held=contract.field==='_hold'
  const lane=held ? (event.lane??2) : (event.targetLane??Math.round(event.lane??2))
  const runtimeScale=particleRuntimeScale(held,event.noteScale??1)
  for(const layer of contract.layers) {
    const m=layer.modules, initial=m?.InitialModule
    if(!initial) continue
    const elapsed=age*layer.simulationSpeed
    for(const born of births(layer,elapsed)) {
      const seed=seedFor(event,layer.nodeId,born.ordinal), random=n=>rng(seed,n)
      const lifetime=initial.startLifetime.minMaxState===0 ? layer.lifetime : sampleMinMax(initial.startLifetime,born.time,random(8))
      const particleAge=elapsed-born.time
      if(particleAge<0 || particleAge>=lifetime) continue
      const p=particleAge/lifetime, startColor=sampleNativeColor(initial.startColor,0,random(9)), color=sampleNativeColor(m.ColorModule?.gradient,p,random(10))
      const tint=Object.fromEntries(['r','g','b','a'].map(k=>[k,startColor[k]*color[k]]))
      const size=initial.startSize.minMaxState===0 ? layer.size : sampleMinMax(initial.startSize,born.time,random(11))
      const sx=size*(m.SizeModule?sampleMinMax(m.SizeModule.curve,p,random(12)):1)
      const sy=(initial.size3D?sampleMinMax(initial.startSizeY,born.time,random(13)):size)*(m.SizeModule?sampleMinMax(m.SizeModule.separateAxes?m.SizeModule.y:m.SizeModule.curve,p,random(12)):1)
      const rotation=m.RotationModule
      const rx=(initial.rotation3D?sampleMinMax(initial.startRotationX,born.time,random(14)):0)
        + integratedRotation(rotation?.separateAxes?rotation.x:null,particleAge,lifetime,random(44))
      const ry=(initial.rotation3D?sampleMinMax(initial.startRotationY,born.time,random(15)):0)
        + integratedRotation(rotation?.separateAxes?rotation.y:null,particleAge,lifetime,random(45))
      const rz=sampleMinMax(initial.startRotation,born.time,random(16))
        + integratedRotation(rotation?.curve,particleAge,lifetime,random(46))
      const motion=sampleMotion(layer,particleAge,lifetime,seed,born.time), trs=layer.transform
      const ls=trs.m_LocalScale
      // Initialize/Play and FloatingTarget.Init reset the prefab root TRS.
      // The serialized .65 scale is not the live root scale.
      const world=v=>rotate(v.map((v,i)=>v*ls[['x','y','z'][i]]),layer.rotation).map((v,i)=>
        (v+trs.m_LocalPosition[['x','y','z'][i]])*runtimeScale)
      const center=world(motion.position), origin=world([0,0,0])
      const axis=v=>{
        const billboard=euler(v,rx,ry,rz)
        // Billboard vertices face the camera (-Z); emitter positions use +Z.
        // View-aligned quads do not inherit the emitter's X/Y rotation (e.g.
        // flick glitter's -90deg emitter would otherwise turn every star edge-on).
        billboard[2]*=-1
        if(layer.renderer.m_RenderAlignment===0) return billboard.map((v,i)=>v*ls[['x','y','z'][i]]*runtimeScale)
        return world(billboard).map((v,i)=>v-origin[i])
      }
      let x=axis([sx,0,0]),y=axis([0,sy,0])
      if(layer.renderMode===1) {
        const speed=Math.hypot(...motion.speed), stretch=sx*layer.lengthScale+speed*layer.renderer.m_VelocityScale
        const angle=Math.atan2(motion.speed[1],motion.speed[0])
        x=axis([Math.cos(angle)*stretch,Math.sin(angle)*stretch,0]);y=axis([-Math.sin(angle)*sy,Math.cos(angle)*sy,0])
      }
      const sheet=m.UVModule, nx=layer.uv.tilesX,ny=layer.uv.tilesY,total=nx*ny
      const progress=sheet?sampleMinMax(sheet.frameOverTime,p,random(17))*(sheet.cycles??1):0
      const frame=mod(Math.floor(mod(layer.uv.startFrame+progress,1)*total),total)
      const texture=textureSizes[layer.texture.pathId],sw=texture.width/nx,sh=texture.height/ny
      const pixelOffset=birthLaneOffset(event,layer,born.time)
      const quad=projectParticleQuad(center,x,y,lane,held,pixelOffset)
      const originScreen=projectParticlePoint([0,0,0],lane,held)
      const projectedCenter=projectParticlePoint(center,lane,held,pixelOffset)
      const basis=[quad[1].x-quad[0].x,quad[1].y-quad[0].y,quad[2].x-quad[0].x,quad[2].y-quad[0].y]
      instructions.push({textureId:layer.texture.pathId,nodeId:layer.nodeId,subName:layer.subName,particleId:born.ordinal,birthTime:born.time,
        sx:frame%nx*sw,sy:Math.floor(frame/nx)*sh,sw,sh,frame,quad,
        dx:projectedCenter.x-originScreen.x,dy:projectedCenter.y-originScreen.y,
        basis,w:Math.hypot(basis[0],basis[1]),h:Math.hypot(basis[2],basis[3]),
        rotation:-rz,alpha:clamp(tint.a),colorTint:tint,blendMode:'lighter'})
    }
  }
  return instructions
}
export function sampleHitEffectFrame(hit, age, contracts=hitEffectsConfig.defaultContracts) {
  return sampleContract(hit,age,contracts?.[hit?.pathId??DEFAULT_IDS[hit?.hitType??0]])
}
export function sampleHoldEffectFrame(hold, age, contracts=hitEffectsConfig.defaultContracts) {
  return sampleContract(hold,age,contracts?.[hold?.pathId??32265])
}
export function sampleAutoEvaluationFrame(age, animData=hitEffectsConfig.evaluation.animation) {
  if(age<0 || age>=animData.duration) return null
  const curves=animData.sourceCurves
  const layers=[]
  for(const target of ['EvaluationImage','EvaluationEffectImage','EvaluationEffectImage2']) {
    const scale=curves.scale.find(c=>c.path===target)
    const sample=(attribute, fallback)=>{const c=curves.float.find(c=>c.path===target&&c.attribute===attribute);return c?evaluateNativeCurve(c.curve,age):fallback}
    const alpha=sample('m_Color.a',1)
    if(sample('m_IsActive',1)<.5 || alpha<=.001) continue
    const binding=hitEffectsConfig.evaluation.bindings[target]
    const parentPosition=hitEffectsConfig.evaluation.panel.rectTransform.m_AnchoredPosition
    const position=binding.rectTransform.m_AnchoredPosition
    layers.push({target,spriteId:2068,scaleX:evaluateNativeCurve(scale.curve,age,'x'),scaleY:evaluateNativeCurve(scale.curve,age,'y'),alpha,
      x:geometry.viewport.width/2+parentPosition.x+position.x,y:geometry.viewport.height/2-parentPosition.y-position.y,
      colorTint:{r:sample('m_Color.r',binding.color.r),g:sample('m_Color.g',binding.color.g),b:sample('m_Color.b',binding.color.b)},
      blendMode:binding.blend?.srcBlend.val===5&&binding.blend?.destBlend.val===1?'lighter':'source-over'})
  }
  return {age,layers}
}
