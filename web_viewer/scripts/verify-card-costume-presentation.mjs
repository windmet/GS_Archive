import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { buildCardMap, mergeCardDetail } from '../src/data/archiveSelectors.js'
import { stripEvidence } from '../readmodels/lib/common.mjs'
import * as semantics from '../src/presentation/CardDetailSemantics.js'
import { reflowArchiveText } from '../src/presentation/ArchiveText.js'
import { presentProducerAddressingText } from '../src/presentation/ProducerAddressingText.js'
import { presentCardSkillDescription } from '../src/presentation/CardSkillDescriptionPresenter.js'
import { cardScenarioTitle } from '../src/presentation/CardPresentation.js'
import { cardVoicePreviewStep } from '../src/data/cardVoicePreview.js'
import * as cardAssets from '../src/utils/CardAssetResolver.js'
import { getVoiceUrl } from '../src/utils/AssetResolver.js'
import { archiveText } from '../src/components/archive/useArchiveCardText.js'
import { gashaText } from '../src/components/archive/useArchiveGashaText.js'
import { uiLocale } from '../src/localization/ui/UiLocaleStore.js'

// Real card/translation projections and compiled SFC, with a memory host.
// CSS visibility, image/media decoding and Browser layout are separate QA.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const json = path => JSON.parse(read(path))
const detailIndex = json('public/data/masterdata/card_detail_index.json')
const cardMap = buildCardMap(json('public/data/masterdata/card_index.json'))
const card = code => mergeCardDetail(cardMap.get(code), detailIndex)
// The real cards.detail generator (readmodels/lib/projections.mjs) applies
// this exact recursive projection to the checkout adapter's merged card.
const compactCard = code => stripEvidence(card(code))
const { presentCardCostumeRelations, presentCardCostumeGroups, reflowCardCostumeFlavor } = semantics
const describe = costume => archiveText('costume', costume.description, 'description')
const groupsFor = relations => presentCardCostumeGroups(relations, describe)
const clone = value => JSON.parse(JSON.stringify(value))

for (const locale of ['zh-CN', 'ja-JP']) {
  uiLocale.value = locale
  for (const project of [card, compactCard]) {
  for (const code of ['040ren_sr06', '001tom_ssr01', '029ass_ssr01', '040ren_ssr01', '040ren_ssr03']) {
    const input = project(code).costume_relations
    const original = JSON.stringify(input)
    const shown = presentCardCostumeRelations(input)
    const groups = groupsFor(input)
    assert.equal(shown.length, 2)
    assert.equal(groups.length, 1, `${code}/${locale} has one shared flavor`)
    assert.equal(groups[0].costumes.length, 2, 'both model variants remain separate entries')
    assert.equal(groups[0].name, shown[0].name, 'the ordinary costume identifies the group')
    assert.equal(groups[0].sourceDescription, shown[0].description, 'canonical flavor identity is retained')
    assert.equal(groups[0].description, describe(shown[0]), 'the production current-language overlay is used')
    assert.deepEqual(groups[0].costumes, shown, 'complete source names, model IDs and Live/Story labels survive')
    assert.equal(JSON.stringify(input), original, 'presentation never rewrites source text or relationships')
  }
  }
}
assert.equal(groupsFor(card('001tom_r01').costume_relations).length, 0, 'home-only relations stay hidden')
assert.equal(groupsFor(card('001tom_r03').costume_relations).length, 1, 'one-model card remains one model')

// Explicitly labeled mutations of a real relation fixture exercise exclusions.
// No different-flavor source claim is made from these synthetic omissions.
const originalRelations = card('040ren_sr06').costume_relations
const altered = change => clone(originalRelations).map(change)
const enhanced = relation => relation.model_resource_id === '040ren_101_01'
const independent = (relations, why, descriptionFor = describe) => {
  const groups = presentCardCostumeGroups(relations, descriptionFor)
  assert.equal(groups.length, 2, why)
  assert.ok(groups.every(group => group.costumes.length === 1), why)
}
independent(altered(r => enhanced(r) ? { ...r, description: null } : r), 'missing source flavor cannot merge')
independent(altered(r => enhanced(r) ? { ...r, description: `${r.description}別の説明。` } : r),
  'different source flavor cannot merge')
independent(altered(r => enhanced(r) ? { ...r, description: `${r.description} ` } : r),
  'even source whitespace is retained rather than normalized for grouping')
