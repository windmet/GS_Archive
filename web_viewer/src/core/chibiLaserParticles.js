import { sampleParticleCurve } from './chibiParticleTimeline.js'
import { sampleFloorGradient } from './chibiFloorParticles.js'
import { sampleStreamedCurve } from './chibiNativeAnimation.js'

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
  const elapsed = (milliseconds - state.eventTime) / Math.max(1, Number(state.sweepDuration) || 1000) * model.defaultDuration
  if (elapsed < 0) return []
  return model.systems.flatMap((s, systemIndex) => {
    const life = sampleParticleCurve(s.lifetime, 0), local = elapsed - s.delay
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
        // CSV/director alignment and 2D projection are recording-guided.
        // Style 7's Y-axis mirror reverses fan rotation, not beam direction.
        // World-space turning particles retain the Animator angle at birth.
        const animated = s.animation ? sampleStreamedCurve(s.animation.curve,
          (born*s.animation.speed)%s.animation.duration)*Math.PI/180 : 0
        const angle = (s.mirrored ? -1 : 1) * (s.angle + angular + animated)
        const color = [16,8,0].reduce((tint,shift,i) => tint | (Math.round(
          (Number.parseInt(String(state.color || '#ffffff').slice(1),16) >> shift & 255)
          * s.color[['r','g','b'][i]]) << shift), 0)
        for (let n = 0; n < burst.count; n++) samples.push({ systemIndex, born, n,
          alpha: sampleFloorGradient(s.alpha, fraction) * s.color.a * state.alpha,
          width: sampleParticleCurve(s.width,0) * 100 * Number(state.width) / 1000
            * (s.sizeX ? sampleParticleCurve(s.sizeX,fraction) : 1),
          length: sampleParticleCurve(s.length,0) * 100 * Number(state.length) / 1000
            * (s.sizeY ? sampleParticleCurve(s.sizeY,fraction) : 1),
          rotation: (Number(state.style) === 7 ? 0 : Math.PI/2)
            - Number(state.angle) * Math.PI/180 - angle,
          color, asset: s.asset, anchorX: s.anchorX, anchorY: s.anchorY })
      }
    }
    return samples.slice(-s.capacity)
  })
}

export function laserParticleLayout(state, width, height, environmentScale = 1) {
  const fit = Math.min(width/1280,height/720) * environmentScale
  return { x: width/2 - Number(state.x)*fit, y: height/2 + (360-Number(state.y))*fit, fit }
}
