import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { computed, reactive, ref } from 'vue'
import { useStoryNavigation } from '../src/core/useStoryNavigation.js'

const scenario = JSON.parse(await readFile(new URL('../public/data/compiled/1_4_001_00.json', import.meta.url), 'utf8'))

function createNavigation(startStep, endStep) {
  const compiledData = ref(scenario)
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
    fastForwardTimeline: () => {},
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

console.log('Story playback range: inferred and explicit episode boundaries verified for 1_4_001_00')
