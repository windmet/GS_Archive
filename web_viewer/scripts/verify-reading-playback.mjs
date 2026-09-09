import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { ref } from 'vue'
import { readingPlaybackTarget } from '../src/core/ReadingPlayback.js'
import { prepareScenario } from '../src/data/prepareScenario.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { useStoryPlaybackController } from '../src/core/useStoryPlaybackController.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { createReadingSession } from '../src/core/ReadingSession.js'
import { buildArchiveUrl, readArchiveRoute } from '../src/core/archiveRoute.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url))
const manifest = JSON.parse(read('public/data/reading/manifest.json'))
const document = JSON.parse(read('public/data/reading/1_4_001_01_d.json'))
const entry = manifest.entries.find(e => e.document_id === document.document_id)
const row = document.rows[1]
const localSources = process.argv.includes('--local-sources')
// CI has no published media tree. Its synthetic source deliberately uses a non-sequential ID.
let bytes
if (localSources) bytes = read(`public/data/compiled/${document.source.file}`)
else {
  const steps = Array.from({ length: document.source.step_count }, (_, index) => ({ step_id: index + 1, type: 'dialogue' }))
  steps[row.anchor.step_index].step_id = 1007
  row.anchor.step_id = 1007
  bytes = Buffer.from(JSON.stringify({ steps }))
  document.source.sha256 = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
  entry.source_sha256 = document.source.sha256
}
const target = readingPlaybackTarget(document, row.anchor.row_id, entry.sha256, entry)
assert.equal(target.initialStep, row.anchor.step_index + 1)
assert.equal(target.startStep, 1)
assert.equal(target.endStep, document.source.step_count)
const full = readingPlaybackTarget(document, '', entry.sha256, entry, { fullDocument: true })
assert.equal(full.initialStep, 1, 'full playback includes opening steps before the first dialogue')
assert.equal(full.endStep, document.source.step_count)
await full.readScenario(new Response(bytes))
await assert.rejects(full.readScenario(new Response('{}')), /来源已更新/)
assert.throws(() => readingPlaybackTarget(document, row.anchor.row_id, 'old', entry), /版本已变化/)
assert.throws(() => readingPlaybackTarget(document, 'missing-row', entry.sha256, entry), /不能定位/)
let media = 0
const prepare = body => prepareScenario(target.file, { isCurrent: () => true,
  fetchImpl: async () => new Response(body), readScenario: target.readScenario,
  loadPlayer: async () => { media++ }, preloadAssets: async () => { media++ } })
await assert.rejects(prepare('{}'), /来源已更新/)
assert.equal(media, 0, 'mismatched bytes must fail before player import or media preload')
await prepare(bytes)
assert.equal(media, 2)

// Execute the production App actions against real coordinator/controller/session.
const state = { ...useArchiveNavigationState(), loading: ref(false), preloadProgress: ref(0),
  readingState: ref({}), readingPlaybackNotice: ref('') }
const navigation = createArchiveNavigationCoordinator()
let url = new URL('http://localhost/')
const context = { ...state, navigation, readingPlaybackTarget,
  syncArchiveRoute: () => { url = buildArchiveUrl(url, state.currentArchiveRoute()) },
  readingSession: createReadingSession({ repository: { manifest: async () => manifest,
    load: async () => ({ status: 'ready', document }) }, publish: value => { state.readingState.value = value } }),
}
let pendingFetch = null
context.playbackController = useStoryPlaybackController({ state, navigation,
  prepare: (file, options) => prepareScenario(file, { ...options, fetchImpl: () => pendingFetch || Promise.resolve(new Response(bytes)) }),
  loadPlayer: async () => {}, preloadAssets: async () => {}, syncRoute: context.syncArchiveRoute,
  returnTo: () => context.returnToReader(), onError: () => {} })
context.playbackError = context.playbackController.error
const app = read('src/App.vue').toString()
for (const name of ['applyArchiveRoute', 'openReaderPlayback', 'returnToReader']) {
  vm.runInNewContext(app.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))[0], context)
}
await context.applyArchiveRoute({ view: 'reader', reading: document.document_id, readingMode: 'bilingual', storyType: 'main', storySection: '101', story: '1_4_001_01.json' })
state.currentCardId.value = 'unrelated-card'
state.filterQuery.value = 'unrelated-filter'
await context.openReaderPlayback(row.anchor.row_id)
assert.equal(state.view.value, 'player')
assert.equal(state.currentScenarioInitialStep.value, target.initialStep)
assert.equal(state.currentScenarioStartStep.value, 1)
const shared = readArchiveRoute(url)
assert.equal(shared.card, '')
assert.equal(shared.query, '')
assert.equal(shared.story, '1_4_001_01.json')
assert.equal(shared.storySection, '101')
assert.equal(shared.readingRev, entry.sha256)
assert.equal(shared.readingRow, row.anchor.row_id)
assert.equal(shared.readingMode, 'bilingual')
assert.equal(shared.initialStep, target.initialStep)
await context.playbackController.close()
assert.equal(state.view.value, 'reader')
assert.equal(readArchiveRoute(url).story, '1_4_001_01.json')
assert.equal(state.readingRowId.value, row.anchor.row_id)
assert.equal(context.playbackController.currentScenario.value, null)
await context.openReaderPlayback(row.anchor.row_id, { fullDocument: true })
assert.equal(state.currentScenarioInitialStep.value, 1)
const fullShared = readArchiveRoute(url)
assert.equal(fullShared.readingRow, row.anchor.row_id, 'full playback preserves the reading return location')
await context.playbackController.close()
await context.applyArchiveRoute(fullShared)
assert.equal(state.view.value, 'player', 'full playback URL restores without treating the return row as the playback target')
assert.equal(state.currentScenarioInitialStep.value, 1)
await context.playbackController.close()
assert.equal(state.readingRowId.value, row.anchor.row_id)
await context.applyArchiveRoute(shared)
assert.equal(state.view.value, 'player', 'refresh restores validated media entry')
await context.applyArchiveRoute({ ...shared, initialStep: shared.initialStep + 1 })
assert.equal(state.view.value, 'reader')
assert.match(state.readingPlaybackNotice.value, /范围与正文定位不一致/)
assert.equal(context.playbackController.currentScenario.value, null)
await context.applyArchiveRoute({ ...shared, readingRev: `sha256:${'0'.repeat(64)}` })
assert.equal(state.view.value, 'reader')
assert.match(state.readingPlaybackNotice.value, /版本已变化/)
await context.applyArchiveRoute({ ...shared, view: 'reader' })
let settleFetch
pendingFetch = new Promise(resolve => { settleFetch = resolve })
const obsolete = context.openReaderPlayback(row.anchor.row_id)
navigation.invalidate()
context.playbackController.reset()
state.view.value = 'portal'
settleFetch(new Response(bytes))
await obsolete
assert.equal(state.view.value, 'portal', 'late source verification must not reopen media after leaving')
assert.equal(context.playbackController.currentScenario.value, null)
console.log(localSources ? 'LOCAL published source verified' : 'CI synthetic non-sequential source verified')
console.log('Reading playback verified: source integrity before media, versioned URL, App round trip, refresh, invalid links and separate target/range')
