import assert from 'node:assert/strict'
import vm from 'node:vm'
import { effectScope, isRef, ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import { useHomeNavigation } from '../../src/composables/useHomeNavigation.js'

export function bindHomeNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parseJavascript(script, { sourceType: 'module' }).program.body
  const binding = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    .find(node => node.init?.type === 'CallExpression' && node.init.callee.name === 'useHomeNavigation')
  assert.ok(binding, 'App binds the real Home navigation factory')
  const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(specifier => specifier.local.name === 'useHomeNavigation'))
  assert.equal(imported?.source.value, './composables/useHomeNavigation.js')
  const unexpected = name => () => { throw new Error(`Unexpected Home fixture boundary: ${name}`) }
  const defaults = {
    ...useArchiveNavigationState(), archiveBootstrap: { idols: [], domains: {} },
    navigation: createArchiveNavigationCoordinator(), readModelClient: { load: unexpected('readModelClient.load') },
    homeReadModelIndex: ref(null), homeReadModelProfiles: ref({}), homeEntryStatus: ref(''),
    loading: ref(false), userPreferenceNotice: ref(''), userPreferences: ref({}), validArchiveHomeIdols: ref([]),
    window: { location: { href: 'http://localhost/' } },
  }
  for (const name of ['openIdolPicker', 'commitView', 'captureActiveArchiveView', 'restoreRoute',
    'syncArchiveRoute']) defaults[name] = unexpected(name)
  Object.assign(context, { ...defaults, ...context, useHomeNavigation })
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

export function createHomeFixtureTransport(ids = ['001tom', '002sht', '003hok', '005kao']) {
  const idols = ids.map(id => ({ id, home_available: true, detail: { url: `home:${id}` } }))
  const data = new Map([['home-index', { idols: structuredClone(idols), stats: [], highlights: [] }]])
  for (const { id } of idols) {
    const cues = ['a', 'b'].map(suffix => ({ id: `${id}:${suffix}`, previewStep: { state: { owner: id } } }))
    const page = { url: `cues:${id}` }
    data.set(`home:${id}`, { id, profile: { id, name: id }, cueIndex: cues.map(cue => ({ id: cue.id, page })) })
    data.set(page.url, { rows: cues })
  }
  const jobs = new Map(), loads = []
  const client = { async load(descriptor, options = {}) {
    loads.push({ descriptor, options })
    const value = jobs.has(descriptor.url) ? await jobs.get(descriptor.url).promise : structuredClone(data.get(descriptor.url))
    assert.ok(value, `Unexpected Home descriptor: ${descriptor.url}`)
    options.validate?.(value)
    return value
  } }
  return { idols, data, jobs, loads, client, bootstrap: { idols, domains: { home: { url: 'home-index' } } } }
}
