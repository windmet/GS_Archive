// Native old-suspension channels. Screen registration remains separate from
// the recovered local hierarchy and command/Animator lifecycle.
import { sampleStreamedCurve } from './chibiNativeAnimation.js'
import { nativeLightScreenLayout } from './chibiNativeLightProjection.js'
const n = (v,i,d=0) => v[i] === '' || v[i] == null ? d : Number(v[i])
const clamp = x => Math.max(0,Math.min(1,x))
const outQuad = x => 1-(1-clamp(x))**2
const mod = (x,p) => ((x%p)+p)%p
function rgba(text) {
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(text || '')) return null
  return {r:parseInt(text.slice(1,3),16)/255,g:parseInt(text.slice(3,5),16)/255,
    b:parseInt(text.slice(5,7),16)/255,a:text.length===9 ? parseInt(text.slice(7,9),16)/255 : 1}
}
function hue(color,shift) {
  const {r,g,b}=color,max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min
  let h=delta===0 ? 0 : max===r ? (g-b)/delta : max===g ? (b-r)/delta+2 : (r-g)/delta+4
  h=mod(h/6+shift,1)*6
  const chroma=delta,x=chroma*(1-Math.abs(h%2-1)),m=min
  const rgb=h<1?[chroma,x,0]:h<2?[x,chroma,0]:h<3?[0,chroma,x]:h<4?[0,x,chroma]:h<5?[x,0,chroma]:[chroma,0,x]
  return {...Object.fromEntries(['r','g','b'].map((key,i)=>[key,rgb[i]+m])),a:1}
}
const hex = c => '#'+[c.r,c.g,c.b].map(x=>Math.round(clamp(x)*255).toString(16).padStart(2,'0')).join('')
function phaseAt(s,time) {return s.phase + (time-s.phaseTime)/s.period*2}
function channelsAt(s,time) {
  const v=s.event.values,age=Math.max(0,time-s.event.time)
  let color=s.color,alpha=color.a,unresolved=null
  if (s.event.command==='Suspensionlight') alpha=color.a+(1-color.a)*outQuad(age/200)
  if (s.event.command==='Suspensionlight_2') {
    if (!(s.tempo>0)) unresolved='tempo_unavailable'
    else {
      const beat=60000/s.tempo,wait=n(v,14)===0?0:beat+Math.max(beat*n(v,14),0)
      const period=beat+wait,cycle=Math.floor(age/period),t=age%period,fadeOut=wait>0 || n(v,11)!==0
      const colors=[s.color,rgba(v[12]),rgba(v[13])].filter(Boolean)
      color=colors[cycle%colors.length]
      if (!fadeOut) alpha=outQuad(t/beat)
      else if (n(v,11)!==0) alpha=t<beat?1-outQuad(t/beat):0
      // SwitchColor explicitly writes alpha=0 (ARM64 fmov s3,wzr),
      // including the initial wait before a fixed 1 -> 0 FadeOut.
      else alpha=t<wait?0:1-outQuad((t-wait)/beat)
    }
  }
  if (s.event.command==='Suspensionlight_3') {
    const delay=n(v,12),period=n(v,11),wait=n(v,13),elapsed=age-delay
    if (elapsed<0) alpha=0
    else if (period>0) {
      const t=mod(elapsed,period+wait)
      alpha=t<period/2?t/(period/2):t<period?2-t/(period/2):0
    } else unresolved='invalid_show_period'
  }
  if (s.event.command==='Suspensionlight_4') {
    // Native DOColor: half-period duration, initial delay, infinite Yoyo,
    // explicit Linear ease. value15 reverses the two complete RGBA colors.
    const second=rgba(v[12])||{r:0,g:0,b:0,a:0}
    const reverse=n(v,14)!==0,from=reverse?second:s.color,to=reverse?s.color:second
    const duration=n(v,11)/2,elapsed=Math.max(0,age-n(v,13))
    if (!(duration>0)) unresolved='invalid_color_period'
    else {
      const leg=Math.floor(elapsed/duration),fraction=elapsed%duration/duration
      const t=leg%2?1-fraction:fraction
      color=Object.fromEntries(['r','g','b','a'].map(k=>[k,from[k]+(to[k]-from[k])*t]))
      alpha=color.a
    }
  }
  if (s.event.command==='Suspensionlight_5') {
    const delay=n(v,12),period=n(v,11)
    if (age>=delay && period>0) {
      const t=mod(age-delay,period)/period
      color=hue(s.color,n(v,13)===0?t:1-t)
      alpha=1
    } else if (!(period>0)) unresolved='invalid_hue_period'
  }
  if (s.exit) {alpha=s.exit.alpha*(1-outQuad((time-s.exit.time)/200));color=s.exit.color}
  return {alpha:unresolved?0:clamp(alpha),color,unresolved}
}
export function oldSuspensionlightsAt(events, time, model, registration = {}) {
  const instances=new Map()
  for (const event of events) {
    if(event.time>time)break
    const key=`${event.command}:${event.id}`,v=event.values
    let previous=instances.get(key)
    if(previous?.exit && event.time>=previous.exit.time+200) {instances.delete(key);previous=null}
    const erase=event.extraValues?.value101!=null?event.extraValues.value101==='1':event.erase
    if(erase) {
      if(previous) {
        const now=channelsAt(previous,event.time)
        previous.exit={time:event.time,alpha:now.alpha,color:now.color}
      }
      continue
    }
    const period=n(v,3),color=rgba(v[9])||previous?.color
    if(!(period>0) || !color)continue
    // ApplyData changes speed without Animator.Play/Rebind. Only an inactive
    // generation starts the controller's default state at phase zero.
    const tempo=typeof registration.tempoAt==='function'?registration.tempoAt(event.time):registration.tempo
    instances.set(key,{key,event,color,period,tempo,phase:previous?phaseAt(previous,event.time):0,phaseTime:event.time})
  }
  const result=[]
  for (const s of instances.values()) {
    if(s.exit && time>=s.exit.time+200)continue
    const v=s.event.values,m=model?.styles?.[s.event.command],clip=m?.clips?.angle60
    if(!clip)continue
    const channels=channelsAt(s,time),phase=mod(phaseAt(s,time),clip.duration)
    const nativeAngle=sampleStreamedCurve(clip.curve,phase),right=v[4]==='right'
    const scale=n(v,5)/1000
    // Rz(root) * Rx(left/right) * Rz(60) * Rz(Animator), with the
    // Unity-to-screen Y reflection applied at both ends of the local matrix.
    result.push({key:s.key,model:m,alpha:channels.alpha,color:hex(channels.color),unresolved:channels.unresolved,
      depth:n(v,10),x:n(v,7),y:n(v,8),scaleX:scale,scaleY:scale,
      mirrorY:!right,moving:true,phase,nativeAngle,angle:right?n(v,6)+60+nativeAngle:n(v,6)-60-nativeAngle})
  }
  return result
}
export function oldSuspensionlightLayout(s,width,height,environmentScale=1) {
  return nativeLightScreenLayout(s,width,height,environmentScale)
}


