import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { computed, ref } from 'vue'

// Executes the production loadNotice computed from App.vue against real refs.
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const start = app.indexOf("const LEGACY_DIRECTORY_VIEWS")
const closing = /\r?\n\}\)\r?\n/g
closing.lastIndex = app.indexOf('const loadNotice = computed', start)
const closed = closing.exec(app)
const end = closed ? closed.index + closed[0].length : -1
assert.ok(start >= 0 && end > start, 'loadNotice source exists')

const names = ['home', 'idol', 'song', 'legacy', 'mobile', 'unit', 'card', 'gasha', 'event', 'seasonal', 'work', 'idolStory', 'collection', 'story', 'resource']
function setup(view = 'story_catalog', loading = false) {
  const state = Object.fromEntries(names.map(name => [name, ref('')]))
  const context = vm.createContext({
    computed, view: ref(view), loading: ref(loading),
    homeEntryStatus: state.home, idolReadModelStatus: state.idol, songReadModelStatus: state.song,
    legacyEntryStatus: ref(''), legacyAliasStatus: state.legacy, mobileReadModelStatus: state.mobile,
    unitReadModelStatus: state.unit, cardReadModelStatus: state.card, gashaReadModelStatus: state.gasha,
    eventReadModelStatus: state.event, seasonalReadModelStatus: state.seasonal, workReadModelStatus: state.work,
    idolStoryReadModelStatus: state.idolStory, collectionReadModelStatus: state.collection,
    storyReadModelStatus: state.story, resourceReadModelStatus: state.resource,
  })
  vm.runInContext(`${app.slice(start, end)}\nthis.loadNotice = loadNotice`, context)
  return { context, state, notice: () => context.loadNotice.value }
}

const failure = '故事目录暂时无法读取，请重试。'
const progress = '正在读取歌曲详情…'
{ const t = setup(); assert.equal(t.notice(), null, 'nothing to show') }
const shown = notice => notice && [notice.message, notice.kind]
{ const t = setup(); t.state.story.value = failure; assert.deepEqual(shown(t.notice()), [failure, 'error']) }
{ const t = setup('song_detail'); t.state.song.value = progress; assert.deepEqual(shown(t.notice()), [progress, 'loading']) }
// A full-page loading screen already covers progress, but failures must never be hidden.
{ const t = setup('song_detail', true); t.state.song.value = progress; assert.equal(t.notice(), null) }
{ const t = setup('song_detail', true); t.state.song.value = '歌曲详情暂时无法读取，请重新选择。'; assert.equal(t.notice().kind, 'error') }
// Ambient statuses belong to no particular view and stay quiet while a page is loading.
{ const t = setup('story_catalog', true); t.state.story.value = failure; assert.equal(t.notice(), null) }
// Scoped status wins over ambient status; other views' scoped status never leaks.
{ const t = setup('unit_detail'); t.state.story.value = failure; t.state.unit.value = '组合详情暂时无法读取，请重试。'; assert.match(t.notice().message, /组合详情/) }
{ const t = setup('cards'); t.state.unit.value = '组合目录暂时无法读取，请重试。'; assert.equal(t.notice(), null) }
// The gasha catalog renders its own status; the portal passes it to its own section.
{ const t = setup('gashas'); t.state.gasha.value = '卡池目录暂时无法读取，请重试。'; assert.equal(t.notice(), null) }
{ const t = setup('cards'); t.state.gasha.value = '卡池目录暂时无法读取，请重试。'; assert.equal(t.notice().kind, 'error') }
// One banner at a time, in a stable order.
{ const t = setup(); t.state.card.value = '卡片目录暂时无法读取，请重试。'; t.state.story.value = failure; assert.match(t.notice().message, /卡片/) }

// A failed first read must land on the portal with a notice, never on a blank boot screen.
{
  const bootStart = app.search(/\n\s*try \{\r?\n\s*await restoreRoute\(startup\.route\)/)
  const bootEnd = app.indexOf('\n})', bootStart)
  assert.ok(bootStart >= 0 && bootEnd > bootStart, 'startup restore block exists')
  async function boot(viewValue, fails) {
    const calls = []
    const context = vm.createContext({
      startup: { route: { view: 'story_catalog' } }, view: ref(viewValue), loading: ref(true), userPreferenceNotice: ref(''),
      restoreRoute: async () => { if (fails) throw new Error('read model offline') },
      commitView: value => calls.push(value), console: { error: () => calls.push('logged') },
    })
    await vm.runInContext(`(async () => {${app.slice(bootStart, bootEnd)}\n})()`, context)
    return { calls, loading: context.loading.value, notice: context.userPreferenceNotice.value }
  }
  const failed = await boot('__boot__', true)
  assert.deepEqual([...failed.calls], ['logged', 'portal'])
  assert.equal(failed.loading, false)
  assert.match(failed.notice, /已回到资料馆/)
  const ok = await boot('__boot__', false)
  assert.deepEqual([...ok.calls], []); assert.equal(ok.notice, '')
  // A newer navigation already left the boot view: the failure must not drag it back.
  const moved = await boot('cards', true)
  assert.deepEqual([...moved.calls], ['logged']); assert.equal(moved.notice, '')
}

// The page must route every reader-facing status through the single slot.
assert.doesNotMatch(app, /class="(?:idol|unit|song|home)-read-model-status"/, 'no per-view status paragraphs remain')
assert.match(app, /<ArchiveLoadNotice v-else-if="loadNotice"/)
console.log('Archive load notice: single banner, scoped priority, loading/error visibility and gasha/portal exemptions passed')
