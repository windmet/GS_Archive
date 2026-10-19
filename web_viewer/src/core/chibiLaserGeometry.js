import geometry from './chibiLaserGeometry.json' with { type: 'json' }
import { sampleStreamedCurve } from './chibiNativeAnimation.js'

export const nativeLaserGeometry = geometry
export function laserSimulationClock(system,state,milliseconds) {
  const wall = (milliseconds-state.eventTime)/1000
  const duration = Math.fround(Number(state.sweepDuration)/1000)
  const speed = Math.fround(system.period/duration)
  return {wall,speed,elapsed:wall*speed}
}
const mul = (l,r) => ({a:l.a*r.a+l.c*r.b,b:l.b*r.a+l.d*r.b,
  c:l.a*r.c+l.c*r.d,d:l.b*r.c+l.d*r.d,
  tx:l.a*r.tx+l.c*r.ty+l.tx,ty:l.b*r.tx+l.d*r.ty+l.ty})
const rotation = a => ({a:Math.cos(a),b:Math.sin(a),c:-Math.sin(a),d:Math.cos(a),tx:0,ty:0})

export function laserBillboardPlane(system,model,state,milliseconds,particleRotation) {
  const source=geometry.systems[`${system.source.serializedFile}:${system.source.pathId}`]
  if(!source || source.parameterTreeSha256!==system.source.parameterTreeSha256 || source.style!==Number(state.style))
    throw new Error('Unbound native laser particle plane')
  let local={a:1,b:0,c:0,d:1,tx:0,ty:0}
  for(const [i,t] of source.chain.entries()) {
    let q=t.rotation
    if(i===source.animationIndex) {
      // Local render alignment follows the current emitter Transform, even
      // with world-space particle positions. Animator has its own clock.
      const speed=Math.fround(model.defaultDuration/Math.fround(Number(state.sweepDuration)/1000))
      const phase=(milliseconds-state.eventTime)/1000*speed*system.animation.speed%system.animation.duration
      const angle=sampleStreamedCurve(system.animation.curve,phase)*Math.PI/180
      q={x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)}
    }
    const {x,y,z,w}=q
    local=mul(local,{a:(1-2*(y*y+z*z))*t.scale.x,b:2*(x*y+w*z)*t.scale.x,
      c:2*(x*y-w*z)*t.scale.y,d:(1-2*(x*x+z*z))*t.scale.y,
      tx:t.position.x*100,ty:t.position.y*100})
  }
  const outer=mul(rotation(Number(state.angle)*Math.PI/180),
    {a:1,b:0,c:0,d:state.direction==='right'?1:-1,tx:0,ty:0})
  const frame=mul(outer,local)
  // Particle rotation uses the billboard's clockwise convention. Conversion
  // to screen includes both Y reflections, preserving texture handedness.
  const oriented=mul(frame,rotation(-particleRotation))
  return {a:oriented.a,b:-oriented.b,c:-oriented.c,d:oriented.d,
    x:frame.tx,y:-frame.ty}
}

export function nativeLaserScale(state) {
  const scale=Math.fround(Number(state.length)/1000)
  return {x:scale,y:scale}
}
// Particle.m_StartColor is Color32: the birth colour cannot retain alpha>1.
// Lifetime modulation follows that bounded start colour. Byte quantization
// within 0..1 remains part of the deferred native particle solver boundary.
export function nativeLaserAlpha(state) {
  return Math.max(0,Math.min(1,Math.fround(Number(state.width)/1000)))*state.alpha
}
