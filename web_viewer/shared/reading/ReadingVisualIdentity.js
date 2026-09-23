const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const idolCode = /^[0-9]{3}[a-z]{3}$/
const noActor = () => ({ entityType: null, entityId: null })

/**
 * Reading presentation evidence, at entry time only. Call after normalizeScenario.
 * knownIdolIds comes from the published idol dictionary, not display-name parsing.
 * This projection never changes the speaker label or derives actors from models.
 */
export function projectReadingIdentity({ step, rowKind, speaker, knownIdolIds }) {
  if (!(knownIdolIds instanceof Set)) throw new TypeError('Reading identity requires an explicit idol dictionary')
  if (!Number.isInteger(step?.step_id)) throw new TypeError('Reading identity requires a step ID')
  const entry = record(step.entry_snapshot) ? step.entry_snapshot : null
  const diagnostics = []
  let performance = noActor()
  const finish = (presence, reason) => ({
    performance,
    visual: { ...performance, presence, reason, source: entry ? 'stage-snapshot' : null,
      snapshot: entry ? 'entry' : null, stepId: step.step_id },
    diagnostics,
  })
  if (rowKind !== 'dialogue' || ['none', 'producer'].includes(speaker?.kind)) {
    return finish('not-applicable', 'non-idol-dialogue')
  }
  const actorId = step.chara_id
  if (!idolCode.test(actorId || '') || !knownIdolIds.has(actorId)) {
    diagnostics.push('unresolved-performance-actor')
    return finish('unknown', 'unresolved-performance-actor')
  }
  performance = { entityType: 'idol', entityId: actorId }
  // A conflicting public identity is evidence to investigate, not permission to
  // show whichever character happens to be first on stage.
  if ((speaker?.entityId && speaker.entityId !== actorId) ||
      (speaker?.entityType && speaker.entityType !== 'idol')) {
    diagnostics.push('speaker-performance-conflict')
    return finish('unknown', 'speaker-performance-conflict')
  }
  if (!entry || !['story-snapshot-v2', 'legacy-state-v1'].includes(step.snapshot_format)) {
    diagnostics.push('entry-snapshot-unavailable')
    return finish('unknown', 'entry-snapshot-unavailable')
  }
  if (step.snapshot_format === 'legacy-state-v1') diagnostics.push('compatibility-stage-evidence')
  if (step.type !== 'adv' || entry.phone_mode === true || entry.talk_mode === true) {
    return finish('unknown', 'medium-policy-unavailable')
  }
  if (!Array.isArray(entry.spines)) {
    diagnostics.push('stage-presence-unavailable')
    return finish('unknown', 'stage-presence-unavailable')
  }
  const matches = entry.spines.filter(spine => spine?.id === actorId)
  const settled = Array.isArray(step.settled_snapshot?.spines)
    ? step.settled_snapshot.spines.filter(spine => spine?.id === actorId) : null
  if (Array.isArray(settled) && JSON.stringify(matches) !== JSON.stringify(settled)) {
    diagnostics.push('entry-settled-actor-difference')
  }
  if (!matches.length) return finish('offstage', 'actor-not-on-stage')
  if (matches.length !== 1) {
    diagnostics.push('ambiguous-stage-actor')
    return finish('unknown', 'ambiguous-stage-actor')
  }
  const spine = matches[0]
  if (spine.visible === false) return finish('hidden', 'explicitly-hidden')
  if (spine.visible !== true) return finish('unknown', 'visibility-unavailable')
  if (spine.silhouette === true || spine.idol_color?.toUpperCase?.() === '#000000') {
    return finish('silhouette', 'concealed-appearance')
  }
  // Model association is a consistency check only. It must never infer chara_id.
  if (typeof spine.model !== 'string' || !spine.model.startsWith(`${actorId}_`)) {
    diagnostics.push('unverified-actor-model')
    return finish('unknown', 'unverified-actor-model')
  }
  // parts_visible controls optional costume slots, not the whole actor.
  if (spine.alpha === 0) return finish('hidden', 'hidden-appearance')
  if (spine.fade || spine.idol_color_transition || spine.slide_duration > 0) {
    diagnostics.push('transitional-stage-appearance')
    return finish('unknown', 'transitional-stage-appearance')
  }
  return finish('visible', 'matching-visible-stage-actor')
}

/** Text secrecy is handled separately by readingPresentationSpeaker. */
export function readingVisualAvatarEntity(row) {
  const v = row?.visual
  return row?.kind === 'dialogue' && !['none', 'producer'].includes(row?.speaker?.kind) &&
    v?.presence === 'visible' && v.source === 'stage-snapshot' && v.snapshot === 'entry' &&
    v.stepId === row?.anchor?.step_id && v.entityType === 'idol' && idolCode.test(v.entityId || '') &&
    row?.performance?.entityType === 'idol' && row.performance.entityId === v.entityId
    ? v.entityId : null
}
