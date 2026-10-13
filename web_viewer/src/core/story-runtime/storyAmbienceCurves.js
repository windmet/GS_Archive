// Ambience volume curves serialized on the 2.6.10 StoryView prefab (APK
// resources.assets, MonoBehaviour 116703; read through a Cpp2IL-generated type tree).
// StoryView.AmbienceDucking plays DUCK when a text cut appears or on
// environmental_ducking; CoPlayAmbienceSound plays RESTORE when new ambience starts
// while ducked (unless the row sets duckingCompleted, which starts at the ducked level).

export const AMBIENCE_DUCK_CURVE = Object.freeze([
  { time: 0, value: 1, inSlope: -1.6517205238342285, outSlope: -1.6517205238342285 },
  { time: 0.5163201689720154, value: 0.4198879599571228, inSlope: -0.4548931419849396, outSlope: -0.4548931419849396 },
  { time: 1.7999999523162842, value: 0.20000000298023224, inSlope: -0.14850282669067383, outSlope: -0.14850282669067383 },
])

export const AMBIENCE_RESTORE_CURVE = Object.freeze([
  { time: 0, value: 0.20000000298023224, inSlope: 1.600000023841858, outSlope: 1.600000023841858 },
  { time: 0.5, value: 1, inSlope: 1.600000023841858, outSlope: 1.600000023841858 },
])

export const AMBIENCE_DUCKED_LEVEL = AMBIENCE_DUCK_CURVE[AMBIENCE_DUCK_CURVE.length - 1].value

/** Unity AnimationCurve.Evaluate for non-weighted keys (Hermite), clamped to the ends. */
export function evaluateUnityCurve(keys, time) {
  if (!keys.length) return 0
  if (time <= keys[0].time) return keys[0].value
  const last = keys[keys.length - 1]
  if (time >= last.time) return last.value
  let i = 0
  while (time > keys[i + 1].time) i++
  const a = keys[i]
  const b = keys[i + 1]
  const dt = b.time - a.time
  const s = (time - a.time) / dt
  const s2 = s * s
  const s3 = s2 * s
  return (2 * s3 - 3 * s2 + 1) * a.value + (s3 - 2 * s2 + s) * a.outSlope * dt
    + (-2 * s3 + 3 * s2) * b.value + (s3 - s2) * b.inSlope * dt
}

/** Sample a curve into a Float32Array for AudioParam.setValueCurveAtTime. */
export function sampleUnityCurve(keys, samples = 32) {
  const duration = keys[keys.length - 1].time
  const values = new Float32Array(samples)
  for (let i = 0; i < samples; i++) values[i] = evaluateUnityCurve(keys, duration * i / (samples - 1))
  return { values, duration }
}
