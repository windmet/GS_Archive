// LiveObjectSpotlight.Show clears its previous target then assigns +250 to
// the new one. Hide resets immediately, independently of the beam's fade.
// This is a shared field on the idol, not a reference count of active lamps.
export function spotlightSortOffsetsAt(events = [], time = 0) {
  const targets = new Map()
  const offsets = new Map()
  for (const event of events) {
    if (event.time > time) break
    const previous = targets.get(event.id)
    if (previous) offsets.set(previous, 0)
    if (event.hide) continue
    const target = Number(event.stagePosition)
    targets.set(event.id, Number.isInteger(target) && target > 0 ? target : null)
    if (targets.get(event.id)) offsets.set(target, 250)
  }
  return offsets
}

// Both lamp families write the same SpotlightBackground renderer. Hiding a
// lamp does not restore its old order. Clear starts that renderer at 1900.
export function spotlightBackgroundOrderAt(song, time = 0, initial = 1900) {
  const commands = [...(song?.spotlightEvents || []), ...(song?.pinspotlightEvents || [])]
    .filter(event => !event.hide && event.time <= time && Number.isFinite(event.depth))
    .sort((a, b) => a.time - b.time)
  return commands.at(-1)?.depth ?? initial
}
