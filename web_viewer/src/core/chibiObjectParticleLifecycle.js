// LiveObjectObjectLayer callbacks: particles Play immediately; only Sprite /
// CanvasGroup receive DOFade. StopEmitting preserves living particles until
// the separate erase-duration callback disables their GameObject.
export function objectParticlePresentation(state,time){
 if(!state)return {alpha:0,visible:false,stoppedAt:Infinity}
 return {alpha:1,visible:state.particleRetireAt==null || time<state.particleRetireAt,
  stoppedAt:state.particleStopAt??Infinity}
}
export function lastParticleLoop(elapsed,stoppedElapsed,period){
 if(elapsed<0 || stoppedElapsed<0)return null
 return Math.floor(Math.min(elapsed,stoppedElapsed)/period)*period
}
