import assert from 'node:assert/strict'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { effectScope, isRef, ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import { useReaderNavigation } from '../../src/composables/useReaderNavigation.js'
import { validateReadingDocument, validateReadingManifest } from '../../shared/reading/ReadingContract.js'

export function bindReaderNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parseJavascript(script, { sourceType: 'module' }).program.body
  const binding = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    .find(node => node.init?.type === 'CallExpression' && node.init.callee.name === 'useReaderNavigation')
  assert.ok(binding, 'App binds the real Reader navigation factory')
  const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(specifier => specifier.local.name === 'useReaderNavigation'))
  assert.equal(imported?.source.value, './composables/useReaderNavigation.js')
  const unexpected = name => () => { throw new Error(`Unexpected Reader fixture boundary: ${name}`) }
  const defaults = {
    ...useArchiveNavigationState(), loading: ref(false), loadingPurpose: ref('archive-data'), playbackError: ref(''),
    navigation: createArchiveNavigationCoordinator(), archiveBootstrap: { release: '0'.repeat(64), idols: [], domains: {} },
    readModelClient: { load: unexpected('readModelClient.load'), invalidate: unexpected('readModelClient.invalidate') },
    playbackController: { reset: unexpected('playbackController.reset'), load: unexpected('playbackController.load') },
  }
  for (const name of ['collectionReadModelDetail', 'storyReadModelDetail', 'eventReadModelDetail', 'workReadModelDetail',
    'idolStoryReadModelDetail', 'currentStoryCollection', 'currentStory', 'currentEventProjection', 'currentWorkIdol', 'currentIdolStoryPage']) defaults[name] = ref(null)
  for (const name of ['applyArchiveRoute', 'syncArchiveRoute', 'restoreDetailSource', 'openStoryCatalog', 'loadCollectionDetail', 'loadPlayerQueue']) defaults[name] = unexpected(name)
  Object.assign(context, { ...defaults, ...context, useReaderNavigation })
  for (const property of binding.init.arguments[0].properties) {
    if (property.value.type !== 'Identifier') continue
    const name = property.value.name, value = context[name]
    if (value && typeof value === 'object' && 'value' in value && !isRef(value)) context[name] = ref(value.value)
  }
  const scope = effectScope()
  let handlers
  try { handlers = scope.run(() => vm.runInNewContext(script.slice(binding.init.start, binding.init.end), context)) }
  catch (error) { scope.stop(); throw error }
  const exposed = {}
  for (const property of binding.id.properties) {
    assert.ok(property.key.name in handlers, `App exports ${property.key.name}`)
    exposed[property.value.name] = handlers[property.key.name]
  }
  Object.assign(context, exposed)
  return { ...exposed, stop: () => scope.stop() }
}

// Control only transport bytes/locator responses. The production repository,
// digest validation, sessions, caches and navigation remain in use.
export function createReaderFixtureTransport() {
  const records = new Map(), locators = new Map(), requests = []
  const register = (document, template = {}) => {
    const bytes = JSON.stringify(document)
    const entry = { ...template, document_id: document.document_id, file: `${document.document_id}.json`,
      schema_version: 2, sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      source_sha256: document.source.sha256, source_file: document.source.file,
      status: document.status, row_count: document.rows.length, logical_id: document.logical_id, scenario_id: document.scenario_id }
    validateReadingManifest({ schema_version: 1, entries: [entry] })
    validateReadingDocument(document, entry)
    records.set(entry.document_id, { entry, bytes })
    return entry
  }
  const readModelClient = { invalidate() {}, async load(descriptor, options = {}) {
    assert.equal(descriptor.kind, 'reading-docs.detail')
    requests.push({ kind: 'locator', id: descriptor.expectedId })
    const entry = records.get(descriptor.expectedId)?.entry
    const entries = locators.get(descriptor.expectedId) || (entry ? [...records.values()].map(row => row.entry).filter(row => row.logical_id === entry.logical_id) : [])
    const data = structuredClone({ view: { entry: entry || null, entries } })
    if (entry) options.validate?.(data)
    else { const error = Error('Reading fixture is absent'); error.code = 'RELEASE_OR_ARTIFACT_MISSING'; throw error }
    return data
  } }
  const fetch = async url => {
    const parsed = new URL(url, 'https://fixture.invalid')
    requests.push({ kind: 'body', path: parsed.pathname })
    if (parsed.pathname === '/data/reading/manifest.json') return new Response(JSON.stringify({ schema_version: 1, entries: [...records.values()].map(row => row.entry) }))
    const record = records.get(parsed.pathname.match(/^\/data\/reading\/([^/]+)\.json$/)?.[1])
    assert.ok(record, `Unexpected Reader byte request: ${url}`)
    assert.equal(parsed.searchParams.get('rev'), record.entry.sha256.slice(7))
    return new Response(record.bytes)
  }
  return { records, locators, requests, register, readModelClient, fetch,
    install() { const original = globalThis.fetch; globalThis.fetch = fetch; return () => { globalThis.fetch = original } } }
}
