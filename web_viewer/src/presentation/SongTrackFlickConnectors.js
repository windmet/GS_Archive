import { nativeSongNoteIsFlick, nativeSongNoteIsHold } from './SongTrackNativeNoteTypes.js'

// EventNoteData.get_isFlickEnd (0x1f461e8): a flick, or a hold whose END type is a flick.
export function nativeSongNoteIsFlickEnd(note) {
  return nativeSongNoteIsFlick(note) || (nativeSongNoteIsHold(note) && !!note.endtype?.startsWith('END_FLICK_'))
}

// NoteScrObj.GetEventNotesByDifficulty: the time-ordered notes are filtered to isFlickEnd,
// and each one in an editor group (flickgroup != 0) takes as nextFlickNote the first later
// entry of that filtered list in the same group, so a flick-tailed hold can also be a target.
// HoldMesh.Create then joins the end of one to the head of the next. Ordinary holds sharing a
// group are not flick ends and never acquire a diagonal connector.
// The perspective track, the long track and its export all draw from this one list.
export function compileSongFlickConnectors(chart) {
  const ends = chart.notes.filter(nativeSongNoteIsFlickEnd)
    .map((note, order) => ({ note, order }))
    .sort((a, b) => a.note.tick - b.note.tick || a.order - b.order)
    .map(entry => entry.note)
  const connectors = []
  for (let i = 0; i < ends.length - 1; i++) {
    const note = ends[i], group = note.flickgroup
    if (!(group > 0)) continue
    let next = null
    for (let j = i + 1; j < ends.length && !next; j++) if (ends[j].flickgroup === group) next = ends[j]
    if (!next) continue
    const held = nativeSongNoteIsHold(note)
    connectors.push({ id: `flick-${group}-${note.sourceIndex}-${next.sourceIndex}`, flickgroup: group,
      fromNote: note, toNote: next, fromTick: note.tick + (held ? note.duration : 0), toTick: next.tick, speed: note.speed ?? 1,
      fromLane: held ? (note.poly?.at(-1)?.posx ?? note.end) : note.end,
      toLane: nativeSongNoteIsHold(next) ? (next.poly?.[0]?.posx ?? next.start) : next.end })
  }
  return connectors
}
