// Static art is centred on its full 1900x1060 transparent texture canvas.
// Take 01/02 both have a measured aperture [726,300,1160,542], centred
// at (943,421). Their authored Backmonitor (-7,340) therefore registers
// at art-relative (-7,-109): Y origin 231, rather than the legacy 250.
// This is a bounded 2D registration, not a recovered Unity camera transform.
export function backmonitorRegistration(songCode) {
  if (['tkstp1', 'tkstp2'].includes(songCode)) return { originY: 231, id: 'take-screen-aperture-v1' }
  // Measured transparent interiors of the original 1900x1060 PNGs, aligned
  // against their authored CSV XY. These are bounded 2D registrations;
  // the native camera/RectTransform conversion is still not recovered.
  if (songCode === 'psblts') return { originY: 242, id: 'possibilities-screen-aperture-v1' }
  if (songCode === 'cgtocc') return { originX: -150.5, originY: 137, id: 'chance-star-apertures-v1' }
  return { originY: 250, id: 'legacy-content-plane' }
}

export function projectChibiBackmonitor(songCode, state, width, height, environmentScale = 1) {
  const fit = Math.min(width / 1280, height / 720) * environmentScale
  const registration = backmonitorRegistration(songCode)
  return {
    x: width / 2 + ((registration.originX || 0) + state.x) * fit,
    y: height / 2 + (registration.originY - state.y) * fit,
    scale: fit * state.scale / 1000 * 2,
  }
}

export function chibiBackmonitorStateAt(events, milliseconds) {
  const state = {
    movie: null, movieTime: 0, transition: null, transitionTime: 0,
    x: 0, y: 360, scale: 1000, rawValue6: 0, rawValue7: 1000, eventTime: '',
  }
  for (const event of events || []) {
    const time = Number(event.time)
    if (time > milliseconds) break
    if (event.movie) { state.movie = event.movie; state.movieTime = time }
    for (const key of ['x', 'y', 'scale']) {
      if (event[key] != null) state[key] = Number(event[key])
    }
    // Old indexes mislabeled value6 as rotation and value7 as opacity.
    // Preserve both raw controls. Neither is a movie alpha or a 2D rotation.
    const value6 = event.rawValue6 ?? event.rotation
    const value7 = event.rawValue7 ?? event.opacity
    if (value6 != null) state.rawValue6 = Number(value6)
    if (value7 != null) state.rawValue7 = Number(value7)
    state.transition = event.transition || null
    if (state.transition) state.transitionTime = time
    state.eventTime = time
  }
  return state
}
