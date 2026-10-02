// Static art is centred on its full 1900x1060 transparent texture canvas.
// Take 01/02 both have a measured aperture [726,300,1160,542], centred
// at (943,421). Their authored Backmonitor (-7,340) therefore registers
// at art-relative (-7,-109): Y origin 231, rather than the legacy 250.
// This is a bounded 2D registration, not a recovered Unity camera transform.
export function backmonitorRegistration(songCode) {
  return ['tkstp1', 'tkstp2'].includes(songCode)
    ? { originY: 231, id: 'take-screen-aperture-v1' }
    : { originY: 250, id: 'legacy-content-plane' }
}

export function projectChibiBackmonitor(songCode, state, width, height, environmentScale = 1) {
  const fit = Math.min(width / 1280, height / 720) * environmentScale
  const registration = backmonitorRegistration(songCode)
  return {
    x: width / 2 + state.x * fit,
    y: height / 2 + (registration.originY - state.y) * fit,
    scale: fit * state.scale / 1000 * 2,
  }
}
