import { sampleParticleCurve } from './chibiParticleTimeline.js'
import { sampleFloorGradient } from './chibiFloorParticles.js'

// Recording-calibrated projection for the native wide-beam/pool pair. The
// five opening Not Alone references show the C-group pools across roughly
// 10–85% of the stage, while the old .5 X scale clustered them at 27–69%.
// Preserve the director width changes and transform both atlas frames alike.
// This is a bounded 2D correction, not a recovered Unity director function.
export function spotbeamParticleScale(state) {
  return { x: Number(state.width)/1000*1.8, y: Number(state.length)/1000 }
}

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
