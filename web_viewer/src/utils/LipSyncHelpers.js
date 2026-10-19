// Client LipSyncPlayData starts 0.1 s into the curve and LipSyncData.GetScale reads the 60 fps sample at
// (int)(time * 60) without interpolation or stretching to the audio length; past the end the mouth closes.
export const LIP_FRAME_RATE = 60
export const LIP_START_TIME = 0.1

// Native lip sample {x, y} for elapsed voice time, or null once the curve is complete (mouth closed).
export function sampleLipScale(curve, elapsedSeconds) {
  const scales = curve?.scales
  if (!Array.isArray(scales) || scales.length === 0) return null
  const time = Math.max(0, Number(elapsedSeconds) || 0) + LIP_START_TIME
  if (time >= scales.length / LIP_FRAME_RATE) return null
  const sample = scales[Math.min(scales.length - 1, Math.floor(time * LIP_FRAME_RATE))] || {}
  return { x: Number(sample.x ?? 1), y: Number(sample.y || 0) }
}

// Opening amount (the sample's y) for UI meters; 0 when closed.
export function sampleLipCurve(curve, elapsedSeconds) {
  return Math.min(1, Math.max(0, sampleLipScale(curve, elapsedSeconds)?.y || 0))
}

export function deriveMainLipPathFromVoice(voice) {
  const file = String(voice || '').split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '')
  if (!file) return null

  const parts = file.split('_')
  if (parts.length < 5) return null

  const sceneParts = parts.slice(0, 4)
  if (!sceneParts.every(Boolean)) return null

  const sceneId = sceneParts.join('_')
  const mainId = sceneParts.slice(0, 3).join('_')
  const rest = parts.slice(4)
  let sourceId = null

  if (rest.length === 1) {
    const stem = rest[0].replace(/\d+$/, '')
    if (stem) sourceId = `${sceneId}_${stem}`
  } else if (rest.length >= 2) {
    sourceId = `${sceneId}_${rest[0]}`
  }

  return sourceId ? `adxlip/main/${mainId}/${sceneId}/${sourceId}/${file}.json` : null
}