independent(originalRelations, 'different current-language flavor cannot merge',
  r => enhanced(r) ? `${describe(r)} distinct overlay` : describe(r))
independent(originalRelations, 'an empty current-language flavor cannot merge', () => '')
independent(stripEvidence(originalRelations).map(r => r.slot.startsWith('home_') ? r : { ...r, slot: 'story_initial' }),
  'public model suffix/name match without an explicit ordinary/breakthrough pair is insufficient')
independent(altered(r => enhanced(r) ? stripEvidence(r) : r),
  'a partially sourced pair cannot masquerade as a complete public projection')
independent(altered(r => enhanced(r) ? { ...r, _source: null } : r),
  'an explicitly malformed source cannot masquerade as an omitted technical field')
independent(altered(r => enhanced(r) ? { ...r, _source: { ...r._source, offset: r._source.offset + 1 } } : r),
  'variant slots from different CardData rows cannot merge')
independent(altered(r => ({ ...r, _source: { ...r._source, fields: { costume_id: 51 } } })),
  'unrelated source field numbers cannot establish an ordinary/breakthrough pair')
independent(altered(r => enhanced(r) ? { ...r, model_resource_id: '040ren_102_01' } : r),
  'different design stems cannot merge even when descriptions match')
independent(altered(r => enhanced(r) ? { ...r, name: '別の衣装+' } : r), 'different source design names cannot merge')
independent(altered(r => enhanced(r) ? { ...r, name: null } : r), 'missing design names cannot merge')
const reversed = groupsFor([...originalRelations].reverse())
assert.equal(reversed.length, 1)
assert.equal(reversed[0].name, 'ワイルドウィナーズ', 'group title is ordinary even when enhanced appears first')
for (const slot of ['live', 'story']) {
  const pair = stripEvidence(originalRelations).filter(r => r.slot.startsWith(`${slot}_`))
  assert.equal(groupsFor(pair).length, 1, `the complete public ${slot} pair is sufficient without technical fields`)
}

for (const locale of ['zh-CN', 'ja-JP']) {
  uiLocale.value = locale
  const flavor = describe(presentCardCostumeRelations(card('040ren_ssr03').costume_relations)[0])
  const lines = flavor.replace(/\r\n?/g, '\n').split('\n')
  const reflowed = reflowCardCostumeFlavor(flavor)
  assert.equal(reflowed, `${lines[0]}\n${reflowArchiveText(lines.slice(1).join('\n'))}`,
    'actual setting title remains separate while the following prose flows naturally')
  assert.equal(lines[0], locale === 'zh-CN' ? '金牛座：土元素' : 'おうし座：地のエレメント')
  for (const model of ['047shu_104_00', '048mom_104_00', '049eis_105_00', '034kan_104_00']) {
    const entry = Object.values(detailIndex.costumes_by_key).find(r => r.model_resource_id === model)
    const translated = describe(entry).replace(/\r\n?/g, '\n')
    const quoted = translated.match(/(?:^|\n)(「[^」]+」|『[^』]+』|“[^”]+”)(?=\n|$)/u)?.[1]
    assert.ok(quoted, `${model}/${locale} has an actual standalone quoted paragraph`)
    assert.ok(reflowCardCostumeFlavor(translated).split('\n\n').includes(reflowArchiveText(quoted)),
      'a complete quoted paragraph remains separate while its internal game-width breaks flow')
  }
  const wordQuote = Object.values(detailIndex.costumes_by_key).find(r => r.model_resource_id === '040ren_107_00')
  assert.equal(reflowCardCostumeFlavor(describe(wordQuote)), reflowArchiveText(describe(wordQuote)),
    'a quotation around one word does not split a narrative paragraph')
}
assert.equal(reflowCardCostumeFlavor('普通的完整一句。\n后续说明。'), '普通的完整一句。后续说明。',
  'sentence-final punctuation does not turn ordinary lines into headings')
assert.equal(reflowCardCostumeFlavor('あの人の歩み、\n積み重ねてきた努力。'), 'あの人の歩み、積み重ねてきた努力。')
assert.equal(reflowCardCostumeFlavor('第一段的\n纯排版换行。\n\n第二段。'), '第一段的纯排版换行。\n\n第二段。')
assert.equal(reflowCardCostumeFlavor('stage\nshow'), 'stage show', 'Latin word boundaries retain a space')
assert.equal(reflowCardCostumeFlavor(null), '')

