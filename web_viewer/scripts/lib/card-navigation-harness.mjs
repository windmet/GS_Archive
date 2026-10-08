import assert from 'node:assert/strict'
import vm from 'node:vm'
import { ref, computed, isRef } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse } from '@babel/parser'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import { cardAttribute } from '../../src/presentation/CatalogIdolScope.js'
import { buildCardRarityTabs, filterArchiveCards } from '../../src/data/cardFilters.js'

// Before extraction, execute the actual App declarations together, preserving closures.
// Only transport and cross-domain callbacks are fixtures; no internal loader is replaced.
export const cardFunctions = ['loadCardFacets', 'loadCardCatalog', 'loadCardDetail',
  'openUnitCards', 'openPrimaryCards', 'openCard', 'selectCardIdol', 'goBackToCards',
  'openCardIdol', 'openRelatedCard', 'openCollectionCard', 'goBackFromCards',
  'openCardScenario', 'openCardEvent', 'openCardGasha']
export const cardComputeds = ['currentCards', 'cardRarityTabs', 'filteredCards', 'filteredCardRows',
  'currentCard', 'currentCardOwnerReference', 'currentCardAssetStatus', 'currentCardEventRelation',
  'currentCardGashaRelation', 'currentCardLimitbreakMaterial', 'currentCardIndex', 'previousCard',
  'nextCard', 'currentSeriesCards', 'currentCardCharacterName']

export function bindCardNavigation(app, context = {}) {
  const script = parseSfc(app).descriptor.scriptSetup.content
  const body = parse(script, { sourceType: 'module' }).program.body
  const names = [...cardFunctions, ...cardComputeds, 'pendingCardNavigation', 'cardFacetsPromise']
  const selected = names.map(name => {
    const fn = body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name)
    if (fn) return { start: fn.start, source: script.slice(fn.start, fn.end) }
    const declaration = body.find(node => node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.name === name))
    assert.ok(declaration, `App declares ${name}`)
    assert.equal(declaration.declarations.length, 1, `do not silently capture unrelated bindings with ${name}`)
    return { start: declaration.start, source: script.slice(declaration.start, declaration.end) }
  }).sort((a, b) => a.start - b.start)
  const unexpected = name => () => { throw new Error(`Unexpected Card fixture boundary: ${name}`) }
  const defaults = {
    ...useArchiveNavigationState(), navigation: createArchiveNavigationCoordinator(),
    loading: ref(false), cardReadModelCatalog: ref(null), cardReadModelDetail: ref(null),
    cardReadModelStatus: ref(''), unitReadModelStatus: ref(''), currentArchiveUnit: ref(null),
    computed, cardAttribute, buildCardRarityTabs, filterArchiveCards,
    idolDisplayName: id => `display:${id}`, idolSourceName: id => `source:${id}`,
    archiveNamedSearchText: (_kind, source) => source,
  }
  for (const name of ['fetch', 'prepareArchivePage', 'captureDetailSource', 'commitView',
    'commitArchiveSelection', 'restoreDetailSource', 'openIdolReadModel', 'loadScenario', 'openEventDetail', 'openGasha'])
    defaults[name] = unexpected(name)
  Object.assign(context, { ...defaults, ...context })
  for (const [name, value] of Object.entries(context)) {
    if (value && typeof value === 'object' && 'value' in value && !isRef(value)) context[name] = ref(value.value)
  }
  const exposed = vm.runInNewContext(`(() => {\n${selected.map(item => item.source).join('\n')}\nreturn { ${[...cardFunctions, ...cardComputeds].join(', ')} };\n})()`, context)
  Object.assign(context, exposed)
  return exposed
}

export function deferredCard() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

export function createCardFixtureTransport() {
  const rows = ['first', 'second', 'third'].map((id, index) => ({ id, resource_id: id,
    character_id: index === 2 ? '002sht' : '001tom', rarity: index === 1 ? 'SR' : 'SSR',
    title: `title-${id}`, attribute: ['Physical', 'Mental', 'Intelligence'][index],
    ownerReference: { actionable: true, idolCode: index === 2 ? '002sht' : '001tom', displayName: 'raw' },
    home_voice_count: 1, scenario_count: 1,
    detail: { url: `card:${id}`, sha256: `sha-${id}` }, release_series_id: 'series',
    has_story: index !== 1, asset_status: { normal_icon: true },
  }))
  const details = rows.map(row => ({ id: row.id, ownerReference: structuredClone(row.ownerReference),
    card: { ...structuredClone(row), home_voice_cues: [{ key: 'cue' }], scenario_entries: [{ compiled_file: 'chapter.json' }], release_series: { series_id: 'series' } },
    assetStatus: { normal_icon: true }, eventRelation: { event_id: 'event' },
    gashaRelation: { announcement_id: 'gasha' }, limitbreakMaterial: { name: 'material' },
  }))
  const data = new Map([['card-index', { count: rows.length, pages: [{ url: 'card-page-1' }, { url: 'card-page-2' }] }],
    ['card-page-1', { rows: rows.slice(0, 2) }], ['card-page-2', { rows: rows.slice(2) }],
    ...details.map(detail => [`card:${detail.id}`, detail])])
  const jobs = new Map(), loads = []
  const client = { async load(descriptor, options = {}) {
    loads.push({ descriptor, options })
    assert.ok(data.has(descriptor.url), `Unexpected Card descriptor: ${descriptor.url}`)
    const value = jobs.has(descriptor.url) ? await jobs.get(descriptor.url).promise : structuredClone(data.get(descriptor.url))
    if (descriptor.url.startsWith('card:')) {
      const id = descriptor.url.slice(5)
      assert.equal(descriptor.expectedId, id); assert.equal(options.expectedId, id)
      assert.equal(value.id, id, 'fixture enforces client envelope identity')
    }
    options.validate?.(value)
    return value
  } }
  return { data, jobs, loads, client, bootstrap: {
    release: 'fixture-release', counts: { canonical_cards: 3 }, domains: { cards: { url: 'card-index' } },
    idols: [{ id: '001tom' }, { id: '002sht' }],
  } }
}
