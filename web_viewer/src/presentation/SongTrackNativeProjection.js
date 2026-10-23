// RhythmGameNoteManager.GetPosFromLane, client 2.6.10, RVA 0x242404c.
// ARM64 returns an HFA (x,y,z,scale), not the float shown by the old C signature.
const f = Math.fround
const lerp = (a, b, t) => f(f(a) + f(f(f(b) - f(a)) * f(t)))

export function nativeTrackDepth(fraction) {
  const beforeClamp = 1 - fraction
  const t = Math.min(beforeClamp, 1.2)
  const early = t < 1 ? 21 / (t * -400 + 420) - .05 : 0
  const late = t > 0 ? 5 / (t * -16 + 20) - .25 : 0
  let depth = f((1 - t) * early + t * late)
  if (t < beforeClamp) depth = f(depth + f(beforeClamp - t))
  return depth
}

export function songTrackNativePoint(lane, fraction, target) {
  if (!Number.isFinite(lane) || !Number.isFinite(fraction)) throw new Error('Invalid native track point')
  const depth = nativeTrackDepth(fraction)
  const ratio = f(21 / 880)
  const x = lerp(target.leftX, target.rightX, f(((lane * .5 - 1) + 1) * .5))
  return {
    x: f(lerp(f(x * ratio), x, depth) * f(target.laneWidthRate)),
    y: lerp(360, target.y, depth),
    z: lerp(200, 100, f(Math.max(0, Math.min(1, Math.min(1 - fraction, 1.2) / 1.5)))),
    scale: lerp(ratio, 1, depth),
  }
}
