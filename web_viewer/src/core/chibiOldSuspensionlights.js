// Native sidelight sprite and rotation curves. CSV timing, clip selection and
// the legacy director plane are reference-guided, not recovered IL2CPP.
import { sampleStreamedCurve } from './chibiNativeAnimation.js'
const n = (v,i,d=0) => v[i] === '' || v[i] == null ? d : Number(v[i])
export function oldSuspensionlightsAt(events, time, model, registration = {}) {
  const instances = new Map()
  for (const e of events) {
    if (e.time > time) break
    const key = `${e.command}:${e.id}`
    if (e.erase || !e.values[1]) {
      const previous=instances.get(key),duration=Number(e.extraValues?.value102)||0
      if(previous && duration>0) instances.set(key,{...previous,fadeStart:e.time,fadeDuration:duration})
      else instances.delete(key)
      continue
    }
    instances.set(key,e)
  }
  const states=[]
  for (const [key,e] of instances) {
    const m=model?.styles?.[e.command],v=e.values
    if (!m || v[1]!=='1' || v[2]!=='1' || !['left','right'].includes(v[4])) continue
    const age=time-e.time, rotationPeriod=n(v,3), beamScale=n(v,5)/1000, angle=n(v,6)
    if (!(rotationPeriod>0 && beamScale>0 && age>=0) || v.slice(1,11).some(x=>x==='' || x==null)) continue
    const selected=e.command==='Suspensionlight' || n(v,11) ? 'angle60' : 'angle30'
    const clip=m.clips?.[selected]
    if (!clip) continue
    // value6 controls beam extent in the reference. Reusing it as Animator
    // speed both moved fixed lamps and dropped their authored length.
    const offset=e.command==='Suspensionlight_3' || e.command==='Suspensionlight_5' ? n(v,12) : 0
    const stageRig=registration.referenceProjection==='stage-rig-v1'
    // Drive holds its M rig with 99999999, then reissues the same points
    // with 6000 / 5000 before the later explicit erase. This is a rotation
    // period, not a lifetime. Each point advances at its own authored period.
    const phase=(((e.command==='Suspensionlight' ? 0 : .5)+(age-offset)/rotationPeriod*clip.duration)%clip.duration+clip.duration)%clip.duration
    // A bound Animator is not permission to play it. The authored period
    // and numbered variants' separate switches decide whether it advances.
    // These switches are recording-guided until ApplyData is recovered.
    const moving=rotationPeriod<999999 && (e.command==='Suspensionlight'
      || e.command==='Suspensionlight_3'
      || (e.command==='Suspensionlight_2' && n(v,14)===1)
      || (e.command==='Suspensionlight_5' && n(v,13)===1))
    const nativeAngle=moving ? sampleStreamedCurve(clip.curve,phase) : 0
    let alpha=.55
    if (e.command==='Suspensionlight_2' && n(v,11)===1) {
      // Single-colour fade-out/fade-in: time changes intensity, not angle.
      const fade=1000
      alpha=.55*(.5+.5*Math.cos(age/fade*Math.PI))
    }
    if (e.command==='Suspensionlight_3' || e.command==='Suspensionlight_5') {
      const period=n(v,11), delay=n(v,12)
      if (!(period>0)) continue
      const elapsed=age-delay
      alpha=elapsed<0 ? 0 : .55*(.5-.5*Math.cos(elapsed/period*Math.PI*2))
    }
    if(e.fadeStart!=null) {
      alpha*=Math.max(0,1-(time-e.fadeStart)/e.fadeDuration)
      if(time>=e.fadeStart+e.fadeDuration)continue
    }
    // Unsupported multi-color strings stay suppressed. Moon's single-color
    // rows do not require the still-unrecovered SwitchColor/HSV tween bodies.
    if (!/^#[0-9a-f]{6}$/i.test(v[9])) continue
    if (e.command==='Suspensionlight_2' && v[12]
      && v[12].toLowerCase()!==v[9].toLowerCase()) continue
    const extent=Number(selected.slice(5))
    const excursion=moving ? nativeAngle-(e.command==='Suspensionlight' ? 0 : extent/2) : 0
    // The child +60 degree base and LeftRightBase reflection are independent
    // of position. A Y threshold changes the same lamp's angle by 30 degrees
    // and destroys the four authored segments of Drive's M-shaped rig.
    const mount=stageRig || n(v,8)>360 ? (v[4]==='right' ? 300 : 240) : 270
    // The validated stage rig and the offstage side overlay are separate
    // reference registrations. Keep Moon's earlier plane until remeasured.
    const sideOverlay=Math.abs(n(v,7))>=1000 && n(v,8)<0
    const coordinateScale=stageRig && !sideOverlay ? 1 : .5
    const size=stageRig ? beamScale : 1
    states.push({key,model:m,alpha,color:v[9],depth:n(v,10),x:n(v,7),y:n(v,8),
      scaleX:n(v,1)*size,scaleY:n(v,2)*size,coordinateScale,moving,mirror:v[4]==='right',
      angle:angle-mount+(v[4]==='right' ? excursion : -excursion)})
  }
  return states
}
export function oldSuspensionlightLayout(s,width,height,environmentScale=1) {
  const fit=Math.min(width/1280,height/720)*environmentScale
  const coordinateFit=fit*(s.coordinateScale ?? .5)
  return {x:width/2+s.x*coordinateFit,y:height/2+(360-s.y)*coordinateFit,
    // The old director coordinates share the native sprite plane. Halving
    // only positions compressed the M rig and brought offstage lamps inside.
    scaleX:(s.mirror ? -1 : 1)*s.scaleX*fit,scaleY:s.scaleY*fit,
    rotation:-s.angle*Math.PI/180}
}
