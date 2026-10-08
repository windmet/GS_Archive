import assert from 'node:assert/strict'
import vm from 'node:vm'
import { effectScope, isRef, ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import { useStoryArchiveNavigation } from '../../src/composables/useStoryArchiveNavigation.js'

export function bindStoryArchiveNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parseJavascript(script, { sourceType: 'module' }).program.body
  const binding = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    .find(node => node.init?.type === 'CallExpression' && node.init.callee.name === 'useStoryArchiveNavigation')
  assert.ok(binding, 'App binds the real story archive navigation factory')
  const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(specifier => specifier.local.name === 'useStoryArchiveNavigation'))
  assert.equal(imported?.source.value, './composables/useStoryArchiveNavigation.js')
  const unexpected = name => () => { throw new Error(`Unexpected story archive fixture boundary: ${name}`) }
  const defaults = {
    ...useArchiveNavigationState(), loading: ref(false), mobileUnitReadModelDetail: ref(null), mobileIdolReadModelDetail: ref(null),
    archiveBootstrap: { idols: [], domains: {}, counts: { catalog_story_entries: 0 } }, navigation: createArchiveNavigationCoordinator(),
    readModelClient: { load: unexpected('readModelClient.load') },
  }
  for (const family of ['seasonal', 'work', 'idolStory']) {
    defaults[`${family}ReadModelCatalog`] = ref(null)
    defaults[`${family}ReadModelDetail`] = ref(null)
    defaults[`${family}ReadModelStatus`] = ref('')
  }
  for (const name of ['prepareArchivePage', 'captureDetailSource', 'commitView', 'commitArchiveSelection', 'openIdolPicker',
    'openStoryCatalog', 'openProjectedCollection', 'loadScenario', 'startEpisodeQueue']) defaults[name] = unexpected(name)
  Object.assign(context, { ...defaults, ...context, useStoryArchiveNavigation })
  for (const property of binding.init.arguments[0].properties) {
    if (property.value.type !== 'Identifier') continue
    const name = property.value.name, value = context[name]
    if (value && typeof value === 'object' && 'value' in value && !isRef(value)) context[name] = ref(value.value)
  }
  const scope = effectScope()
  let handlers
  // Evaluate App's complete argument expression so its late-bound cross-domain
  // callbacks read this same context after the other factories are initialized.
  try { handlers = scope.run(() => vm.runInNewContext(script.slice(binding.init.start, binding.init.end), context)) }
  catch (error) { scope.stop(); throw error }
  const exposedHandlers = {}
  for (const property of binding.id.properties) {
    assert.ok(property.key.name in handlers, `App exports ${property.key.name}`)
    exposedHandlers[property.value.name] = handlers[property.key.name]
  }
  Object.assign(context, exposedHandlers)
  return { ...exposedHandlers, stop: () => scope.stop() }
}
