import motion from '../../config/song-flick-motion.v1.json' with { type: 'json' }
import { sampleMinMax, sampleNativeColor } from './SongChartHitEffectRenderer.js'
import { rotateParticleEuler } from './SongChartHitProjection.js'
export { motion as songFlickMotion }

export function flickTextureFrame(layer, age) {
  const uv=layer.uv
  const start=sampleMinMax(uv.startFrame),advance=sampleMinMax(uv.frameOverTime,age/layer.lifetime)*(uv.cycles??1)
  return Math.floor((((start+advance)%1+1)%1)*uv.tilesX*uv.tilesY)
}

// Integrate the authored velocity-over-lifetime curve (not a CSS sine/bounce).
// Simpson integrates an unweighted cubic exactly between its source keys.
export function flickDisplacement(curve, age, lifetime) {
  const p = Math.max(0, Math.min(1, age / lifetime))
  const cuts = [0, ...(curve.maxCurve?.m_Curve || []).map(k => k.time).filter(t => t > 0 && t < p), p]
  let distance = 0
  for (let i = 1; i < cuts.length; i++) {
    const a = cuts[i-1], b = cuts[i]
    distance += (b-a) / 6 * (sampleMinMax(curve,a) + 4*sampleMinMax(curve,(a+b)/2) + sampleMinMax(curve,b))
  }
  return distance * lifetime
}

export function songAnimatedFlickHint(role, root, elapsed, seed = 0) {
  const contracts = motion.layers[role]
  if (!contracts) return null
  const layers = []
  for (const l of contracts) {
    const phase = Math.max(0, elapsed) + (l.prewarm ? l.period : 0)
    const cycle = Math.floor(phase/l.period)
    const parent = l.chain[1], child = l.chain[2]
    for (let c = cycle-1; c <= cycle; c++) for (const burst of l.bursts) {
      const age = phase - (c*l.period + burst.time)
      if (c < 0 || age < 0 || age >= l.lifetime) continue
      const gradient = sampleNativeColor(l.gradient,age/l.lifetime)
      for (let i = 0; i < burst.countCurve.scalar; i++) {
        // Source box is only .01 units. Deterministic spawn offsets make seek
        // reproducible; Unity's autoRandomSeed sequence/pool phase is unknown.
        const random = n => { const x=Math.sin(seed*19+l.nodeId*3+i*7+n)*43758.5453; return x-Math.floor(x)-.5 }
        const scale = key => parent.scale[key]*child.scale[key]
        const dx = flickDisplacement(l.velocity.x,age,l.lifetime)
        const dy = flickDisplacement(l.velocity.y,age,l.lifetime)
        const birth=rotateParticleEuler(['x','y','z'].map((axis,i)=>random(i+1)*l.shape.m_Scale[axis]),
          ...['x','y','z'].map(axis=>l.shape.m_Rotation[axis]*Math.PI/180))
        const cx = root.position[0] + (parent.position.x + (dx+birth[0]+l.shape.m_Position.x)*scale('x'))*root.scale[0]
        const cy = root.position[1] + (parent.position.y + (dy+birth[1]+l.shape.m_Position.y)*scale('y'))*root.scale[1]
        const textureFrame=flickTextureFrame(l,age)
        layers.push({ url:l.urls[textureFrame], textureFrame, cx:640+cx, cy:360-cy,
          width:l.size*scale('x')*root.scale[0],height:l.size*scale('y')*root.scale[1],rotation:-l.rotation*180/Math.PI,
          alpha:l.startColor.a*gradient.a,
          sortingOrder:l.sortingOrder, blendMode:l.blend?.dst===1?'lighter':'source-over',
          color:{r:l.startColor.r*gradient.r,g:l.startColor.g*gradient.g,b:l.startColor.b*gradient.b,a:1} })
      }
    }
  }
  return { defaultIndex:motion.defaultIndex,presentation:'native-loop-sampler',layers }
}
