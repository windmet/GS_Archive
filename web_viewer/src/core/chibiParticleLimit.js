import { sampleParticleCurve } from './chibiParticleTimeline.js'

export const LIFETIME_LIMIT_PROFILE='native-lifetime-magnitude-v1'
// The scalar distance cache below is force-free. ClampVelocity damps the
// magnitude without changing direction; acceleration must be applied first.
export function stepLifetimeLimit(speed,limit,phase,dt) {
  if(limit.profile!==LIFETIME_LIMIT_PROFILE)throw Error('Unbound lifetime velocity limit')
  const maximum=Math.max(0,sampleParticleCurve(limit.curve,Math.max(0,Math.min(.99999,phase))))
  return speed>maximum?speed+(maximum-speed)*(1-Math.pow(1-limit.dampen,dt*30)):speed
}

// Native module order: gravity, magnitude limit, then position integration.
// Supply acceleration in the particle simulation space; source binding and
// world/local conversion belong to the caller, not this bounded step kernel.
export function stepLifetimeLimitMotion(state,gravity,limit,phase,dt) {
  const velocity={x:state.velocity.x+gravity.x*dt,y:state.velocity.y+gravity.y*dt,z:state.velocity.z+gravity.z*dt}
  const speed=Math.hypot(velocity.x,velocity.y,velocity.z)
  const limited=stepLifetimeLimit(speed,limit,phase,dt)
  if(speed>0&&limited!==speed){
    const ratio=limited/speed
    velocity.x*=ratio;velocity.y*=ratio;velocity.z*=ratio
  }
  return {velocity,position:{x:state.position.x+velocity.x*dt,y:state.position.y+velocity.y*dt,z:state.position.z+velocity.z*dt}}
}

const integrals=new WeakMap()
export function sampleLifetimeLimitDistance(speed,limit,age,life) {
  if(age<=0)return 0
  if(limit.profile!==LIFETIME_LIMIT_PROFILE)throw Error('Unbound lifetime velocity limit')
  let entries=integrals.get(limit)
  if(!entries){entries=new Map();integrals.set(limit,entries)}
  const key=`${speed}:${life}`
  let state=entries.get(key)
  if(!state){
    if(entries.size>=256)entries.delete(entries.keys().next().value)
    state={velocities:[speed],distances:[0]};entries.set(key,state)
  }
  const steps=Math.floor(age*60+1e-9)
  while(state.distances.length<=steps){
    const i=state.distances.length,v=stepLifetimeLimit(state.velocities[i-1],limit,i/60/life,1/60)
    state.velocities.push(v);state.distances.push(state.distances[i-1]+v/60)
  }
  const dt=Math.max(0,age-steps/60)
  return state.distances[steps]+(dt?stepLifetimeLimit(state.velocities[steps],limit,age/life,dt)*dt:0)
}
