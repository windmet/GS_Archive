import { PINSPOTLIGHT_STAGE_SCALE } from './chibiPinspotlightTimeline.js'
const pixelToCamera=Math.fround(PINSPOTLIGHT_STAGE_SCALE/100)
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)

export function attachNativeSpotlights(choreography,data,hash) {
  if(data?.schemaVersion!==1||data.contract!=='native-spotlight-v1'||!digest(hash)||data.choreographyIndexSha256!==hash
      ||Object.keys(data.songs||{}).length!==choreography.songs.length)
    throw new Error('Native Spotlight input does not match choreography')
  return {...choreography,songs:choreography.songs.map(song=>{
    const track=data.songs[song.id]
    if(!track||track.source!==song.source||track.songCode!==song.songCode
        ||track.raw?.textAsset!==song.id||!digest(track.raw?.bundleSha256)||!digest(track.raw?.textSha256)
        ||track.events.length!==(song.spotlightEvents||[]).length)
      throw new Error('Native Spotlight identity/source mismatch')
    let time=-Infinity
    for(const [i,e] of track.events.entries()) {
      const legacy=song.spotlightEvents[i]
      if(!Number.isFinite(e.time)||e.time<time||!Number.isSafeInteger(e.id)||typeof e.hide!=='boolean'
          ||!Number.isFinite(e.duration)||e.time!==legacy.time||e.id!==legacy.id||e.hide!==legacy.hide
          ||!Number.isSafeInteger(e.sourceRow)||e.sourceRow<2)
        throw new Error('Invalid native Spotlight command/order')
      time=e.time
      if(e.hide)continue
      if(e.duration!==500||!Number.isSafeInteger(e.targetSlot)||!Number.isFinite(e.scale)
          ||![e.x,e.y,e.depth,e.environmentOpacity].every(Number.isSafeInteger)
          ||e.stagePosition!==(song.stagePositionMap.find(m=>m.performerSlot===e.targetSlot)?.stagePosition??null))
        throw new Error('Invalid native Spotlight fields/target binding')
    }
    return {...song,spotlightEvents:track.events,spotlightContract:data.contract}
  })}
}

export function spotlightPoint(event,time,placement) {
  if(event.stagePosition>0) {
    const p=placement(event.stagePosition,time)
    return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?{x:p.x,y:360-p.y}:null
  }
  return {x:Math.fround(event.x*pixelToCamera)*100,
    y:-Math.fround((event.y-360)*pixelToCamera)*100}
}
const progress=(t,start,duration)=>duration<=0?1:Math.max(0,Math.min(1,(t-start)/duration))
const ease=t=>1-(1-t)**2
function sample(state,time,placement) {
  if(!state)return null
  const t=progress(time,state.start,state.duration)
  const point=!state.showing?state.from:t<1
    ?{x:state.from.x+(state.to.x-state.from.x)*ease(t),y:state.from.y+(state.to.y-state.from.y)*ease(t)}
    :spotlightPoint(state,time,placement)
  return {...state,point,alpha:state.showing?state.alpha:state.alpha*(1-t)**2}
}
const htmlColor=value=>/^#[a-f0-9]{6}([a-f0-9]{2})?$/i.test(value||'')
  ?{color:value.slice(0,7),alpha:value.length===9?Number.parseInt(value.slice(7),16)/255:1}:null

export function spotlightTimelineAt(events,time,placement) {
  const states=new Map()
  for(const event of events||[]) {
    if(event.time>time)break
    const previous=sample(states.get(event.id),event.time,placement)
    if(event.hide) {
      if(previous?.point)states.set(event.id,{...previous,showing:false,from:previous.point,
        start:event.time,duration:Math.max(0,event.duration)})
      continue
    }
    const to=spotlightPoint(event,event.time,placement)
    if(!to){states.delete(event.id);continue}
    const color=htmlColor(event.beamColor)
    states.set(event.id,{...event,showing:true,to,from:previous?.showing&&previous.point?previous.point:to,
      start:event.time,duration:500,beamColor:color?.color||previous?.beamColor||'#ffffff',
      alpha:previous?.showing?(color?.alpha??previous.alpha):1})
  }
  return new Map([...states].map(([id,state])=>[id,sample(state,time,placement)]))
}
