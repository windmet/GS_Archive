import binding from '../data/chibiSmokeBinding.json' with {type:'json'}
import {stepLifetimeLimitMotion} from './chibiParticleLimit.js'

const admitted=new WeakSet(),motion=new WeakMap()
export function assertSmokeSystem(system) {
  if(admitted.has(system))return
  const source=binding.systems[system.source?.pathId]
  if(system.smokeBinding!==binding.profile || !source || JSON.stringify(source.source)!==JSON.stringify(system.source)
    || JSON.stringify(source.chain)!==JSON.stringify(system.chain) || JSON.stringify(source.bounds)!==JSON.stringify(system.rendererBounds)
    || system.alignment!==1 || system.shape?.type!==12 || system.noise || system.velocity || system.rotationX)
    throw Error('Unbound Smoke source system')
  admitted.add(system)
}
// Reversible Web 60 Hz preview. Native kernels establish the module order;
// these are Web seeds and steps, not a reconstruction of the device clock.
export function smokeMotionAt(system,id,initial,gravity,age,life) {
  assertSmokeSystem(system)
  if(!system.limit)return {x:initial.position.x+initial.velocity.x*age,y:initial.position.y+initial.velocity.y*age,z:initial.position.z+initial.velocity.z*age}
  let entries=motion.get(system)
  if(!entries){entries=new Map();motion.set(system,entries)}
  const steps=Math.floor(age*60+1e-9)
  let cached=entries.get(id)
  if(!cached || cached.step>steps){cached={step:0,state:initial};entries.set(id,cached)}
  // Retain only the current grid state per particle; long playback does not
  // accumulate a position object for every historical simulation step.
  while(entries.size>system.capacity*2)entries.delete(entries.keys().next().value)
  for(;cached.step<steps;cached.step++)cached.state=stepLifetimeLimitMotion(cached.state,gravity,system.limit,(cached.step+1)/60/life,1/60)
  const dt=Math.max(0,age-steps/60)
  return (dt?stepLifetimeLimitMotion(cached.state,gravity,system.limit,age/life,dt):cached.state).position
}
export const SMOKE_BINDING=binding
