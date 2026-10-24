// EventNoteTypeExtenions.IsAnyHold (0x1f46110), verified against ARM64.
// Positive RAW duration alone does not create a hold's body or endpoint.
// Flick next-note connectors are a separate native path in HoldMesh.Create.
export function nativeSongNoteIsHold(note) {
  return note.type === 'HOLD' || note.type === 'VARIABLE_HOLD'
    || note.type === 'LARGE_HOLD' || note.type === 'LARGE_VARIABLE_HOLD'
}

// EventNoteTypeExtenions.IsAnyFlick (0x1f460e8), verified against ARM64.
export function nativeSongNoteIsFlick(note) {
  return note.type === 'FLICK_LEFT' || note.type === 'FLICK_UP' || note.type === 'FLICK_RIGHT'
}

// EventNoteTypeExtenions.IsAnyHoldOrFlick (0x1f47364), verified against ARM64.
export function nativeSongNoteUsesHoldMesh(note) {
  return nativeSongNoteIsHold(note) || nativeSongNoteIsFlick(note)
}
