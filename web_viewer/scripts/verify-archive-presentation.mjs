import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
import { parseExpression } from '@babel/parser'
import { baseParse, parserOptions } from '@vue/compiler-dom'
import { createServer } from 'vite'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { buildSongPresentation } from '../src/presentation/SongPresentation.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const json = path => JSON.parse(read(`public/data/${path}`))
const catalog = json('song_catalog.json')
const identity = json('masterdata/idol_unit_dictionary.json')
const playback = json('song_playback_audio.json')
const experiments = json('song_experimental_audio.json')
const before = JSON.stringify([catalog, identity, playback, experiments])
const presentations = Object.values(catalog.songs).map(song => buildSongPresentation(song, identity, {
  playbackTrack: playback.songs[song.song_code], audioExperiment: experiments.songs[song.song_code],
}))
const byId = Object.fromEntries(presentations.map(song => [song.id, song]))
assert.equal(byId.brndnf.unit.displayName, 'Jupiter')
assert.equal(byId.brndnf.performers[0].displayName, '天ヶ瀬 冬馬')
assert.equal(byId.drvalv.unit, null, 'a special selector is never interpreted as a unit')
assert.equal(byId.drvalv.performers.length, 0, 'vocal resources are not a confirmed performer lineup')
assert.equal(byId.drvalv.audioGroups[0].entries[0].id, '01jup', 'resource alias resolves to canonical route identity')
assert.equal(byId.drvalv.playback.experiment.solo_tracks['001tom'].displayName, '天ヶ瀬 冬馬')
assert.equal(byId.flslgt.performers.length, 4)
assert.equal(byId.drv999.unit, null)
assert.equal(byId.drv999.scopeLabel, '特别演出')
assert.ok(byId.hrkzbn.movies.length)
assert.equal(byId.hrkzbn.technicalEvidence.catalog.movies[0].movie_offset, 220)
for (const result of presentations) {
  assert.deepEqual(result.technicalEvidence.catalog, catalog.songs[result.id])
  assert.equal(result.playback.track?.url, playback.songs[result.id]?.url)
  for (const entry of [...result.performers, ...result.audioGroups.flatMap(group => group.entries)]) {
    assert.ok(entry.displayName)
    assert.notEqual(entry.displayName, entry.id)
  }
}
const missing = buildSongPresentation({ ...catalog.songs.brndnf, performance_mapping: {
  confirmed_unit: { unit_code: '999bad' }, performer_idol_codes: ['999bad'],
} }, {})
assert.equal(missing.unit.actionable, false)
assert.equal(missing.unit.displayName, '组合待确认')
assert.equal(missing.performers[0].actionable, false)
assert.equal(missing.performers[0].displayName, '姓名待确认')
assert.equal(missing.playbackLabel, '暂未提供试听', 'resource counts do not promise playable media')
assert.equal(before, JSON.stringify([catalog, identity, playback, experiments]), 'projection never mutates evidence')

