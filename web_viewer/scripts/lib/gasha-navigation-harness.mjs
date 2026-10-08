import assert from 'node:assert/strict'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { ref, computed, isRef } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import evidence from '../../public/data/editorial/gasha-ticket-evidence.json' with { type: 'json' }

// Execute App's actual declarations together; imports retain App's source location.
// ReadModelClient is the fixture boundary, not the internal catalog/detail loaders.
export function bindGashaNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parse(script, { sourceType: 'module' }).program.body
  const outputs = ['loadGashaCatalog', 'loadGashaDetail', 'openGashaCatalog', 'openGasha',
    'goBackFromGasha', 'openGashaCard', 'gashaCatalog', 'gashaCategoryOptions', 'filteredGashas', 'currentGasha']
  const nodes = [...outputs, 'pendingGashaNavigation'].map(name => {
    const node = body.find(node => node.type === 'FunctionDeclaration' ? node.id.name === name
      : node.type === 'VariableDeclaration' && node.declarations.some(row => row.id.name === name))
    assert.ok(node, `App declares ${name}`)
    if (node.declarations) assert.equal(node.declarations.length, 1)
    return node
  }).sort((a, b) => a.start - b.start)
  const unexpected = name => () => { throw new Error(`Unexpected Gasha fixture boundary: ${name}`) }
  const defaults = {
    ...useArchiveNavigationState(), navigation: createArchiveNavigationCoordinator(),
    loading: ref(false), gashaReadModelCatalog: ref(null), gashaReadModelDetail: ref(null),
    gashaReadModelStatus: ref(''), gashaCatalogFunctions: ref(null),
    currentStoryCollection: ref(null), cardReadModelCatalog: ref(null), computed,
    idolEntitySearchText: id => `idol:${id}`,
  }
  for (const name of ['prepareArchivePage', 'captureDetailSource', 'commitView', 'loadCardCatalog', 'openCard']) defaults[name] = unexpected(name)
  Object.assign(context, { ...defaults, ...context })
  for (const [name, value] of Object.entries(context)) if (value && typeof value === 'object' && 'value' in value && !isRef(value)) context[name] = ref(value.value)
  const executable = new vm.Script(`(() => {\n${nodes.map(node => script.slice(node.start, node.end)).join('\n')}\nreturn { ${outputs.join(', ')} };\n})()`, {
    filename: fileURLToPath(new URL('../../src/App.vue', import.meta.url)),
    importModuleDynamically: vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  })
  const exposed = executable.runInNewContext(context)
  Object.assign(context, exposed)
  return exposed
}

export function deferredGasha() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

export function createGashaFixtureTransport() {
  const ticket = evidence.rows.find(row => row.matched_ids.length && row.tickets.length)
  const supplement = evidence.rows.find(row => !row.matched_ids.length && row.tickets.length)
  assert.ok(ticket && supplement, 'real evidence includes both linked and supplemental ticket records')
  const ids = [String(ticket.matched_ids[0]), 'fixture-second']
  const rows = ids.map((id, index) => ({ id, phase: 'primary', code: `code-${id}`,
    display_name: index ? 'Second fixture' : ticket.source_name,
    category: index ? 'growing_fes' : 'standard_pickup',
    derived_pickup_cards: [{ card_resource_id: 'card', character_id: '001tom', card_title: 'fixture card' }],
    detail: { url: `gasha:${id}` },
  }))
  const data = new Map([['gasha-index', { count: 2, summary: { category_counts: { standard_pickup: 1, growing_fes: 1 } }, pages: [{ url: 'gasha-page-1' }, { url: 'gasha-page-2' }] }],
    ['gasha-page-1', { rows: rows.slice(0, 1) }], ['gasha-page-2', { rows: rows.slice(1) }],
    ...rows.map(row => [row.detail.url, { id: row.id, gasha: structuredClone(row) }])])
  const jobs = new Map(), loads = []
  const client = { async load(descriptor, options = {}) {
    loads.push({ descriptor, options })
    assert.ok(data.has(descriptor.url), `Unexpected Gasha descriptor: ${descriptor.url}`)
    const result = jobs.has(descriptor.url) ? await jobs.get(descriptor.url).promise : structuredClone(data.get(descriptor.url))
    if (descriptor.url.startsWith('gasha:')) {
      const id = descriptor.url.slice(6)
      assert.equal(descriptor.expectedId, id); assert.equal(options.expectedId, id)
      assert.equal(result.id, id, 'fixture enforces the client envelope identity')
    }
    options.validate?.(result)
    return result
  } }
  return { data, jobs, loads, client, ids, ticket, supplement,
    bootstrap: { domains: { gashas: { url: 'gasha-index' } }, counts: { primary_gashas: 2 } } }
}
