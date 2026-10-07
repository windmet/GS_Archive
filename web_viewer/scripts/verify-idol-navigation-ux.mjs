import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { computed, ref } from 'vue'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const source = (start, end) => {
  const from = app.indexOf(start), to = app.indexOf(end, from)
  assert.ok(from >= 0 && to > from, `Missing production region: ${start}`)
  return app.slice(from, to)
}

for (const preferred of [null, { id: '002sht' }]) {
  const views = []
  const state = {
    view: { value: 'idol_detail' }, detailSourceRoute: { value: '' },
    gashaReadModelStatus: { value: 'old status' },
    filterQuery: { value: 'old query' }, currentCategoryId: { value: 'cards' },
    currentCharacterId: { value: '002sht' }, currentIdolUnitFilter: { value: '01jup' },
    currentGroup: { value: { id: 'old' } }, currentCardId: { value: 'old-card' },
    preferredArchiveIdol: { value: preferred },
    buildArchiveSourceQuery: () => '', currentArchiveRoute: () => ({}),
    commitView: next => { views.push(next); state.view.value = next },
  }
  vm.runInNewContext([
    source('function navigateArchiveSection(', 'async function openStoryReader('),
    source('function openIdolDirectory(', 'function openPrimaryCards('),
    'navigateArchiveSection("idols")',
  ].join('\n'), state)
  assert.deepEqual(views, ['idols'])
  assert.equal(state.currentCategoryId.value, 'idol')
  assert.equal(state.currentCharacterId.value, '')
  assert.equal(state.filterQuery.value, '')
  assert.equal(state.currentIdolUnitFilter.value, '')
  assert.equal(state.currentCardId.value, '')
  assert.equal(state.gashaReadModelStatus.value, '')
  assert.equal(state.currentGroup.value, null)
}
// Execute the real shortcut dispatcher. Its collaborators record destinations;
// no replacement dispatcher or duplicated decision logic is used in the test.
{
  const opened = []
  const state = {
    preferredArchiveIdol: { value: { id: '002sht' } },
    archiveBootstrap: { idols: [{ id: '001tom' }, { id: '002sht' }] },
    openIdolReadModel: (id, options) => opened.push([id, { ...options }]),
  }
  vm.runInNewContext(source('function openPreferredDestination(', 'function openArchivePortal('), state)
  state.openPreferredDestination('profile')
  state.openPreferredDestination({ action: 'profile', idolCode: '001tom' })
  assert.deepEqual(opened, [
    ['002sht', { captureSource: true, resetContext: true }],
    ['001tom', { captureSource: true, resetContext: true }],
  ])
  state.openPreferredDestination({ action: 'profile', idolCode: 'unknown' })
  state.preferredArchiveIdol.value = null
  state.openPreferredDestination('profile')
  assert.equal(opened.length, 2, 'missing or unknown idols must not navigate')
}
{
  const state = {
    computed,
    currentCategoryId: ref('idol'),
    archiveBootstrap: { idols: [
      { id: '001tom', name: '冬馬', unitId: '1' },
      { id: '002sht', name: '翔太', unitId: '1' },
    ] },
    cardReadModelCatalog: { value: [
      { character_id: '002sht' }, { character_id: '002sht' },
    ] },
    indexData: { get value() { throw new Error('compiled index must not be read') } },
    cardIndexData: { get value() { throw new Error('legacy card index must not be read') } },
  }
  vm.runInNewContext(source('const idolList = computed(', 'const searchMatchedIdols = computed(') + '\nresult = idolList.value', state)
  assert.deepEqual(Array.from(state.result, row => row.id), ['001tom', '002sht'])
  state.currentCategoryId.value = 'cards'
  vm.runInNewContext('result = idolList.value', state)
  assert.deepEqual(Array.from(state.result, row => [row.id, row.cardCount]), [['002sht', 2]])
}
{
  const destinations = []
  const state = {
    currentCharacterId: { value: '001tom' }, currentCategoryId: { value: 'idol' },
    currentPickTarget: { value: '' }, detailSourceRoute: { value: 'old-source' },
    archiveBootstrap: { idols: [{ id: '001tom' }] }, currentGroup: { value: { id: 'group' } },
    currentUnit: { value: null }, currentEpisodeId: { value: '' }, currentCardId: { value: '' },
    openIdolReadModel: id => destinations.push(['detail', id]),
    openIdolPicker: target => destinations.push(['picker', target]),
    commitView: view => destinations.push(['view', view]), goHome: () => destinations.push(['home']),
  }
  vm.runInNewContext(source('function goBackFromGroups(', 'function closePlayer('), state)
  state.goBackFromGroups()
  assert.deepEqual(destinations.pop(), ['detail', '001tom'])
  state.currentCategoryId.value = 'idol_chat'
  state.goBackFromGroups()
  assert.deepEqual(destinations.pop(), ['view', 'idol_picker'])
  assert.equal(state.detailSourceRoute.value, '')
  assert.equal(state.currentPickTarget.value, 'mobile')
  state.currentCategoryId.value = 'idol_chat'
  state.currentCharacterId.value = '001jup'
  state.goBackToFiles()
  assert.deepEqual(destinations.pop(), ['view', 'groups'])
}
console.log('Idol navigation UX: main destination is the same directory with or without preferred idol')
