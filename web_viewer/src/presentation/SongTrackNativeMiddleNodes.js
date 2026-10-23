// NoteScrObj's variable-hold predicate followed by EventNoteData's
// GetChildHoldMiddleNotes (0x1f46e3c) and child lambda (0x1c33724).
// Exclude the first/last array indices, regardless of their tick values.
export function nativeSongHoldMiddlePoints(note) {
  if (note.type !== 'VARIABLE_HOLD' && note.type !== 'LARGE_VARIABLE_HOLD') return []
  return (note.poly || []).slice(1, -1).map((point, index) => ({
    polyIndex: index + 1,
    tick: note.tick + point.subtick,
    lane: Math.fround(point.posx),
    speed: Math.fround(note.speed ?? 1),
    type: 10, duration: 0, endtype: -1,
  }))
}
