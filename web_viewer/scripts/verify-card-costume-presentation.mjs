import assert from 'node:assert/strict'
import { eventBannerUrl } from '../src/data/eventResourceGraph.js'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as Vue from 'vue'
import { parse, compileScript } from '@vue/compiler-sfc'
import { buildCardMap, mergeCardDetail } from '../src/data/archiveSelectors.js'
import { stripEvidence } from '../readmodels/lib/common.mjs'
import { projectCardLimitbreakMaterials } from '../readmodels/lib/domain_expansion.mjs'
import * as semantics from '../src/presentation/CardDetailSemantics.js'
import { reflowArchiveText } from '../src/presentation/ArchiveText.js'
import { presentProducerAddressingText } from '../src/presentation/ProducerAddressingText.js'
import { presentCardSkillDescription } from '../src/presentation/CardSkillDescriptionPresenter.js'
import * as CardPresentation from '../src/presentation/CardPresentation.js'
const { cardScenarioTitle } = CardPresentation
import { cardVoicePreviewStep } from '../src/data/cardVoicePreview.js'
import * as cardAssets from '../src/utils/CardAssetResolver.js'
import { getVoiceUrl } from '../src/utils/AssetResolver.js'
import { archiveText } from '../src/components/archive/useArchiveCardText.js'
import { gashaText } from '../src/components/archive/useArchiveGashaText.js'
import { uiLocale } from '../src/localization/ui/UiLocaleStore.js'
import * as AttributeLabel from '../src/presentation/AttributeLabel.js'

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
const { presentCardCostumeRelations, presentCardCostumeGroups, presentCardCostumeFlavor, reflowCardCostumeFlavor } = semantics
const describe = costume => archiveText('costume', costume.description, 'description')
const groupsFor = relations => presentCardCostumeGroups(relations, describe)
const clone = value => JSON.parse(JSON.stringify(value))

// Inspect every real shown group, rather than extrapolating the Taurus sample.
const sourceHeaders = new Set()
let shownCards = 0, shownGroups = 0
for (const row of cardMap.values()) {
  const groups = presentCardCostumeGroups(card(row.resource_id).costume_relations)
  if (groups.length) shownCards++
  shownGroups += groups.length
  for (const group of groups) {
    const first = group.sourceDescription?.split(/\r\n|\r|\n/u)[0] || ''
    if (/^(?:[^\s:：]+座[:：]|クラス[:：])/u.test(first)) sourceHeaders.add(first)
    for (const locale of ['zh-CN', 'ja-JP']) {
      uiLocale.value = locale
      const description = describe(group.costumes[0])
      const flavor = presentCardCostumeFlavor(description, group.sourceDescription)
      assert.equal(flavor.heading + flavor.separator + flavor.authoredBody, description,
        `${row.resource_id}/${locale}: desktop source/overlay text retains every line and character`)
      assert.equal(flavor.reflowedBody, reflowCardCostumeFlavor(flavor.authoredBody))
      assert.equal(Boolean(flavor.heading), sourceHeaders.has(first),
        `${row.resource_id}/${locale}: only an actual setting first line has the metadata role`)
    }
  }
}
assert.equal(shownCards, 340)
assert.equal(shownGroups, 340)
assert.deepEqual([...sourceHeaders].sort(), ['おひつじ座：火のエレメント', 'おうし座：地のエレメント',
  'さそり座：水のエレメント', 'クラス：エリミネイトシューター', 'クラス：トキシックアサシン',
  'クラス：スターディーウォーリアー'].sort(), 'all six current source setting anchors are covered')

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
assert.equal(presentCardCostumeFlavor('星座：水元素\n正文。', '普通的原始首行。\n正文。').heading, '',
  'an overlay-only setting-like line cannot fabricate a source heading')
assert.equal(presentCardCostumeFlavor('金牛座：土元素\n正文。', 'さそり座：水のエレメント\n本文。').heading, '',
  'a mismatched setting overlay is not promoted to a heading')
