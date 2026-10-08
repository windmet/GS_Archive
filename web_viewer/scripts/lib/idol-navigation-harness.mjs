import assert from 'node:assert/strict'
import vm from 'node:vm'
import { ref, isRef } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import { useIdolNavigation } from '../../src/composables/useIdolNavigation.js'

// Execute App's complete factory call and expose only its actual destructuring.
export function bindIdolNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parseJavascript(script, { sourceType: 'module' }).program.body
  const binding = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    .find(node => node.init?.callee?.name === 'useIdolNavigation')
  assert.ok(binding, 'App binds the real idol navigation factory')
  const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(item => item.local.name === 'useIdolNavigation'))
  assert.equal(imported?.source.value, './composables/useIdolNavigation.js')
  const unexpected = name => () => { throw new Error(`Unexpected idol fixture boundary: ${name}`) }
  const defaults = {
    ...useArchiveNavigationState(),
    navigation: createArchiveNavigationCoordinator(), archiveBootstrap: { idols: [], domains: {} },
    readModelClient: { load: unexpected('readModelClient.load') },
    idolReadModelCatalog: ref(null), idolReadModelDetail: ref(null), idolReadModelStatus: ref(''),
    loading: ref(false), currentIdolUnitFilter: ref(''),
    idolDisplayName: (id, name) => name || id,
  }
  for (const name of ['openIdolPicker', 'captureDetailSource', 'commitArchiveSelection', 'commitView'])
    defaults[name] = unexpected(name)
  Object.assign(context, { ...defaults, ...context, useIdolNavigation })
  for (const [key, value] of Object.entries(context)) {
    if (value && typeof value === 'object' && 'value' in value && !isRef(value)) context[key] = ref(value.value)
  }
  const handlers = vm.runInNewContext(script.slice(binding.init.start, binding.init.end), context)
  const exposed = {}
  for (const property of binding.id.properties) {
    assert.ok(property.key.name in handlers, `App exports ${property.key.name}`)
    exposed[property.value.name] = handlers[property.key.name]
  }
  Object.assign(context, exposed)
  return exposed
}

export function idolFixtureDetail(id) {
  return { id, view: { profile: { idol_code: id, display_name: id }, stats: { chats: 2, phones: 1 },
    events: [{ event_id: 1 }], songs: [{ song: { song_code: 'one' } }] } }
}

export function createIdolFixtureTransport(ids = ['001tom', '002sht']) {
  const idols = ids.map(id => ({ id, name: id }))
  const rows = idols.map(idol => ({ ...idol, detail: { url: `idol:${idol.id}` } }))
  const data = new Map([
    ['idol-index', { count: rows.length, pages: [{ url: 'idol-page' }] }],
    ['idol-page', { rows }], ...ids.map(id => [`idol:${id}`, idolFixtureDetail(id)]),
  ])
  const jobs = new Map(), loads = []
  const client = { async load(descriptor, options = {}) {
    loads.push({ descriptor, options })
    assert.ok(data.has(descriptor.url), `Unexpected idol descriptor: ${descriptor.url}`)
    const value = jobs.has(descriptor.url) ? await jobs.get(descriptor.url).promise : structuredClone(data.get(descriptor.url))
    if (descriptor.url.startsWith('idol:')) {
      const expected = descriptor.url.slice(5)
      assert.equal(descriptor.expectedId, expected, 'descriptor carries requested idol identity')
      assert.equal(options.expectedId, expected, 'client receives requested idol identity')
      assert.equal(value.id, expected, 'fixture enforces the client envelope identity contract')
    }
    options.validate?.(value)
    return value
  } }
  return { data, jobs, loads, client, bootstrap: { idols, domains: { idols: { url: 'idol-index' } } } }
}

export function deferredIdol() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

// Restore fixtures retain their other domain transports; idol requests use real
// catalog/leaf loading against an explicit fixture derived from their bootstrap.
export function bindIdolFixtureNavigation(app, context) {
  const bootstrap = context.archiveBootstrap || { idols: [], domains: {} }
  const fixture = createIdolFixtureTransport(bootstrap.idols.map(idol => idol.id))
  const rows = fixture.data.get('idol-page').rows
  rows.forEach((row, index) => { row.name = bootstrap.idols[index].name })
  const previousLoad = context.readModelClient?.load?.bind(context.readModelClient)
  context.archiveBootstrap = { ...bootstrap, domains: { ...bootstrap.domains, idols: fixture.bootstrap.domains.idols } }
  context.readModelClient ??= {}
  context.readModelClient.load = (descriptor, options) => fixture.data.has(descriptor?.url)
    ? fixture.client.load(descriptor, options) : previousLoad(descriptor, options)
  bindIdolNavigation(app, context)
  return fixture
}
