import { sampleParticleCurve } from './chibiParticleTimeline.js'
import { sampleFloorGradient } from './chibiFloorParticles.js'

export function sampleSpotbeamParticles(model,state,milliseconds) {
  const elapsed=(milliseconds-state.eventTime)/Math.max(1,Number(state.sweepDuration)||1000)*model.defaultDuration
  if(elapsed<0) return []
  return model.systems.flatMap((s,systemIndex)=>{
    const life=sampleParticleCurve(s.lifetime,0),local=elapsed-s.delay,samples=[]
    for(let cycle=Math.max(0,Math.floor((local-life)/s.period));cycle<=Math.floor(local/s.period);cycle++) {
      for(const burst of s.bursts) {
        const age=local-cycle*s.period-burst.time
        if(age<0||age>=life)continue
        for(let n=0;n<burst.count;n++)samples.push({systemIndex,n,frame:s.frame,
          x:s.x,y:s.y,
          alpha:sampleFloorGradient(s.alpha,age/life)*state.alpha,
          width:sampleParticleCurve(s.size,0)*100,
          length:sampleParticleCurve(s.size,0)*100,
          rotation:sampleParticleCurve(s.rotation,0),
          color:Number.parseInt(String(state.color).replace('#',''),16),
          anchorX:s.anchorX,anchorY:s.anchorY})
      }
    }
    return samples.slice(-s.capacity)
  })
}
