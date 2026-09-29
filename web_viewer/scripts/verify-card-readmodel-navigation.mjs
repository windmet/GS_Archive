import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const listSource = app.match(/function openPrimaryCards\([^]*?\n\}/)?.[0]
const detailSource = app.match(/function openCard\([^]*?\n\}/)?.[0]
assert.ok(listSource && detailSource)

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const jobs = new Map(), commits = [], errors = []
  let revision = 0
  const context = vm.createContext({
    prepareArchivePage: (_view, data) => data,
    pendingCardNavigation: 0, cardReadModelStatus: { value: '' }, cardReadModelDetail: { value: null },
    unitReadModelStatus: { value: '' }, currentArchiveUnit: { value: { unit_id: '1' } },
    currentArchiveUnitCode: { value: '01jup' }, currentIdolUnitFilter: { value: '' },
    loading: { value: false }, view: { value: 'cards' }, filterQuery: { value: 'old' },
    currentCategoryId: { value: '' }, currentCharacterId: { value: '' }, currentCardId: { value: '' },
    currentGroup: { value: null }, currentCardRarity: { value: 'SSR' },
    currentCardAssetState: { value: 'all' }, currentCardRelationState: { value: 'all' },
    archiveBootstrap: { idols: [{ id: '001tom' }] },
    navigation: { invalidate: () => revision++, getRevision: () => revision, isDisposed: () => false },
    loadCardCatalog: () => { const job = deferred(); jobs.set('catalog', job); return job.promise },
    loadCardDetail: id => { const job = deferred(); jobs.set(id, job); return job.promise },
    captureDetailSource: () => {},
    commitView: value => { revision++; commits.push(value); context.view.value = value; context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  vm.runInContext(`${listSource}\n${detailSource}\n${app.match(/function openUnitCards\([^]*?\n\}/)[0]}`, context)
  return { context, jobs, commits, errors, invalidate: () => revision++ }
}
const detail = id => ({ id, card: { resource_id: id } })

{
  const t = setup()
  const old = t.context.openCard({ resource_id: 'first' })
  const current = t.context.openCard({ resource_id: 'second' })
  t.jobs.get('second').resolve(detail('second')); await current
  t.jobs.get('first').resolve(detail('first')); await old
  assert.equal(t.context.currentCardId.value, 'second')
  assert.deepEqual(t.commits, ['card_detail'])
}
{
  const t = setup()
  const old = t.context.openCard({ resource_id: 'first' })
  t.invalidate()
  t.jobs.get('first').resolve(detail('first')); await old
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const failed = t.context.openCard({ resource_id: 'first' })
  t.jobs.get('first').reject(new Error('network')); await failed
  assert.match(t.context.cardReadModelStatus.value, /重试/)
  assert.equal(t.context.loading.value, false)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openCard({ resource_id: 'first' })
  t.jobs.get('first').resolve(detail('first')); await retry
  assert.deepEqual(t.commits, ['card_detail'])
}
{
  const t = setup()
  const list = t.context.openPrimaryCards('001tom')
  t.jobs.get('catalog').resolve([]); await list
  assert.deepEqual(t.commits, ['cards'])
  assert.equal(t.context.currentCharacterId.value, '001tom')
  assert.equal(t.context.currentCardRarity.value, 'all')
}
{
  const t = setup()
  const pending = t.context.openUnitCards()
  t.jobs.get('catalog').resolve([]); await pending
  assert.deepEqual(t.commits, ['idols'])
  assert.equal(t.context.currentCategoryId.value, 'cards')
  assert.equal(t.context.currentIdolUnitFilter.value, '1')
  assert.equal(t.context.currentArchiveUnitCode.value, '')
}
{
  const t = setup()
  const pending = t.context.openUnitCards()
  t.invalidate()
  t.jobs.get('catalog').resolve([]); await pending
  assert.deepEqual(t.commits, [], 'leaving the unit page cancels the old cards action')
}
{
  const t = setup()
  const pending = t.context.openUnitCards()
  t.jobs.get('catalog').reject(new Error('offline')); await pending
  assert.deepEqual(t.commits, [])
  assert.match(t.context.unitReadModelStatus.value, /重试/)
  assert.equal(t.context.loading.value, false)
}
{
  const calls = []
  const context = { loadScenario: (...args) => { calls.push(args); return 'pending' } }
  vm.runInNewContext(['openUnitStory', 'openCardScenario'].map(name => app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0]).join('\n'), context)
  assert.equal(context.openUnitStory({ file: 'unit.json', exists: true }), 'pending')
  context.openUnitStory({ file: 'missing.json', exists: false })
  assert.equal(context.openCardScenario({ compiled_file: 'card.json' }), 'pending')
  assert.deepEqual(calls, [['unit.json', 'unit_detail'], ['card.json', 'card_detail']])
}
{
  const context = { computed: fn => fn(), currentCategoryId: { value: 'cards' },
    cardReadModelCatalog: { value: [{ character_id: 'a' }, { character_id: 'a' }, { character_id: 'b' }] },
    archiveBootstrap: { idols: [{ id: 'a', unitId: '1' }, { id: 'b', unitId: '2' }, { id: 'c', unitId: '1' }] } }
  const source = app.slice(app.indexOf('const idolList = computed('), app.indexOf('const searchMatchedIdols = computed('))
  const list = vm.runInNewContext(source + '\nidolList', context)
  assert.deepEqual(JSON.parse(JSON.stringify(list)), [
    { id: 'a', unitId: '1', cardCount: 2, _isGroup: false }, { id: 'b', unitId: '2', cardCount: 1, _isGroup: false },
  ], 'card idol directory must use projected ownership and bootstrap unit identity without old tables')
}
console.log('Card read-model navigation: selection, races, retry, unit card directory and scenario actions passed')
