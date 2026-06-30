export function sampleLipCurve(curve, elapsedSeconds) {
  const scales = curve?.scales
  if (!Array.isArray(scales) || scales.length === 0) return 0
  const duration = Math.max(0.001, curve.duration || (scales.length / 60))
  const t = Math.min(Math.max(elapsedSeconds / duration, 0), 1)
  const pos = t * (scales.length - 1)
  const i = Math.floor(pos)
  const frac = pos - i
  const a = Number(scales[i]?.y || 0)
  const b = Number(scales[Math.min(i + 1, scales.length - 1)]?.y || 0)
  const y = a + (b - a) * frac
  return Math.min(1, Math.max(0, y * (curve.gain || 1)))
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
