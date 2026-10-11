import assert from 'node:assert/strict'
import vm from 'node:vm'
import { effectScope, isRef, ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import { useSongNavigation } from '../../src/composables/useSongNavigation.js'

// The fixture supplies state and transport boundaries; App's actual initializer
// selects dependencies and the imported production module owns every decision.
export function bindSongNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parseJavascript(script, { sourceType: 'module' }).program.body
  const binding = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    .find(node => node.init?.type === 'CallExpression' && node.init.callee.name === 'useSongNavigation')
  assert.ok(binding, 'App binds the real song navigation factory')
  const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(specifier => specifier.local.name === 'useSongNavigation'))
  assert.equal(imported?.source.value, './composables/useSongNavigation.js')
  const unexpected = name => () => { throw new Error(`Unexpected song fixture boundary: ${name}`) }
  const defaults = { ...useArchiveNavigationState(),
    songReadModelCatalog: ref(null), songReadModelDetail: ref(null), songReadModelStatus: ref(''), currentArchiveUnit: ref(null),
    archiveBootstrap: { idols: [], domains: {} }, navigation: createArchiveNavigationCoordinator(),
    readModelClient: { load: unexpected('readModelClient.load') },
  }
  for (const name of ['captureDetailSource', 'commitView', 'restoreDetailSource', 'goHome', 'openArchiveUnit', 'openPrimaryIdol', 'openProjectedCollection']) defaults[name] = unexpected(name)
  Object.assign(context, { ...defaults, ...context, useSongNavigation })
  for (const name of ['view', 'currentSongId', 'currentSongScope', 'songParentView', 'currentCharacterId', 'currentCategoryId', 'filterQuery',
    'detailSourceRoute', 'songReadModelCatalog', 'songReadModelDetail', 'songReadModelStatus', 'currentArchiveUnit']) {
    if (!isRef(context[name])) context[name] = ref(context[name]?.value)
  }
  const scope = effectScope()
  let handlers
  try { handlers = scope.run(() => vm.runInNewContext(script.slice(binding.init.start, binding.init.end), context)) }
  catch (error) { scope.stop(); throw error }
  for (const property of binding.id.properties) assert.ok(property.key.name in handlers, `App exports ${property.key.name}`)
  Object.assign(context, handlers)
  return { ...handlers, stop: () => scope.stop() }
}
