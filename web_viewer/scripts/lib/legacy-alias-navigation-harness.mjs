import assert from 'node:assert/strict'
import vm from 'node:vm'
import { effectScope, isRef, ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import { useLegacyAliasNavigation } from '../../src/composables/useLegacyAliasNavigation.js'

export function bindLegacyAliasNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parseJavascript(script, { sourceType: 'module' }).program.body
  const binding = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    .find(node => node.init?.type === 'CallExpression' && node.init.callee.name === 'useLegacyAliasNavigation')
  assert.ok(binding, 'App binds the real legacy alias navigation factory')
  const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(specifier => specifier.local.name === 'useLegacyAliasNavigation'))
  assert.equal(imported?.source.value, './composables/useLegacyAliasNavigation.js')
  const unexpected = name => () => { throw new Error(`Unexpected legacy alias fixture boundary: ${name}`) }
  const defaults = {
    ...useArchiveNavigationState(), archiveBootstrap: { release: 'fixture', idols: [], domains: {} },
    navigation: createArchiveNavigationCoordinator(), readModelClient: { load: unexpected('readModelClient.load') },
    legacyAliasStatus: ref(''),
  }
  for (const name of ['legacyGroupReadModelDetail', 'legacyFileReadModelDetail', 'legacyEpisodeReadModelDetail',
    'legacyZeroReadModelDetail']) defaults[name] = ref(null)
  for (const name of ['captureDetailSource', 'commitView', 'goHome', 'loadScenario', 'openIdolReadModel']) defaults[name] = unexpected(name)
  Object.assign(context, { ...defaults, ...context, useLegacyAliasNavigation })
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
