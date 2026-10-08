import assert from 'node:assert/strict'
import vm from 'node:vm'
import { parse } from '@vue/compiler-sfc'
import { parse as parseScript } from '@babel/parser'
import { computed, ref, reactive, watch, nextTick, effectScope, createSSRApp } from 'vue'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { renderToString } from '@vue/server-renderer'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import { songMatchesIdol } from '../../src/presentation/CatalogIdolScope.js'
import { buildSongPresentation } from '../../src/presentation/SongPresentation.js'
import { projectSongPerformance } from '../../readmodels/lib/projections.mjs'
import { useStageSongProjection } from '../../src/composables/useStageSongProjection.js'

function production(text) {
  const { descriptor, errors } = parse(text); assert.deepEqual(errors, [])
  const script = descriptor.scriptSetup.content, body = parseScript(script, { sourceType: 'module' }).program.body
  const cut = node => { assert.ok(node, 'production declaration exists'); return script.slice(node.start, node.end) }
  return { body, cut,
    fn: name => cut(body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name)),
    value: name => cut(body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations).find(node => node.id.name === name)?.init),
    setup: body.filter(node => node.type !== 'ImportDeclaration').map(cut).join('\n'),
    template: descriptor.template.ast,
  }
}
const flush = async () => { await nextTick(); await Promise.resolve(); await Promise.resolve() }
const plain = value => JSON.parse(JSON.stringify(value))

