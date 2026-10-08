import assert from 'node:assert/strict'
import vm from 'node:vm'
import { ref, isRef } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'

// Exercise App's loader and entry together; only transport and page preparation
// are fixture boundaries. Keep this source extraction until the module moves.
export function bindResourceNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parse(script, { sourceType: 'module' }).program.body
  const names = ['openArchiveStatus', 'loadResourceStatus', 'pendingResourceNavigation']
  const nodes = names.map(name => {
    const node = body.find(node => node.id?.name === name || node.declarations?.some(row => row.id.name === name))
    assert.ok(node, `App declares ${name}`)
    return node
  }).sort((a, b) => a.start - b.start)
  const unexpected = name => () => { throw Error(`Unexpected resource fixture boundary: ${name}`) }
  Object.assign(context, {
    ...useArchiveNavigationState(), navigation: createArchiveNavigationCoordinator(),
    loading: ref(false), resourceReadModelDetail: ref(null), resourceReadModelStatus: ref(''),
    prepareArchivePage: unexpected('prepareArchivePage'), commitView: unexpected('commitView'),
    ...context,
  })
  for (const [name, value] of Object.entries(context)) if (value && typeof value === 'object' && 'value' in value && !isRef(value)) context[name] = ref(value.value)
  const exposed = vm.runInNewContext(`(() => {\n${nodes.map(node => script.slice(node.start, node.end)).join('\n')}\nreturn { openArchiveStatus, loadResourceStatus };\n})()`, context)
  Object.assign(context, exposed)
  return exposed
}

export function deferredResource() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

export function createResourceFixtureTransport() {
  const detail = { id: 'archive-status', view: {
    manifest: { coverage: { assets: 7 } }, verification: { scenarios: { count: 4 } },
    uiAssets: { meta: { count: 3 } },
  } }
  const data = new Map([
    ['resource-index', { count: 1, pages: [{ url: 'resource-page' }] }],
    ['resource-page', { rows: [{ id: 'archive-status', detail: { url: 'resource-detail' } }] }],
    ['resource-detail', detail],
  ])
  const jobs = new Map(), loads = []
  const client = { async load(descriptor, options = {}) {
    assert.ok(data.has(descriptor?.url), `Unexpected resource descriptor: ${descriptor?.url}`)
    loads.push({ descriptor, options })
    const queue = jobs.get(descriptor.url)
    const result = queue?.length ? await queue.shift().promise : structuredClone(data.get(descriptor.url))
    if (descriptor.url === 'resource-detail') {
      assert.equal(descriptor.expectedId, 'archive-status')
      assert.equal(options.expectedId, 'archive-status')
      assert.equal(result.id, 'archive-status', 'transport enforces envelope identity')
    }
    options.validate?.(result)
    return result
  } }
  function hold(url) {
    const job = deferredResource()
    jobs.set(url, [...(jobs.get(url) || []), job])
    return job
  }
  return { data, detail, jobs, loads, client, hold, bootstrap: { domains: { resources: { url: 'resource-index' } } } }
}
