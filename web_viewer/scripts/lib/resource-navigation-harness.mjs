import assert from 'node:assert/strict'
import vm from 'node:vm'
import { ref, isRef } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'

import { useResourceNavigation } from '../../src/composables/useResourceNavigation.js'

// Execute App's actual factory arguments; transport is the loading boundary.
export function bindResourceNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parse(script, { sourceType: 'module' }).program.body
  const binding = body.flatMap(node => node.declarations || []).find(node => node.init?.callee?.name === 'useResourceNavigation')
  assert.ok(binding, 'App binds the real resource factory')
  const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(row => row.local.name === 'useResourceNavigation'))
  assert.equal(imported?.source.value, './composables/useResourceNavigation.js')
  const unexpected = name => () => { throw Error(`Unexpected resource fixture boundary: ${name}`) }
  Object.assign(context, {
    ...useArchiveNavigationState(), navigation: createArchiveNavigationCoordinator(),
    loading: ref(false), resourceReadModelDetail: ref(null), resourceReadModelStatus: ref(''),
    prepareArchivePage: unexpected('prepareArchivePage'), commitView: unexpected('commitView'),
    ...context, useResourceNavigation,
  })
  for (const [name, value] of Object.entries(context)) if (value && typeof value === 'object' && 'value' in value && !isRef(value)) context[name] = ref(value.value)
  const handlers = vm.runInNewContext(script.slice(binding.init.start, binding.init.end), context)
  const exposed = {}
  for (const property of binding.id.properties) {
    assert.ok(property.key.name in handlers)
    exposed[property.value.name] = handlers[property.key.name]
  }
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