const separated = presentCardCostumeFlavor('金牛座：土元素\n第一段。\n\n第二段。',
  'おうし座：地のエレメント\n本文。')
assert.equal(separated.authoredBody, '第一段。\n\n第二段。')
assert.equal(separated.reflowedBody, '第一段。\n\n第二段。', 'explicit blank paragraphs remain intact')
for (const locale of ['zh-CN', 'ja-JP']) {
  uiLocale.value = locale
  const source = card('044ame_ssr02').costume_relations[0].description
  const flavor = presentCardCostumeFlavor(archiveText('costume', source, 'description'), source)
  assert.equal(flavor.heading, locale === 'zh-CN' ? '天蝎座：水元素' : 'さそり座：水のエレメント')
  assert.ok(flavor.authoredBody.startsWith(locale === 'zh-CN'
    ? '洞察力出众，深藏不露。富有探求心。\n' : '洞察力に優れていて秘密主義。探求心がある。\r\n'))
  if (locale === 'zh-CN') assert.equal(flavor.reflowedBody,
    '洞察力出众，深藏不露。富有探求心。\n\n“嗨，客人。找到心仪的商品了吗？还是说，要听我讲讲旅途中收集到的有趣故事呢？”',
    'the existing Chinese complete quotation stays a separate paragraph')
  else assert.equal(flavor.reflowedBody, reflowArchiveText(flavor.authoredBody),
    'Japanese without quotation delimiters does not borrow a Chinese paragraph interpretation')
}

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
  '../../presentation/CardPresentation.js': { ...CardPresentation },
  '../../data/cardVoicePreview.js': { cardVoicePreviewStep },
  '../../utils/AssetResolver.js': { getVoiceUrl },
  '../../utils/CardAssetResolver.js': cardAssets,
  '../../data/eventResourceGraph.js': { eventBannerUrl },
  './useArchiveCardText.js': { archiveText }, './useArchiveGashaText.js': { gashaText },
  // Card lines come from the lazy card-lines overlay; this contract covers costumes, so lines stay source.
  './useArchiveNamedText.js': { archiveNamedText: (_kind, source) => source, loadArchiveNames: () => Promise.resolve(), ANY_CARD_LINE: [],
    archiveLineText: (_domain, _keys, source) => ({ text: presentProducerAddressingText(source || ''), lang: 'ja', pending: false }) },
  '../../localization/ui/UiLocaleStore.js': { uiLocale },
  '../../presentation/AttributeLabel.js': { ...AttributeLabel },
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
const openedEntities = []
const state = Vue.shallowReactive({ card: card('040ren_sr06'), limitbreakMaterial: null,
  onOpenEntity: key => openedEntities.push(key) })
const app = renderer.createApp({ render: () => Vue.h(Detail, { ...state, embedded: true }) })
app.config.warnHandler = message => assert.fail(message)
app.mount(root)
const flush = async () => { await Vue.nextTick(); await Vue.nextTick() }
const costumeSection = () => all(root).find(item => item.type === 'section' &&
  item.children.some(child => child.type === 'h4' && text(child) === '关联衣装'))
