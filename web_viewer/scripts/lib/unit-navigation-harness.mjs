import assert from 'node:assert/strict'
import vm from 'node:vm'
import { ref, isRef } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import { useUnitNavigation } from '../../src/composables/useUnitNavigation.js'

// Execute App's complete factory call and expose only its actual destructuring.
export function bindUnitNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parseJavascript(script, { sourceType: 'module' }).program.body
  const binding = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    .find(node => node.init?.callee?.name === 'useUnitNavigation')
  assert.ok(binding, 'App binds the real unit navigation factory')
  const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(item => item.local.name === 'useUnitNavigation'))
  assert.equal(imported?.source.value, './composables/useUnitNavigation.js')
  const unexpected = name => () => { throw new Error(`Unexpected unit fixture boundary: ${name}`) }
  const defaults = {
    ...useArchiveNavigationState(),
    navigation: createArchiveNavigationCoordinator(), archiveBootstrap: { idols: [], domains: {} },
    readModelClient: { load: unexpected('readModelClient.load') },
    unitReadModelCatalog: ref(null), unitReadModelDetail: ref(null), unitReadModelStatus: ref(''),
    loading: ref(false),
  }
  for (const name of ['prepareArchivePage', 'captureDetailSource', 'commitView', 'openIdolReadModel', 'loadScenario', 'openEventDetail'])
    defaults[name] = unexpected(name)
  Object.assign(context, { ...defaults, ...context, useUnitNavigation })
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

export function unitFixtureDetail(id, code = `unit-${id}`) {
  return { id, view: { entry: { unit: { unit_id: Number(id), unit_code: code, unit_name: code },
    members: [{ idol_code: `idol-${id}` }], cardStats: { total: 3 } },
    stories: [{ file: `unit-${id}.json`, exists: true }], songs: [{ song: { song_code: `song-${id}` } }] } }
}

export function createUnitFixtureTransport(ids = ['1', '2']) {
  const details = ids.map(id => unitFixtureDetail(id))
  const rows = details.map(detail => ({ id: detail.id, catalog: structuredClone(detail.view.entry), detail: { url: `unit:${detail.id}` } }))
  const data = new Map([['unit-index', { count: rows.length, pages: [{ url: 'unit-page' }] }],
    ['unit-page', { rows }], ...details.map(detail => [`unit:${detail.id}`, detail])])
  const jobs = new Map(), loads = []
  const client = { async load(descriptor, options = {}) {
    loads.push({ descriptor, options })
    assert.ok(data.has(descriptor.url), `Unexpected Unit descriptor: ${descriptor.url}`)
    const value = jobs.has(descriptor.url) ? await jobs.get(descriptor.url).promise : structuredClone(data.get(descriptor.url))
    if (descriptor.url.startsWith('unit:')) {
      const expected = descriptor.url.slice(5)
      assert.equal(descriptor.expectedId, expected)
      assert.equal(options.expectedId, expected)
      assert.equal(value.id, expected, 'fixture enforces the client envelope identity contract')
    }
    options.validate?.(value)
    return value
  } }
  return { data, jobs, loads, client, bootstrap: { idols: ids.flatMap(id => [{ id: `idol-${id}`, unitId: id }, { id: `idol-${id}-b`, unitId: id }]), domains: { units: { url: 'unit-index' } } } }
}

export function deferredUnit() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
