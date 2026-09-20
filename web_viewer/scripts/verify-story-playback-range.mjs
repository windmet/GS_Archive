import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { computed, reactive, ref } from 'vue'
import { useStoryNavigation } from '../src/core/useStoryNavigation.js'

const scenario = JSON.parse(await readFile(new URL('../public/data/compiled/1_4_001_00.json', import.meta.url), 'utf8'))

function createNavigation(startStep, endStep, scenarioData = scenario, initialStep = null) {
  const compiledData = ref(scenarioData)
  const currentStepIndex = ref(0)
  const currentStep = computed(() => compiledData.value.steps[currentStepIndex.value] || {})
  const historyStack = ref([])
  const navigation = useStoryNavigation({
    compiledData,
    currentStep,
    currentStepIndex,
    historyStack,
    selectedChoices: reactive(new Map()),
    storyPreferences: ref({
      story_content_mode: 'original',
      story_translation_locale: 'zh-CN',
      bilingual_primary: 'original',
    }),
    updateStoryPreferences: () => {},
    initialStep,
    startStep,
    endStep,
    clearFadeAutoAdvance: () => {},
    ensureAudioCtx: () => {},
    resetVoiceDedup: () => {},
  })
  navigation.applyStartStepIfNeeded()
  return { currentStepIndex, historyStack, ...navigation }
}

const firstEpisode = createNavigation(2)
assert.equal(firstEpisode.navigationStartIndex.value, 1)
assert.equal(firstEpisode.navigationEndIndex.value, 26)
assert.equal(firstEpisode.currentStepIndex.value, 1)
assert.equal(firstEpisode.isFirstStep.value, true)
firstEpisode.goPrev()
assert.equal(firstEpisode.currentStepIndex.value, 1)
firstEpisode.currentStepIndex.value = 26
assert.equal(firstEpisode.isLastStep.value, true)
firstEpisode.goNext()
assert.equal(firstEpisode.currentStepIndex.value, 26)

const secondEpisode = createNavigation(28)
assert.equal(secondEpisode.navigationStartIndex.value, 27)
assert.equal(secondEpisode.navigationEndIndex.value, 59)
assert.equal(secondEpisode.currentStepIndex.value, 27)
secondEpisode.goPrev()
assert.equal(secondEpisode.currentStepIndex.value, 27)

const explicitRange = createNavigation(2, 10)
assert.equal(explicitRange.navigationEndIndex.value, 9)

const wholeStory = createNavigation(null, null)
assert.equal(wholeStory.navigationStartIndex.value, 1)
assert.equal(wholeStory.navigationEndIndex.value, 59)

const strictScenario = {
  runtime_contract: 'story-runtime-v2',
  episodes: [{ episode_index: 0, start_step_id: 1, end_step_id: 3 }],
  steps: [
    { step_id: 1, type: 'adv', entry_snapshot: { bg: 'strict-bg' } },
    {
      step_id: 2,
      type: 'choice',
      choice_id: 'strict-choice',
      options: [{ option_id: 'strict-option', source_text: 'next', target_step_id: 3 }],
    },
    { step_id: 3, type: 'adv', entry_snapshot: { bg: 'strict-bg-2' } },
  ],
}
const strict = createNavigation(1, null, strictScenario)
assert.equal(strict.navigationStartIndex.value, 0)
assert.equal(strict.navigationEndIndex.value, 2)
assert.equal(strict.currentEpisode.value?.episode_index, 0)
assert.equal(strict.firstAvailableBg.value, 'strict-bg')
strict.currentStepIndex.value = 1
strict.onChoice(strictScenario.steps[1].options[0])
assert.equal(strict.currentStepIndex.value, 2)
assert.deepEqual(strict.historyStack.value, [1])

console.log('Story playback range: compatibility and authoritative episode boundaries, backgrounds and choices verified')

const fromMiddle = createNavigation(2, 6, { steps: Array.from({length: 8}, (_, i) => ({ step_id: 100 + i * 10, type: 'dialogue' })) }, 4)
assert.equal(fromMiddle.currentStepIndex.value, 3)
assert.equal(fromMiddle.navigationStartIndex.value, 1)
assert.equal(fromMiddle.navigationEndIndex.value, 5)
fromMiddle.goPrev()
assert.equal(fromMiddle.currentStepIndex.value, 2, 'initial position must not become the range floor')
fromMiddle.goNext()
assert.equal(fromMiddle.currentStepIndex.value, 3)

// Manual and AUTO both enter every authored step; scene timers own transitions.
const manualScenario = { steps: [
  { step_id: 1, type: 'adv', dialogue: { text: 'First line', voice: 'a.m4a' } },
  { step_id: 2, type: 'stage', duration: 1 },
  { step_id: 3, type: 'stage', duration: 3 },
  { step_id: 4, type: 'adv', dialogue: { source_text: 'Silent second line' } },
  { step_id: 5, type: 'choice', options: [] },
  { step_id: 6, type: 'title' },
  { step_id: 7, type: 'talk_stamp', auto_advance: true },
  { step_id: 8, type: 'stage', auto_advance: false },
  { step_id: 9, type: 'text_time' },
  { step_id: 10, type: 'stage' },
] }
{
  const manual = createNavigation(1, 10, manualScenario)
  manual.applyStartStepIfNeeded()
  assert.equal(manual.goNext({ manual: true }), true)
  assert.equal(manual.currentStepIndex.value, 1, 'one click must enter the first authored action')
  assert.deepEqual(manual.historyStack.value, [0])
  manual.goPrev()
  assert.equal(manual.currentStepIndex.value, 0)
  manual.goNext()
  assert.equal(manual.currentStepIndex.value, 1, 'AUTO/runtime keeps the first action')
  manual.goNext()
  assert.equal(manual.currentStepIndex.value, 2, 'AUTO/runtime keeps the second action')
  manual.goNext({ manual: true })
  assert.equal(manual.currentStepIndex.value, 3)
  for (const expected of [4, 5, 6, 7, 8]) {
    manual.goNext({ manual: true }); assert.equal(manual.currentStepIndex.value, expected)
  }
  assert.equal(manual.goNext({ manual: true }), true, 'trailing transitions must render before episode completion')
  assert.equal(manual.currentStepIndex.value, 9)
  assert.equal(manual.goNext({ manual: true }), false)
  const bounded = createNavigation(1, 3, manualScenario)
  bounded.applyStartStepIfNeeded()
  assert.equal(bounded.goNext({ manual: true }), true)
  assert.equal(bounded.currentStepIndex.value, 1)
  assert.equal(bounded.goNext({ manual: true }), true)
  assert.equal(bounded.goNext({ manual: true }), false, 'manual navigation cannot escape the requested range')
}
console.log('Manual boundaries: voiced/silent lines, action bridges, AUTO, history, special nodes and episode limits passed')

const kogadou = JSON.parse(await readFile(new URL('../public/data/compiled/episodes/1_1_013_01_a.json', import.meta.url), 'utf8'))
const kogadouNav = createNavigation(11, 18, kogadou)
kogadouNav.applyStartStepIfNeeded()
for (let expected = 11; expected <= 17; expected++) {
  assert.equal(kogadouNav.goNext({ manual: true }), true)
  assert.equal(kogadouNav.currentStepIndex.value, expected, 'Kogadou episode 1 must preserve every transition and silent line')
}
assert.ok(kogadou.steps[16].dialogue.text)
assert.ok(!kogadou.steps[16].dialogue.voice, 'silent spoken text remains a reading stop')
console.log('Kogadou 11-18: all authored steps and silent dialogue retained')
