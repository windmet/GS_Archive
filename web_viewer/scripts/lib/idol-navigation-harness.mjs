import assert from 'node:assert/strict'
import vm from 'node:vm'
import { computed, ref, isRef } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'

// Execute the current App declarations together: internal loaders and the request
// counter must not be replaced by fixture callbacks at this boundary.
export function bindIdolNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parseJavascript(script, { sourceType: 'module' }).program.body
  const functions = ['openPrimaryIdol', 'openIdolReadModel', 'openIdolDirectory',
    'selectPrimaryIdol', 'loadIdolCatalog', 'loadIdolDetail']
  const projections = ['currentIdolDetail', 'currentIdolProfile', 'currentIdolDisplayName',
    'currentIdolStats', 'currentIdolEvents', 'currentIdolSongs']
  const names = new Set([...functions, ...projections, 'pendingIdolNavigation'])
  const nodes = body.filter(node => node.type === 'FunctionDeclaration' ? names.has(node.id.name)
    : node.type === 'VariableDeclaration' && node.declarations.some(item => names.has(item.id.name)))
  assert.equal(nodes.length, names.size, 'All production idol declarations are present')
  const unexpected = name => () => { throw new Error(`Unexpected idol fixture boundary: ${name}`) }
  const defaults = {
    ...useArchiveNavigationState(), computed,
    navigation: createArchiveNavigationCoordinator(), archiveBootstrap: { idols: [], domains: {} },
    readModelClient: { load: unexpected('readModelClient.load') },
    idolReadModelCatalog: ref(null), idolReadModelDetail: ref(null), idolReadModelStatus: ref(''),
    loading: ref(false), currentIdolUnitFilter: ref(''),
    idolDisplayName: (id, name) => name || id,
  }
  for (const name of ['openIdolPicker', 'captureDetailSource', 'commitArchiveSelection', 'commitView'])
    defaults[name] = unexpected(name)
  Object.assign(context, { ...defaults, ...context })
  for (const [key, value] of Object.entries(context)) {
    if (value && typeof value === 'object' && 'value' in value && !isRef(value)) context[key] = ref(value.value)
  }
  const exposed = [...functions, ...projections]
  const handlers = vm.runInNewContext(nodes.map(node => script.slice(node.start, node.end)).join('\n')
    + `\n;({${exposed.join(',')}})`, context)
  Object.assign(context, handlers)
  return handlers
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