const digest=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value)
export function attachNativeOldSuspension(index,data,indexHash) {
  if(data?.schemaVersion!==1 || data.contract!=='native-old-suspension-v1'
      || !digest(indexHash) || data.stageEffectIndexSha256!==indexHash
      || Object.keys(data.songs||{}).length!==Object.keys(index.oldSuspensionlightSongs||{}).length)
    throw new Error('Native old suspension input does not match stage effects')
  const styles=data.model?.styles
  for(const command of ['Suspensionlight','Suspensionlight_2','Suspensionlight_3','Suspensionlight_4','Suspensionlight_5']) {
    const model=styles?.[command]
    if(!model?.clips?.angle60 || model.clips.angle60.duration!==2 || model.layers?.length!==1
        || model.layers[0].asset!=='sidelight' || model.layers[0].anchorX!==.5 || model.layers[0].anchorY!==0)
      throw new Error('Invalid native old suspension prefab')
  }
  const songs={}
  for(const [id,descriptor] of Object.entries(index.oldSuspensionlightSongs)) {
    const track=data.songs[id]
    if(!track || track.file!==descriptor.file || track.eventCount!==descriptor.eventCount
        || !digest(track.fileSha256) || JSON.stringify(track.source)!==JSON.stringify(descriptor.source)
        || !['supported','unsupported'].includes(track.nativeCapability) || !Array.isArray(track.reasons)
        || (track.nativeCapability==='supported')!==(track.reasons.length===0)
        || !track.commands?.length || track.commands.some(command=>!Object.hasOwn(styles,command)))
      throw new Error('Invalid native old suspension capability/source')
    songs[id]={...descriptor,...track,previewEnabled:track.nativeCapability==='supported',referenceProjection:'native-stage-camera-v1'}
  }
  return {...index,oldSuspensionlight:data.model,oldSuspensionlightSongs:songs,oldSuspensionlightContract:data.contract}
}

export function validateOldSuspensionTrack(track,descriptor,hash) {
  if(!digest(hash) || hash!==descriptor.fileSha256 || descriptor.nativeCapability!=='supported'
      || !Array.isArray(track?.events) || track.events.length!==descriptor.eventCount
      || JSON.stringify(track.source)!==JSON.stringify(descriptor.source))
    throw new Error('Native old suspension track/source mismatch')
  return track
}
