// Native sidelight sprite and rotation curves. CSV timing, clip selection and
// the legacy director plane are reference-guided, not recovered IL2CPP.
import { sampleStreamedCurve } from './chibiNativeAnimation.js'
const n = (v,i,d=0) => v[i] === '' || v[i] == null ? d : Number(v[i])
export function oldSuspensionlightsAt(events, time, model) {
  const instances = new Map()
  for (const e of events) {
    if (e.time > time) break
    const key = `${e.command}:${e.id}`
    if (e.erase || !e.values[1]) { instances.delete(key); continue }
    instances.set(key,e)
  }
  const states=[]
  for (const [key,e] of instances) {
    const m=model?.styles?.[e.command],v=e.values
    if (!m || v[1]!=='1' || v[2]!=='1' || !['left','right'].includes(v[4])) continue
    const age=time-e.time, life=n(v,3), speed=n(v,5)/1000, angle=n(v,6)
    if (!(life>0 && speed>0 && age>=0 && age<life) || v.slice(1,11).some(x=>x==='' || x==null)) continue
    const selected=e.command==='Suspensionlight' || n(v,11) ? 'angle60' : 'angle30'
    const clip=m.clips?.[selected]
    if (!clip) continue
    // value6 follows the animation rate in the reference: 125 means a slow
    // building beam, not a 125px sprite. Preserve the full native beam extent.
    const offset=e.command==='Suspensionlight_3' || e.command==='Suspensionlight_5' ? n(v,12) : 0
    const phase=((age-offset)/1000*speed%clip.duration+clip.duration)%clip.duration
    const nativeAngle=sampleStreamedCurve(clip.curve,phase)
    let alpha=.55
    if (e.command==='Suspensionlight_3' || e.command==='Suspensionlight_5') {
      const period=n(v,11), delay=n(v,12)
      if (!(period>0)) continue
      const elapsed=age-delay
      alpha=elapsed<0 ? 0 : .55*(.5-.5*Math.cos(elapsed/period*Math.PI*2))
    }
    // Unsupported multi-color strings stay suppressed. Moon's single-color
    // rows do not require the still-unrecovered SwitchColor/HSV tween bodies.
    if (!/^#[0-9a-f]{6}$/i.test(v[9])) continue
    if (e.command==='Suspensionlight_2' && v[12]
      && v[12].toLowerCase()!==v[9].toLowerCase()) continue
    // Ceiling and floor mounts use different reference bases. Mirror the
    // animated excursion, not the CSV mounting angle: the mirrored floor
    // rows already contain complementary angles (70/110, 80/100).
    // Reflecting both would send paired lights toward the same side.
    const extent=Number(selected.slice(5))
    const excursion=nativeAngle-extent/2
    const mount=n(v,8)>360 ? 240 : 270
    states.push({key,model:m,alpha,color:v[9],depth:n(v,10),x:n(v,7),y:n(v,8),
      scaleX:n(v,1),scaleY:n(v,2),speed,mirror:v[4]==='right',
      angle:angle-mount+(v[4]==='right' ? -excursion : excursion)})
  }
  return states
}
export function oldSuspensionlightLayout(s,width,height,environmentScale=1) {
  const fit=Math.min(width/1280,height/720)*environmentScale*.5
  return {x:width/2+s.x*fit,y:height/2+(360-s.y)*fit,
    // Legacy CSV coordinates are double-resolution UI units; native Sprite
    // pixels already use the stage's 1280 reference, not the CSV coordinate fit.
    scaleX:(s.mirror ? -1 : 1)*s.scaleX*fit*2,scaleY:s.scaleY*fit*2,
    rotation:-s.angle*Math.PI/180}
}
