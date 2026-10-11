import assert from 'node:assert/strict'
import { validateArchivePayload } from '../src/data/archiveDataContracts.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readArchiveRoute, buildArchiveUrl, buildArchiveBreadcrumbs, ARCHIVE_NAVIGATION } from '../src/core/archiveRoute.js'
import { ARCHIVE_SOURCES } from '../src/data/ArchiveDataRepository.js'
import { verifySongLandingBehavior } from './lib/song-landing-behavior.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const viewerRoot = path.resolve(scriptDirectory, '..')
const readViewerFile = relativePath => readFile(path.join(viewerRoot, relativePath), 'utf8')

const [catalog, appComponent, catalogComponent, detailComponent, idolDetailComponent, unitDetailComponent, jacketIndex, unitDictionary] =
  await Promise.all([
    readViewerFile('public/data/song_catalog.json').then(JSON.parse),
    readViewerFile('src/App.vue'),
    readViewerFile('src/components/archive/ArchiveSongCatalog.vue'),
    readViewerFile('src/components/archive/ArchiveSongDetail.vue'),
    readViewerFile('src/components/archive/ArchiveIdolDetail.vue'),
    readViewerFile('src/components/archive/ArchiveUnitDetail.vue'),
    readViewerFile('public/data/song_jacket_index.json').then(JSON.parse),
    readViewerFile('public/data/masterdata/idol_unit_dictionary.json').then(JSON.parse),
  ])

// Route contract: song_catalog and song_detail views with the song query key
const catalogRoute = readArchiveRoute('http://localhost/?view=song_catalog')
assert.equal(catalogRoute.view, 'song_catalog')
assert.equal(catalogRoute.song, '')
const detailRoute = readArchiveRoute('http://localhost/?view=song_detail&song=drvalv')
assert.equal(detailRoute.view, 'song_detail')
assert.equal(detailRoute.song, 'drvalv')
assert.equal(readArchiveRoute('http://localhost/?view=song_detail').view, 'song_catalog')
assert.equal(readArchiveRoute('http://localhost/?view=song_detail&song=byndtd').song, 'byndtd')

// Catalog data: 61 metadata-only entries, 60 available
assert.equal(catalog.schema_version, 1)
assert.equal(catalog.summary.song_count, 61)
assert.equal(catalog.summary.work_count, 60)
assert.equal(catalog.summary.special_variant_count, 1)
assert.equal(catalog.summary.available_song_count, 60)
assert.equal(catalog.summary.mv_resource_count, 12)
assert.equal(catalog.summary.three_d_movie_count, 11)
assert.equal(catalog.summary.mvlive_count, 1)
assert.equal(catalog.summary.layered_song_count, 3)
assert.equal(catalog.summary.oneshot_song_count, 2)
assert.equal(catalog.summary.lipsync_coverage, 60)
assert.equal(catalog.summary.unit_effect_song_count, 3)
assert.equal(catalog.summary.confirmed_unit_song_count, 47)
assert.equal(catalog.summary.explicit_performer_song_count, 13)

const songs = Object.values(catalog.songs)
assert.equal(songs.length, 61)
assert.equal(new Set(songs.map(song => song.song_id)).size, 61, 'song_id must be unique')
assert.equal(
  [...songs].sort((a, b) => a.song_id - b.song_id)[0].song_code,
  'drvalv',
  'song_id ordering must lead with DRIVE A LIVE',
)

// DRIVE A LIVE family: layered performances and the April Fools variant
for (const code of ['byndtd', 'drvalv', 'grwsml']) {
  const song = catalog.songs[code]
  assert.equal(song.audio_form, 'layered')
  assert.equal(song.audio.unit_cue_count, 16)
  assert.equal(song.choreography.has_fumen, true)
  assert.equal(song.choreography.has_for_lipsync, true)
}
const drv999 = catalog.songs.drv999
assert.equal(drv999.available, false)
assert.equal(drv999.archive_status, 'special')
assert.equal(drv999.parent_song_code, 'drvalv')
assert.equal(drv999.variant_kind, 'april_fools')
assert.equal(drv999.related_entities[0].story_section, '602')
assert.equal(catalog.songs.drvalv.variants[0].song_code, 'drv999')
assert.equal(drv999.choreography.has_for_lipsync, false)
assert.equal(drv999.audio_form, 'single-cue')
assert.equal(drv999.performance_mapping.confirmed_unit, null)
assert.equal(drv999.performance_mapping.performer_scope, 'unspecified_special')
for (const code of ['flslgt', 'pcuslv']) {
  assert.equal(catalog.songs[code].audio_form, 'oneshot')
  assert.equal(catalog.songs[code].audio.oneshot_cue_count, 49)
}

// Movie relations: exact kind / resource_id mapping
const movieRelations = Object.values(catalog.songs)
  .flatMap(song => (song.movies || []).map(movie => [song.song_code, movie.kind, movie.resource_id]))