export async function verifySongLandingBehavior({ appComponent, catalogComponent, detailComponent, idolDetailComponent, unitDetailComponent, catalog, unitDictionary }) {
  const app = production(appComponent)
  const state = { computed, view: ref('song_detail'), currentSongId: ref('drvalv'),
    songReadModelDetail: ref({ id: 'drvalv', song: catalog.songs.drvalv, view: { id: 'drvalv' }, experimental: { id: 'drvalv' } }) }
  const values = Object.fromEntries(['currentSong','currentSongPresentation'].map(name => [name, vm.runInNewContext(app.value(name), state)]))
  const stageBinding = app.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    .find(node => node.id.type === 'ObjectPattern' && node.id.properties.some(property => property.key.name === 'stageAudioExperiments'))
  const stageCatalog = ref(null)
  Object.assign(values, vm.runInNewContext(app.cut(stageBinding.init), {
    ...state, songReadModelCatalog: stageCatalog, useStageSongProjection,
  }))
  assert.equal(values.currentSong.value.song_code, 'drvalv')
  assert.equal(values.currentSongPresentation.value.id, 'drvalv')
  state.currentSongId.value = 'brndnf'
  assert.equal(values.currentSong.value, null); assert.equal(values.currentSongPresentation.value, null)
  assert.deepEqual(Object.keys(values.stageAudioExperiments.value), [])
  state.currentSongId.value = ''; state.view.value = 'chibi_stage'
  assert.deepEqual(Object.keys(values.stageAudioExperiments.value), ['drvalv'])
  assert.deepEqual(values.stageSongDirectory.value, [])
  stageCatalog.value = catalog
  assert.equal(values.stageSongDirectory.value.length, Object.keys(catalog.songs).length)
  assert.equal(values.stageSongDirectory.value[0], stageCatalog.value.songs[Object.keys(catalog.songs)[0]])
  // Preserve table-46 slot ordering, including repeated performers, rather than sorting/deduplicating it.
  const slotMapping = { performer_slot_idol_codes: ['003hok', '001tom', '003hok'], performer_idol_codes: ['001tom', '003hok'] }
  state.songReadModelDetail.value = { id: 'drvalv', song: { performance_mapping: slotMapping } }
  assert.equal(values.stageOriginalSlotOrdered.value, true)
  assert.deepEqual(plain(values.stageOriginalPerformers.value), slotMapping.performer_slot_idol_codes)
  assert.deepEqual(Object.keys(values.stageAudioExperiments.value), [])
  state.songReadModelDetail.value.song.performance_mapping.performer_slot_idol_codes = []
  assert.equal(values.stageOriginalSlotOrdered.value, false)
  assert.deepEqual(plain(values.stageOriginalPerformers.value), slotMapping.performer_idol_codes)
  state.currentSongId.value = 'brndnf'
  assert.equal(values.stageOriginalSlotOrdered.value, false)
  assert.deepEqual(values.stageOriginalPerformers.value, [])
  state.currentSongId.value = ''; state.view.value = 'song_catalog'
  assert.deepEqual(values.stageOriginalPerformers.value, [])
  state.view.value = 'chibi_stage'; state.songReadModelDetail.value = null
  assert.deepEqual(values.stageOriginalPerformers.value, [])
  for (const [id, song] of Object.entries(catalog.songs)) {
    state.currentSongId.value = id; state.songReadModelDetail.value = { id, song }
    const mapping = song.performance_mapping
    assert.equal(values.stageOriginalSlotOrdered.value, Boolean(mapping?.performer_slot_idol_codes?.length))
    assert.deepEqual(plain(values.stageOriginalPerformers.value), mapping?.performer_slot_idol_codes?.length
      ? mapping.performer_slot_idol_codes : mapping?.performer_idol_codes || [])
  }
  state.currentSongId.value = 'drvalv'; state.view.value = 'song_detail'

  const requests = [], views = [], effects = []
  const navigation = createArchiveNavigationCoordinator()
  const context = {
    ...state, navigation, pendingSongNavigation: 0, songReadModelStatus: ref(''), songParentView: ref(''),
    detailSourceRoute: ref('old'), currentCharacterId: ref('001tom'), currentSongScope: ref('movie'),
    filterQuery: ref('old'), currentCategoryId: ref('idol'), gashaReadModelStatus: ref(''),
    currentArchiveUnit: ref({ id: '01jup' }), archiveBootstrap: { idols: [{ id: '001tom' }] },
    commitView: next => { views.push(next); state.view.value = next },
    ensureSongCatalog: () => effects.push('catalog'), captureDetailSource: () => effects.push('source'),
    buildArchiveSourceQuery: () => '?view=portal', currentArchiveRoute: () => ({ view: state.view.value }),
    loadSongDetail: id => new Promise((resolve, reject) => requests.push({ id, resolve, reject })),
    openChibiStage: target => effects.push(['stage', plain(target)]),
    openArchiveUnit: target => effects.push(['unit', plain(target)]),
    openPrimaryIdol: id => effects.push(['idol', id]), openProjectedCollection: target => effects.push(['story', plain(target)]),
    console: { error() {} },
  }
  vm.runInNewContext(['navigateArchiveSection','openSongCatalog','openSong','openSongStage','openSongUnit','openSongIdol','openSongRelatedStory'].map(app.fn).join('\n'), context)
  context.navigateArchiveSection('songs')
  assert.equal(state.view.value, 'song_catalog'); assert.equal(state.currentSongId.value, '')
  for (const key of ['songParentView','filterQuery','currentCategoryId','currentCharacterId']) assert.equal(context[key].value, '')
  assert.equal(context.currentSongScope.value, 'all'); assert.ok(effects.includes('catalog'))
  const back = app.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'goArchiveBack')
    .body.body.find(node => node.type === 'VariableDeclaration').declarations.find(node => node.id.name === 'backByView')
    .init.properties.find(node => node.key.name === 'song_detail').value
  const returnFromSong = vm.runInNewContext(`(${app.cut(back)})`, context)
  for (const parent of ['idol_detail','unit_detail','song_catalog']) {
    state.view.value = parent; context.currentCharacterId.value = '001tom'
    const opened = context.openSong('brndnf'); requests.at(-1).resolve({ id: 'brndnf' }); await opened
    assert.equal(state.view.value, 'song_detail'); assert.equal(state.currentSongId.value, 'brndnf')
    assert.equal(context.songParentView.value, parent === 'song_catalog' ? '' : parent)
    returnFromSong(); assert.equal(state.view.value, parent); assert.equal(state.currentSongId.value, '')
  }
  const first = context.openSong('drvalv'), old = requests.at(-1)
  const second = context.openSong('brndnf'); requests.at(-1).resolve({ id: 'brndnf' }); await second
  old.resolve({ id: 'drvalv' }); await first
  assert.equal(state.currentSongId.value, 'brndnf', 'old responses must not replace the selected song')
  const failed = context.openSong('drvalv'); requests.at(-1).reject(Error('controlled failure')); await failed
  assert.equal(state.currentSongId.value, 'brndnf'); assert.match(context.songReadModelStatus.value, /重新选择/)
  context.openSongStage({ songCode: 'wrong', choreographyId: 'sample' })
  assert.ok(!effects.some(item => Array.isArray(item) && item[0] === 'stage'))
  context.openSongStage({ songCode: 'brndnf', choreographyId: 'sample' })
  assert.deepEqual(effects.at(-1), ['stage', { songCode: 'brndnf', choreographyId: 'sample' }])
  context.openSongUnit('01jup'); assert.deepEqual(effects.at(-1), ['unit', { unit_code: '01jup' }])
  context.openSongIdol('001tom'); assert.deepEqual(effects.at(-1), ['idol', '001tom'])
  context.openSongRelatedStory(catalog.songs.drv999.related_entities[0])
  assert.deepEqual(effects.at(-1), ['story', { domain: 'extra', section: '602', parent: 'song_detail' }])

  // Real watcher + real navigation revision ownership, with only transport controlled.
  context.watch = watch
  const watcher = app.body.find(node => node.type === 'ExpressionStatement' && node.expression.callee?.name === 'watch' &&
    node.expression.arguments[0]?.type === 'ArrayExpression' && node.expression.arguments[0].elements[1]?.name === 'currentSongId')
  const scope = effectScope()
  try {
    scope.run(() => vm.runInNewContext(app.cut(watcher), context))
    state.currentSongId.value = 'drvalv'; await flush()
    requests.at(-1).resolve({ id: 'drvalv' }); await flush()
    assert.equal(state.songReadModelDetail.value.id, 'drvalv')
    state.currentSongId.value = 'brndnf'; await flush(); navigation.invalidate()
    requests.at(-1).resolve({ id: 'brndnf' }); await flush()
    assert.equal(state.songReadModelDetail.value.id, 'drvalv')
  } finally { scope.stop() }

  const rows = Object.values(catalog.songs)
  let pageRows = rows, count = rows.length, loads = 0
  const loader = { navigation, songReadModelCatalog: ref(null), archiveBootstrap: { domains: { songs: 'index' } },
    readModelClient: { load: async descriptor => { loads++; return descriptor === 'index' ? { pages: ['page'], count, summary: catalog.summary } : { rows: pageRows } } } }
  vm.runInNewContext(app.fn('loadSongCatalog'), loader)
  assert.equal(Object.keys((await loader.loadSongCatalog()).songs).length, 61)
  await loader.loadSongCatalog(); assert.equal(loads, 2, 'cached catalog must not request pages again')
  loader.songReadModelCatalog.value = null; count++
  await assert.rejects(loader.loadSongCatalog(), /count or identity mismatch/)
  count--; pageRows = [...rows.slice(1), rows[1]]
  await assert.rejects(loader.loadSongCatalog(), /count or identity mismatch/)
  let leaf = { song: catalog.songs.brndnf, view: { id: 'brndnf' } }
  const detailLoader = { navigation, songReadModelCatalog: ref({ songs: { brndnf: { detail: 'bounded-detail' } } }),
    readModelClient: { load: async (descriptor, options) => {
      assert.equal(descriptor, 'bounded-detail'); options.validate(leaf); return leaf
    } } }
  vm.runInNewContext(app.fn('loadSongDetail'), detailLoader)
  assert.equal(await detailLoader.loadSongDetail('brndnf'), leaf)
  leaf = { song: catalog.songs.drvalv, view: { id: 'brndnf' } }
  await assert.rejects(detailLoader.loadSongDetail('brndnf'), /identity mismatch/)
  leaf = { song: catalog.songs.brndnf, view: { id: 'drvalv' } }
  await assert.rejects(detailLoader.loadSongDetail('brndnf'), /identity mismatch/)

  const directory = { ...catalog, songs: Object.fromEntries(rows.map(song => [song.song_code, { ...song,
    performance: projectSongPerformance(song, buildSongPresentation(song, unitDictionary)),
  }])) }
  const component = production(catalogComponent), emitted = []
  const props = reactive({ catalog: directory, scope: 'all', query: '', scopeIdol: null, idolName: () => '', idolSearch: (_id, name) => name || '' })
  const catalogState = vm.runInNewContext(`${component.setup}\n;({filteredSongs,query,activeFilter})`, {
    computed, songMatchesIdol, defineProps: () => props, defineEmits: () => (event, value) => emitted.push([event, value]),
  })
  const ids = () => Array.from(catalogState.filteredSongs.value, song => song.song_code)
  assert.equal(ids().length, 60); assert.equal(ids()[0], 'drvalv'); assert.ok(!ids().includes('drv999'))
  for (const [scope, size] of [['movie',11],['mvlive',1],['layered',3],['oneshot',2],['special',1]]) {
    props.scope = scope; assert.equal(ids().length, size, scope)
  }
  props.scope = 'all'
  for (const [query, expected] of [['brand new field',['brndnf']],['drv999',['drvalv']],['びよんど',['byndtd']],['no-such-song',[]]]) {
    props.query = query; assert.deepEqual(ids(), expected)
  }
  props.query = 'Jupiter'; assert.ok(ids().includes('brndnf')); assert.ok(!ids().includes('flslgt'))
  catalogState.query.value = 'changed'; catalogState.activeFilter.value = 'movie'
  assert.deepEqual(emitted, [['update:query','changed'],['update:scope','movie']])

  // Exercise the real template emit expressions with production-shaped payloads.
  for (const [text, event, payload, bindings] of [
    [catalogComponent,'open','brndnf',{ song: catalog.songs.brndnf }],
    [idolDetailComponent,'open-song','brndnf',{ entry: { song: catalog.songs.brndnf } }],
    [unitDetailComponent,'open-song','brndnf',{ song: catalog.songs.brndnf }],
    [detailComponent,'open-unit','01jup',{ song: { unit: { id: '01jup' } }, entry: { id: '01jup' } }],
    [detailComponent,'open-idol','001tom',{ $event: '001tom' }],
    [detailComponent,'open-related-story',catalog.songs.drv999.related_entities[0],{ entry: { payload: catalog.songs.drv999.related_entities[0] } }],
  ]) {
    const expressions = []
    const visit = node => { for (const prop of node.props || []) if (prop.name === 'on' && prop.exp?.content.includes(`'${event}'`)) expressions.push(prop.exp.content); for (const child of node.children || []) visit(child) }
    visit(production(text).template); assert.ok(expressions.length, `${event} template event exists`)
    for (const expression of expressions) {
      const events = [], emit = (name, value) => events.push([name, value])
      vm.runInNewContext(expression, { ...bindings, emit, $emit: emit })
      assert.deepEqual(events, [[event, payload]])
    }
  }
  const server = await createServer({ configFile: false, plugins: [vue()], server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
  try {
    const { default: Catalog } = await server.ssrLoadModule('/src/components/archive/ArchiveSongCatalog.vue')
    const html = await renderToString(createSSRApp(Catalog, { catalog: directory }))
    assert.equal((html.match(/class="song-card"/g) || []).length, 60)
    assert.ok(html.includes('aria-label="搜索歌曲"')); assert.ok(html.includes('loading="lazy"'))
    assert.ok(html.indexOf('song:drvalv') < html.indexOf('song:brndnf'))
    const filtered = await renderToString(createSSRApp(Catalog, { catalog: directory, scope: 'mvlive' }))
    assert.equal((filtered.match(/class="song-card"/g) || []).length, 1); assert.ok(filtered.includes('song:reason'))
  } finally { await server.close() }
}
