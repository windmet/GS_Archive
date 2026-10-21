import { sampleObjectEmitter } from './chibiObjectEmitters.js'
import { advHorizontalSqueeze, advStageUnit, advViewOriginY } from '../../shared/story/AdvStageLayout.js'
import MODEL from '../data/advParticleEffects.json' with { type: 'json' }

// Story bg effects bound to the APK fx_adv_* ParticleSystems (scripts/prepare-adv-particle-effects.py) and
// sampled with the stage emitter sampler. Positions come out in particle units x 100 with y down; on the ADV
// stage one particle unit is ADV_CANVAS_PER_WORLD canvas units around the canvas origin.
export const ADV_PARTICLE_MODEL = MODEL

/** Prefab an effect id instantiates; cameraflare follows the background's lightPosition (0 none, 1 left, 2 right). */
export function advParticlePrefab(id, bgProfile = null) {
  const binding = MODEL.effects[id]
  if (typeof binding === 'string') return binding
  if (!binding) return null
  return binding[String(Number(bgProfile?.lightPosition ?? 0))] || null
}

export function advParticleSystems(prefab) {
  return MODEL.prefabs[prefab]?.systems || []
}

/** StoryEffectController.CreateBgEffectCoroutine: a negative or absent command alpha falls back to the
 *  background's lightAlpha for cameraflare and to 1 for every other effect. */
export function advParticleEffectAlpha(id, commandAlpha, bgProfile = null) {
  const alpha = commandAlpha == null ? NaN : Number(commandAlpha)
  if (Number.isFinite(alpha) && alpha >= 0) return alpha
  if (id !== 'cameraflare') return 1
  const light = Number(bgProfile?.lightAlpha)
  return Number.isFinite(light) ? light : 1
}

/** One sampled particle as a Pixi matrix on a width x height stage, before the camera (actor) transform. */
export function advParticleQuad(system, sample, effectAlpha, width, height) {
  const k = advStageUnit(width, height) * MODEL.placement.canvasPerWorld / 100
  let { a, b, c, d } = sample
  // ParticleSystemRenderer.m_Pivot shifts the quad by pivot x size along its own axes: Unity +x is (a, b),
  // Unity +y is -(c, d) because exported texture rows are flipped.
  const px = system.pivot ? system.pivot.x * a - system.pivot.y * c : 0
  const py = system.pivot ? system.pivot.x * b - system.pivot.y * d : 0
  // m_Flip 1 mirrors every particle on that axis.
  if (system.flip?.x) { a = -a; b = -b }
  if (system.flip?.y) { c = -c; d = -d }
  return {
    a: a * k, b: b * k, c: c * k, d: d * k,
    x: width / 2 + (sample.x * advHorizontalSqueeze(width, height) + px) * k,
    y: advViewOriginY(width, height) + (sample.y + py) * k,
    alpha: sample.alpha * effectAlpha ** system.commandAlphaPower,
    tint: sample.color,
    frame: sample.frame,
  }
}

/** Live particles of one system at `time` for an effect started at `activatedAt` (ms, no prewarm). */
export function sampleAdvParticles(system, time, activatedAt, effectAlpha, width, height) {
  return sampleObjectEmitter(system, time, activatedAt)
    .map(sample => advParticleQuad(system, sample, effectAlpha, width, height))
}