assert.deepEqual(
  movieRelations.filter(([, kind]) => kind === 'mvlive').map(([code]) => code),
  ['reason'],
)
assert.equal(movieRelations.filter(([, kind]) => kind === '3dmv').length, 11)
assert.equal(movieRelations.some(([code, kind, resourceId]) => code === 'hrkzbn' && kind === '3dmv' && resourceId === 'hrkzbn'), true)
const hrkzbnMovie = catalog.songs.hrkzbn.movies[0]
assert.equal(hrkzbnMovie.movie_offset, 220)
assert.equal(hrkzbnMovie.movie_finish_offset, 3500)

// Unit-effect variants on the three layered songs
assert.equal(catalog.songs.grwsml.choreography.live_effect_variants.includes('tutorial'), true)

const songNavigation = useArchiveNavigationState()
songNavigation.view.value = 'song_detail'
songNavigation.currentSongId.value = 'drvalv'
songNavigation.currentSongScope.value = '3dmv'
assert.equal(songNavigation.currentArchiveRoute().song, 'drvalv')
assert.equal(songNavigation.currentArchiveRoute().songScope, '3dmv')
songNavigation.view.value = 'cards'
assert.equal(songNavigation.currentArchiveRoute().song, '')
assert.equal(songNavigation.currentArchiveRoute().songScope, 'all')
await verifySongLandingBehavior({ appComponent, catalogComponent, detailComponent, idolDetailComponent, unitDetailComponent, catalog, unitDictionary })

// Jacket relation: every catalog song carries a published RAW cover URL
assert.equal(Object.keys(jacketIndex.entries).length, 61)
assert.equal(catalog.summary.jacket_url_coverage, 61)
for (const code of Object.keys(jacketIndex.entries)) {
  assert.equal(catalog.songs[code].jacket_url, jacketIndex.entries[code].url)
}
assert.match(
  jacketIndex.entries.drvalv.url,
  /^\/assets\/songs\/jacket_drvalv\.png$/,
  'jacket URL must follow the published asset convention',
)

// Unit-name reverse lookup: every catalog unit code must resolve through
// idol_unit_dictionary.units (table 24 UnitMaster), which the detail page
// queries by unit_code after stripping the leading zero of ACB cue codes.
const unitByCode = new Map(unitDictionary.units.map(unit => [unit.unit_code, unit.unit_name]))
const unitCodeOf = code => code.replace(/^0(\d{2}[a-z0-9]{3})/, '$1')
const allUnitCodes = songs.flatMap(song => [
  ...(song.audio.unit_codes || []),
  ...(song.choreography.live_effect_variants || []),
]).map(unitCodeOf)
const uniqueUnitCodes = [...new Set(allUnitCodes)].filter(code => !/^(solo|solo_multi|solo_single|tutorial)$/.test(code))
assert.equal(uniqueUnitCodes.length, 16, 'layered songs must cover exactly the 16 masterdata units')
for (const code of uniqueUnitCodes) {
  const name = unitByCode.get(code)
  assert.ok(name, `unit code ${code} must resolve to a unit_name in idol_unit_dictionary`)
}
assert.equal(unitByCode.get('01jup'), 'Jupiter')
assert.equal(unitByCode.get('02dra'), 'DRAMATIC STARS')
assert.equal(catalog.songs.brndnf.performance_mapping.confirmed_unit.unit_code, '01jup')
assert.equal(catalog.songs.psblts.performance_mapping.confirmed_unit.unit_code, '12sem')
assert.deepEqual(catalog.songs.flslgt.performance_mapping.explicit_performer_idol_codes, ['007kei', '009kyj', '022nat', '048mom'])
assert.equal(catalog.songs.flslgt.performance_mapping.performer_scope, 'fixed_special_lineup')
assert.equal(catalog.songs.drvalv.performance_mapping.performer_scope, 'configurable_formation')
assert.equal(catalog.songs.brndnf.performance_mapping.performer_scope, 'fixed_unit')

// Public route and repository contracts are values and round trips, not source formatting.
assert.equal(ARCHIVE_NAVIGATION.find(entry => entry.id === 'songs')?.label, '歌曲')
const restored = readArchiveRoute(buildArchiveUrl('http://localhost/', detailRoute))
assert.equal(restored.song, 'drvalv')
assert.equal(restored.view, 'song_detail')
const breadcrumb = buildArchiveBreadcrumbs(detailRoute, { title: 'DRIVE A LIVE' }).find(entry => entry.route?.view === 'song_catalog')
assert.ok(breadcrumb)
assert.equal(breadcrumb.label, '歌曲')
assert.equal(breadcrumb.route.song, '')
assert.equal(ARCHIVE_SOURCES.songCatalog, '/data/song_catalog.json')
assert.equal(ARCHIVE_SOURCES.songJacketIndex, '/data/song_jacket_index.json')
validateArchivePayload('songCatalog', catalog)
validateArchivePayload('songJacketIndex', jacketIndex)
assert.throws(() => validateArchivePayload('songCatalog', { ...catalog, schema_version: 0 }))
assert.throws(() => validateArchivePayload('songJacketIndex', { ...jacketIndex, schema_version: 0 }))

console.log('Song domain landing: 60 works / 61 song entities, 47 confirmed unit mappings, 13 explicit performer songs and bidirectional entity links verified')
