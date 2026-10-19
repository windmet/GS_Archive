export function validateMotionOffsetData(data,hash) {
  if(data?.schemaVersion!==1 || !/^[a-f0-9]{64}$/.test(hash || '') || data.choreographyIndexSha256!==hash)
    throw Error('Motion offset does not match choreography')
  if(!data.songs || !Number.isSafeInteger(data.eventCount))throw Error('Invalid motion offset index')
  let count=0
  for(const track of Object.values(data.songs)) {
    if(!track.songCode || !track.source || !Array.isArray(track.events)
      || !Array.isArray(track.tempo?.values) || !track.tempo.values.length
      || track.tempo.file!==`song_charts/${track.songCode}-1.json`
      || track.tempo.values.some(tempo=>!Number.isFinite(tempo)||tempo<=0)
      || !/^[a-f0-9]{64}$/.test(track.tempo.sha256 || ''))throw Error('Invalid motion offset track/tempo')
    let previous=null
    for(const event of track.events) {
      if(!Number.isFinite(event.time) || !Number.isSafeInteger(event.sourceRow) || typeof event.erase!=='boolean'
        || !event.erase && !Number.isFinite(event.offsetMs)
        || previous && (previous.time>event.time || previous.time===event.time && previous.sourceRow>=event.sourceRow))
        throw Error('Invalid motion offset event/order')
      previous=event;count++
    }
  }
  if(count!==data.eventCount)throw Error('Motion offset count mismatch')
  return data
}

export function danceStartOffsetAt(events,time) {
  return events?.findLast(event=>event.time<=time&&!event.erase)?.offsetMs ?? 0
}

// UpdateMotionIfNeeded: 1.5 / baseTimeScale <= currentTime + offset.
// baseTimeScale = 1.5 / ((60 / curTempo) * 4), so the gate is four beats.
// A BPM set proves true/false outside its threshold range without inventing
// tempo-change timestamps from the currently unverified chart offset unit.
export function randomMotionGateAt(track,time) {
  if(!track)return {allowed:null,offsetMs:null}
  const offsetMs=danceStartOffsetAt(track.events,time),tempos=track.tempo.values
  const earliest=240000/Math.max(...tempos),latest=240000/Math.min(...tempos)
  const clock=time+offsetMs
  return {allowed:clock>=latest?true:clock<earliest?false:null,offsetMs,
    earliestMs:earliest-offsetMs,latestMs:latest-offsetMs}
}

// Resolve the first eligible time for a constant BPM, including later offset
// assignments. Variable BPM only resolves an already-certain due time; an
// ambiguous interval remains null rather than becoming a made-up start time.
export function randomMotionDueTime(track,dueTime) {
  if(!track)return null
  const first=randomMotionGateAt(track,dueTime)
  if(first.allowed===true)return dueTime
  if(track.tempo.values.some(tempo=>tempo!==track.tempo.values[0]))return null
  let time=dueTime
  for(const event of track.events.filter(event=>!event.erase&&event.time>dueTime)) {
    const gate=randomMotionGateAt(track,time),candidate=Math.max(time,gate.latestMs)
    if(candidate<event.time)return candidate
    time=event.time
  }
  return Math.max(time,randomMotionGateAt(track,time).latestMs)
}
