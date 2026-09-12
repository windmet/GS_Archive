import { normalizeScenario } from './ScenarioNormalizer.js'
import { effectTextures } from './EffectTextures.js'
import { communicationRequirements } from './CommunicationScenes.js'
import { legacyFieldCoverage } from './LegacyFieldCoverage.js'
import { mouthSettingCandidates } from './MouthSettingCandidates.js'

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
  const assets = new Map(), unresolved = [], accountedFields = [], stepIds = new Set()
  const issue = (use, reason) => unresolved.push({ ...use, reason })
  // `required: false` marks a requirement the runtime is known to ignore. It is
  // still enumerated with the reason it is unused, but it is not a download:
  // nothing may count it towards readiness or loading progress.
  function add(kind, id, use, pending = null, runtimeDisabled = null) {
    if (typeof id !== 'string' || !id) { issue(use, `invalid-${kind}-identity`); return null }
    const key = `${kind}:${id}`
    if (!assets.has(key)) {
      const entry = { key, kind, id, required: !runtimeDisabled, dependencies: [],
        dependencyState: pending ? 'pending' : 'complete', pending, uses: [] }
      if (runtimeDisabled) entry.runtimeDisabled = runtimeDisabled
      assets.set(key, entry)
    }
    const asset = assets.get(key)
    if (!asset.uses.some(previous => JSON.stringify(previous) === JSON.stringify(use))) asset.uses.push(use)
    return asset
  }
  function audio(kind, value, use) {
    if (value == null || value === '') return
    add(kind, typeof value === 'string' ? value : value.cue, use)
  }
  // Effects resolve per handler domain: an authored id only requires textures
  // in the snapshot field whose manager implements it.
  function effects(values, domain, use) {
    if (values == null) return
    if (!Array.isArray(values)) { issue(use, 'invalid-effect-list'); return }
    values.forEach((effect, index) => {
      const at = { ...use, path: `${use.path}[${index}]` }
      const resolved = effectTextures(effect, domain)
      if (resolved.reason) { issue(at, resolved.reason); return }
      resolved.textures.forEach(texture =>
        add('effect-texture', texture, at, null, resolved.runtimeDisabled))
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
          const mouth = add('idol-mouth', spine.id, use, bundle ? null : 'model-specific-mouth-fallback')
          if (bundle && mouth) {
            const config = add('model-mouth', `${spine.id}/${spine.model}`, use)
            config.modelId = spine.model
            config.candidateIds = mouthSettingCandidates(spine.id, spine.model)
            if (!mouth.dependencies.includes(config.key)) mouth.dependencies.push(config.key)
          }
          add('idol-body-types', 'index', use)
          add('idol-motion', 'index', use)
          add('costume-prefab-metadata', 'index', use)
          add('costume-dictionary', 'index', use)
        }
      }
      effects(snapshot.bg_effects, 'bg_effects', useAt(`${slot}.bg_effects`))
      if (snapshot.bg_effect) issue(useAt(`${slot}.bg_effect`), 'legacy-effect-field')
      effects(snapshot.screen_effects, 'screen_effects', useAt(`${slot}.screen_effects`))
      if (typeof snapshot.image_icon === 'string' || snapshot.image_icon?.layer) add('image-icon', typeof snapshot.image_icon === 'string' ? snapshot.image_icon : snapshot.image_icon.display_id || snapshot.image_icon.id,
        useAt(`${slot}.image_icon`))
      for (const [field, value] of Object.entries(snapshot)) {
        if (value != null && !knownSnapshotFields.has(field)) issue(useAt(`${slot}.${field}`), 'unclassified-snapshot-field')
      }
    }
    if (step.dialogue?.voice) add('voice', step.dialogue.voice, useAt('dialogue.voice'))
    if (step.dialogue?.lip?.path) add('lipsync', step.dialogue.lip.path, useAt('dialogue.lip.path'))
    else if (step.dialogue?.lip) issue(useAt('dialogue.lip'), 'unresolved-lipsync-format')
    if (step.stamp) add('stamp', step.stamp.id || step.stamp.stamp_id, useAt('stamp'))
    // A field the normalizer leaves out of the cue layer is only an open gap
    // when nothing else accounts for it. Fields with a real handler need no
    // asset, so they are recorded as covered instead of inflating the backlog.
    for (const field of step.normalization?.unmapped_legacy_fields || []) {
      const coverage = legacyFieldCoverage(field)
      if (coverage) accountedFields.push({ ...useAt(field), field, handledBy: coverage.handledBy })
      else issue(useAt(field), 'unmapped-legacy-field')
    }
    if (step.cues != null && !Array.isArray(step.cues)) throw new TypeError('Asset plan cues must be an array')
    for (const [index, cue] of (step.cues || []).entries()) {
      const use = { ...useAt(`cues[${index}]`), cueId: cue.cue_id ?? null }
      if (cue.action === 'background.change') add('background', cue.payload?.bg, use)
      else if (cue.action === 'se.play') add('se', cue.payload?.cue, use)
      else if (!noAssetActions.has(cue.action)) issue(use, `unclassified-cue:${cue.action}`)
    }
  })
  // Communication surfaces resolve through the runtime's own presentation
  // context, so a step that shows a phone scene because of what it continues
  // is described by the scene it is actually in.
  for (const step of communicationRequirements(scenario)) {
    const use = { stepIndex: step.stepIndex, stepId: scenario.steps[step.stepIndex]?.step_id ?? null, path: 'communication' }
    for (const requirement of step.requirements) {
      const at = requirement.optionIndex == null ? use : { ...use, optionIndex: requirement.optionIndex }
      if (requirement.reason) issue(at, requirement.reason)
      else add(requirement.kind, requirement.id, at)
    }
  }
  return { schema_version: 1, source: { file, sha256, scenarioId: scenario.scenario_id ?? null,
    runtimeContract: scenario.runtime_contract }, stepCount: scenario.steps.length,
  assets: [...assets.values()], unresolved, accountedFields,
  dependenciesComplete: unresolved.length === 0 && [...assets.values()].every(asset => asset.dependencyState === 'complete') }
}
