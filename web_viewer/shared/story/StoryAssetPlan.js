import { normalizeScenario } from './ScenarioNormalizer.js'

const HASH = /^sha256:[a-f0-9]{64}$/
const record = value => value && typeof value === 'object' && !Array.isArray(value)
const noAssetActions = new Set(['camera.transform', 'screen.fade', 'screen.directional_wipe',
  'spine.face.set', 'spine.body.play', 'spine.neck.play', 'spine.neck.stop', 'spine.visual.tint'])
const knownSnapshotFields = new Set(['bg', 'bg_effect', 'bg_effects', 'bg_transition', 'bg_profile',
  'bgm', 'bgm_volume', 'bgm_stop_fade', 'se', 'se_events', 'environmental', 'environmental_volume',
  'environmental_duck_target', 'spines', 'talk_mode', 'phone_mode', 'camera_zoom', 'screen_fade',
  'screen_slide', 'screen_effects', 'camera_filter', 'bg_color', 'bg_dof', 'bg_color_transition',
  'bg_dof_transition', 'text_disabled', 'image_icon', 'screen_overlay'])

/**
 * Logical requirements only: no fetch, renderer import, cue execution or branch
 * traversal. Dependency discovery is explicitly separate from download readiness.
 */
export function createStoryAssetPlan(input, { file, sha256 }) {
  if (!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.json$/.test(file || '') || !HASH.test(sha256 || '')) {
    throw new TypeError('Asset plan requires source file and SHA-256')
  }
  const scenario = normalizeScenario(input)
  if (!['story-runtime-v2', 'story-runtime-v2-compat'].includes(scenario.runtime_contract)) {
    throw new TypeError('Unsupported asset plan runtime contract')
  }
  const assets = new Map(), unresolved = [], stepIds = new Set()
  const issue = (use, reason) => unresolved.push({ ...use, reason })
  function add(kind, id, use, pending = null) {
    if (typeof id !== 'string' || !id) { issue(use, `invalid-${kind}-identity`); return null }
    const key = `${kind}:${id}`
    if (!assets.has(key)) assets.set(key, { key, kind, id, dependencies: [],
      dependencyState: pending ? 'pending' : 'complete', pending, uses: [] })
    const asset = assets.get(key)
    if (!asset.uses.some(previous => JSON.stringify(previous) === JSON.stringify(use))) asset.uses.push(use)
    return asset
  }
  function audio(kind, value, use) {
    if (value == null || value === '') return
    add(kind, typeof value === 'string' ? value : value.cue, use)
  }
  function effects(kind, values, use) {
    if (values == null) return
    if (!Array.isArray(values)) { issue(use, 'invalid-effect-list'); return }
    values.forEach((effect, index) => {
      if (['fadein', 'fadeout'].includes(effect?.type)) return // generated overlays, no texture
      add(kind, effect?.id || effect?.name || effect?.type, { ...use, path: `${use.path}[${index}]` }, 'effect-texture-mapping')
    })
  }
  scenario.steps.forEach((step, stepIndex) => {
    if (!Number.isInteger(step.step_id) || stepIds.has(step.step_id)) throw new TypeError('Asset plan requires unique integer step IDs')
    stepIds.add(step.step_id)
    const useAt = path => ({ stepIndex, stepId: step.step_id, path })
    for (const slot of ['entry_snapshot', 'settled_snapshot']) {
      const snapshot = step[slot]
      if (!record(snapshot)) { issue(useAt(slot), 'snapshot-unavailable'); continue }
      if (snapshot.bg) add('background', snapshot.bg, useAt(`${slot}.bg`))
      audio('bgm', snapshot.bgm, useAt(`${slot}.bgm`))
      audio('ambient', snapshot.environmental, useAt(`${slot}.environmental`))
      audio('se', snapshot.se, useAt(`${slot}.se`))
      if (snapshot.se_events != null && !Array.isArray(snapshot.se_events)) issue(useAt(`${slot}.se_events`), 'invalid-se-events')
      for (const [index, se] of (Array.isArray(snapshot.se_events) ? snapshot.se_events : []).entries()) audio('se', se, useAt(`${slot}.se_events[${index}]`))
      if (!Array.isArray(snapshot.spines)) issue(useAt(`${slot}.spines`), 'spines-unavailable')
      for (const [index, spine] of (Array.isArray(snapshot.spines) ? snapshot.spines : []).entries()) {
        const use = useAt(`${slot}.spines[${index}]`)
        const bundle = add('spine-bundle', spine?.model, use, 'atlas-pages-and-model-adapter')
        if (bundle) {
          for (const kind of ['spine-skeleton', 'spine-atlas']) {
            const dependency = add(kind, spine.model, use)
            if (!bundle.dependencies.includes(dependency.key)) bundle.dependencies.push(dependency.key)
          }
        }
        // Stage placement/lip-sync also read these data resources.
        if (spine?.id) {
          add('idol-placement', spine.id, use)
          add('idol-mouth', spine.id, use, 'model-specific-mouth-fallback')
          add('idol-body-types', 'index', use)
          add('idol-motion', 'index', use)
          add('costume-prefab-metadata', 'index', use)
          add('costume-dictionary', 'index', use)
        }
      }
      effects('background-effect', snapshot.bg_effects, useAt(`${slot}.bg_effects`))
      if (snapshot.bg_effect) issue(useAt(`${slot}.bg_effect`), 'legacy-effect-field')
      effects('screen-effect', snapshot.screen_effects, useAt(`${slot}.screen_effects`))
      if (typeof snapshot.image_icon === 'string' || snapshot.image_icon?.layer) add('image-icon', typeof snapshot.image_icon === 'string' ? snapshot.image_icon : snapshot.image_icon.display_id || snapshot.image_icon.id,
        useAt(`${slot}.image_icon`))
      if (snapshot.phone_mode || snapshot.talk_mode) issue(useAt(slot), 'communication-ui-dependencies')
      for (const [field, value] of Object.entries(snapshot)) {
        if (value != null && !knownSnapshotFields.has(field)) issue(useAt(`${slot}.${field}`), 'unclassified-snapshot-field')
      }
    }
    if (step.dialogue?.voice) add('voice', step.dialogue.voice, useAt('dialogue.voice'))
    if (step.dialogue?.lip?.path) add('lipsync', step.dialogue.lip.path, useAt('dialogue.lip.path'))
    else if (step.dialogue?.lip) issue(useAt('dialogue.lip'), 'unresolved-lipsync-format')
    if (step.stamp) add('stamp', step.stamp.id || step.stamp.stamp_id, useAt('stamp'))
    if (['talk', 'talk_stamp', 'call'].includes(step.type)) issue(useAt('type'), 'communication-ui-dependencies')
    for (const field of step.normalization?.unmapped_legacy_fields || []) issue(useAt(field), 'unmapped-legacy-field')
    if (step.cues != null && !Array.isArray(step.cues)) throw new TypeError('Asset plan cues must be an array')
    for (const [index, cue] of (step.cues || []).entries()) {
      const use = { ...useAt(`cues[${index}]`), cueId: cue.cue_id ?? null }
      if (cue.action === 'background.change') add('background', cue.payload?.bg, use)
      else if (cue.action === 'se.play') add('se', cue.payload?.cue, use)
      else if (!noAssetActions.has(cue.action)) issue(use, `unclassified-cue:${cue.action}`)
    }
  })
  return { schema_version: 1, source: { file, sha256, scenarioId: scenario.scenario_id ?? null,
    runtimeContract: scenario.runtime_contract }, stepCount: scenario.steps.length,
  assets: [...assets.values()], unresolved,
  dependenciesComplete: unresolved.length === 0 && [...assets.values()].every(asset => asset.dependencyState === 'complete') }
}
