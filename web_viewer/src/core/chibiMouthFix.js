export const NATIVE_MOUTH_CLOSED_RATE = Math.fround(.15)
const clamp=value=>Math.max(0,Math.min(1,value))

export function validateMouthFixData(data,hash) {
  if(data?.schemaVersion!==1 || !/^[a-f0-9]{64}$/.test(hash || '') || data.choreographyIndexSha256!==hash)
    throw Error('Mouth fix does not match choreography')
  if(!data.songs || !Number.isSafeInteger(data.eventCount))throw Error('Invalid mouth fix index')
  let count=0
  for(const track of Object.values(data.songs)) {
    if(!track.songCode || !track.source || !Array.isArray(track.events))throw Error('Invalid mouth fix track')
    let previous=null
    for(const event of track.events) {
      if(!Number.isFinite(event.time) || !Number.isSafeInteger(event.sourceRow) || !Number.isInteger(event.target) || event.target<0
        || typeof event.erase!=='boolean' || !Number.isFinite(event.duration) || event.duration<0
        || !event.erase && !Number.isFinite(event.openRate)
        || previous && (previous.time>event.time || previous.time===event.time && previous.sourceRow>=event.sourceRow))
        throw Error('Invalid mouth fix event/order')
      previous=event;count++
    }
  }
  if(count!==data.eventCount)throw Error('Mouth fix count mismatch')
  return data
}

// Native Fix/Cancel kill the prior tween, retain its current fixed rate, and
// use default DOTween OutQuad. Cancel releases the override only on completion.
export function mouthFixAt(events,position,time,{immediate=false}={}) {
  let tween=null,rate=NATIVE_MOUTH_CLOSED_RATE,active=false
  function sample(at) {
    if(!tween)return {rate,active}
    const progress=tween.duration>0?clamp((at-tween.time)/tween.duration):1
    return {rate:tween.from+(tween.to-tween.from)*(1-(1-progress)**2),
      active:!tween.erase || progress<1}
  }
  for(const event of events || []) {
    if(event.time>time)break
    if(event.target===0 ? position<1 || position>5 : event.target!==position)continue
    const previous=sample(event.time)
    tween={time:event.time,duration:immediate?0:event.duration,from:previous.rate,
      to:event.erase?NATIVE_MOUTH_CLOSED_RATE:NATIVE_MOUTH_CLOSED_RATE+(1-NATIVE_MOUTH_CLOSED_RATE)*clamp(event.openRate),erase:event.erase}
    rate=previous.rate;active=event.erase?previous.active:true
    // Cancel while already inactive must not activate the override.
    if(event.erase && !active)tween=null
  }
  return sample(time)
}
