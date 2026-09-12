import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createReadingSession } from '../src/core/ReadingSession.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { buildArchiveUrl, readArchiveRoute, readPortalReturnRoute, buildPortalReturnQuery } from '../src/core/archiveRoute.js'
import { readingPresentationSpeaker } from '../shared/reading/ReadingDocument.js'
import { resolveStoryText } from '../src/localization/story/StoryTextResolver.js'

const route = readArchiveRoute('http://localhost/?view=reader&reading=1_4_001_01_d&reading_mode=bilingual&reading_row=1_4_001_01_d:step-9:text')
assert.equal(route.view, 'reader')
assert.deepEqual(readArchiveRoute(buildArchiveUrl('http://localhost/?scenario=old&reading_row=stale', route)), route)
assert.deepEqual(readPortalReturnRoute(buildPortalReturnQuery(route)), route)
assert.equal(buildArchiveUrl('http://localhost/?reading=x&reading_mode=translation', { view: 'home' }).search, '')
assert.equal(readArchiveRoute('http://localhost/?view=reader&reading=../../RAW').view, 'story_catalog')
assert.equal(readArchiveRoute('http://localhost/?view=reader&reading=x&reading_mode=bad').readingMode, 'original')
for (const query of [
  'story_type=unit_story&story_section=13&story=1_1_013the_03.json',
  'story_type=birthday&story=1_x_001tom_1_8_001_01.json',
  'event=10001&parent=unit_detail&category=idol&unit=01jup&from=%3Fview%3Dunit_detail%26category%3Didol%26unit%3D01jup',
  'story_type=work&idol=001tom&story=work.json',
]) {
  const nonMain = readArchiveRoute(`http://localhost/?view=reader&reading=sample&${query}`)
  assert.deepEqual(readArchiveRoute(buildArchiveUrl('http://localhost/', nonMain)), nonMain)
  assert.deepEqual(readPortalReturnRoute(buildPortalReturnQuery(nonMain)), nonMain)
}

let state
let resolveSlow
let rejectSlow
const navigation = createArchiveNavigationCoordinator()
const repository = { manifest: async () => ({ entries: [{ document_id: 'fast' }] }), load: async id => {
  if (id === 'slow') return new Promise((resolve, reject) => { resolveSlow = resolve; rejectSlow = reject })
  if (id === 'error') throw Error('controlled failure')
  return { status: id === 'fast' ? 'ready' : id, document: id === 'fast' ? { document_id: id } : null }
} }
const session = createReadingSession({ repository, publish: next => { state = next } })
const open = id => navigation.run(intent => session.open(id, intent))
const slow = open('slow')
await Promise.resolve(); await Promise.resolve()
assert.equal(state.status, 'loading')
await open('fast')
const fastState = state
resolveSlow({ status: 'ready', document: { document_id: 'slow' } })
await slow
assert.equal(state, fastState)
const staleError = open('slow')
await Promise.resolve(); await Promise.resolve()
navigation.invalidate()
state = { status: 'outside-reader' }
rejectSlow(Error('obsolete'))
await staleError
assert.equal(state.status, 'outside-reader')
for (const status of ['empty', 'unsupported', 'not-generated', 'error']) {
  await open(status)
  assert.equal(state.status, status)
  assert.equal(state.document, null)
}
// Exercise the actual App route branch with no player/preloader globals present.
const context = { ...useArchiveNavigationState(), navigation, readingSession: session,
  readingPlaybackNotice: { value: '' }, currentScenario: { value: { old: true } }, loading: { value: true },
  captureActiveArchiveView: () => {} }
context.playbackController = { reset: () => { context.currentScenario.value = null } }
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
vm.runInNewContext(app.match(/async function applyArchiveRoute\([^]*?\n\}/)[0], context)
for (const source of [{ storyType: 'work', idol: '001tom', story: 'work.json' }, { event: '10001', parentView: 'story_catalog' }, { storyType: 'unit_story', storySection: '13', story: 'unit.json' },
  { storyType: 'birthday', storySection: '', story: 'birthday.json' }]) {
  await context.applyArchiveRoute({ ...route, ...source })
  const restored = readArchiveRoute(buildArchiveUrl('http://localhost/', context.currentArchiveRoute()))
  for (const key of Object.keys(source)) assert.equal(restored[key], source[key], `App retains ${key}`)
}
await context.applyArchiveRoute(route)
context.view.value = 'work_archive'
context.currentStoryDomain.value = 'work'
context.currentCharacterId.value = '001tom'
context.currentStoryFile.value = 'line.json'
assert.equal(readArchiveRoute(buildArchiveUrl('http://localhost/', context.currentArchiveRoute())).story, 'line.json', 'work page refresh retains source tab selector')
await context.applyArchiveRoute(route)
assert.equal(context.view.value, 'reader')
assert.equal(context.currentScenario.value, null)
assert.equal(context.readingMode.value, 'bilingual')
assert.equal(context.readingDocumentId.value, '1_4_001_01_d')
assert.equal(readArchiveRoute(buildArchiveUrl('http://localhost/', context.currentArchiveRoute())).readingRow, route.readingRow)
let syncDuringPending = false
context.syncArchiveRoute = () => { syncDuringPending = navigation.isPending() && !navigation.isRestoring() }
vm.runInNewContext(app.match(/async function openStoryReader\([^]*?\n\}/)[0], context)
await context.openStoryReader('fast')
assert.equal(syncDuringPending, true, 'explicit selection publishes its URL while loading')
const unknown = { speaker: { kind: 'unknown', entityType: 'idol', entityId: '047shu', sourceName: '？？？' } }
const display = resolveStoryText({ source: 'text', speaker: readingPresentationSpeaker(unknown),
  entityNames: { 'zh-CN': { '047shu': 'must not reveal' } }, preferences: { story_content_mode: 'translation' } })
assert.equal(display.speaker.display, '？？？')
assert.equal(unknown.speaker.entityId, '047shu')
console.log('Reading navigation verified: route round trips, portal return, stale success/error, page states and identity privacy')