for (const locale of ['zh-CN', 'ja-JP']) {
  uiLocale.value = locale
  for (const project of [card, compactCard]) {
  for (const code of ['040ren_sr06', '001tom_ssr01', '029ass_ssr01', '040ren_ssr01', '040ren_ssr03', '044ame_ssr02', '001tom_r03']) {
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
      const structured = presentCardCostumeFlavor(expected[i].description, expected[i].sourceDescription)
      const heading = all(flavor[0]).find(item => hasClass(item, 'costume-setting-heading'))
      assert.equal(heading ? text(heading) : '', structured.heading)
      assert.equal(text(all(flavor[0]).find(item => hasClass(item, 'authored-text'))), structured.authoredBody,
        'desktop body retains exact current-language authored line breaks')
      assert.equal((heading ? text(heading) : '') + structured.separator + structured.authoredBody,
        expected[i].description, 'a metadata role never deletes the original setting or prose')
      assert.equal(text(all(flavor[0]).find(item => hasClass(item, 'reflowed-text'))),
        structured.reflowedBody, 'mobile text uses the structured local reflow')
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
  assert.equal(text(all(section).find(item => hasClass(item, 'costume-setting-heading'))),
    locale === 'zh-CN' ? '金牛座：土元素' : 'おうし座：地のエレメント')
  const flavor = all(section).find(item => hasClass(item, 'authored-text'))
  assert.ok(text(flavor).startsWith(locale === 'zh-CN' ? '追求稳定，感受性丰富且我行我素。\n' : '安定志向で、感受性が豊かなマイペース。\r\n'))
}
state.card = { ...card('040ren_sr06'), costume_relations: altered(r => enhanced(r) ? { ...r, description: null } : r) }
await flush()
assert.equal(all(costumeSection()).filter(item => hasClass(item, 'costume-group')).length, 2)
assert.equal(all(costumeSection()).filter(item => hasClass(item, 'costume-row')).length, 2)
assert.equal(all(costumeSection()).filter(item => item.type === 'blockquote').length, 1,
  'missing-flavor variant keeps its own name and labels without a fabricated flavor')
state.card = card('001tom_r01'); await flush()
assert.equal(costumeSection(), undefined, 'home-only card has no costume section')

// The material fixture comes from the real producer and real typed media map.
// No asset filename or quantity is inferred by this UI contract.
const allCards = [...cardMap.keys()].map(card)
const itemCatalog = json('public/data/masterdata/domains/item_catalog.json').entries
const collectionMedia = json('public/data/masterdata/domains/collection_media.json').entries
const { materialContexts } = projectCardLimitbreakMaterials(allCards, itemCatalog, collectionMedia)
const materialRow = () => all(root).find(item => hasClass(item, 'limitbreak-item-row'))
const materialButton = () => all(root).find(item => hasClass(item, 'limitbreak-item-open'))
const materialImage = () => materialRow() && all(materialRow()).find(item => item.type === 'img')
for (const id of [10501, 10502, 10503, 10504, 10505]) {
  const real = allCards.find(row => materialContexts[row.resource_id]?.id === id)
  assert.ok(real, `actual card/item:${id} sample exists`)
  state.card = compactCard(real.resource_id)
  state.limitbreakMaterial = materialContexts[real.resource_id]
  const original = JSON.stringify({ card: state.card, material: state.limitbreakMaterial })
  for (const locale of ['zh-CN', 'ja-JP']) {
    uiLocale.value = locale; await flush()
    const button = materialButton(), row = materialRow(), image = materialImage()
    assert.ok(button)
    assert.equal(text(all(button).find(item => item.type === 'strong')),
      archiveText('item', state.limitbreakMaterial.nameJa))
    assert.equal(image.props.src, collectionMedia[`item:${id}`].image.url,
      'the image uses the production typed collection binding')
    assert.equal(button.props['data-archive-focus-id'], `card-material:${real.resource_id}:item:${id}`)
    assert.equal(all(button).filter(item => ['button', 'a', 'select', 'input'].includes(item.type)).length, 1,
      'the material button contains no nested retry or link control')
    button.props.onClick(); assert.equal(openedEntities.at(-1), `item:${id}`)
    assert.equal(all(row).filter(item => item.type === 'p').map(text).join(''),
      archiveText('item', state.limitbreakMaterial.description, 'description'))
  }
  assert.equal(JSON.stringify({ card: state.card, material: state.limitbreakMaterial }), original)
}
const festival = materialContexts['040ren_ssr03']
state.card = compactCard('040ren_ssr03'); state.limitbreakMaterial = festival; await flush()
const sameButton = materialButton(), failedUrl = materialImage().props.src
materialImage().props.onError({ target: { getAttribute: () => failedUrl } }); await flush()
assert.equal(materialImage(), undefined, 'an actual image failure shows the existing generic fallback')
assert.equal(materialButton(), sameButton, 'image failure retains the text navigation control')
sameButton.props.onClick(); assert.equal(openedEntities.at(-1), festival.key)
state.limitbreakMaterial = { ...festival, image: null }; await flush()
assert.ok(materialButton(), 'a resolved entity without an image remains actionable')
assert.equal(materialImage(), undefined)
for (const invalid of [null, { ...festival, key: 'honor:10505', kind: 'honor' },
  { ...festival, referenceStatus: 'unresolved' }, { ...festival, id: 10504, key: 'item:10504' },
  { ...festival, nameJa: 10505 }]) {
  state.limitbreakMaterial = invalid; await flush()
  assert.equal(materialButton(), undefined, 'an absent, malformed or stale typed context adds no navigation')
  assert.equal(text(all(materialRow()).find(item => item.type === 'strong')),
    archiveText('item', state.card.limitbreak_item.name), 'the original dictionary name stays as fallback')
}
const ordinary = allCards.find(row => materialContexts[row.resource_id]?.id === 10504)
state.card = compactCard(ordinary.resource_id)
state.limitbreakMaterial = materialContexts[ordinary.resource_id]; await flush()
assert.ok(materialImage(), 'a new card/binding resets an earlier failed image')
materialImage().props.onError({ target: { getAttribute: () => failedUrl } }); await flush()
assert.ok(materialImage(), 'a late error from a different image cannot hide the current material')
const emptyMaterials = allCards.filter(row => row.limitbreak_item_id == null)
assert.equal(emptyMaterials.length, 169)
for (const real of emptyMaterials) {
  state.card = compactCard(real.resource_id); state.limitbreakMaterial = festival; await flush()
  assert.equal(materialRow(), undefined, 'an empty source FK never guesses an item from a stale context')
}

// Card/home/operation voice text keeps the existing viewport reflow contract.
// This batch changes neither the generic algorithm nor source/voice identity.
state.card = compactCard('040ren_ssr03'); state.limitbreakMaterial = null; await flush()
const voiceSections = all(root).filter(item => item.type === 'section' && item.children.some(child =>
  child.type === 'h4' && ['卡面文本', '首页触摸语音', '演出语音'].includes(text(child))))
const sourceTexts = [state.card.texts.normal, state.card.texts.awakened, state.card.texts.extra,
  ...state.card.home_voice_cues.map(cue => cue.preview?.text),
  ...state.card.operational_voice_cues.map(cue => cue.text)].filter(value => value?.trim() && value.trim() !== '0')
assert.deepEqual(voiceSections.flatMap(section => all(section).filter(item => hasClass(item, 'authored-text')).map(text)),
  sourceTexts.map(presentProducerAddressingText), 'desktop retains all real authored card/voice line breaks')
assert.deepEqual(voiceSections.flatMap(section => all(section).filter(item => hasClass(item, 'reflowed-text')).map(text)),
  sourceTexts.map(value => reflowArchiveText(presentProducerAddressingText(value))),
  'mobile retains the existing complete card/home/operation text reflow')
assert.equal(reflowArchiveText('stage\nshow'), 'stage show')
assert.equal(reflowArchiveText('第一段\n台词。\n\n第二段。'), '第一段台词。\n\n第二段。')
assert.equal(reflowArchiveText('そうだよね！　　English teacherも'), 'そうだよね！　　English teacherも')
app.unmount()
uiLocale.value = 'zh-CN'
console.log(`Card costume/material presentation: all ${shownCards} shown cards/${shownGroups} groups and six exact source setting headers checked in Chinese/Japanese. Real SFC canonical/public variant structure, authored body preservation, Taurus/Scorpio prose/quotation differences, locale switching and conservative grouping exclusions passed. Five production typed material/image bindings, open-entity and focus IDs, missing image/failure/late image error, malformed/stale contexts, raw fallback and ${emptyMaterials.length} empty-FK cards passed. Actual 040ren_ssr03 card/home/operation voice text and existing generic reflow remain unchanged. Browser wrapping/visibility, focus restoration and decoded media remain separate.`)
