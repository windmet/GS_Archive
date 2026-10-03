// Native streamed keys store cubic coefficients in elapsed key time units.
export function sampleStreamedCurve(curve, seconds) {
  const key=curve.keys.findLast(key=>key.time<=seconds)
  if(!key)return curve.initialValue
  const t=seconds-key.time,[a,b,c,d]=key.coefficients
  return ((a*t+b)*t+c)*t+d
}
