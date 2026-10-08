import assert from 'node:assert/strict'
import vm from 'node:vm'
import { effectScope, isRef, ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import { useStoryNavigation } from '../../src/composables/useStoryNavigation.js'

export function bindStoryNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parseJavascript(script, { sourceType: 'module' }).program.body
  const binding = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    .find(node => node.init?.type === 'CallExpression' && node.init.callee.name === 'useStoryNavigation')
  assert.ok(binding, 'App binds the real story navigation factory')
  const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(specifier => specifier.local.name === 'useStoryNavigation'))
  assert.equal(imported?.source.value, './composables/useStoryNavigation.js')
  const unexpected = name => () => { throw new Error(`Unexpected story fixture boundary: ${name}`) }
  const defaults = { ...useArchiveNavigationState(), loading: ref(false), storyVisibleLimit: ref(80), currentStory: ref(null),
    collectionReadModelCatalog: ref(null), collectionReadModelDetail: ref(null), collectionReadModelStatus: ref(''),
    storyReadModelCatalog: ref(null), storyReadModelDetail: ref(null), storyReadModelStatus: ref(''), storyCatalogIndex: ref(null), storyCatalogLanding: ref(null),
    archiveBootstrap: { idols: [], domains: {}, counts: { catalog_story_entries: 0 } }, navigation: createArchiveNavigationCoordinator(),
    readModelClient: { load: unexpected('readModelClient.load') },
  }
  for (const name of ['prepareArchivePage', 'captureDetailSource', 'commitView', 'commitArchiveSelection', 'goHome', 'openEventDetail',
    'openIdolStoryArchive', 'openStoryPhone', 'openStoryReader', 'loadScenario', 'startEpisodeQueue']) defaults[name] = unexpected(name)
  Object.assign(context, { ...defaults, ...context, useStoryNavigation })
  for (const property of binding.init.arguments[0].properties) {
    const name = property.value.name, value = context[name]
    if (value && typeof value === 'object' && 'value' in value && !isRef(value)) context[name] = ref(value.value)
  }
  const scope = effectScope()
  let handlers
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

// Shared landing acceptance exercises production navigation, not source spelling.
export async function verifyStoryLandingNavigation(app, domain, projected) {
  const section = ({ main: '101', extra: '601', birthday: '001tom' })[domain]
  const landings = { main: { collections: [] }, extra: { collections: [] }, birthday: { collections: [] }, [domain]: projected }
  let homeCalls = 0
  const context = {
    archiveBootstrap: { domains: { stories: 'story-index' }, counts: { catalog_story_entries: 0 } },
    collectionReadModelCatalog: ref([{ id: `${domain}:${section}`, domain, sectionId: section, title: domain, detail: { url: 'collection-detail' } }]),
    readModelClient: { load: async (descriptor, options = {}) => {
      if (descriptor === 'story-index') return { count: 0, pages: [], landing: { main: 'main', extra: 'extra', birthday: 'birthday' } }
      if (Object.hasOwn(landings, descriptor)) return { value: landings[descriptor] }
      assert.equal(descriptor.url, 'collection-detail')
      const detail = { view: { collection: { domain, sectionId: section, chapters: [] }, readingEntries: [] } }
      options.validate(detail)
      return detail
    } },
    prepareArchivePage: (_view, pending) => pending,
    captureDetailSource: () => {}, goHome: () => { homeCalls++ },
    commitView: view => { context.navigation.invalidate(); context.view.value = view },
  }
  const bound = bindStoryNavigation(app, context)
  try {
    const landing = await bound.loadStoryReadModelLanding()
    assert.deepEqual(landing[domain], projected, `${domain} reads its bounded landing projection`)
    context.currentStoryDomain.value = domain; context.currentStoryMode.value = 'portal'
    bound.goBackFromStoryCatalog()
    assert.equal(context.currentStoryDomain.value, '')
    assert.equal(context.view.value, 'story_catalog')
    assert.equal(homeCalls, 0, 'domain Back stays inside the story catalog')
    await bound.browseStoryCollection({ domain, section })
    assert.equal(context.view.value, 'story_collection')
    assert.equal(context.currentStorySection.value, section)
    await bound.goBackFromStoryCollection()
    assert.equal(context.view.value, 'story_catalog')
    assert.equal(context.currentStoryMode.value, 'portal')
    assert.equal(context.currentStoryDomain.value, domain, 'collection Back returns to its formal domain landing')
    context.storyCollectionParentView.value = 'external_story_resources'
    await bound.goBackFromStoryCollection()
    assert.equal(context.view.value, 'external_story_resources')
    assert.equal(context.currentStoryDomain.value, '')
    bound.browseStoryCollection({ domain, mode: 'portal' })
    assert.equal(context.view.value, 'story_catalog')
    assert.equal(context.currentStoryDomain.value, domain)
  } finally { bound.stop() }
}
