import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { computed, ref } from 'vue'
import { createNativeCutWait, nativeWaitSeconds } from '../src/core/story-runtime/NativeCutWait.js'
import { finiteBranchNextIndex, finiteChoiceTargetIndex } from '../shared/story/FiniteBranchFlow.js'
import { PlaybackModeController } from '../src/core/story-runtime/PlaybackModeController.js'
import { useStepSceneEffects } from '../src/core/useStepSceneEffects.js'

// Wait-only client cuts (compiled post_wait / pre_wait) hold the screen between
// steps. Runs the production StoryViewer handlers with controlled timers.
const source = readFileSync(new URL('../src/core/StoryViewer.vue', import.meta.url), 'utf8')
const handlers = ['goNext', 'holdNativeCut', 'leaveStep', 'onChoice', 'commitChoice'].map(name => {
  const match = source.match(new RegExp(`\\nfunction ${name}\\([^]*?\\n\\}`))
  assert.ok(match, name)
  return match[0]
}).join('\n')
assert.match(source, /hasBlockingAuto:[^\n]*nativeCutWait\.pending/, 'auto mode waits out a cut wait')
const watcher = source.match(/watch\(currentStep, \(newStep, oldStep\) => \{([\s\S]*?)\n\}\)/)[1]
assert.match(watcher, /nativeCutWait\.cancel\(\)/, 'a step change drops the wait it was holding')
assert.match(source, /onBeforeUnmount\(\(\) => \{[^]*?nativeCutWait\.cancel\(\)/, 'unmount drops a pending wait')
assert.match(source, /getSteps: \(\) => compiledData\.value\?\.steps/, 'transition timers see the holds')

const timers = new Map()
let serial = 0
const setTimer = (fn, ms) => { timers.set(++serial, { fn, ms }); return serial }
const clearTimer = id => timers.delete(id)
const fire = () => { const due = [...timers.values()]; timers.clear(); due.forEach(t => t.fn()) }
const delays = () => [...timers.values()].map(t => t.ms)

function viewer(steps) {
  const index = ref(0)
  const log = []
  const ctx = {
    RUNTIME_DEBUG: false, releaseSoakRecorder: { record() {} },
    compiledData: ref({ steps }), currentStepIndex: index, currentStep: computed(() => steps[index.value]),
    episodeFinished: ref(false), backlogOpen: ref(false), menuOpen: ref(false), viewingOfferOpen: ref(false),
    runtimeReadinessStatus: ref('playable'), titlePaused: ref(false), titleAnimationPending: ref(false),
    titleAdvancePending: null, setTitleAnimationPending() {}, runtimePauseReasons: new Set(),
    storyRuntimeCues: { hasNonSkippable: () => false, cancelCurrentStep() {}, settleCurrentStep: () => false },
    _stopCurrentVoice() {}, markStepRead() {}, recordHistoryStep() {}, leaveRestoredScene() {}, finishEpisode() { log.push('finish') },
    isLastStep: computed(() => index.value === steps.length - 1),
    advanceStep() { index.value++; return true },
    navigateChoice(option) { log.push(option.label); index.value = finiteChoiceTargetIndex({ steps }, index.value, option) },
    playbackController: { skipEnabled: false },
    nativeCutWait: createNativeCutWait({ setTimer, clearTimer }),
    nativeWaitSeconds, finiteBranchNextIndex, finiteChoiceTargetIndex,
  }
  vm.runInNewContext(handlers, ctx)
  return { ctx, index, log }
}

const adv = (id, extra = {}) => ({ step_id: id, type: 'adv', dialogue: { text: `line ${id}` }, ...extra })
{
  // post_wait of the step left + pre_wait of the step entered, then advance.
  const { ctx, index } = viewer([adv(1, { post_wait: 0.5 }), adv(2, { pre_wait: 0.25 }), adv(3)])
  assert.equal(ctx.goNext('user'), 'held')
  assert.equal(index.value, 0, 'the screen stays on the line during the wait')
  assert.deepEqual(delays(), [750])
  assert.equal(ctx.goNext('auto'), 'blocked', 'auto mode waits it out')
  fire()
  assert.equal(index.value, 1)
  assert.equal(ctx.goNext('user'), 'advanced', 'no hold between steps without waits')
}
{
  // A tap during the wait clears it (OnClickBackgroundPanel).
  const { ctx, index } = viewer([adv(1, { post_wait: 2 }), adv(2)])
  assert.equal(ctx.goNext('user'), 'held')
  assert.equal(ctx.goNext('user'), 'advanced')
  assert.equal(index.value, 1)
  assert.equal(timers.size, 0, 'the cleared wait leaves no timer behind')
}
{
  // Skip mode never holds.
  const { ctx, index } = viewer([adv(1, { post_wait: 2 }), adv(2)])
  assert.equal(ctx.goNext('skip'), 'advanced')
  assert.equal(index.value, 1)
  assert.equal(timers.size, 0)
}
{
  // An open menu keeps the wait pending; the story resumes after it closes.
  const { ctx, index } = viewer([adv(1, { post_wait: 1 }), adv(2)])
  ctx.goNext('user')
  ctx.menuOpen.value = true
  fire()
  assert.equal(index.value, 0)
  assert.equal(ctx.nativeCutWait.pending, true)
  ctx.menuOpen.value = false
  fire()
  assert.equal(index.value, 1)
}
{
  // A wait started from a step no longer shown does nothing.
  const { ctx, index, log } = viewer([adv(1, { post_wait: 1 }), adv(2), adv(3), adv(4)])
  ctx.goNext('user')
  index.value = 2
  fire()
  assert.equal(index.value, 2)
  assert.deepEqual(log, [])
}
{
  // The last step's hold runs before the episode ends.
  const { ctx, log } = viewer([adv(1, { post_wait: 1 })])
  assert.equal(ctx.goNext('user'), 'held')
  assert.deepEqual(log, [])
  fire()
  assert.deepEqual(log, ['finish'])
}
{
  // A choice holds before the branch it picks (talk branches open with label + wait).
  const choice = { step_id: 1, type: 'choice', options: [{ label: 'a', target_step_id: 2 }, { label: 'b', target_step_id: 3 }] }
  const steps = [choice, adv(2, { pre_wait: 2 }), adv(3)]
  let run = viewer(steps)
  run.ctx.onChoice(choice.options[0])
  assert.deepEqual(run.log, [], 'the choice commits after the wait')
  assert.deepEqual(delays(), [2000])
  fire()
  assert.deepEqual(run.log, ['a'])
  assert.equal(run.index.value, 1)
  run = viewer(steps)
  run.ctx.onChoice(choice.options[0])
  run.ctx.onChoice(choice.options[1])
  assert.deepEqual(run.log, ['a'], 'choosing again skips the wait with the first pick')
  assert.equal(timers.size, 0)
  run = viewer(steps)
  run.ctx.goNext('user')
  assert.deepEqual(run.log, [], 'the background tap is still blocked on a choice')
  run.ctx.onChoice(choice.options[0])
  assert.equal(run.ctx.goNext('user'), 'advanced', 'a tap during the choice wait commits it')
  assert.deepEqual(run.log, ['a'])
  run = viewer(steps)
  run.ctx.playbackController.skipEnabled = true
  run.ctx.onChoice(choice.options[0])
  assert.deepEqual(run.log, ['a'], 'skip commits at once')
  assert.equal(timers.size, 0)
}

// Auto mode stays blocked while the wait is pending.
{
  const wait = createNativeCutWait({ setTimer, clearTimer })
  let advances = 0
  const controller = new PlaybackModeController({
    getStep: () => ({ type: 'adv', dialogue: { text: 'x' } }), getVoiceState: () => 'idle',
    hasBlockingAuto: () => wait.pending, onAdvance: () => { advances++; return 'advanced' },
    getReadingMs: () => 0, setTimer, clearTimer, now: () => 0,
  })
  wait.start({}, 1, () => {})
  controller.setAuto?.(true)
  for (const t of [...timers.values()].filter(t => t.ms !== 1000)) t.fn()
  assert.equal(advances, 0, 'auto does not advance while the cut wait is pending')
  timers.clear()
}

// Auto-advancing transition steps add the following hold to their timer.
{
  const steps = [{ step_id: 1, type: 'fadein', state: { screen_fade: { duration: 0.5 } }, post_wait: 1 }, adv(2)]
  const savedSet = globalThis.setTimeout, savedClear = globalThis.clearTimeout
  globalThis.setTimeout = setTimer
  globalThis.clearTimeout = clearTimer
  try {
    const noop = () => {}
    const index = ref(0)
    const effects = useStepSceneEffects({ currentStepIndex: index, historyStack: ref([]), isLastStep: computed(() => false),
      spineStageRef: ref(null), audioManager: { stopBgm: noop, stopAmbient: noop }, voicePlayer: { playVoice: noop },
      resetVoiceDedup: noop, isAutoBlocked: () => false, getSteps: () => steps,
    })
    timers.clear()
    effects.handleStepChange(steps[0])
    const plain = useStepSceneEffects({ currentStepIndex: ref(0), historyStack: ref([]), isLastStep: computed(() => false),
      spineStageRef: ref(null), audioManager: { stopBgm: noop, stopAmbient: noop }, voicePlayer: { playVoice: noop },
      resetVoiceDedup: noop, isAutoBlocked: () => false,
    })
    const [held] = delays()
    timers.clear()
    plain.handleStepChange(steps[0])
    const [bare] = delays()
    assert.equal(held - bare, 1000, `transition hold ${held} vs ${bare}`)
    timers.clear()
  } finally {
    globalThis.setTimeout = savedSet
    globalThis.clearTimeout = savedClear
  }
}
console.log('Native cut wait runtime: hold, tap/skip/auto, pause, stale step, episode end, choice and transition timer passed')
