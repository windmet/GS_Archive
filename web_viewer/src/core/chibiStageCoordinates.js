import { nativeCharacterGeometry } from './chibiNativeCharacterGeometry.js'

// SetPosition (0x221bea0) uses the common ScriptPosToStagePos origin (0,360,0).
// The former baseline540 + (180-scriptY) was algebraically the same result;
// keep that registration while replacing its visual-calibration explanation.
export function chibiGroundRegistration() {
  return { originY: nativeCharacterGeometry.originY, id: 'native-character-plane-v1' }
}

// Independent position commands own formation and off-stage visibility.
// Motion rows retain legacy x/y fields, but cannot overwrite a formation.
export function chibiPositionStateAt(events, performerSlot, milliseconds) {
  return (events || []).findLast(event => event.position === performerSlot && event.time <= milliseconds) || null
}

export function resolveChibiPlacement(positionState, motionEvent, fallbackX) {
  return {
    x: Number(positionState?.x ?? motionEvent?.x ?? fallbackX),
    y: Number(positionState?.y ?? motionEvent?.y ?? 180),
    // SetPosition (0x221bea0) writes value4 to baseSortOrder, not scale.
    // Existing resource indexes used the wrong name; accept those bytes until
    // their next source export without changing character size or corpus.
    sortingOrder: Number(positionState?.sortingOrder ?? positionState?.scale ?? 1700),
    positionState,
  }
}

export function projectChibiGround(songCode, coordinates, width, height) {
  const fit = Math.min(width / 1280, height / 720)
  const registration = chibiGroundRegistration(songCode)
  return {
    x: width * 0.5 + coordinates.x * fit,
    y: height * 0.5 + (registration.originY - coordinates.y) * fit,
  }
}
