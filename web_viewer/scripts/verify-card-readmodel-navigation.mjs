import './verify-card-loading-boundary.mjs'
import { bindCardNavigation } from './lib/card-navigation-harness.mjs'
import { bindUnitNavigation } from './lib/unit-navigation-harness.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
{
  const calls = []
  const context = { loadScenario: (...args) => { calls.push(args); return 'pending' } }
  bindUnitNavigation(app, context)
  bindCardNavigation(app, context)
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
