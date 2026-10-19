// Native streamed keys store cubic coefficients in elapsed key time units.
export function sampleStreamedCurve(curve, seconds) {
  // Native cached streamed coefficients still undergo cubic evaluation for
  // NaN time. Do not turn an invalid clock into a valid initial pose.
  if (Number.isNaN(seconds)) return NaN
  const key=curve.keys.findLast(key=>key.time<=seconds)
  if(!key)return curve.initialValue
  const t=seconds-key.time,[a,b,c,d]=key.coefficients
  return ((a*t+b)*t+c)*t+d
}
