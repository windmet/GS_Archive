import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { ref } from 'vue'
import { validatedFiniteForks, finiteBranchNextIndex } from '../shared/story/FiniteBranchFlow.js'
import { createReadingDocument, readingBranchRows } from '../shared/reading/ReadingDocument.js'
import { readingPlaybackTarget } from '../src/core/ReadingPlayback.js'
import { useStoryNavigation } from '../src/core/useStoryNavigation.js'
import { selectCollectionContinuation } from '../src/core/PlayerEntryRequest.js'
import { resolveCommunicationContext } from '../src/core/story-runtime/CommunicationPresentationContext.js'
const read = async file => JSON.parse(await fs.readFile(new URL('../public/data/' + file, import.meta.url), 'utf8'))
const knownIdolIds = new Set((await read('masterdata/idol_unit_dictionary.json')).idols.map(i => i.idol_code))
for (const part of ['c', 'd']) {
  const input = await read(`compiled/episodes/1_4_001_05_${part}.json`)
  const [fork] = validatedFiniteForks(input)
  assert.equal(fork.branches.length, 2)
  const data = ref(input), index = ref(fork.choice_index), history = ref([])
  const navigation = useStoryNavigation({ compiledData: data, currentStep: { get value() { return data.value.steps[index.value] } },
    currentStepIndex: index, historyStack: history, selectedChoices: new Map(), storyPreferences: ref({}),
    updateStoryPreferences() {}, clearFadeAutoAdvance() {}, ensureAudioCtx() {}, resetVoiceDedup() {} })
  for (const branch of fork.branches) {
    index.value = fork.choice_index; history.value = []
    navigation.onChoice(input.steps[fork.choice_index].options[branch.option_index])
    assert.equal(index.value, branch.step_indices[0])
    navigation.goNext(); assert.equal(index.value, fork.join_index, 'exclusive response skips the other branch')
    navigation.goPrev(); assert.equal(index.value, branch.exit_index, 'back follows actual selected path')
  }
  const document = await read(`reading/1_4_001_05_${part}.json`)
  assert.equal(document.status, 'ready')
  const projected = readingBranchRows(document)
  assert.equal(new Set(projected.map(r => r.row.anchor.row_id)).size, document.rows.length)
  assert.equal(projected.filter(r => r.branch?.first).length, 2)
  const row = document.rows.find(r => r.anchor.step_index === fork.branches[1].exit_index)
  assert.throws(() => readingPlaybackTarget(document, row.anchor.row_id, 'rev', { document_id: document.document_id, sha256: 'rev' }), /分支内定位/)
  for (const mutate of [f => { f.join_index = 0 }, f => { f.branches[1].step_indices = [...f.branches[0].step_indices] }, f => { f.branches[0].exit_index = 999 }]) {
    const bad = structuredClone(input); mutate(bad.reading_control_flow.forks[0])
    assert.throws(() => validatedFiniteForks(bad))
    assert.equal(createReadingDocument(bad, { documentId: 'bad', logicalId: 'bad', file: 'bad.json', sha256: document.source.sha256, knownIdolIds }).status, 'unsupported')
  }
  assert.equal(finiteBranchNextIndex(input, 0), 1, 'zero index remains valid')
}
const chapters = [{ id: 'a', label: '第5话', exists: true, episodes: [{ file: 'a.json', exists: true }] },
  { id: 'b', label: '第6话', exists: false, episodes: [] }, { id: 'c', exists: true, episodes: [{ file: 'c.json', exists: true }] }]
assert.equal(selectCollectionContinuation({ chapters }, 'a.json').nextChapter.available, false)
assert.equal(selectCollectionContinuation({ chapters }, 'a.json').nextChapter.id, 'b', 'never skip missing adjacent chapter')
const chat = await read('compiled/episodes/1_4_001_05_h.json')
for (const [index, step] of chat.steps.entries()) if (step.type === 'talk') {
  const context = resolveCommunicationContext({ step, stepIndex: index, steps: chat.steps, scenarioId: chat.scenario_id })
  assert.equal(context.threadTitle, 'THE 虎牙道'); assert.equal(context.unitCode, '13the'); assert.equal(context.isGroup, true)
}
const privateStep = { type: 'talk', chara_id: '047shu' }
assert.equal(resolveCommunicationContext({ step: privateStep, steps: [privateStep], stepIndex: 0 }).unitCode, null)
console.log('Real phone branches: both runtime paths, Reader unique units, bounded rejection, row guard, canonical chapter and RAW thread identity passed')
