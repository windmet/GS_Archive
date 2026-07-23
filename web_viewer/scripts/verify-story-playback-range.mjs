import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { computed, reactive, ref } from 'vue'
import { useStoryNavigation } from '../src/core/useStoryNavigation.js'

const scenario = JSON.parse(await readFile(new URL('../public/data/compiled/1_4_001_00.json', import.meta.url), 'utf8'))

function createNavigation(startStep, endStep, scenarioData = scenario) {
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
