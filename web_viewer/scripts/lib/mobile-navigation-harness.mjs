import assert from 'node:assert/strict'
import vm from 'node:vm'
import { effectScope, isRef, ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import { useMobileNavigation } from '../../src/composables/useMobileNavigation.js'

export function bindMobileNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parseJavascript(script, { sourceType: 'module' }).program.body
  const binding = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    .find(node => node.init?.type === 'CallExpression' && node.init.callee.name === 'useMobileNavigation')
  assert.ok(binding, 'App binds the real mobile navigation factory')
  const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(specifier => specifier.local.name === 'useMobileNavigation'))
  assert.equal(imported?.source.value, './composables/useMobileNavigation.js')
  const unexpected = name => () => { throw new Error(`Unexpected mobile fixture boundary: ${name}`) }
  const defaults = {
    ...useArchiveNavigationState(), archiveBootstrap: { idols: [], domains: {} }, bootstrapMembership: {},
    navigation: createArchiveNavigationCoordinator(), readModelClient: { load: unexpected('readModelClient.load') },
    idolDisplayName: id => id,
  }
  for (const name of ['mobileIdolReadModelCatalog', 'mobileUnitReadModelCatalog', 'mobileIdolReadModelDetail',
    'mobileUnitReadModelDetail', 'cardReadModelDetail']) defaults[name] = ref(null)
  for (const name of ['mobileReadModelStatus', 'legacyEntryStatus']) defaults[name] = ref('')
  for (const name of ['captureDetailSource', 'commitView', 'commitArchiveSelection', 'openIdolPicker',
    'goHome', 'loadScenario', 'loadCardDetail']) defaults[name] = unexpected(name)
  Object.assign(context, { ...defaults, ...context, useMobileNavigation })
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
