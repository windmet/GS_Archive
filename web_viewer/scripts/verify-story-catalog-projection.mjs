import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { computed, ref } from 'vue'
import { parse } from '@vue/compiler-sfc'
import { parse as parseScript } from '@babel/parser'
import { useStoryCatalogProjection } from '../src/composables/useStoryCatalogProjection.js'

const app = parse(readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const binding = parseScript(app, { sourceType: 'module' }).program.body
  .filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
  .find(node => node.id.type === 'ObjectPattern' && node.id.properties.some(property => property.key.name === 'filteredStoryCatalog'))
assert.ok(binding, 'App binds its production story projection')
const declarations = parseScript(app, { sourceType: 'module' }).program.body
  .filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
const prerequisites = declarations.filter(node => ['storyCatalogEntries','catalogScopeIdol'].includes(node.id.name))
assert.equal(prerequisites.length, 2)
const entries = [
  { resourceId: 'b', title: 'い', domain: 'main', domainLabel: '主线剧情', domainOrder: 0, sectionId: '101', exists: true, releaseAt: 20, characters: ['001tom'], summary: { step_count: 3 } },
  { resourceId: 'a', title: 'う', domain: 'event', domainLabel: '活动', domainOrder: 1, sectionId: '1', eventScope: 'fixed_unit_event', exists: false, releaseAt: 40, characters: ['002sht'], summary: { step_count: 5 } },
  { resourceId: 'c', title: 'あ', domain: 'event', domainLabel: '活动', domainOrder: 1, sectionId: '2', eventScope: 'mixed_unit_event', exists: true, releaseAt: 10, characters: ['001tom'] },
  { resourceId: 'd', title: 'え', domain: 'event', domainLabel: '活动', domainOrder: 1, sectionId: '3', eventScope: 'attribute_event', exists: true, releaseAt: 30, characters: ['001tom'], summary: { step_count: 1 } },
]
const state = Object.fromEntries(Object.entries({ storyCatalogEntries: entries, catalogScopeIdol: null, filterQuery: '',
  currentStoryAvailability: 'all', currentStoryDomain: '', currentStorySection: '', currentEventScope: 'all',
  currentStorySort: 'domain', storyVisibleLimit: 2 }).map(([key, value]) => [key, ref(value)]))
// Execute the actual dependency declarations and call in App order: unlike lazy computed callbacks,
// passing a ref into a composable reads it immediately and must not cross its temporal dead zone.
vm.runInNewContext([...prerequisites, binding].sort((a,b) => a.start-b.start)
  .map(node => `const ${app.slice(node.start,node.end)};`).join('\n'), {
  ...state, computed, useStoryCatalogProjection, storyReadModelCatalog: ref(entries),
  currentCharacterId: ref(''), archiveBootstrap: { idols: [] },
})
const result = vm.runInNewContext(app.slice(binding.init.start, binding.init.end), { ...state, useStoryCatalogProjection })
const ids = () => result.filteredStoryCatalog.value.map(row => row.resourceId)
assert.deepEqual(ids(), ['b','a','c','d'])
assert.deepEqual(result.visibleStoryCatalogEntries.value.map(row => row.resourceId), ['b','a'])
state.storyVisibleLimit.value = 4
assert.equal(result.visibleStoryCatalogEntries.value.length, 4)
for (const [sort, expected] of [['latest',['a','d','b','c']], ['title',['c','b','a','d']], ['resource',['a','b','c','d']], ['steps_desc',['a','b','d','c']]]) {
  state.currentStorySort.value = sort; assert.deepEqual(ids(), expected)
}
assert.deepEqual(state.storyCatalogEntries.value.map(row => row.resourceId), ['b','a','c','d'], 'sorting cannot mutate source rows')
state.currentStorySort.value = 'domain'
assert.deepEqual(result.storyDomainOptions.value, [{ id:'main', count:1, label:'主线剧情' },{ id:'event', count:3, label:'活动' }])
assert.deepEqual(result.storyEventScopeOptions.value.map(row => row.count), [1,1,1])
state.catalogScopeIdol.value = { id:'001tom' }
assert.deepEqual(ids(), ['b','c','d'])
assert.deepEqual(result.storyEventScopeOptions.value.map(row => row.count), [0,1,1])
state.catalogScopeIdol.value = null
state.currentStoryDomain.value = 'event'; state.currentEventScope.value = 'mixed_unit_event'
assert.deepEqual(ids(), ['c'])
state.currentEventScope.value = 'all'; state.currentStorySection.value = '1'
assert.deepEqual(ids(), ['a'])
state.currentStorySection.value = ''; state.currentStoryAvailability.value = 'playable'
assert.deepEqual(ids(), ['c','d'])
state.currentStoryAvailability.value = 'missing'
assert.deepEqual(ids(), ['a'])
state.currentStoryDomain.value = 'main'; state.currentStoryAvailability.value = 'all'; state.currentEventScope.value = 'attribute_event'
assert.deepEqual(ids(), ['b'], 'event scope does not filter another domain')
// Search remains owned by the existing catalog component; extraction must not add a second title-only filter.
state.filterQuery.value = 'component-owned search'
assert.deepEqual(ids(), ['b'])
state.storyCatalogEntries.value = []
assert.deepEqual(ids(), []); assert.deepEqual(result.storyDomainOptions.value, [])
assert.deepEqual(result.storyEventScopeOptions.value.map(row => row.count), [0,0,0])
console.log('Story catalog projection: actual App binding, reactive scope/counts, availability/section, five orders, pagination, empty replacement and immutable source passed')
