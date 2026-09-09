import assert from 'node:assert/strict'
import { isRef } from 'vue'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { legacyProjection } from '../fixtures/archive-navigation/legacy-route-projection.mjs'
import { VALID_VIEWS, buildArchiveUrl, readArchiveRoute } from '../src/core/archiveRoute.js'

const navigation = useArchiveNavigationState()
const independent = useArchiveNavigationState()
const fields = Object.keys(navigation).filter(key => key !== 'currentArchiveRoute')
assert.ok(fields.every(key => isRef(navigation[key])))
assert.equal(navigation.view.value, '__boot__')
assert.equal(navigation.homeSelectedId.value, '001tom')
assert.equal(navigation.returnViewAfterPlayer.value, 'files')
for (const key of fields) {
  assert.notEqual(navigation[key], independent[key], `${key} must be scoped to one App instance`)
  navigation[key].value = `${key}-fixture`
}
navigation.currentGroup.value = { id: 'group-1' }
navigation.currentUnit.value = { unit_code: 'legacy-unit', id: 'unit-fallback' }
// New independent entry position is tested in verify-reading-playback; legacy projection stays unchanged.
navigation.currentScenarioInitialStep.value = null
navigation.currentScenarioStartStep.value = 7
navigation.currentScenarioEndStep.value = 12
const contexts = ['home', 'unit_detail', 'mobile_archive', 'event_detail', 'story_detail', 'story_collection', 'song_detail', 'files']
let cases = 0
for (const view of VALID_VIEWS) {
  if (['portal', 'reader'].includes(view)) continue // New route has its own return contract verifier.
  for (const returnView of contexts) {
    for (const parent of contexts) {
      navigation.view.value = view
      navigation.returnViewAfterPlayer.value = returnView
      for (const key of ['songParentView', 'eventParentView', 'storyDetailParentView', 'storyCollectionParentView']) navigation[key].value = parent
      const actual = navigation.currentArchiveRoute()
      const expected = legacyProjection(navigation)
      assert.deepEqual(actual, expected, `${view}/${returnView}/${parent}`)
      const url = buildArchiveUrl('http://localhost/?runtimeDebug=1', actual)
      assert.equal(url.href, buildArchiveUrl('http://localhost/?runtimeDebug=1', expected).href)
      assert.deepEqual(readArchiveRoute(url.href), readArchiveRoute(buildArchiveUrl('http://localhost/?runtimeDebug=1', expected).href))
      cases++
    }
  }
}
// Explicit ownership invariants beyond the frozen oracle.
navigation.view.value = 'story_catalog'
assert.equal(navigation.currentArchiveRoute().scenario, '')
assert.equal(navigation.currentArchiveRoute().voice, '')
assert.equal(navigation.currentArchiveRoute().homeIdol, '')
navigation.view.value = 'player'
navigation.returnViewAfterPlayer.value = 'story_collection'
navigation.storyCollectionParentView.value = 'song_detail'
assert.equal(navigation.currentArchiveRoute().song, navigation.currentSongId.value)
assert.equal(navigation.currentArchiveRoute().parentView, 'song_detail')
assert.equal(navigation.currentArchiveRoute().startStep, 7)
navigation.returnViewAfterPlayer.value = 'event_detail'
navigation.eventParentView.value = 'unit_detail'
assert.equal(navigation.currentArchiveRoute().unit, navigation.currentArchiveUnitCode.value)
assert.equal(navigation.currentArchiveRoute().song, '')
assert.equal(independent.view.value, '__boot__')
assert.equal(independent.currentScenarioStartStep.value, null)

// Execute the production entry/return handlers and route projection together.
// The old oracle above continues to cover routes without the new provenance.
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const context = {
  ...independent,
  currentStoryCollection: { value: { sectionId: '604' } },
  commitView: value => { independent.view.value = value },
}
for (const name of ['openGasha', 'goBackFromGasha']) {
  const source = app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))?.[0]
  assert.ok(source, `${name} production handler exists`)
  vm.runInNewContext(source, context)
}
independent.view.value = 'story_collection'
independent.currentStoryDomain.value = 'extra'
independent.currentStorySection.value = '604'
context.openGasha({ id: '1300011' })
const restored = readArchiveRoute(buildArchiveUrl('http://localhost/?noAudio=1', independent.currentArchiveRoute()).href)
assert.equal(restored.parentView, 'story_collection')
assert.equal(restored.storySection, '604')
assert.equal(restored.gasha, '1300011')
// Exercise the same parent restoration assignment as full App startup.
const restoreSource = app.match(/    gashaParentView.value =[^]*?(?=\n    currentGashaCategory.value)/)?.[0]
assert.ok(restoreSource)
for (const route of [restored, { ...restored, storySection: '' }, { ...restored, storyType: 'main' }, { ...restored, parentView: '' }]) {
  vm.runInNewContext(restoreSource, { ...context, route })
  context.goBackFromGasha()
  assert.equal(independent.view.value, route === restored ? 'story_collection' : 'gashas')
}
independent.gashaParentView.value = 'story_collection'
context.currentStoryCollection.value = null
context.goBackFromGasha()
assert.equal(independent.view.value, 'gashas')
independent.filterQuery.value = 'FES'
independent.currentGashaCategory.value = 'growing_fes'
context.openGasha({ id: '1300011' })
context.goBackFromGasha()
assert.equal(independent.view.value, 'gashas')
assert.equal(independent.filterQuery.value, 'FES')
assert.equal(independent.currentGashaCategory.value, 'growing_fes')
assert.equal(independent.currentArchiveRoute().parentView, '')
console.log(`Archive navigation state: ${fields.length} scoped refs and ${cases} view/return/parent projection + URL cases passed`)
