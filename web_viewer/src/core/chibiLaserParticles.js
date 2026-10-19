import { sampleParticleCurve } from './chibiParticleTimeline.js'
import { sampleFloorGradient } from './chibiFloorParticles.js'
import { laserSimulationClock, laserBillboardPlane, nativeLaserAlpha } from './chibiLaserGeometry.js'

// Integrate unweighted native angular-velocity curves, rather than treating
// their values as absolute rotation angles or inventing a triangular sweep.
export function integrateLaserCurve(curve, time) {
  if (curve.mode === 0) return curve.scalar * time
  let value = 0
  const keys = curve.keys
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i], span = b.time - a.time
    const t = Math.max(0, Math.min(1, (time - a.time) / span))
    const t2 = t*t, t3 = t2*t, t4 = t3*t
    value += span * ((t4/2 - t3 + t) * a.value
      + (t4/4 - 2*t3/3 + t2/2) * span * a.outSlope
      + (-t4/2 + t3) * b.value + (t4/4 - t3/3) * span * b.inSlope)
    if (time <= b.time) break
  }
  return value * curve.scalar
}

export function sampleLaserParticles(model, state, milliseconds) {
  if (milliseconds < state.eventTime) return []
  return model.systems.flatMap((s, systemIndex) => {
    const clock = laserSimulationClock(s,state,milliseconds)
    if (!Number.isFinite(clock.elapsed)) return []
    const life = sampleParticleCurve(s.lifetime, 0), local = clock.elapsed - s.delay
    if (local < 0) return []
    const samples = []
    const first = Math.max(0, Math.floor((local - life) / s.period))
    const last = Math.floor(local / s.period)
    for (let cycle = first; cycle <= last; cycle++) {
      for (const burst of s.bursts) {
        const born = cycle * s.period + burst.time, age = local - born
        if (age < 0 || age >= life) continue
        const fraction = age / life
        const angular = s.angularVelocity ? integrateLaserCurve(s.angularVelocity, fraction) * life : 0
        const plane=laserBillboardPlane(s,model,state,milliseconds,sampleParticleCurve(s.rotation,0)+angular)
        const color=Number.parseInt(String(state.color || '#ffffff').slice(1,7),16)
        for (let n = 0; n < burst.count; n++) samples.push({ systemIndex, born, n,
          alpha: sampleFloorGradient(s.alpha, fraction) * nativeLaserAlpha(state),
          width: sampleParticleCurve(s.width,0) * 100
            * (s.sizeX ? sampleParticleCurve(s.sizeX,fraction) : 1),
          length: sampleParticleCurve(s.length,0) * 100
            * (s.sizeY ? sampleParticleCurve(s.sizeY,fraction) : 1),
          matrix:plane, x:plane.x, y:plane.y, rotation:Math.atan2(plane.b,plane.a),
          color, asset: s.asset, anchorX: s.anchorX, anchorY: s.anchorY })
      }
    }
    return samples.slice(-s.capacity)
  })
}

export function laserParticleLayout(state, width, height, environmentScale = 1) {
  const fit = Math.min(width/1280,height/720) * environmentScale
  return { x: width/2 + Number(state.x)*fit, y: height/2 + (360-Number(state.y))*fit, fit }
}
