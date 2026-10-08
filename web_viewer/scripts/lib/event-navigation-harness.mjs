import assert from 'node:assert/strict'
import vm from 'node:vm'
import { effectScope, isRef, ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import { useEventNavigation } from '../../src/composables/useEventNavigation.js'

export function bindEventNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parseJavascript(script, { sourceType: 'module' }).program.body
  const binding = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    .find(node => node.init?.type === 'CallExpression' && node.init.callee.name === 'useEventNavigation')
  assert.ok(binding, 'App binds the real event navigation factory')
  const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(specifier => specifier.local.name === 'useEventNavigation'))
  assert.equal(imported?.source.value, './composables/useEventNavigation.js')
  const unexpected = name => () => { throw new Error(`Unexpected event fixture boundary: ${name}`) }
  const defaults = {
    ...useArchiveNavigationState(), archiveBootstrap: { idols: [], domains: {} },
    navigation: createArchiveNavigationCoordinator(), readModelClient: { load: unexpected('readModelClient.load') },
    eventReadModelStatus: ref(''), loading: ref(false),
  }
  for (const name of ['eventReadModelCatalog', 'eventReadModelDetail', 'cardReadModelCatalog',
    'currentCard', 'currentArchiveUnit', 'externalStoryResourcesData']) defaults[name] = ref(null)
  for (const name of ['prepareArchivePage', 'captureDetailSource', 'commitView', 'restoreDetailSource',
    'openStoryCatalog', 'startEpisodeQueue', 'loadScenario', 'loadCardCatalog', 'openCard',
    'openIdolReadModel', 'openArchiveUnit']) defaults[name] = unexpected(name)
  Object.assign(context, { ...defaults, ...context, useEventNavigation })
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

export function eventFixtureDetail(id) {
  return { id: String(id), view: { schemaVersion: 2, identity: { id: String(id) },
    story: { entry: { event_id: String(id), event_code: `event-${id}` } },
    episodes: [], cards: [], cast: [], units: [], castReferences: [], readingEntries: [],
    provenance: { eventId: Number(id) }, rewards: { generalPages: [], generalCount: 0 },
  } }
}

export function createEventFixtureTransport(ids) {
  const rows = ids.map(id => ({ id: String(id), event_id: String(id), detail: { url: `event:${id}` } }))
  const data = new Map(rows.map(row => [row.detail.url, eventFixtureDetail(row.id)]))
  const client = { async load(descriptor, options = {}) {
    assert.ok(data.has(descriptor.url), `Unexpected event descriptor: ${descriptor.url}`)
    const value = structuredClone(data.get(descriptor.url))
    assert.equal(descriptor.expectedId, value.id)
    assert.equal(options.expectedId, value.id)
    options.validate?.(value)
    return value
  } }
  return { rows, data, client }
}
