import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { computed, ref, reactive } from 'vue'
import { useStoryNavigation } from '../src/core/useStoryNavigation.js'
import { useStepSceneEffects } from '../src/core/useStepSceneEffects.js'

// Exercise production navigation + transition timers + the actual viewer input
// gate together. Timers are controlled; no compiled corpus or GPU is needed.
const steps = [
  { step_id: 1, type: 'adv', dialogue: { text: 'voiced', voice: 'slow.m4a' } },
  { step_id: 2, type: 'fadein', state: { screen_fade: { duration: .5 } } },
  { step_id: 3, type: 'stage', duration: 1 },
  { step_id: 4, type: 'adv', dialogue: { text: 'silent' } },
  { step_id: 5, type: 'choice' },
]
const currentStepIndex = ref(0), historyStack = ref([])
const currentStep = computed(() => steps[currentStepIndex.value])
const noop = () => {}, pauses = new Set(), timers = new Map()
const savedSet = globalThis.setTimeout, savedClear = globalThis.clearTimeout
let serial = 0
globalThis.setTimeout = callback => { timers.set(++serial, callback); return serial }
globalThis.clearTimeout = id => timers.delete(id)
const effects = useStepSceneEffects({ currentStepIndex, historyStack, isLastStep: computed(() => currentStepIndex.value === 4),
  spineStageRef: ref(null), audioManager: { stopBgm: noop, stopAmbient: noop }, voicePlayer: { playVoice: noop },
  resetVoiceDedup: noop, isAutoBlocked: () => pauses.size > 0,
})
const navigation = useStoryNavigation({ compiledData: ref({ steps }), currentStep, currentStepIndex, historyStack,
  selectedChoices: reactive(new Map()), storyPreferences: ref({}), updateStoryPreferences: noop,
  startStep: 1, endStep: 5, initialStep: 1, clearFadeAutoAdvance: effects.clearFadeAutoAdvance,
  ensureAudioCtx: noop, resetVoiceDedup: noop,
})
const source = readFileSync(new URL('../src/core/StoryViewer.vue', import.meta.url), 'utf8')
const method = source.slice(source.indexOf("function goNext(source = 'user'"), source.indexOf('\nfunction goPrev()', source.indexOf("function goNext(source = 'user'")))
const context = { currentStep, currentStepIndex, episodeFinished: ref(false), backlogOpen: ref(false), menuOpen: ref(false),
  runtimeReadinessStatus: ref('playable'), titlePaused: ref(false), titleAnimationPending: ref(false), titleAdvancePending: null,
  setTitleAnimationPending: noop, markStepRead: noop, recordHistoryStep: noop, leaveRestoredScene: noop,
  _stopCurrentVoice: noop, storyRuntimeCues: { hasNonSkippable: () => false, cancelCurrentStep: noop, settleCurrentStep: () => false },
  isLastStep: navigation.isLastStep, finishEpisode: noop, advanceStep: navigation.goNext,
}
const next = vm.runInNewContext(`${method}\ngoNext`, context)
function tick() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()) }
try {
  navigation.applyStartStepIfNeeded()
  assert.equal(next(), 'advanced', 'pending soft voice cannot block input')
  assert.equal(currentStepIndex.value, 1, 'manual Next must enter the fade')
  effects.handleStepChange(currentStep.value)
  pauses.add('hidden'); pauses.add('user')
  tick(); assert.equal(currentStepIndex.value, 1)
  pauses.delete('hidden'); tick(); assert.equal(currentStepIndex.value, 1, 'visibility does not clear user pause')
  pauses.clear(); tick(); assert.equal(currentStepIndex.value, 2)
  effects.handleStepChange(currentStep.value); tick()
  assert.equal(currentStepIndex.value, 3, 'stage plays before silent dialogue')
  effects.handleStepChange(currentStep.value)
  assert.equal(timers.size, 0, 'silent dialogue waits for input')
  context.runtimeReadinessStatus.value = 'waiting'
  const before = [...historyStack.value]
  assert.equal(next(), 'blocked'); assert.deepEqual([...historyStack.value], before)
  context.runtimeReadinessStatus.value = 'playable'
  context.backlogOpen.value = true
  assert.equal(next(), 'blocked')
  context.backlogOpen.value = false
  assert.equal(next(), 'advanced'); assert.equal(next(), 'blocked', 'choice cannot be bypassed by Next')
  navigation.goPrev(); assert.equal(currentStepIndex.value, 3)
  navigation.goNext(); assert.equal(currentStepIndex.value, 4)
  assert.equal(navigation.goNext(), false, 'range is bounded')
} finally {
  effects.clearFadeAutoAdvance()
  globalThis.setTimeout = savedSet; globalThis.clearTimeout = savedClear
}
console.log('Interaction matrix: input + authored transition chain, silent stop, hidden/user pause ownership, buffering/history, backlog, choice and bounded Prev/Next passed')
