// Native LiveStage/LiveObjectCamera plane for the archive's 1280x720 stage.
// Prepare scales LiveStage by 1.3888889; ScriptPosToStagePos is .01 and
// the default orthographic size is 5: 720/(2*5)*.01*1.3888889 == 1.
const clamp=x=>Math.max(0,Math.min(1,x))
const ease=x=>1-(1-clamp(x))**2
const sample=(t,time)=>t.from+(t.to-t.from)*(t.duration>0?ease((time-t.time)/t.duration):1)
function focusPosition(song,slot,time) {
  const p=(song.positionEvents||[]).findLast(p=>p.position===slot&&p.time<=time)
  return p?{x:p.x,y:p.y+150}:null // get_targetIdolPos adds Vector3.up * 150 camera pixels.
}
export function nativeLightCameraAt(song,time) {
  let state={orthoSize:5,x:0,y:360,rotation:0,focusSlot:0,endsAt:-Infinity,verified:true},tweens=null
  function at(t) {
    const now={...state}
    if(tweens) for(const key of ['orthoSize','x','y','rotation'])now[key]=sample(tweens[key],t)
    if(now.focusSlot && t>=now.endsAt) {
      const p=focusPosition(song,now.focusSlot,t)
      if(p)Object.assign(now,p)
      else now.verified=false
    }
    return now
  }
  for(const event of song?.cameraEvents||[]) {
    if(event.time>time)break
    const previous=at(event.time),requested=event.reset?0:Number(event.focusSlot)||0
    // Both bound LiveStage instances serialize six idol roots. GetTargetIdolObj
    // returns null outside the list; malformed large IDs use the free camera.
    const focusSlot=requested>=1&&requested<=6?requested:0
    const focus=focusSlot?focusPosition(song,focusSlot,event.time):null
    const target={orthoSize:event.reset?5:5/(Number(event.zoom)/1000),
      x:event.reset?0:focus?.x??Number(event.x),y:event.reset?360:focus?.y??Number(event.y),
      rotation:event.reset?0:Number(event.rotation)}
    const duration=event.reset?{orthoSize:event.resetDuration,x:event.resetDuration,y:event.resetDuration,rotation:event.resetDuration}
      :{orthoSize:event.zoomDuration,x:event.moveDuration,y:event.moveDuration,rotation:event.rotationDuration}
    tweens=Object.fromEntries(Object.keys(target).map(key=>[key,{from:previous[key],to:target[key],time:event.time,duration:Math.max(0,Number(duration[key])||0)}]))
    state={...previous,focusSlot,endsAt:event.time+Math.max(...Object.values(duration).map(v=>Number(v)||0)),verified:!focusSlot||Boolean(focus)}
  }
  const result=at(time)
  return {...result,zoom:5/result.orthoSize}
}
export function nativeLightScreenLayout(state,width,height,environmentScale=1,camera={x:0,y:360,rotation:0,zoom:1},viewScale=1) {
  const fit=Math.min(width/1280,height/720),zoom=camera.zoom*viewScale
  const angle=camera.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle)
  const x=(state.x*environmentScale-camera.x)*fit*zoom
  const y=((360-state.y)*environmentScale+camera.y-360)*fit*zoom
  return {x:width/2+c*x-s*y,y:height/2+s*x+c*y,
    scaleX:state.scaleX*fit*environmentScale*zoom,
    scaleY:state.scaleY*(state.mirrorY?-1:1)*fit*environmentScale*zoom,
    rotation:-state.angle*Math.PI/180+angle}
}
// Keep common stage z-order while cancelling the reference camera parent.
// Useful for consumers attached beneath a separately transformed parent.
export function nativeLightLocalLayout(screen,parent) {
  const {a,b,c,d,tx,ty}=parent,det=a*d-b*c
  const inverse=(x,y)=>({x:(d*x-c*y)/det,y:(a*y-b*x)/det})
  const p=inverse(screen.x-tx,screen.y-ty)
  const axis=inverse(Math.cos(screen.rotation),Math.sin(screen.rotation))
  const scale=Math.hypot(axis.x,axis.y)
  return {x:p.x,y:p.y,rotation:Math.atan2(axis.y,axis.x),scaleX:screen.scaleX*scale,scaleY:screen.scaleY*scale}
}
