// EventNoteTypeExtenions.IsAnyHold (0x1f46110), verified against ARM64.
// Positive RAW duration alone does not create a hold's body or endpoint.
// Flick next-note connectors are a separate native path in HoldMesh.Create.
export function nativeSongNoteIsHold(note) {
  return note.type === 'HOLD' || note.type === 'VARIABLE_HOLD'
    || note.type === 'LARGE_HOLD' || note.type === 'LARGE_VARIABLE_HOLD'
}
