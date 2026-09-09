import { projectStoryState } from '../../../shared/story/StoryStateProjector.js'

const color = value => `#${Number(value ?? 0).toString(16).padStart(6, '0').toUpperCase()}`
const usable = value => !!value && !value.destroyed
function readPlane(plane, kind) {
  if (!usable(plane)) return null
  return { visible: !!plane.visible, color: color(plane.tint),
    ...(kind === 'fade' ? { alpha: plane.alpha } : { x: plane.x, y: plane.y }) }
}
export function readProjectorActual(manager) {
  const background = manager.backgroundManager, transition = background?._bgTransition
  const layers = transition?.newSprite ? [
    ...(usable(transition.oldSprite) ? [{ bg: transition.oldBgId, alpha: transition.oldSprite.alpha }] : []),
    { bg: transition.newBgId, alpha: transition.newSprite.alpha },
  ] : usable(background?.bgSprite) ? [{ bg: background.currentBgId, alpha: background.bgSprite.alpha }] : []
  const container = manager.spineContainer
  const timing = handle => !handle || handle.cancelled ? null : { started_at: handle.startedAtMilliseconds / 1000, sampled_at: handle.sampledAtMilliseconds == null ? null : handle.sampledAtMilliseconds / 1000 }
  return {
    timing: { camera: timing(manager.cameraController?._cameraTween), fade: timing(manager._screenFadeTween), wipe: timing(manager._screenSlideTween) },
    background: background ? { layers, pending_texture: !!transition && !transition.newSprite,
      started_at: transition?.startedAtMilliseconds == null ? null : transition.startedAtMilliseconds / 1000,
      target: transition?.newBgId || null } : null,
    camera: usable(container) ? { scale: container.scale.x, x: container.x, y: container.y } : null,
    screen: { fade: readPlane(manager._fadeOverlay, 'fade'), wipe: readPlane(manager._slideOverlay, 'wipe') },
  }
}
function differences(expected, actual, path = '', output = []) {
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') { output.push({ path, expected, actual: actual ?? null }); return output }
    if (Array.isArray(expected) && expected.length !== actual.length) output.push({ path: `${path}.length`, expected: expected.length, actual: actual.length })
    for (const key of Object.keys(expected)) differences(expected[key], actual[key], path ? `${path}.${key}` : key, output)
  } else if (typeof expected === 'number' && Number.isFinite(actual)) {
    if (Math.abs(expected - actual) > .001) output.push({ path, expected, actual, delta: actual - expected })
  } else if (expected !== actual) output.push({ path, expected, actual: actual ?? null })
  return output
}
function comparablePlane(plane, kind) {
  if (!plane) return null
  return plane.visible ? { visible: true, color: plane.color.toUpperCase(),
    ...(kind === 'fade' ? { alpha: plane.alpha } : { x: plane.x, y: plane.y }) } : { visible: false }
}

/** Read-only diagnostic adapter. It samples, never advances, settles or restores Runtime. */
export function captureProjectorShadow({ scenario, stepIndex, runtime, manager, context = {} }) {
  if (!manager || manager._destroyed || !runtime?.clock || !scenario?.steps?.[stepIndex]) return { status: 'not-comparable', reason: 'runtime-not-ready' }
  const time = runtime.clock.time
  const actual = readProjectorActual(manager)
  const entries = runtime.entries || []
  const starts = Object.fromEntries(entries.filter(e => Number.isFinite(e.started_at)).map(e => [e.cue_id, e.started_at]))
  const step = scenario.steps[stepIndex]
  const knownIds = new Set(step.cues.map(c => c.cue_id))
  for (const id of Object.keys(starts)) if (!knownIds.has(id)) delete starts[id]
  if (actual.background?.started_at != null) {
    const active = [...step.cues].reverse().find(c => c.action === 'background.change' && c.payload.bg === actual.background.target && starts[c.cue_id] != null)
    if (active) starts[active.cue_id] = actual.background.started_at
  }
  for (const [kind, action] of [['camera', 'camera.transform'], ['fade', 'screen.fade'], ['wipe', 'screen.directional_wipe']]) {
    const observedStart = actual.timing[kind]?.started_at
    const latest = [...entries].reverse().find(e => e.action === action && Number.isFinite(e.started_at))
    if (latest && knownIds.has(latest.cue_id) && Number.isFinite(observedStart) && observedStart >= latest.started_at) starts[latest.cue_id] = observedStart
  }
  const basis = { ...context, ...(context.cuePolicy !== 'suppressed' ? { startedAt: starts } : {}) }
  let expected
  try { expected = projectStoryState(scenario, { stepIndex, time, viewport: { width: manager.width, height: manager.height }, context: basis }) }
  catch (error) { return { status: 'not-comparable', reason: 'projection-input', detail: error.message, step_index: stepIndex, time, actual } }
  const samples = {}
  for (const channel of ['background', 'camera', 'screen']) {
    const related = entries.filter(e => e.action?.startsWith(`${channel}.`))
    let reason = null
    if (expected[channel].status !== 'projected') reason = 'unsupported-projection'
    else if (related.some(e => e.completion_mode === 'explicit-settlement')) reason = 'explicit-settlement-requires-resolved-entry'
    else if (related.some(e => ['failed', 'cancelled'].includes(e.status))) reason = 'cue-failed-or-cancelled'
    else if (related.some(e => e.status === 'scheduled' && time >= e.at)) reason = 'cue-awaiting-dispatch'
    if (channel === 'background' && actual.background?.pending_texture) reason = 'texture-pending'
    if (reason) { samples[channel] = { status: 'not-comparable', reason }; continue }
    let wanted, observed
    if (channel === 'background') { wanted = expected.background.layers; observed = actual.background?.layers }
    if (channel === 'camera') {
      wanted = { scale: expected.camera.scale, x: expected.camera.x, y: expected.camera.y }; observed = actual.camera
    }
    if (channel === 'screen') {
      wanted = { fade: comparablePlane(expected.screen.fade, 'fade'), wipe: comparablePlane(expected.screen.wipe, 'wipe') }
      observed = { fade: comparablePlane(actual.screen.fade, 'fade'), wipe: comparablePlane(actual.screen.wipe, 'wipe') }
    }
    const delta = differences(wanted, observed)
    samples[channel] = { status: delta.length ? 'difference' : 'match', differences: delta }
  }
  return {
    shadow_version: 1, scenario_id: scenario.scenario_id || null,
    viewport: { width: manager.width, height: manager.height },
    scope: ['background-mix', 'camera-stage', 'screen-overlays'], status: Object.values(samples).some(s => s.status === 'difference') ? 'difference'
      : Object.values(samples).some(s => s.status === 'not-comparable') ? 'partial' : 'match',
    step_index: stepIndex, step_id: step.step_id, time, clock_state: runtime.clock.state,
    numeric_tolerance: .001, sampling: 'read-only-between-frames',
    note: 'Active animation differences may include frame sampling lag; no tolerance window is treated as a pass.',
    context: basis, expected, actual, channels: samples,
  }
}
