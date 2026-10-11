import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pick } from '../readmodels/lib/common.mjs'
import { projectSongPerformance } from '../readmodels/lib/projections.mjs'
import { buildSongPresentation } from '../src/presentation/SongPresentation.js'
import { buildStageSongLibrary, filterStageSongLibrary, stageSongCategoryOptions, findStageSongGroup } from '../src/presentation/ChibiSongLibrary.js'

const json = name => JSON.parse(readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8'))
const scripts = json('assets/live-chibi/choreography/index.json').songs
const catalog = json('data/song_catalog.json')
const identity = json('data/masterdata/idol_unit_dictionary.json')
const manifest = json('data/archive_manifest.json')
// The existing writer's light directory contract: no attribute/event metadata,
// primary rows only, special identities retained by explicit variant summaries.
// Use its real performer projector rather than guessing from titles or filenames.
const directory = Object.values(catalog.songs).filter(song => song.variant_kind === 'primary').map(song => ({
  ...pick(song, ['song_code', 'title', 'kana', 'credits', 'song_id', 'audio_form', 'jacket_url', 'variant_kind']),
  performance: projectSongPerformance(song, buildSongPresentation(song, identity, { manifest })),
  variants: (song.variants || []).map(variant => pick(variant, ['song_code', 'title', 'archive_status'])),
}))
const snapshot = JSON.stringify({ scripts, directory, catalog })
const library = buildStageSongLibrary(scripts, directory)
const byCode = code => library.find(group => group.songCode === code)
const byId = id => library.flatMap(group => group.versions).find(version => version.id === id)
const assertComplete = groups => {
  assert.equal(groups.length, 60)
  const versions = groups.flatMap(group => group.versions)
  assert.equal(versions.length, 118)
  assert.equal(new Set(versions.map(version => version.id)).size, 118)
  assert.deepEqual(versions.map(version => version.id).sort(), scripts.map(script => script.id).sort())
  for (const script of scripts) {
    const group = findStageSongGroup(groups, script.id)
    assert.equal(group.songCode, script.songCode, 'selected exact script resolves to its authored songCode')
    const version = group.versions.find(version => version.id === script.id)
    assert.deepEqual(version.positions, script.positions)
    assert.equal(version.participantCount, script.positions.length, 'count is authored active stage slots, not singer count')
    assert.ok(group.versions.some(version => version.id === group.defaultScriptId))
  }
}
assertComplete(library)
assert.deepEqual(buildStageSongLibrary(scripts, Object.fromEntries(directory.map(row => [row.song_code, row]))), library)
assert.deepEqual(buildStageSongLibrary(scripts, { songs: Object.fromEntries(directory.map(row => [row.song_code, row])) }), library)
assert.deepEqual(stageSongCategoryOptions(library).map(({ id, count }) => ({ id, count })),
  [{ id: 'all', count: 60 }, { id: 'collective', count: 5 }, { id: 'unit', count: 47 }, { id: 'special', count: 8 }])
assert.equal(library.every(group => group.attributeKey === ''), true, 'light directory does not acquire inferred attributes')
assert.deepEqual(filterStageSongLibrary(library, { attribute: 'all' }), [])
assert.deepEqual(filterStageSongLibrary(library, { category: 'event' }), [], 'movie/campaign/activity categories are not guessed')
assert.equal(byCode('drvalv').title, 'DRIVE A LIVE')
assert.equal(byCode('drvalv').defaultScriptId, 'drvalv_live_effect')
assert.equal(byCode('drvalv').category, 'collective')
assert.equal(byCode('drvalv').versions.length, 20)
assert.equal(buildStageSongLibrary(scripts.filter(script => script.songCode === 'drvalv' && script.vocalSetting?.mode === 'unit'), directory)[0].category,
  'collective', 'available Unit arrangements do not override the work-level confirmed free-formation scope')
assert.equal(byCode('knwonl').category, 'unit')
assert.equal(byCode('knwonl').unitName, 'THE 虎牙道')
assert.equal(byCode('anwhre').category, 'special')
assert.equal(byCode('drv999').category, 'special')
assert.equal(byCode('drv999').title, 'DRIVE A LIVE（パッションMAX Ver.）')
assert.equal(byId('drv999_live_effect').label, '特别演出')
assert.deepEqual(byId('drv999_live_effect').positions, [3])
assert.notEqual(byCode('drv999'), byCode('drvalv'), 'explicit special song identity stays separate from its parent work')
for (const code of ['drvalv', 'byndtd', 'grwsml']) {
  const unitVersions = byCode(code).versions.filter(version => version.kind === 'unit')
  assert.equal(unitVersions.length, 16)
  assert.equal(new Set(unitVersions.map(version => version.unitCode)).size, 16)
  assert.equal(unitVersions.find(version => version.unitCode === '01jup').label, 'Jupiter')
  assert.equal(unitVersions.find(version => version.unitCode === '03alt').participantCount, 2)
  assert.equal(unitVersions.find(version => version.unitCode === '08hig').participantCount, 5)
  assert.equal(unitVersions.find(version => version.unitCode === '16cfi').label, 'C.FIRST')
  for (const [variant, expected] of [['solo', '单人中心 · Solo'], ['solo_multi', '单人中心 · Solo Multi'], ['solo_single', '单人中心 · Solo Single']]) {
    const version = byCode(code).versions.find(version => version.variant === variant)
    assert.equal(version.label, expected)
    assert.equal(version.participantCount, 1, 'Multi name never implies multiple onstage people')
    assert.deepEqual(version.positions, [3])
  }
}
assert.equal(byCode('tfmvmt').title, 'The 1st Movement ～未来のための二重奏～')
assert.equal(byCode('mtples').title, 'Multiple Entertainment Show!')
assert.deepEqual(filterStageSongLibrary(library, { query: '  MULTIPLE   S.E.M  ' }).map(group => group.songCode), ['mtples'])
assert.deepEqual(filterStageSongLibrary(library, { query: 'Ｔｈｅ　１ｓｔ　Ｍｏｖｅｍｅｎｔ' }).map(group => group.songCode), ['tfmvmt'])
assert.equal(filterStageSongLibrary(library, { query: 'THE 虎牙道', category: 'unit' }).some(group => group.songCode === 'knwonl'), true)
assert.equal(filterStageSongLibrary(library, { query: 'Café Parade' }).some(group => group.songCode === 'drvalv'), true,
  'source variant unit labels participate in group search')
assert.deepEqual(filterStageSongLibrary(library, { query: 'NO-SUCH-SONG' }), [])
assert.deepEqual(filterStageSongLibrary(library), library)
assert.equal(findStageSongGroup(library, 'drvalv'), null, 'a songCode is not silently interpreted as a script id')
assert.equal(findStageSongGroup(library, 'drvalv_live_effect_not-authored'), null)
assert.equal(findStageSongGroup(library, ''), null)

// Canonical metadata can supply explicit attributes; the light published input
// cannot. Neither search terms nor unknown attribute labels become evidence.
const canonicalLibrary = buildStageSongLibrary(scripts, catalog)
assertComplete(canonicalLibrary)
assert.equal(canonicalLibrary.find(group => group.songCode === 'tfmvmt').attributeKey, 'intelli')
assert.equal(filterStageSongLibrary(canonicalLibrary, { attribute: 'all' }).some(group => group.songCode === 'drvalv'), true)
assert.equal(filterStageSongLibrary(canonicalLibrary, { attribute: 'mental' }).some(group => group.songCode === 'knwonl'), true)
assert.equal(JSON.stringify({ scripts, directory, catalog }), snapshot, 'source scripts and regular metadata stay unmodified')

// Explicit synthetic boundaries: these omitted/conflicting fields are not a
// claim that the actual source corpus contains malformed scripts or long fixtures.
const synthetic = { id: 'exact-script_A', songCode: 'fixture', variant: '', title: 'ALL STARS 活动曲', positions: [3] }
const unknown = buildStageSongLibrary([synthetic], null)[0]
assert.equal(unknown.category, 'unknown', 'all-stars/event words in a title cannot classify a song')
assert.equal(unknown.categoryLabel, '', 'omitted source classification does not require a status badge on every normal song')
assert.equal(unknown.title, synthetic.title)
assert.equal(unknown.versions[0].label, '标准编排')
assert.equal(unknown.attributeKey, '')
assert.equal(buildStageSongLibrary([{ ...synthetic, title: '' }], [])[0].title, '曲名未收录')
assert.equal(buildStageSongLibrary([{ ...synthetic, songCode: 'drv999' }], [])[0].category, 'unknown',
  'even a recognized-looking code cannot create a special category without source metadata')
assert.equal(buildStageSongLibrary([synthetic], [{ song_code: 'fixture', attribute: { key: 'allstars' } }])[0].attributeKey, '')
const veryLongTitle = '未来への挑戦 — 完整保留原文 / Multiple Entertainment Show! '.repeat(8)
const longLibrary = buildStageSongLibrary([synthetic], [{ song_code: 'fixture', title: veryLongTitle, kana: 'みらいへのちょうせん' }])
assert.equal(longLibrary[0].title, veryLongTitle)
assert.equal(filterStageSongLibrary(longLibrary, { query: 'みらいへのちょうせん' }).length, 1)
const malformed = [[3, 3], [0], [6], ['3'], [], undefined]
for (const positions of malformed) {
  const version = buildStageSongLibrary([{ ...synthetic, positions }], [])[0].versions[0]
  assert.equal(version.id, synthetic.id, 'unknown people count must not remove an otherwise valid script identity')
  assert.equal(version.participantCount, null)
  assert.deepEqual(version.positions, [])
  assert.equal(version.positionLabel, '人数未确认')
}
const center = { ...synthetic, variant: 'constructor', vocalSetting: { mode: 'center', rawVariant: 'constructor' } }
assert.equal(buildStageSongLibrary([center], [])[0].versions[0].label, '单人中心 · constructor', 'unknown center suffix remains literal')
assert.equal(buildStageSongLibrary([{ ...synthetic, variant: 'solo_multi' }], [])[0].versions[0].kind, 'variant',
  'variant spelling alone does not establish center mode')
assert.equal(buildStageSongLibrary([{ ...synthetic, vocalSetting: { mode: 'unit', unitCode: 'unlisted', label: '' } }], [])[0].versions[0].label,
  '组合编排', 'missing unit label does not invent a unit name')
const reordered = [
  { ...synthetic, id: 'unit-first', variant: 'known-unit', vocalSetting: { mode: 'unit', label: 'Unit：True Source Unit' } }, synthetic,
]
assert.equal(buildStageSongLibrary(reordered, [])[0].defaultScriptId, synthetic.id, 'authored primary wins without changing variant identity/order')
assert.deepEqual(buildStageSongLibrary(reordered, [])[0].versions.map(version => version.id), ['unit-first', synthetic.id])
const conflictingMetadata = [{ song_code: 'fixture', title: 'First', performance: { scope: 'fixed_unit' } },
  { song_code: 'fixture', title: 'Second', performance: { scope: 'unspecified_special' } }]
assert.equal(buildStageSongLibrary([synthetic], conflictingMetadata)[0].category, 'unknown')
assert.equal(buildStageSongLibrary([synthetic], conflictingMetadata)[0].title, synthetic.title)
assert.throws(() => buildStageSongLibrary([synthetic, { ...synthetic }], []), /Duplicate stage script id/)
assert.throws(() => buildStageSongLibrary([{ ...synthetic, id: '' }], []), /exact script id/)
assert.throws(() => buildStageSongLibrary([{ ...synthetic, songCode: '' }], []), /songCode/)
assert.deepEqual(buildStageSongLibrary(null, directory), [])
assert.deepEqual(filterStageSongLibrary(null), [])
assert.deepEqual(stageSongCategoryOptions([]), [{ id: 'all', label: '全部歌曲', count: 0 }])
assert.equal(findStageSongGroup(null, 'exact-script_A'), null)

const args = process.argv.slice(2)
assert.ok(!args.length || args.length === 2 && args[0] === '--read-model-root', 'Expected --read-model-root <directory>')
if (args.length) {
  const root = path.resolve(args[1])
  const bootstrap = JSON.parse(readFileSync(path.join(root, 'bootstrap.inline.json'), 'utf8'))
  const load = descriptor => JSON.parse(readFileSync(path.join(root, 'pages', descriptor.url.replace(/^\//u, '')), 'utf8')).data
  const index = load(bootstrap.domains.songs)
  const rows = index.pages.flatMap(descriptor => load(descriptor).rows)
  assert.equal(rows.length, index.count)
  const actualLibrary = buildStageSongLibrary(scripts, rows)
  assertComplete(actualLibrary)
  assert.deepEqual(actualLibrary, library, 'independently generated public light directory matches the current projection contract')
  console.log(`Actual published songs directory parity passed: ${rows.length} primary records, 60 stage songs / 118 exact scripts; release ${bootstrap.release}`)
}
console.log('Chibi song library passed: actual 60 songs / 118 script identities, 16 Unit variants per collective song, exact selected-script mapping, authored active slot counts, conservative source categories, title/kana/unit search, special identity fallback, full mixed/long titles, missing/conflicting metadata and malformed-slot guards. No SFC, Browser, player/audio or CSV scheduling claim.')
