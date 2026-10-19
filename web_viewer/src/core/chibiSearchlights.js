const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>1-(1-clamp(x))**2
const n=(e,i)=>Number(e.values[i-1])||0
const mix=(a,b,t)=>a+(b-a)*t
function hsv(hex) {
  const rgb=[1,3,5].map(i=>parseInt((hex||'#000000').slice(i,i+2),16)/255)
  const [r,g,b]=rgb,max=Math.max(...rgb),min=Math.min(...rgb),d=max-min
  return [(!d?0:max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4)/6,max?d/max:0,max]
}
function color([h,s,v]) {
  h=((h%1)+1)%1*6;const c=v*s,x=c*(1-Math.abs(h%2-1)),m=v-c
  return [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h)].reduce((a,c,i)=>a|(Math.round(clamp(c+m)*255)<<(16-8*i)),0)
}
function transition(channel,time) {
  const age=Math.max(0,time-channel.time)
  if(!channel.loop)return ease(channel.rise>0?age/channel.rise:1)
  const period=channel.rise+channel.hold+channel.fall+channel.wait
  if(!(period>0))return null
  const t=age%period
  if(t<channel.rise)return ease(t/channel.rise)
  if(t<channel.rise+channel.hold)return 1
  if(t<channel.rise+channel.hold+channel.fall)return 1-ease((t-channel.rise-channel.hold)/channel.fall)
  return 0
}
function at(s,time) {
  const v={...s}
  if(s.fade)v.alpha=mix(s.fade.from,s.fade.to,ease(s.fade.duration>0?(time-s.fade.time)/s.fade.duration:1))
  if(s.colorTween){const c=s.colorTween;v.hsv=c.from.map((x,i)=>mix(x,c.to[i],ease(c.duration>0?(time-c.time)/c.duration:1)))}
  for(const [key,channel] of [['angle',s.rotate],['scaleX',s.scale],['scaleY',s.scale]])if(channel) {
    const t=transition(channel,time)
    if(t!==null)v[key]=mix(channel.from[key],channel.to[key],t)
    else v.deferred='nonpositive_animation_period'
  }
  if(s.move) {
    const c=s.move
    let degrees
    if(c.mode<=4) {
      const period=c.rise+c.hold+c.fall+c.wait
      if(!(period>0)){v.deferred='nonpositive_oval_period';degrees=0}
      else {const t=Math.max(0,time-c.time)%period,half=c.mode%2?180:-180,end=c.mode<=2?half*2:0
        degrees=t<c.rise?half*ease(t/c.rise):t<c.rise+c.hold?half:t<c.rise+c.hold+c.fall?mix(half,end,ease((t-c.rise-c.hold)/c.fall)):end}
    } else degrees=(c.mode===5?180:-180)*ease(c.duration>0?(time-c.time)/c.duration:1)
    const a=degrees*Math.PI/180
    // Native OvalMove callback: left rotated by ±180°, Y multiplied by
    // value6 aspect, then rotated by the source→target vector's Z angle.
    const dx=c.to.x-c.from.x,dy=c.to.y-c.from.y
    v.x=(c.from.x+c.to.x)/2-dx*Math.cos(a)/2+dy*c.aspect*Math.sin(a)/2
    v.y=(c.from.y+c.to.y)/2-dy*Math.cos(a)/2-dx*c.aspect*Math.sin(a)/2
  }
  v.color=color(v.hsv);return v
}

