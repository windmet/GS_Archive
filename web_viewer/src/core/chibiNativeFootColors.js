// Bound to all five RAW SkeletonDataAssets; Web SkeletonBinary keeps scale=1.
export const NATIVE_SKELETON_SCALE = 0.003333332948386669
const clamp = x => Math.max(0, Math.min(1, x))
export function footUniformsAt(events = [], time = 0, nativeSlot = null) {
  let state = { rgba: [1,1,1,0], rcpHeight: .5 * NATIVE_SKELETON_SCALE }
  let tracks = [], now = -Infinity
  const sample = (track, t) => {
    const p = clamp((t-track.time)/track.duration)
    const f = 1-(1-p)**2
    return { rgba: track.from.rgba.map((v,i)=>v+(track.to.rgba[i]-v)*f),
      rcpHeight: track.from.rcpHeight+(track.to.rcpHeight-track.from.rcpHeight)*f }
  }
  const advance = t => {
    // DOTween.To has no target/kill here: a short newer tween can finish
    // while an older one still writes the same material on subsequent frames.
    const ends = [...new Set(tracks.map(track=>track.time+track.duration))]
      .filter(end=>end>now && end<=t).sort((a,b)=>a-b)
    for (const end of ends) {
      for (const track of tracks) state = sample(track,end)
      tracks = tracks.filter(track=>track.time+track.duration>end)
      now = end
    }
    if (t>now) for (const track of tracks) state = sample(track,t)
    now = t
  }
  for (const event of events) {
    if (event.time > time) break
    if (event.target && event.target !== nativeSlot) continue
    advance(event.time)
    if (event.hide && !event.solo) {
      // ClearFootColor clears Src/Dst immediately; it does not alter cutoff.
      state = { rgba: [0,0,0,0], rcpHeight: state.rcpHeight }
      continue
    }
    const cutoff = event.cutoff ?? event.depth
    const soloErase=event.solo && event.hide
    if ((!soloErase && !(cutoff > 0)) || !/^#[0-9a-f]{6}$/i.test(event.color || '')) continue
    const color = parseInt(event.color.slice(1),16)
    const rgba = [16,8,0].map(s=>((color>>s)&255)/255).concat(event.opacity/1000)
    const track = { from: state, to: { rgba, rcpHeight: soloErase ? 0 : NATIVE_SKELETON_SCALE*1000/cutoff },
      time:event.time, duration:Math.max(0,event.duration || 0) }
    if (track.duration) tracks.push(track)
    else state = track.to
  }
  advance(time)
  return state
}

export function validateFootSoloData(data,hash) {
  if(data?.schemaVersion!==1 || !/^[a-f0-9]{64}$/.test(hash || '') || data.choreographyIndexSha256!==hash)
    throw Error('Solo foot choreography mismatch')
  if(!data.songs || typeof data.songs!=='object' || Array.isArray(data.songs))throw Error('Invalid solo foot tracks')
  let count=0,solo=0
  for(const track of Object.values(data.songs || {})) {
    if(!track.songCode || !track.source || !Array.isArray(track.events)
      || !/^[a-f0-9]{64}$/.test(track.raw?.sha256 || '') || !/^[a-f0-9]{64}$/.test(track.raw?.bundleSha256 || ''))throw Error('Invalid solo foot source')
    let previous=null
    for(const e of track.events) {
      if(!Number.isFinite(e.time) || !Number.isInteger(e.sourceRow) || !Number.isInteger(e.target) || e.target<0 || e.target>5
        || typeof e.solo!=='boolean' || typeof e.hide!=='boolean' || !e.solo && e.target!==0
        || previous && (e.time<previous.time || e.time===previous.time && e.sourceRow<=previous.sourceRow)
        || !(e.hide&&!e.solo) && (!/^#[a-f0-9]{6}$/i.test(e.color || '') || !(e.opacity>=0 && e.opacity<=1000)
          || !Number.isFinite(e.duration) || e.duration<0 || !Number.isFinite(e.cutoff) || (e.hide ? e.cutoff!==0 : e.cutoff<=0)))throw Error('Invalid solo foot event')
      previous=e;count++;solo+=e.solo?1:0
    }
  }
  if(count!==data.eventCount || solo!==data.soloEventCount)throw Error('Solo foot count mismatch')
  return data
}

export function addressedFootUniformsAt(song,data,time) {
  const track=data?.songs?.[song?.id]
  if(!track || track.songCode!==song.songCode || track.source!==song.source)return new Map()
  return new Map((song.stagePositionMap || []).map(entry=>[entry.stagePosition,
    footUniformsAt(track.events,time,entry.performerSlot)]))
}
