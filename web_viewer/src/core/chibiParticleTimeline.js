// A bounded RAW profile. Other modules/shaders remain unsupported.
export const CHIBI_PARTICLE_PROFILE = 'uv-single-burst-billboard-v1'

export function sampleParticleCurve(curve, time) {
  if (curve.mode === 0) return curve.scalar
  const keys = curve.keys
  if (time <= keys[0].time) return keys[0].value * curve.scalar
  if (time >= keys.at(-1).time) return keys.at(-1).value * curve.scalar
  const end = keys.findIndex(key => key.time > time)
  const a = keys[end - 1], b = keys[end], span = b.time - a.time
  const t = (time - a.time) / span, t2 = t * t, t3 = t2 * t
  // Unity unweighted AnimationCurve tangents are derivatives in key time units.
  return ((2 * t3 - 3 * t2 + 1) * a.value + (t3 - 2 * t2 + t) * span * a.outSlope
    + (-2 * t3 + 3 * t2) * b.value + (t3 - t2) * span * b.inSlope) * curve.scalar
}

export function sampleChibiParticle(system, milliseconds, activatedAt) {
  const elapsed = (milliseconds - activatedAt) / 1000 - system.delay
  if (elapsed < 0) return { visible: false, frame: 0 }
  const age = elapsed % system.duration
  // Burst repeats on SYSTEM duration, not particle lifetime (some have a gap).
  if (age >= system.lifetime) return { visible: false, frame: 0 }
  const fraction = system.startFrame + sampleParticleCurve(system.frameOverTime, age / system.lifetime)
  const frameCount = system.columns * system.rows
  const frame = ((Math.floor(fraction * frameCount) % frameCount) + frameCount) % frameCount
  return { visible: true, frame }
}

function validSystem(system, textures, serializedFile) {
  const finite = value => typeof value === 'number' && Number.isFinite(value)
  const curve = system?.frameOverTime
  const texture = textures?.[system?.texture]
  return system?.source?.serializedFile === serializedFile && typeof system.source.pathId === 'string'
    && system.shader?.serializedFile === serializedFile && typeof system.shader.pathId === 'string'
    && system.shader.name === 'Mobile/Particles/Additive' && system.shader.status === 'resolved_in_bundle'
    && /^[a-f0-9]{64}$/.test(system.shader.parametersSha256 || '')
    && system.shader.blend?.srcBlend === 5 && system.shader.blend?.destBlend === 1 && system.shader.blend?.blendOp === 0
    && /^[a-f0-9]{64}$/.test(system.source.parameterTreeSha256 || '')
    && texture?.serializedFile === serializedFile && texture.id === system.texture
    && /^particle-layers\/textures\/[\w.-]+\.png$/.test(texture.file || '')
    && texture.width === 1024 && texture.height === 1024
    && [system.size, system.duration, system.lifetime, system.delay, system.startFrame,
      system.position?.x, system.position?.y, system.position?.z,
      system.color?.r, system.color?.g, system.color?.b, system.color?.a].every(finite)
    && system.size > 0 && system.duration > 0 && system.lifetime > 0 && system.lifetime <= system.duration
    && system.delay >= 0 && system.columns === 4 && system.rows === 4
    && Object.values(system.color).every(value => value >= 0 && value <= 1)
    && curve && finite(curve.scalar) && [0, 1].includes(curve.mode) && Array.isArray(curve.keys)
    && (curve.mode === 0 || (curve.keys.length > 0 && curve.keys.every((key, i, keys) =>
      [key.time, key.value, key.inSlope, key.outSlope].every(finite) && (!i || key.time > keys[i - 1].time))))
}

export function attachChibiParticleLayers(objectIndex, particleIndex) {
  if (!objectIndex || particleIndex?.schemaVersion !== 1
    || particleIndex.projection !== 'existing-2d-object-plane') return objectIndex
  const assets = { ...objectIndex.assets }
  for (const [asset, entry] of Object.entries(particleIndex.assets || {})) {
    const original = assets[asset]
    if (original?.kind !== 'particle' || entry.profile !== CHIBI_PARTICLE_PROFILE
      || original.bundle !== entry.bundle || !/^[a-f0-9]{64}$/.test(entry.bundleSha256 || '')
      || !entry.keeper?.serializedFile || typeof entry.keeper.pathId !== 'string'
      || !Array.isArray(entry.systems) || !entry.systems.length
      || entry.systems.length !== entry.particleCount || original.particleCount !== entry.particleCount
      || !entry.systems.every(system => validSystem(system, particleIndex.textures, entry.keeper.serializedFile))) continue
    assets[asset] = { ...original, particleAnimation: { ...entry, textures: particleIndex.textures } }
  }
  // Keep original kinds/counts: RAW inventory does not become full VFX support.
  return { ...objectIndex, assets }
}
