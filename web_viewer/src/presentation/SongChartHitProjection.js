import projection from '../../config/song-hit-projection.v1.json' with { type: 'json' }
import geometry from '../../config/song-track-native-geometry.v1.json' with { type: 'json' }
export { projection }

// Unity Euler angles apply Z, then X, then Y. XYZ rotates the tilted circles
// around a different plane and loses the horizontal ellipse in the reference.
export function rotateParticleEuler(v, x = 0, y = 0, z = 0) {
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z)
  const a = [v[0] * cz - v[1] * sz, v[0] * sz + v[1] * cz, v[2]]
  const b = [a[0], a[1] * cx - a[2] * sx, a[1] * sx + a[2] * cx]
  return [b[0] * cy + b[2] * sy, b[1], -b[0] * sy + b[2] * cy]
}

export function particleRuntimeScale(hold, noteScale = 1) {
  return (hold ? projection.holdRootScale : projection.transientRootScale) * noteScale
}

export function projectParticlePoint(point, lane, hold = false, pixelOffset = 0) {
  const { width, height } = geometry.viewport, target = geometry.target
  const anchorX = target.leftX + (target.rightX - target.leftX) * lane / 4
  if (hold) {
    // FloatingTarget lives under TargetCanvas (1/72 world units per UI unit),
    // resets the cloned root to 100*noteScale, and uses orthographic EffectCamera.
    return { x: width / 2 + anchorX + point[0] + pixelOffset, y: height / 2 - target.y - point[1], depth: 1 }
  }
  const pre = projection.cameras.pre, camera = projection.cameras.perspective
  const units = height / (2 * pre.orthographicSize)
  const worldX = anchorX / units + point[0]
  const worldY = target.y / units + point[1]
  const depth = pre.position.z + projection.targetCanvas.planeDistance + point[2] - camera.position.z
  const focal = height / (2 * Math.tan(camera.fieldOfView * Math.PI / 360))
  return { x: width / 2 + focal * (worldX - camera.position.x) / depth,
    y: height / 2 - focal * (worldY - camera.position.y) / depth, depth }
}

export function projectParticleQuad(center, x, y, lane, hold = false, pixelOffset = 0) {
  // Ordered top-left, top-right, bottom-left, bottom-right. Keep homogeneous
  // depth for GPU perspective-correct UV interpolation rather than an affine
  // ellipse/rotation around its 2D center.
  return [[-.5, .5], [.5, .5], [-.5, -.5], [.5, -.5]].map(([u, v]) =>
    projectParticlePoint(center.map((c, i) => c + x[i] * u + y[i] * v), lane, hold, pixelOffset))
}
