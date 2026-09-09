import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
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
const sensitive = /\b(?:\w+_(?:id|code)|resourceId|classification_source|_source|raw_category|raw_selector|evidenceLabel|evidence|resource|cue)\b|\.id\b/
function leaks(template) {
  const failures = []
  function walk(node, technical = false) {
    const evidenceGuard = node.props?.some(prop => prop.name === 'if' && /^showEvidence\s*&&/.test(prop.exp?.content || ''))
    technical ||= node.tag === 'ArchiveTechnicalDetails' || evidenceGuard
    // Known numeric projection: filter identity is an input, never the rendered output.
    const countProjection = node.type === 5 && /^filterCount\(filter\.id\)$/.test(node.content.content)
    if (!technical && node.type === 5 && !countProjection && sensitive.test(node.content.content)) failures.push(node.content.content)
    if (!technical && node.type === 2 && /\b(?:RAW|ACB|cue|Confirmed|Derived)\b|表\s*46|字段\s*\d/.test(node.content)) failures.push(node.content)
    for (const child of node.children || []) walk(child, technical)
  }
  walk(baseParse(template))
  return failures
}
assert.ok(leaks('<p>{{ item.resource_id }}</p>').length)
assert.ok(leaks('<p>{{ item.id }}</p>').length)
assert.equal(leaks('<button :key="item.id" @click="open(item.id)">{{ item.title }}</button>').length, 0)
assert.equal(leaks('<ArchiveTechnicalDetails><code>{{ item.resource_id }}</code></ArchiveTechnicalDetails>').length, 0)
const migrated = ['ArchiveSongDetail', 'ArchiveSongCatalog', 'ArchiveSongSinglePlayer', 'ArchiveSongExperimentalPlayer', 'ArchiveSongLineupPlayer', 'ArchiveRelationList', 'ArchiveUnitDetail', 'ArchiveIdolDetail']
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