// Guard rendered text, not keys, URLs or event payloads. Explicit technical slots are exempt.
// This is a bounded migrated-surface gate, not a claim about every archive page.
const technicalField = /(?:_(?:id|code)$|^(?:id|code|resourceId|classification_source|_source|raw_category|raw_selector|script_label|evidenceLabel|evidence|resource|cue)$)/
const namedProjections = new Set(['filterCount', 'tabCount', 'idolName', 'characterName', 'formatDate', 'formatDateTime', 'formatNumber', 'formatDuration', 'formatTime', 'locationLabel', 'unlockText', 'unlockTitle', 'timeWindow', 'shortType', 'voiceSourceLabel', 'scenarioSubtitle'])
function technicalOutput(node) {
  if (!node) return false
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') return technicalField.test(node.property.name || node.property.value || '')
  if (node.type === 'Identifier') return technicalField.test(node.name)
  if (node.type === 'ConditionalExpression') return technicalOutput(node.consequent) || technicalOutput(node.alternate)
  if (node.type === 'LogicalExpression' || node.type === 'BinaryExpression') return technicalOutput(node.left) || technicalOutput(node.right)
  if (node.type === 'TemplateLiteral') return node.expressions.some(technicalOutput)
  if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') {
    // Named formatting/identity projections return user text or counts; their inputs are not outputs.
    if (namedProjections.has(node.callee.name)) return false
    return technicalOutput(node.callee.object) || node.arguments.some(technicalOutput)
  }
  if (node.type === 'ArrowFunctionExpression') return technicalOutput(node.body)
  if (node.type === 'ArrayExpression') return node.elements.some(technicalOutput)
  if (node.type === 'ObjectExpression') return node.properties.some(property => technicalOutput(property.value))
  return false
}
function leaks(template) {
  const failures = []
  function walk(node, technical = false) {
    const evidenceGuard = node.props?.some(prop => prop.name === 'if' && /^showEvidence\s*&&/.test(prop.exp?.content || ''))
    technical ||= node.tag === 'ArchiveTechnicalDetails' || evidenceGuard
    if (!technical && node.type === 5 && technicalOutput(parseExpression(node.content.content))) failures.push(node.content.content)
    for (const prop of node.props || []) {
      if (!technical && prop.name === 'bind' && ['title', 'alt', 'aria-label'].includes(prop.arg?.content) && prop.exp && technicalOutput(parseExpression(prop.exp.content))) failures.push(prop.exp.content)
    }
    if (!technical && node.type === 2 && /\b(?:RAW|ACB|cue|Confirmed|Derived)\b|表\s*46|字段\s*\d/.test(node.content)) failures.push(node.content)
    for (const child of node.children || []) walk(child, technical)
  }
  walk(baseParse(template))
  return failures
}
assert.ok(leaks('<p>{{ item.resource_id }}</p>').length)
assert.ok(leaks('<p>{{ item.id }}</p>').length)
assert.ok(leaks('<img :alt="item.resource_id" />').length)
assert.equal(leaks('<p>{{ resource.uploader.name }}</p>').length, 0)
assert.equal(leaks("<p>{{ item.resource_id ? '已收录' : '未收录' }}</p>").length, 0)
assert.equal(leaks('<button :key="item.id" @click="open(item.id)">{{ item.title }}</button>').length, 0)
assert.equal(leaks('<ArchiveTechnicalDetails><code>{{ item.resource_id }}</code></ArchiveTechnicalDetails>').length, 0)
const migrated = ['ArchiveSongDetail', 'ArchiveSongCatalog', 'ArchiveSongSinglePlayer', 'ArchiveSongExperimentalPlayer', 'ArchiveSongLineupPlayer', 'ArchiveRelationList', 'ArchiveUnitDetail', 'ArchiveIdolDetail', 'ArchiveEventDetail', 'ArchiveGashaDetail', 'ArchiveGashaCatalog', 'ArchiveCardDetail', 'ArchiveMobileArchive', 'ArchiveSeasonalCampaign', 'ArchiveWorkStory', 'ArchiveStoryDetail', 'ArchiveStoryCatalog', 'ArchiveStoryCollection', 'ArchiveCardList', 'ArchiveIdolStory']
for (const name of migrated) {
  const source = read(`src/components/archive/${name}.vue`)
  assert.deepEqual(leaks(parse(source).descriptor.template.content), [], name)
  if (name.startsWith('ArchiveSong')) assert.ok(!source.includes('IdolNameMap'), `${name} must use canonical presentation identity`)
}