const node = (type, value = '') => {
  const item = { type, text: value, props: {}, children: [], parent: null, events: {}, selectedIndex: -1 }
  // Existing skill-level v-model needs a minimal select host to mount. These
  // accessors do not claim native selection or add tests of unrelated controls.
  item.addEventListener = (name, listener) => { item.events[name] = listener }
  item.removeEventListener = name => { delete item.events[name] }
  Object.defineProperty(item, 'options', { get: () => item.children.filter(child => child.type === 'option') })
  return item
}
const remove = item => {
  if (item.parent) item.parent.children.splice(item.parent.children.indexOf(item), 1)
  item.parent = null
}
const all = root => [root, ...root.children.flatMap(all)]
const text = root => root.text + root.children.map(text).join('')
const hasClass = (item, name) => String(item.props.class || '').split(/\s+/).includes(name)
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: value => node('#text', value), createComment: value => node('#comment', value),
  setText: (item, value) => { item.text = value },
  setElementText: (item, value) => { item.text = value; item.children = [] },
  patchProp: (item, key, _previous, value) => {
    item.props[key] = value
    if (key === 'value' || key === 'multiple') item[key] = value
  },
  insert(item, parent, anchor = null) {
    remove(item)
    const position = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(position < 0 ? parent.children.length : position, 0, item)
    item.parent = parent
  },
  remove, parentNode: item => item.parent,
  nextSibling: item => item.parent?.children[item.parent.children.indexOf(item) + 1] || null,
})
const emptyComponent = { render: () => null }
const imports = {
  vue: Vue,
  '@lucide/vue': Object.fromEntries(['Activity', 'CheckCircle2', 'ChevronLeft', 'ChevronRight', 'CircleSlash',
    'Expand', 'HeartPulse', 'ImageOff', 'PackageOpen', 'Shirt'].map(name => [name, emptyComponent])),
  '../../presentation/ArchiveText.js': { reflowArchiveText },
  '../../presentation/ProducerAddressingText.js': { presentProducerAddressingText },
  '../../presentation/CardSkillDescriptionPresenter.js': { presentCardSkillDescription },
  '../../presentation/CardDetailSemantics.js': semantics,
  '../../presentation/CardPresentation.js': { cardScenarioTitle },
  '../../data/cardVoicePreview.js': { cardVoicePreviewStep },
  '../../utils/AssetResolver.js': { getVoiceUrl },
  '../../utils/CardAssetResolver.js': cardAssets,
  './useArchiveCardText.js': { archiveText }, './useArchiveGashaText.js': { gashaText },
  ...Object.fromEntries(['ArchiveVoiceRow', 'ArchiveImageLightbox', 'ArchiveListHeader', 'ArchiveIdolReference',
    'ArchiveTechnicalDetails', 'ArchiveRelationList'].map(name => [`./${name}.vue`, { default: emptyComponent }])),
}
const { descriptor } = parse(read('src/components/archive/ArchiveCardDetail.vue'))
const source = compileScript(descriptor, { id: 'card-costume-contract', inlineTemplate: true }).content
const context = vm.createContext({ console, Intl })
const module = new vm.SourceTextModule(source, { context })
await module.link(specifier => {
  assert.ok(Object.hasOwn(imports, specifier), `unexpected production dependency: ${specifier}`)
  const exports = imports[specifier]
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value)
  }, { context })
})
await module.evaluate()
const Detail = module.namespace.default
const root = node('root')
const state = Vue.shallowReactive({ card: card('040ren_sr06') })
const app = renderer.createApp({ render: () => Vue.h(Detail, { ...state, embedded: true }) })
app.config.warnHandler = message => assert.fail(message)
app.mount(root)
const flush = async () => { await Vue.nextTick(); await Vue.nextTick() }
const costumeSection = () => all(root).find(item => item.type === 'section' &&
  item.children.some(child => child.type === 'h4' && text(child) === '关联衣装'))
