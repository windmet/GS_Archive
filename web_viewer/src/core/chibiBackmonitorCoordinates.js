import { nativeBackmonitorGeometry as plane } from './chibiBackmonitorGeometry.js'
// ScriptPosToStagePos subtracts (0,360,0). Base RectTransform anchored Y=1.35
// belongs inside the scripted root scale. MoviePanel Sprite1734 is
// 32px / 100ppu, scaled by (16.25,8.4375): a 520 x 270 stage-pixel plane.
// The encoded movie resolution does not own the renderer's geometry.
export function backmonitorRegistration() {
  return { originY: plane.originY, id: 'native-backmonitor-plane-v1' }
}

export function projectChibiBackmonitor(songCode, state, width, height, environmentScale = 1) {
  const fit = Math.min(width / 1280, height / 720) * environmentScale
  const registration = backmonitorRegistration(songCode)
  const rootScale = state.scale / 1000
  return {
    x: width / 2 + (state.x + plane.baseOffsetX * rootScale) * fit,
    y: height / 2 + (registration.originY - state.y - plane.baseOffsetY * rootScale) * fit,
    scale: fit * rootScale,
    width: fit * rootScale * plane.width,
    height: fit * rootScale * plane.height,
  }
}

export function chibiBackmonitorStateAt(events, milliseconds) {
  const state = {
    movie: null, movieTime: 0, transition: null, transitionTime: 0,
    x: 0, y: 360, scale: 1000, rawValue6: 0, rawValue7: 1000, sortingOrder: 1000, logo:null, glowAlpha:1, eventTime: '',
  }
  for (const event of events || []) {
    const time = Number(event.time)
    if (time > milliseconds) break
    if (event.movie && event.movie !== state.movie) { state.movie = event.movie; state.movieTime = time }
    for (const key of ['x', 'y', 'scale']) {
      if (event[key] != null) state[key] = Number(event[key])
    }
    // Old indexes mislabeled value6 as rotation and value7 as opacity.
    // Preserve both raw controls. Neither is a movie alpha or a 2D rotation.
    const value6 = event.rawValue6 ?? event.rotation
    const value7 = event.rawValue7 ?? event.opacity
    if (value6 != null) state.rawValue6 = Number(value6)
    if (value7 != null) state.rawValue7 = Number(value7)
    // Native SetSortOrder maps zero/blank to 1000 on every command.
    state.glowAlpha = event.glowAlpha ?? Number(value7 || 0)/1000
    state.sortingOrder = Number(event.sortingOrder) || 1000
    if(event.logo)state.logo=event.logo
    state.transition = event.transition || null
    if (state.transition) state.transitionTime = time
    state.eventTime = time
  }
  return state
}
