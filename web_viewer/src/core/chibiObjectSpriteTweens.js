// Native nonnegative-duration, single-loop, alpha-only DOTween semantics.
// The kernel accepts explicit frame deltas; the seekable timeline below uses
// a declared Web 60 Hz reference clock, not an original device frame history.
const f = Math.fround
export const objectSpriteTweenStatus = 'native-per-renderer-tweens-web-60hz-preview'

export function createSpriteTweenState(alphas) {
  if (!alphas.length || alphas.some(a=>!Number.isFinite(a))) throw Error('Invalid Sprite alpha inputs')
  return {alphas:alphas.map(f),active:false,tweens:[]}
}

export function dispatchSpriteTween(state, hide, seconds, id) {
  if (!Number.isFinite(seconds) || seconds<0) throw Error('Sprite tween needs nonnegative duration')
  const tween={id,hide:Boolean(hide),duration:f(seconds),elapsed:0,from:null,change:null}
  if (!hide) state.active=true
  state.tweens.push(tween)
  return tween
}

export function stepSpriteTweens(state, seconds) {
  if (!Number.isFinite(seconds) || seconds<0) throw Error('Invalid Sprite frame delta')
  const dt=f(seconds)
  for (const tween of state.tweens) {
    if (!tween.from) {
      // Native Startup runs in array order, after older tweens wrote this frame.
      tween.from=state.alphas.slice()
      tween.change=tween.from.map(a=>f((tween.hide?0:1)-a))
    }
    tween.elapsed=Math.min(tween.duration,f(tween.elapsed+dt))
    const p=tween.duration?f(tween.elapsed/tween.duration):1,ease=f(-f(p*f(p-2)))
    for (let i=0;i<state.alphas.length;i++) state.alphas[i]=f(tween.from[i]+f(tween.change[i]*ease))
    if (tween.elapsed>=tween.duration && tween.hide) state.active=false
  }
  state.tweens=state.tweens.filter(t=>t.elapsed<t.duration)
  return state
}

export function supportsObjectSpriteTweens(entry) {
  return entry?.kind==='sprite' && !entry.nativeSpriteShader && entry.particleCount===0
    && entry.groupCount===0 && Boolean(entry.instances?.length)
}

export function createObjectSpriteTimeline(events, alphas) {
  const ordered=events.slice()
  if (ordered.some((e,i)=>!Number.isFinite(e.time) || !Number.isFinite(e.duration) || e.duration<0
    || (i && e.time<ordered[i-1].time))) throw Error('Invalid Sprite command timeline')
  const frameAt=t=>Math.floor(t*60/1000+1e-7)
  const origin=Math.min(0,frameAt(ordered[0]?.time || 0))-1
  let state,index,frame
  const reset=()=>{state=createSpriteTweenState(alphas);index=0;frame=origin}
  reset()
  return {
    status:objectSpriteTweenStatus,
    sample(milliseconds) {
      if (!Number.isFinite(milliseconds)) throw Error('Invalid Sprite sample time')
      const target=frameAt(milliseconds)
      if (target<frame) reset()
      while (frame<target) {
        // Idle intervals do not change colors or active. Skip them without
        // discarding old tweens, including tweens on inactive GameObjects.
        if (!state.tweens.length) {
          const next=index<ordered.length?Math.ceil(ordered[index].time*60/1000-1e-7):target+1
          frame=Math.max(frame,Math.min(target,next-1))
          if (frame>=target) break
        }
        frame++
        const time=frame*1000/60
        while (index<ordered.length && ordered[index].time<=time+1e-7) {
          const event=ordered[index]
          // GetOrCreate activates the preloaded root even for a first erase;
          // later erase calls do not reactivate previously hidden children.
          if (index===0) state.active=true
          dispatchSpriteTween(state,event.hide,event.duration/1000,index++)
        }
        stepSpriteTweens(state,1/60)
      }
      return {active:state.active,alphas:state.alphas.slice(),frame,status:objectSpriteTweenStatus}
    },
  }
}
