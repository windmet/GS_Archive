import hitEffectsConfig from '../../config/song-hit-effects.v1.json' with { type: 'json' }

export { hitEffectsConfig }

const EVALUATION_SUFFIXES = ['Slow', 'Fast', 'Good', 'Great', 'Perfect']
const PREFIXES = ['_touch', '_flickUp', '_flickRight', '_flickLeft', '_touch']

// Resolve the native hitType (0..6) from a demonstration timeline event or raw note properties.
// In native ARM64 RhythmGameNoteManager.ShowHitEffect (0x242a430):
// - If resuming: returns null (suppresses transient effects)
// - Producer skill flag (5) takes precedence over special (6) and note types.
// - Special flag (6) takes precedence over normal note types.
export function resolveSongNoteHitType(event, options = {}) {
  if (options.resuming || event?.resuming) return null

  // If raw native flags are provided directly:
  if (typeof options.producerSkill === 'boolean' || typeof options.special === 'boolean' || typeof options.noteType === 'number') {
    if (options.producerSkill) return 5
    if (options.special) return 6
    const mapped = hitEffectsConfig.noteTypeHitTypeMap[options.noteType]
    return typeof mapped === 'number' ? mapped : 7
  }

  // Otherwise map from the presentation role:
  const role = event?.role
  if (role === 'p_skill') return 5
  if (role === 'sp') return 6
  if (role === 'swipe_up') return 1
  if (role === 'swipe_right') return 2
  if (role === 'swipe_left') return 3
  if (role === 'normal' || role === 'middle') return 0
  return hitEffectsConfig.hitTypeRoleMap[role] ?? 7
}

// Native ARM64 EventNoteTypeExtenions.GetNoteHitType (0x1f475b0) table.
export function resolveNativeHitType({ noteType = 0, producerSkill = false, special = false, resuming = false } = {}) {
  if (resuming) return null
  if (producerSkill) return 5
  if (special) return 6
  return hitEffectsConfig.noteTypeHitTypeMap[noteType] ?? 7
}

// Prefab lookup matching native LiveHitEffectPrefabsData.GetPrefab (0x1d7b654).
// In Auto Live, evaluation is forced to PERFECT (6).
export function lookupSongHitEffectPrefab({ setIndex = 1, hitType = 0, evaluation = 6 } = {}) {
  const set = hitEffectsConfig.sets[setIndex - 1] || hitEffectsConfig.sets[0]
  let field = '_nullTap'
  if (hitType === 5) {
    field = '_touchPSkill'
  } else if (hitType === 6) {
    field = '_touchSpecial'
  } else if (hitType >= 0 && hitType <= 4) {
    const prefix = PREFIXES[hitType]
    const suffix = EVALUATION_SUFFIXES[evaluation - 2]
    if (prefix && suffix) field = prefix + suffix
  }

  const ref = set.refs.find(r => r.field === field)
  if (!ref || !ref.pathId) return null
  const prefab = hitEffectsConfig.prefabs[String(ref.pathId)]
  if (!prefab) return null
  const contract = hitEffectsConfig.defaultContracts[String(ref.pathId)]
  // IsAlive includes the lifetime of particles born in later bursts. Using
  // only max startLifetime cuts P-skill at .5s and Special at .55s too early.
  const maxLifetime = contract ? Math.max(...contract.layers.map(layer =>
    (Math.max(0, ...layer.bursts.map(burst => burst.time)) + layer.lifetime) / layer.simulationSpeed))
    : prefab.maxLifetime || 0.7

  return Object.freeze({
    setIndex: set.index,
    setName: set.name,
    field,
    pathId: ref.pathId,
    name: prefab.name,
    scale: prefab.scale,
    systems: prefab.systems,
    maxLifetime,
    guardTimeout: hitEffectsConfig.guardTimeout || 5.0,
    useParseCamera: Boolean(set.useParseCamera),
  })
}

// Look up continuous hold effect prefab (e.g. fx_in_touch_circle_hold).
export function lookupSongHoldEffectPrefab({ setIndex = 1 } = {}) {
  const set = hitEffectsConfig.sets[setIndex - 1] || hitEffectsConfig.sets[0]
  const ref = set.refs.find(r => r.field === '_hold')
  if (!ref || !ref.pathId) return null
  const prefab = hitEffectsConfig.prefabs[String(ref.pathId)]
  if (!prefab) return null

  return Object.freeze({
    setIndex: set.index,
    setName: set.name,
    field: '_hold',
    pathId: ref.pathId,
    name: prefab.name,
    scale: prefab.scale,
    systems: prefab.systems,
    looping: true,
  })
}