// Exercise real templates with production data; exclude closed technical details from normal text.
function publicText(html) {
  function collect(node) {
    if (node.tag === 'details') return ''
    return node.type === 2 ? node.content : (node.children || []).map(collect).join(' ')
  }
  return collect(baseParse(html, parserOptions))
}
const server = await createServer({ configLoader: 'native', server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: Detail } = await server.ssrLoadModule('/src/components/archive/ArchiveSongDetail.vue')
  for (const song of presentations) {
    const html = await renderToString(createSSRApp(Detail, { song }))
    assert.ok(!/\b\d{3}[a-z]{3}\b|表\s*46|\bRAW\b|\bACB\b/.test(publicText(html)), song.id)
    assert.ok(html.includes('data-technical-details'), song.id)
    assert.ok(!/<details[^>]*\sopen(?:[\s=>])/.test(html), 'evidence is closed by default')
  }
  async function checkPage(name, props, expected = []) {
    const { default: Component } = await server.ssrLoadModule(`/src/components/archive/${name}.vue`)
    const html = await renderToString(createSSRApp(Component, props))
    const visible = publicText(html)
    assert.ok(!/\b\d{3}[a-z]{3}\b|\bRAW\b|\bACB\b|Raw ·|\bDerived\b|\bConfirmed\b|LimitbreakItemId|resource_id|model_resource_id/.test(visible), `${name}: ${visible.slice(0, 200)}`)
    for (const text of expected) assert.ok(visible.includes(text), `${name}: ${text}`)
    assert.ok(!/<details[^>]*\sopen(?:[\s=>])/.test(html), `${name}: evidence closed by default`)
    return { html, visible }
  }
  const gashas = json('masterdata/gasha_index.json').gashas
  const idolName = code => identity.by_idol_code[code]?.display_name || '姓名待确认'
  for (const gasha of gashas) await checkPage('ArchiveGashaDetail', { gasha, idolName })
  const projectedGasha = await checkPage('ArchiveGashaDetail', { gasha: gashas.find(gasha => gasha.derived_pickup_cards?.length), idolName }, ['推定的关联'])
  assert.ok(projectedGasha.html.includes('data-technical-details'))
  const { mergeCardDetail } = await import('../src/data/archiveSelectors.js')
  const cards = json('masterdata/card_index.json').cards
  const details = json('masterdata/card_detail_index.json')
  const merged = cards.map(card => mergeCardDetail(card, details))
  const cardSamples = [...new Set([
    merged[0], merged.find(card => card.single_state),
    merged.find(card => card.home_voice_cues?.length),
    merged.find(card => card.operational_voice_cues?.length),
    merged.find(card => card.voice_candidates?.unmapped_card_only?.length),
    merged.find(card => card.scenario_entries?.length),
  ].filter(Boolean))]
  for (const card of cardSamples) {
    const { html, visible } = await checkPage('ArchiveCardDetail', { card })
    assert.ok(!visible.includes('未归类卡面语音候选'))
    if (card.voice_candidates?.unmapped_card_only?.length) assert.ok(html.includes(card.voice_candidates.unmapped_card_only[0]))
  }
  const sourceEvent = json('masterdata/event_index.json').events[0]
  await checkPage('ArchiveEventDetail', { event: { event_id: 'test', event_code: 'test', title: '测试活动', exists: false }, masterEvent: sourceEvent, idols: identity.idols }, ['剧情暂未收录'])
  for (const campaign of json('masterdata/seasonal_campaign_index.json').campaigns) await checkPage('ArchiveSeasonalCampaign', { campaign })
  for (const idol of json('masterdata/work_story_index.json').idols) await checkPage('ArchiveWorkStory', { idol })
  const archive = json('masterdata/mobile_archive_index.json')
  for (const mode of ['personal', 'phone', 'unit', 'random']) await checkPage('ArchiveMobileArchive', { archive, mode, selectedIdol: '001tom', selectedUnit: '01jup', idols: identity.idols, units: identity.units, cards, idolEpisodes: json('masterdata/idol_episode_index.json') })
  await checkPage('ArchiveStoryDetail', { story: { id: 'sample', title: '测试剧情', resourceId: '1_1_resource', file: 'sample.json', exists: false }, idolName }, ['暂未收录'])
  const { buildStoryCatalog } = await import('../src/data/archiveSelectors.js')
  const { buildStoryCollections } = await import('../src/data/storyCollections.js')
  const { buildMainStoryDomainIdentity, buildExtraStoryDomainIdentity, buildBirthdayStoryDomainIdentity } = await import('../src/data/storyDomainIdentityIndex.js')
  const storyData = json('masterdata/story_catalog.json')
  const storyEntries = buildStoryCatalog(storyData, json('masterdata/story_presentation_index.json'))
  const mainDomain = buildMainStoryDomainIdentity(storyData)
  const extraDomain = buildExtraStoryDomainIdentity(storyData, json('masterdata/gasha_index.json'), json('masterdata/extra_story_visual_index.json'))
  const birthdayDomain = buildBirthdayStoryDomainIdentity(storyData, identity, json('masterdata/speaker_dictionary.json'), json('masterdata/birthday_story_semantic_index.json'))
  for (const domain of ['main', 'extra', 'birthday']) await checkPage('ArchiveStoryCatalog', { mode: 'portal', domain, mainDomain, extraDomain, birthdayDomain })
  const listResult = await checkPage('ArchiveStoryCatalog', { mode: 'search', entries: storyEntries, filteredTotal: storyEntries.length })
  assert.ok(!/\b1_\d_\d{3}_/.test(listResult.visible), 'resource identities stay out of search results')
  for (const collection of buildStoryCollections(storyData, storyEntries, { extraDomain, birthdayDomain, idolEpisodes: json('masterdata/idol_episode_index.json') })) await checkPage('ArchiveStoryCollection', { collection })
  const cardList = await checkPage('ArchiveCardList', { cards: merged })
  assert.ok(!/\b\d{3}[a-z]{3}_(?:ssr|sr|r)\d/.test(cardList.visible), 'card list uses names')
  const { default: Relations } = await server.ssrLoadModule('/src/components/archive/ArchiveRelationList.vue')
  const items = [{ id: 'r', title: '测试活动', label: '活动', statusLabel: '可播放', evidenceLabel: 'Derived', evidence: 'relation_basis', resource: '1_3_source', payload: { preserved: true } }]
  const normal = await renderToString(createSSRApp(Relations, { items }))
  assert.ok(publicText(normal).includes('可播放'))
  assert.ok(!publicText(normal).includes('Derived'))
  assert.ok(normal.includes('relation_basis') && normal.includes('1_3_source'), 'evidence remains accessible')
  const technical = await renderToString(createSSRApp(Relations, { items, showEvidence: true }))
  assert.ok(publicText(technical).includes('Derived'))
  assert.ok(publicText(technical).includes('1_3_source'))
} finally { await server.close() }
console.log(`Archive presentation verified: ${presentations.length} songs, canonical identity, capability boundaries, immutable evidence, default/technical rendering and ${migrated.length} template boundaries`)
