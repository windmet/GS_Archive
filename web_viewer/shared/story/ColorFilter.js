// Native colour filter (client 2.6.10), shared by the story camera filter and the per-background idol filter.
// - camera_color loads TextAsset color_preset_<name> from color_filter_presets.unity3d; camera_defaultcolor
//   targets new ColorFilterPreset(Vector3.zero, Vector3.one, 1). StoryCamera.SetColorFilter waits the delay,
//   then lerps colorOffset, colorScale and saturation (not the matrix) linearly over the duration.
// - ScenarioBackgroundData (advbg_data_<bg>) carries colorOffSet/colorScale/colorSaturation, which
//   AdventureBackgroundPanel.BackgroundChange/BackgroundFadeChange apply to the IdolFigure target with no
//   duration whenever the background sprite is swapped.
// - ColorFilterSetting.SetColorTransform: M = Translate(offset) * Scale(scale) * fromYCbCr * Scale(1, s, s)
//   * toYCbCr (BT.601 constants at RVA 0x32d37b0), whose first three rows go to _ColorTransformR/G/B and are
//   dotted with the premultiplied texel, so the offset is weighted by alpha.

export const COLOR_FILTER_PRESETS_BUNDLE = 'color_filter_presets.unity3d'

export const IDENTITY_COLOR_FILTER = Object.freeze({
  colorOffset: Object.freeze({ x: 0, y: 0, z: 0 }),
  colorScale: Object.freeze({ x: 1, y: 1, z: 1 }),
  saturation: 1,
})

const preset = (offset, scale, saturation) => Object.freeze({
  colorOffset: Object.freeze({ x: offset[0], y: offset[1], z: offset[2] }),
  colorScale: Object.freeze({ x: scale[0], y: scale[1], z: scale[2] }),
  saturation,
})

// TextAsset bodies of color_filter_presets.unity3d, verbatim.
export const CAMERA_COLOR_PRESETS = Object.freeze({
  gray: preset([-0.1, -0.1, -0.1], [1.2, 1.2, 1.2], 0.4),
  mono: preset([0, 0, 0], [1, 1, 1], 0.05),
  sepia: preset([0, -0.02, -0.05], [1.1, 1, 0.8], 0.1),
  sepia_light: preset([0, -0.02, -0.05], [1.1, 1.05, 1], 0.6),
})

const TO_YCBCR = [
  [0.299, 0.587, 0.114],
  [-0.169, -0.331, 0.5],
  [0.5, -0.419, -0.081],
]
const FROM_YCBCR = [
  [1, 0, 1.402],
  [1, -0.344, -0.714],
  [1, 1.772, 0],
]

function finite(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function vector(value, fallback) {
  return {
    x: finite(value?.x, fallback.x),
    y: finite(value?.y, fallback.y),
    z: finite(value?.z, fallback.z),
  }
}

/** Preset for a camera_color name, or null when the client has no such TextAsset. */
export function cameraColorPreset(name) {
  return Object.hasOwn(CAMERA_COLOR_PRESETS, name) ? CAMERA_COLOR_PRESETS[name] : null
}

/** IdolFigure preset of a compiled bg_profile; identity when the profile has none. */
export function backgroundIdolColorPreset(profile) {
  if (!profile) return IDENTITY_COLOR_FILTER
  return {
    colorOffset: vector(profile.colorOffSet, IDENTITY_COLOR_FILTER.colorOffset),
    colorScale: vector(profile.colorScale, IDENTITY_COLOR_FILTER.colorScale),
    saturation: finite(profile.colorSaturation, 1),
  }
}

export function isIdentityColorFilter(filter) {
  const { colorOffset: o, colorScale: s, saturation } = filter
  return o.x === 0 && o.y === 0 && o.z === 0 && s.x === 1 && s.y === 1 && s.z === 1 && saturation === 1
}

/** Mathf.Lerp of each preset component, t clamped to [0, 1]. */
export function lerpColorFilter(from, to, t) {
  const k = Math.max(0, Math.min(1, t))
  const mix = (a, b) => a + (b - a) * k
  const mixVector = (a, b) => ({ x: mix(a.x, b.x), y: mix(a.y, b.y), z: mix(a.z, b.z) })
  return {
    colorOffset: mixVector(from.colorOffset, to.colorOffset),
    colorScale: mixVector(from.colorScale, to.colorScale),
    saturation: mix(from.saturation, to.saturation),
  }
}

/** Rows R, G, B of SetColorTransform as [r, g, b, offset]. */
export function colorFilterRows(filter) {
  const scale = [filter.colorScale.x, filter.colorScale.y, filter.colorScale.z]
  const offset = [filter.colorOffset.x, filter.colorOffset.y, filter.colorOffset.z]
  const chroma = [1, filter.saturation, filter.saturation]
  // The client only multiplies the YCbCr round trip in when saturation != 1; its rounded constants are not
  // an exact inverse pair.
  const roundTrip = filter.saturation !== 1
  return [0, 1, 2].map(row => {
    const coefficients = [0, 1, 2].map(column => !roundTrip ? Number(row === column) : FROM_YCBCR[row].reduce(
      (sum, value, k) => sum + value * chroma[k] * TO_YCBCR[k][column], 0))
    return [...coefficients.map(value => value * scale[row]), offset[row]]
  })
}

/** PIXI.ColorMatrixFilter.matrix (offsets already in 0..1) for a preset. */
export function colorFilterPixiMatrix(filter) {
  const [r, g, b] = colorFilterRows(filter)
  return [
    r[0], r[1], r[2], 0, r[3],
    g[0], g[1], g[2], 0, g[3],
    b[0], b[1], b[2], 0, b[3],
    0, 0, 0, 1, 0,
  ]
}
