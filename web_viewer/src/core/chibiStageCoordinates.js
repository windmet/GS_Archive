// CSV depth coordinates and stage art must share a fixed design-space origin.
// Study's platform centres (600,620), (950,750), (1300,660) in the
// 1900x1060 art register CSV Y 270/140/230 at baseline 540 in 1280x720.
// The former viewport-height * .82 placed every stage 50.4 design pixels
// farther forward, and drifted relative to the art on letterboxed canvases.
// This common 2D registration is reference-calibrated, not Unity projection.
export function chibiGroundRegistration() {
  return { baselineY: 540, id: 'design-space-ground-v1' }
}

// Independent position commands own formation and off-stage visibility.
// Motion rows retain legacy x/y fields, but cannot overwrite a formation.
export function resolveChibiPlacement(positionState, motionEvent, fallbackX) {
  return {
    x: Number(positionState?.x ?? motionEvent?.x ?? fallbackX),
    y: Number(positionState?.y ?? motionEvent?.y ?? 180),
    scale: Number(positionState?.scale ?? 1700),
    positionState,
  }
}

export function projectChibiGround(songCode, coordinates, width, height) {
  const fit = Math.min(width / 1280, height / 720)
  const registration = chibiGroundRegistration(songCode)
  const baseline = height * 0.5 + (registration.baselineY - 360) * fit
  return {
    x: width * 0.5 + coordinates.x * fit,
    y: baseline + (180 - coordinates.y) * fit,
  }
}
