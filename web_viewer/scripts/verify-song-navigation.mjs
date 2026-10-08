import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { effectScope, nextTick, ref } from 'vue'
import { parse } from '@vue/compiler-sfc'
import { parse as parseScript } from '@babel/parser'
import { useSongNavigation } from '../src/composables/useSongNavigation.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'

const script = parse(readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const body = parseScript(script, { sourceType: 'module' }).program.body
const binding = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
  .find(node => node.init?.callee?.name === 'useSongNavigation')
assert.ok(binding, 'App uses the real song navigation factory')
const call = script.slice(binding.init.start, binding.init.end)
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { await nextTick(); for (let i = 0; i < 12; i++) await Promise.resolve() }
const detail = id => ({ id, song: { song_code: id }, view: { id } })
const rows = [
  { song_code: 'drvalv', title: 'DRIVE A LIVE', song_id: 1, detail: 'detail:drvalv',
    variants: [{ song_code: 'drv999', title: 'Special' }], performance: { scope: 'all' } },
  { song_code: 'brndnf', title: 'BRAND NEW FIELD', song_id: 2, detail: 'detail:brndnf', performance: { unitName: 'Jupiter' } },
]
const catalog = () => ({ songs: Object.fromEntries(rows.map(row => [row.song_code, row])), summary: {} })
let fetchCalls = 0
const previousFetch = globalThis.fetch, previousError = console.error
const scopes = []
globalThis.fetch = async url => {
  assert.equal(url, '/data/song_charts/manifest.json')
  fetchCalls++
  return new Response(JSON.stringify({ songs: { brndnf: { easy: {} }, drv999: { hard: {}, expert: {} }, unknown: {} } }))
}
console.error = () => {}

function fixture(initialView = 'experiments') {
  const scope = effectScope(); scopes.push(scope)
  const calls = [], loads = [], requests = new Map()
  const state = {
    view: ref(initialView), currentSongId: ref(''), currentSongScope: ref('all'), songParentView: ref(''),
    currentCharacterId: ref(''), currentCategoryId: ref(''), filterQuery: ref(''), detailSourceRoute: ref(''),
    songReadModelCatalog: ref(catalog()), songReadModelDetail: ref(null), songReadModelStatus: ref(''), currentArchiveUnit: ref(null),
  }
  const navigation = createArchiveNavigationCoordinator()
  const transport = { rows, count: rows.length }
  const context = { ...state, navigation, useSongNavigation,
    archiveBootstrap: { domains: { songs: 'song-index' }, idols: [{ id: '001tom' }] },
    readModelClient: { load: async (descriptor, options = {}) => {
      loads.push(descriptor)
      const data = descriptor === 'song-index' ? { count: transport.count, pages: ['song-page'], summary: {} }
        : descriptor === 'song-page' ? { rows: transport.rows }
          : await (requests.get(descriptor)?.promise || Promise.resolve(detail(descriptor.slice(7))))
      options.validate?.(data)
      return data
    } },
    captureDetailSource: () => { state.detailSourceRoute.value = `?view=${state.view.value}`; calls.push(['capture']) },
    commitView: (view, options = {}) => { navigation.invalidate(); state.view.value = view; calls.push(['commit', view, options]) },
    restoreDetailSource: fallback => { calls.push(['restore', state.detailSourceRoute.value]); return state.detailSourceRoute.value || fallback() },
    goHome: () => calls.push(['home']),
    openArchiveUnit: value => calls.push(['unit', value]), openPrimaryIdol: value => calls.push(['idol', value]),
    openProjectedCollection: value => calls.push(['story', value]),
  }
  const api = scope.run(() => vm.runInNewContext(call, context))
  return { ...api, state, navigation, calls, loads, requests, transport, scope }
}

try {
  // Tools entry has no selected song; manifest variants retain the primary catalogue identity.
  {
    const t = fixture()
    t.state.currentSongId.value = 'brndnf'; t.state.filterQuery.value = 'old'
    t.openChartTool(); await flush()
    assert.equal(t.state.view.value, 'chart_lab')
    assert.equal(t.state.currentSongId.value, '')
    assert.equal(t.state.filterQuery.value, '')
    assert.deepEqual(t.chartSongs.value.map(row => [row.code, row.title, row.difficultyCount]),
      [['drv999', 'Special', 2], ['brndnf', 'BRAND NEW FIELD', 1]])
    assert.equal(t.chartSongs.value[1].unitName, 'Jupiter')
    assert.equal(fetchCalls, 1)
    t.closeChartTool(); assert.deepEqual(t.calls.at(-1), ['restore', '?view=experiments'])
    t.scope.stop()
  }
  // A chart selection supersedes an openSong request before either commits a new revision.
  for (const failure of [false, true]) {
    const t = fixture(), old = deferred(), newest = deferred()
    t.requests.set('detail:drvalv', old); t.requests.set('detail:brndnf', newest)
    const first = t.openSong('drvalv')
    t.state.view.value = 'chart_lab'
    const second = t.selectChartSong('brndnf')
    if (failure) old.reject(Error('obsolete song failure')); else old.resolve(detail('drvalv'))
    await first
    assert.equal(t.state.view.value, 'chart_lab')
    assert.equal(t.state.songReadModelDetail.value, null, 'old song cannot publish while chart selection is pending')
    assert.equal(t.state.songReadModelStatus.value, '正在读取谱面…')
    newest.resolve(detail('brndnf')); await second; await flush()
    assert.equal(t.state.currentSongId.value, 'brndnf')
    assert.equal(t.currentSongPresentation.value.id, 'brndnf')
    assert.deepEqual(t.calls.at(-1), ['commit', 'chart_lab', { replace: true }])
    t.scope.stop()
  }
  // The details watcher participates in the same request counter, and route restoration revokes it.
  {
    const t = fixture(), old = deferred(), restored = deferred()
    t.requests.set('detail:drvalv', old); t.requests.set('detail:brndnf', restored)
    const first = t.openSong('drvalv')
    t.state.view.value = 'song_detail'; t.state.currentSongId.value = 'brndnf'; await flush()
    old.resolve(detail('drvalv')); await first
    assert.equal(t.state.songReadModelDetail.value, null)
    t.invalidateSongNavigation()
    restored.resolve(detail('brndnf')); await flush()
    assert.equal(t.state.songReadModelDetail.value, null, 'route invalidation revokes pending watcher publication')
    t.scope.stop()
  }
  // Invalidation also revokes an in-flight chart request without relying on a changed view/revision.
  {
    const t = fixture('chart_lab'), pending = deferred()
    t.requests.set('detail:brndnf', pending)
    const task = t.selectChartSong('brndnf'); t.invalidateSongNavigation()
    pending.resolve(detail('brndnf')); await task
    assert.equal(t.state.currentSongId.value, '')
    assert.equal(t.state.songReadModelDetail.value, null)
    t.scope.stop()
  }
  // Route preparation does not commit views, respects stale work, and keeps stage default/failure policy.
  {
    const t = fixture(), pending = deferred(); let current = true
    t.requests.set('detail:brndnf', pending)
    const task = t.prepareSongRoute({ view: 'song_detail', song: 'brndnf' }, { isCurrent: () => current })
    current = false; pending.resolve(detail('brndnf'))
    assert.equal(await task, false)
    assert.equal(t.state.songReadModelDetail.value, null)
    assert.equal(await t.prepareSongRoute({ view: 'home' }, { isCurrent: () => false }), false)
    assert.equal(await t.prepareSongRoute({ view: 'chibi_stage' }, { isCurrent: () => true }), true)
    assert.equal(t.state.songReadModelDetail.value.id, 'drvalv')
    assert.equal(t.state.view.value, 'experiments')
    assert.deepEqual(t.calls, [])
    t.scope.stop()
  }
  for (const routeView of ['song_detail', 'chart_lab', 'chibi_stage']) {
    const t = fixture(), failed = deferred()
    t.requests.set('detail:brndnf', failed)
    const task = t.prepareSongRoute({ view: routeView, song: 'brndnf' }, { isCurrent: () => true })
    failed.reject(Error('controlled missing detail'))
    assert.equal(await task, true)
    assert.equal(t.state.songReadModelDetail.value, null)
    assert.equal(t.state.songReadModelStatus.value, routeView === 'chibi_stage' ? '' : '歌曲详情暂时无法读取，请重新选择。')
    t.scope.stop()
  }
  // Page counts and cancellation are checked before the assembled catalogue is published.
  {
    const t = fixture(); t.state.songReadModelCatalog.value = null
    t.transport.count++
    await assert.rejects(t.loadSongCatalog(), /count or identity mismatch/)
    assert.equal(t.state.songReadModelCatalog.value, null)
    t.transport.count--; t.transport.rows = [rows[0], rows[0]]
    await assert.rejects(t.loadSongCatalog(), /count or identity mismatch/)
    t.transport.rows = rows
    const controller = new AbortController(); controller.abort()
    await assert.rejects(t.loadSongCatalog({ signal: controller.signal }), /abort/i)
    assert.equal(t.state.songReadModelCatalog.value, null)
    await t.loadSongCatalog(); const count = t.loads.length
    await t.loadSongCatalog(); assert.equal(t.loads.length, count)
    t.scope.stop()
  }
  // Detail identities remain required, and route fallbacks retain their existing source rules.
  {
    const t = fixture(), wrong = deferred()
    t.requests.set('detail:brndnf', wrong)
    const task = t.loadSongDetail('brndnf'); wrong.resolve(detail('drvalv'))
    await assert.rejects(task, /identity mismatch/)
    for (const [parent, expected] of [['idol_detail', 'idol_detail'], ['unit_detail', 'unit_detail'], ['', 'song_catalog']]) {
      t.state.songParentView.value = parent; t.state.currentSongId.value = 'brndnf'
      t.state.currentCharacterId.value = '001tom'; t.state.currentArchiveUnit.value = { id: '01jup' }
      t.goBackFromSong()
      assert.equal(t.state.view.value, expected)
      assert.equal(t.state.currentSongId.value, '')
      assert.equal(t.state.songParentView.value, '')
    }
    t.state.detailSourceRoute.value = ''; t.state.currentSongId.value = 'brndnf'
    t.closeChartTool(); assert.equal(t.state.view.value, 'song_detail')
    t.state.currentSongId.value = ''; t.closeChartTool(); assert.equal(t.state.view.value, 'experiments')
    t.scope.stop()
  }
  console.log('Song navigation: real App wiring, shared request ownership, chart variants, route preparation, loaders and return behavior passed')
} finally {
  scopes.forEach(scope => scope.stop())
  globalThis.fetch = previousFetch; console.error = previousError
}