for (const locale of ['zh-CN', 'ja-JP']) {
  uiLocale.value = locale
  for (const project of [card, compactCard]) {
  for (const code of ['040ren_sr06', '001tom_ssr01', '029ass_ssr01', '040ren_ssr01', '040ren_ssr03', '001tom_r03']) {
    state.card = project(code)
    const before = JSON.stringify(state.card)
    await flush()
    const section = costumeSection()
    assert.ok(section)
    const expected = groupsFor(state.card.costume_relations)
    const rendered = all(section).filter(item => hasClass(item, 'costume-group'))
    assert.equal(rendered.length, expected.length)
    for (let i = 0; i < rendered.length; i++) {
      const group = rendered[i]
      const title = all(group).find(item => hasClass(item, 'costume-group-title'))
      const flavor = all(group).filter(item => item.type === 'blockquote')
      assert.equal(text(title), archiveText('costume', expected[i].name))
      assert.equal(title.props.title, expected[i].name, 'unabridged original name remains available')
      assert.equal(flavor.length, 1, 'one shared flavor block is rendered')
      assert.equal(text(all(flavor[0]).find(item => hasClass(item, 'authored-text'))), expected[i].description,
        'desktop text retains exact current-language authored line breaks')
      assert.equal(text(all(flavor[0]).find(item => hasClass(item, 'reflowed-text'))),
        reflowCardCostumeFlavor(expected[i].description), 'mobile text uses the structured local reflow')
      const rows = all(group).filter(item => hasClass(item, 'costume-row'))
      assert.equal(rows.length, expected[i].costumes.length)
      rows.forEach((row, index) => {
        const item = expected[i].costumes[index]
        const name = all(row).find(node => node.type === 'strong')
        assert.equal(text(name), expected[i].costumes.length > 1
          ? (item.model_resource_id.endsWith('_01') ? '突破版（+）' : '通常版') : '用途')
        assert.equal(row.props.title, item.name, 'full source name remains available without repeating it visually')
        assert.equal(row.props['aria-label'], archiveText('costume', item.name), 'each variant retains its accessible full name')
        assert.deepEqual(all(row).filter(node => hasClass(node, 'costume-condition')).map(text), item.labels,
          'individual usage/state badges retain all actual source labels')
      })
      assert.equal(all(group).filter(item => ['button', 'select', 'input'].includes(item.type)).length, 0,
        'static presentation adds no variant toggle or invented unlock action')
    }
    assert.equal(JSON.stringify(state.card), before, 'the real SFC does not mutate card data')
  }
  }
}
state.card = compactCard('040ren_ssr03'); await flush()
const publishedIdentity = state.card
for (const locale of ['zh-CN', 'ja-JP', 'zh-CN']) {
  uiLocale.value = locale; await flush()
  assert.equal(state.card, publishedIdentity, 'language-only changes retain the published card identity')
  const section = costumeSection()
  assert.equal(all(section).filter(item => hasClass(item, 'costume-group')).length, 1)
  const title = all(section).find(item => hasClass(item, 'costume-group-title'))
  assert.equal(text(title), locale === 'zh-CN' ? '皇室崇高' : 'インペリアルサブライム')
  const flavor = all(section).find(item => hasClass(item, 'authored-text'))
  assert.ok(text(flavor).startsWith(locale === 'zh-CN' ? '金牛座：土元素\n' : 'おうし座：地のエレメント\r\n'))
}
state.card = { ...card('040ren_sr06'), costume_relations: altered(r => enhanced(r) ? { ...r, description: null } : r) }
await flush()
assert.equal(all(costumeSection()).filter(item => hasClass(item, 'costume-group')).length, 2)
assert.equal(all(costumeSection()).filter(item => hasClass(item, 'costume-row')).length, 2)
assert.equal(all(costumeSection()).filter(item => item.type === 'blockquote').length, 1,
  'missing-flavor variant keeps its own name and labels without a fabricated flavor')
state.card = card('001tom_r01'); await flush()
assert.equal(costumeSection(), undefined, 'home-only card has no costume section')
app.unmount()
uiLocale.value = 'zh-CN'
console.log('Card costume presentation: five real SR/SSR ordinary/enhanced pairs in canonical and actual stripEvidence public projections, with production Chinese/Japanese overlays; exact source/current-language identity, model/name/slot preservation, original headings and independent quoted paragraphs passed. Labeled missing/different text, absent explicit pairs and partial/malformed source exclusions passed. Real SFC static group/title/flavor/variant structure, same-public-card Chinese/Japanese/Chinese switching, no new actions, unmodified desktop flavor and local mobile reflow passed in a memory renderer. Browser wrapping/visibility and decoded media remain separate.')
