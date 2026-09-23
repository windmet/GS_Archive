import assert from 'node:assert/strict'
import { effectScope, nextTick, ref } from 'vue'
import { createStoryLocalization } from '../src/localization/story/StoryLocalizationContext.js'
import { criticalPreloadProgress } from '../src/presentation/LoadingPresentation.js'
assert.deepEqual(criticalPreloadProgress({ tasks: [
  { priority: 'critical', state: 'fetched' }, { priority: 'critical', state: 'failed' },
  { priority: 'near', state: 'fetched' }, { priority: 'critical', state: 'excluded' },
] }), { total: 2, ready: 1 })
const requests = [], invalidated = []
const repository = {
  loadScenario: args => new Promise((resolve, reject) => requests.push({ ...args, resolve, reject })),
  getDiagnostics: () => null,
  invalidate: args => invalidated.push(args),
}
const data = ref({ scenario_id: 'first', steps: [] })
const preferences = ref({ story_content_mode: 'translation', story_translation_locale: 'zh-CN' })
const scope = effectScope()
const context = scope.run(() => createStoryLocalization({ compiledData: data, storyPreferences: preferences, repository }))
requests[0].reject(new Error('temporary failure'))
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(context.diagnostics.value.code, 'translation_invalid')
assert.equal(context.loading.value, false)
assert.equal(context.retryTranslation(), true)
await nextTick()
assert.equal(requests.length, 2)
assert.deepEqual(invalidated, [{ scenarioId: 'first', locale: 'zh-CN' }])
assert.equal(context.retryTranslation(), false)
data.value = { scenario_id: 'second', steps: [] }
await nextTick()
assert.equal(requests[1].signal.aborted, true)
requests[1].resolve({ entries: { stale: {} } })
requests[2].resolve({ entries: { current: {} } })
await new Promise(resolve => setTimeout(resolve, 0))
assert.ok(context.overlay.value.entries.current)
assert.equal(preferences.value.story_content_mode, 'translation')
assert.equal(context.loading.value, false)
scope.stop()
console.log('UI recovery: critical progress, translation retry, unchanged preference, stale completion passed')
