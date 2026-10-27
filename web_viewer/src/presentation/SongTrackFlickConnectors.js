import { nativeSongNoteIsFlick, nativeSongNoteIsHold } from './SongTrackNativeNoteTypes.js'

// HoldMesh.Create uses a flick's end lane; a hold can extend to nextFlickNote
// only when its END type is a flick. Ordinary holds sharing an editor group
// are not successive flicks and must not acquire a diagonal connector.
export function compileSongFlickConnectors(chart) {
  const groups = new Map()
  for (const note of chart.notes) {
    if (!(note.flickgroup > 0)) continue
    if (!groups.has(note.flickgroup)) groups.set(note.flickgroup, [])
    groups.get(note.flickgroup).push(note)
  }
  const connectors = []
  for (const [group, notes] of groups) {
    const flicks = notes.filter(nativeSongNoteIsFlick).sort((a,b)=>a.tick-b.tick)
    for (const note of notes) {
      const held = nativeSongNoteIsHold(note)
      if (!nativeSongNoteIsFlick(note) && !(held && note.endtype?.startsWith('END_FLICK_'))) continue
      const tick = note.tick + (held ? note.duration : 0)
      const next = flicks.find(n=>n.tick>tick)
      if (!next) continue
      connectors.push({ id:`flick-${group}-${note.sourceIndex}-${next.sourceIndex}`, flickgroup:group,
        fromNote:note,toNote:next,fromTick:tick,toTick:next.tick,speed:note.speed??1,
        fromLane:held ? (note.poly?.at(-1)?.posx ?? note.end) : note.end,
        toLane:next.end })
    }
  }
  return connectors
}