export function searchlightsAt(events,time,tempoAt=()=>null,positionAt=()=>null) {
  const states=new Map()
  for(const e of events||[]) {
    if(e.time>time)break
    const id=e.values[0],old=states.get(id)
    let s=old?at(old,e.time):null
    if(e.command==='Searchlight_show' || e.command==='Searchlight_show_2') {
      if(e.hide) {if(s)s.fade={time:e.time,duration:e.eraseDuration,from:s.alpha,to:0}}
      else {
        s={...s,id,asset:e.values[1],alpha:n(e,4)/1000,hsv:hsv(e.values[4]),target:n(e,6),x:n(e,7),y:n(e,8),angle:n(e,9)/(e.command.endsWith('_2')?1:1000),rootScale:n(e,10)/1000,depth:n(e,11),
          scaleX:s?.scaleX??1,scaleY:s?.scaleY??1,flash:n(e,3),flashTime:e.time,tempo:tempoAt(e.time),deferred:null}
      }
    } else if(e.command==='Searchlight_fade') {
      // Native fade targets the object even when Play comes later: Take queues
      // Fade 100 ms before Show, and the tween must survive the activation.
      const base=s || {id,alpha:0,hsv:[0,0,0],scaleX:1,scaleY:1,depth:0,x:0,y:0,angle:0,rootScale:0}
      base.fade={time:e.time,duration:n(e,2),from:base.alpha,to:n(e,3)/1000}
      s=base
    } else if(s) {
      if(e.command==='Searchlight_coloranim') {
        const to=hsv(e.values[1]),from=s.hsv
        if(n(e,4)===0)to[0]+=from[0]<=to[0]?-1:1
        s.colorTween={time:e.time,duration:n(e,3),from,to}
      } else if(e.command==='Searchlight_ovalmove') {
        const mode=n(e,5)
        if(mode>=1 && mode<=6)s.move={time:e.time,from:{x:s.x,y:s.y},to:{x:n(e,3),y:n(e,4)},aspect:n(e,6)/1000,duration:n(e,7),mode,rise:n(e,7),hold:n(e,8),fall:n(e,9),wait:n(e,10)}
        else s.deferred=`oval_mode_${mode}`
      } else if(e.command==='Searchlight_scaleanim') {
        const mode=n(e,8)
        if(mode===1 || mode===2)s.scale={time:e.time,from:{scaleX:s.scaleX,scaleY:s.scaleY},to:{scaleX:n(e,2)/1000,scaleY:n(e,3)/1000},rise:n(e,4),hold:n(e,5),fall:mode===2?n(e,6):0,wait:n(e,7),loop:mode===2}
        else s.deferred=`scale_mode_${mode}`
      } else if(e.command==='Searchlight_rotateanim') {
        const mode=n(e,2)
        if([1,2,3].includes(mode))s.rotate={time:e.time,from:{angle:s.angle},to:{angle:n(e,3)},rise:n(e,4),hold:n(e,5),fall:mode===3?n(e,6):0,wait:mode===3?n(e,7):0,loop:mode!==1}
        else s.deferred=`rotate_mode_${mode}`
      }
    }
    if(s)states.set(id,s)
  }
  return [...states.values()].map(s=> {
    const v=at(s,time)
    if(s.flash===2){if(s.tempo>0)v.alpha*=1-(((time-s.flashTime)*s.tempo/30000)%1);else v.deferred='missing_native_tempo'}
    // SpotlightBase follows an idol only when no tween targets this object.
    const until=Math.max(s.fade?s.fade.time+s.fade.duration:-Infinity,s.colorTween?s.colorTween.time+s.colorTween.duration:-Infinity,s.move?(s.move.mode<=4?Infinity:s.move.time+s.move.duration):-Infinity,
      s.scale?(s.scale.loop?Infinity:s.scale.time+s.scale.rise):-Infinity,s.rotate?(s.rotate.loop?Infinity:s.rotate.time+s.rotate.rise):-Infinity,s.flash===2?Infinity:-Infinity)
    if(s.target && time>=until){const p=positionAt(s.target,time);if(p){v.x=p.x;v.y=p.y+150}}
    return v
  })
}

export function attachSearchlights(index,data,hash) {
  if(data?.contract!=='native-searchlights-v1' || data.choreographyIndexSha256!==hash)throw new Error('Searchlight source binding mismatch')
  return {...index,searchlights:data,songs:index.songs.map(s=> {
    const source=data.songs[s.id]
    if(source?.source!==s.source || source.songCode!==s.songCode)throw new Error(`Searchlight identity mismatch ${s.id}`)
    return {...s,searchlightEvents:source.events}
  })}
}
