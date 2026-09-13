import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const source = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)))
assert.ok(app.includes("else if (section === 'idols') openIdolDirectory()"))
assert.match(app, /if \(destination === 'profile'\) openPrimaryIdol\(idolCode\)/,
  'preferred-idol shortcut must remain a separate action')

for (const preferred of [null, { id: '002sht' }]) {
  const views = []
  const state = {
    view: { value: 'idol_detail' }, detailSourceRoute: { value: '' },
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
}
console.log('Idol navigation UX: main destination is the same directory with or without preferred idol')