// Instance lifecycle management and multi-event pool.
// Manages transient hits, decaying lane flashes, and continuous hold rings.
export function createSongChartHitEffectPool({ setIndex = 1 } = {}) {
  const instances = new Map()
  const laneLastHit = [-Infinity, -Infinity, -Infinity, -Infinity, -Infinity]
  const holdPrefab = lookupSongHoldEffectPrefab({ setIndex })
  let autoEvalLastSpawn = -Infinity
  let instanceSeq = 0

  function spawn(event, seconds) {
    const hitType = resolveSongNoteHitType(event)
    if (hitType === null || hitType === 7) return null
    const targetLane = Math.max(0, Math.min(4, Math.round(event.lane)))
    const prefab = lookupSongHitEffectPrefab({ setIndex, hitType, evaluation: 6 })
    if (!prefab) return null

    const instanceId = `${event.id || event.sourceIndex}-${seconds}-${++instanceSeq}`
    const instance = {
      instanceId,
      sourceIndex: event.sourceIndex,
      eventId: event.id,
      endpoint: event.endpoint,
      role: event.role,
      lane: event.lane,
      targetLane,
      hitType,
      evaluation: 6,
      spawnSeconds: seconds,
      duration: prefab.maxLifetime,
      guardTimeout: prefab.guardTimeout,
      prefab: prefab.name,
      pathId: prefab.pathId,
      systems: prefab.systems,
    }
    instances.set(instanceId, instance)
    laneLastHit[targetLane] = seconds
    autoEvalLastSpawn = seconds
    return instance
  }

  function prune(seconds) {
    for (const [id, inst] of instances.entries()) {
      const age = seconds - inst.spawnSeconds
      if (age < 0 || age >= inst.duration || age >= inst.guardTimeout) {
        instances.delete(id)
      }
    }
  }

  function snapshot(seconds, activeHolds = []) {
    prune(seconds)
    const hits = []
    for (const inst of instances.values()) {
      const age = seconds - inst.spawnSeconds
      hits.push(Object.freeze({
        ...inst,
        age,
        progress: Math.min(1, Math.max(0, age / inst.duration)),
      }))
    }

    const laneAlphas = [0, 0, 0, 0, 0]
    for (let i = 0; i < 5; i++) {
      const age = seconds - laneLastHit[i]
      if (age >= 0 && age < 0.5) {
        laneAlphas[i] = Math.max(0, 1.0 - age * hitEffectsConfig.laneDecayRate)
      }
    }

    const evalAge = seconds - autoEvalLastSpawn
    const evalDuration = hitEffectsConfig.evaluation?.animation?.duration ?? 1.0
    const autoEvalActive = evalAge >= 0 && evalAge < evalDuration
    const autoEvalAlpha = autoEvalActive ? Math.max(0, 1.0 - evalAge / evalDuration) : 0

    const holds = activeHolds.map(h => Object.freeze({
      sourceIndex: h.sourceIndex,
      lane: h.lane,
      age: h.age,
      remaining: h.remaining,
      startSeconds: h.startSeconds,
      knots: h.knots,
      prefab: holdPrefab?.name || null,
      pathId: holdPrefab?.pathId || null,
    }))

    return Object.freeze({
      seconds,
      hits: Object.freeze(hits),
      holds: Object.freeze(holds),
      laneAlphas: Object.freeze(laneAlphas),
      autoEval: Object.freeze({ active: autoEvalActive, age: evalAge, alpha: autoEvalAlpha }),
    })
  }

  function advance(seconds, crossed = [], activeHolds = []) {
    if (!Number.isFinite(seconds)) throw new TypeError('Media time must be finite')
    for (const item of crossed) {
      const events = item.events || [item]
      for (const e of events) spawn(e, item.seconds ?? seconds)
    }
    return snapshot(seconds, activeHolds)
  }

  function seek(seconds, activeHolds = []) {
    if (!Number.isFinite(seconds)) throw new TypeError('Media time must be finite')
    instances.clear()
    laneLastHit.fill(-Infinity)
    autoEvalLastSpawn = -Infinity
    return snapshot(seconds, activeHolds)
  }

  function clear() {
    instances.clear()
    laneLastHit.fill(-Infinity)
    autoEvalLastSpawn = -Infinity
  }

  return { spawn, advance, seek, clear }
}
