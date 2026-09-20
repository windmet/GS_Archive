import assert from 'node:assert/strict'
import { readyEpisodeReading } from '../src/data/IdolStoryReading.js'
import { buildArchiveSourceQuery, buildArchiveUrl, readArchiveRoute } from '../src/core/archiveRoute.js'
const entries = [
  { document_id: 'ready', source_file: 'exact.json', status: 'ready' },
  { document_id: 'unsupported', source_file: 'unsupported.json', status: 'unsupported' },
]
assert.equal(readyEpisodeReading(entries, { file: 'exact.json' }).document_id, 'ready')
assert.equal(readyEpisodeReading(entries, { file: 'unsupported.json' }), null)
assert.equal(readyEpisodeReading(entries, { file: 'exact_other.json' }), null)
assert.equal(readyEpisodeReading(entries, { resource_id: 'exact' }), null)
const parent = { view: 'idol_story_archive', storyType: 'idol_story', idol: '001tom', storySection: '20101', episode: '2010101' }
const sourceRoute = buildArchiveSourceQuery(parent)
const reader = readArchiveRoute(buildArchiveUrl('http://localhost/', { ...parent, view: 'reader', reading: 'ready', sourceRoute }))
assert.equal(reader.storyType, 'idol_story')
assert.equal(reader.idol, '001tom')
assert.equal(reader.episode, '2010101')
assert.equal(reader.storySection, '20101')
const restored = readArchiveRoute(`http://localhost/${reader.sourceRoute}`)
for (const key of ['view', 'storyType', 'idol', 'storySection', 'episode']) assert.equal(restored[key], parent[key])
console.log('Personal Reader: exact ready identity and reload-safe source section/episode passed')

const { useArchiveNavigationState } = await import('../src/core/useArchiveNavigationState.js')
const navigation = useArchiveNavigationState()
navigation.currentStoryDomain.value = 'idol_story'
navigation.currentCharacterId.value = parent.idol
navigation.currentStorySection.value = parent.storySection
navigation.currentEpisodeId.value = parent.episode
navigation.returnViewAfterPlayer.value = 'reader'
for (const view of ['reader', 'player']) {
  navigation.view.value = view
  const route = navigation.currentArchiveRoute()
  for (const key of ['idol', 'storySection', 'episode']) assert.equal(route[key], parent[key])
}
