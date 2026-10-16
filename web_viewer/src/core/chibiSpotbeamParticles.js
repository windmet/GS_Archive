import { sampleParticleCurve } from './chibiParticleTimeline.js'
import { sampleFloorGradient } from './chibiFloorParticles.js'

import { laserSimulationClock, laserBillboardPlane, nativeLaserAlpha, nativeLaserScale } from './chibiLaserGeometry.js'

export const spotbeamParticleScale = nativeLaserScale

export function sampleSpotbeamParticles(model,state,milliseconds) {
  if(milliseconds<state.eventTime) return []
  return model.systems.flatMap((s,systemIndex)=>{
    const clock=laserSimulationClock(s,state,milliseconds)
    if(!Number.isFinite(clock.elapsed))return []
    const life=sampleParticleCurve(s.lifetime,0),local=clock.elapsed-s.delay,samples=[]
    const plane=laserBillboardPlane(s,model,state,milliseconds,sampleParticleCurve(s.rotation,0))
    for(let cycle=Math.max(0,Math.floor((local-life)/s.period));cycle<=Math.floor(local/s.period);cycle++) {
      for(const burst of s.bursts) {
        const age=local-cycle*s.period-burst.time
        if(age<0||age>=life)continue
        for(let n=0;n<burst.count;n++)samples.push({systemIndex,n,frame:s.frame,
          x:plane.x,y:plane.y,matrix:plane,
          alpha:sampleFloorGradient(s.alpha,age/life)*nativeLaserAlpha(state),
          width:sampleParticleCurve(s.size,0)*100,
          length:sampleParticleCurve(s.size,0)*100,
          rotation:Math.atan2(plane.b,plane.a),
          color:Number.parseInt(String(state.color).replace('#',''),16),
          anchorX:s.anchorX,anchorY:s.anchorY})
      }
    }
    return samples.slice(-s.capacity)
  })
}
