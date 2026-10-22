import { sampleParticleCurve } from './chibiParticleTimeline.js'

export const LIFETIME_LIMIT_PROFILE='native-lifetime-magnitude-v1'
// This profile is force-free. ClampVelocity damps the magnitude without
// changing direction, so integrating a scalar preserves all three axes.
export function stepLifetimeLimit(speed,limit,phase,dt) {
  if(limit.profile!==LIFETIME_LIMIT_PROFILE)throw Error('Unbound lifetime velocity limit')
  const maximum=Math.max(0,sampleParticleCurve(limit.curve,Math.max(0,Math.min(.99999,phase))))
  return speed>maximum?speed+(maximum-speed)*(1-Math.pow(1-limit.dampen,dt*30)):speed
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
