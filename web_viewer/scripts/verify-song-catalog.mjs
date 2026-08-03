import { readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { loadArchiveSources } from './lib/archive-sources.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = path.join(projectRoot, 'public', 'data', 'song_catalog.json')
const schemaPath = path.join(projectRoot, 'schemas', 'song-catalog-v1.schema.json')
const musicCatalogPath = path.join(projectRoot, 'public', 'data', 'masterdata', 'music_catalog.json')
const songMovieIndexPath = path.join(projectRoot, 'public', 'data', 'masterdata', 'song_movie_index.json')
const songAudioCatalogPath = path.join(projectRoot, 'public', 'data', 'song_audio_relation_catalog.json')
const songRelatedEntityIndexPath = path.join(projectRoot, 'public', 'data', 'song_related_entity_index.json')
const idolUnitDictionaryPath = path.join(projectRoot, 'public', 'data', 'masterdata', 'idol_unit_dictionary.json')
const archiveManifestPath = path.join(projectRoot, 'public', 'data', 'archive_manifest.json')

const sourceOnly = process.argv.includes('--source-only')
const sources = loadArchiveSources()
const rawConfig = JSON.parse(readFileSync(sources.configPath, 'utf8'))
const rawAudioRoot = path.resolve(sources.archiveRoot, rawConfig.raw_root, 'audio')
const rawAssetRoot = path.resolve(sources.archiveRoot, rawConfig.raw_root, 'asset')

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exitCode = 1
}

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
const musicCatalog = JSON.parse(readFileSync(musicCatalogPath, 'utf8'))
const songMovieIndex = JSON.parse(readFileSync(songMovieIndexPath, 'utf8'))
const songAudioCatalog = JSON.parse(readFileSync(songAudioCatalogPath, 'utf8'))
const songRelatedEntityIndex = JSON.parse(readFileSync(songRelatedEntityIndexPath, 'utf8'))
const idolUnitDictionary = JSON.parse(readFileSync(idolUnitDictionaryPath, 'utf8'))
const archiveManifest = JSON.parse(readFileSync(archiveManifestPath, 'utf8'))

const ajv = new Ajv2020({ allErrors: true })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(catalog)) {
  fail(`catalog schema invalid: ${JSON.stringify(validate.errors, null, 1)}`)
}

const expectedSongs = Object.keys(musicCatalog.songs).sort()
const catalogSongs = Object.keys(catalog.songs).sort()
if (JSON.stringify(expectedSongs) !== JSON.stringify(catalogSongs)) {
  fail(`song set mismatch: expected ${expectedSongs.join(',')}, got ${catalogSongs.join(',')}`)
}

const seenSongIds = new Set()
for (const code of catalogSongs) {
  const song = catalog.songs[code]
  const meta = musicCatalog.songs[code]
  for (const key of ['title', 'kana', 'credits']) {
    if (song[key] !== meta[key]) {
      fail(`song ${code}: ${key} mismatch with music_catalog`)
    }
  }
  const expectedLinks = [...new Set(meta.links || [])].sort()
  if (JSON.stringify([...song.links].sort()) !== JSON.stringify(expectedLinks)) {
    fail(`song ${code}: links mismatch with music_catalog`)
  }
  if (song.song_id == null || seenSongIds.has(song.song_id)) {
    fail(`song ${code}: song_id missing or duplicated`)
  }
  seenSongIds.add(song.song_id)
  if (song.available !== (song.open_at != null && song.open_at !== 4102412400)) {
    fail(`song ${code}: available does not match open_at`)
  }
  const expectedStatus = song.open_at === 4102412400
    ? 'special'
    : (song.open_at === 946652400 ? 'initial' : 'released')
  if (song.archive_status !== expectedStatus) fail(`song ${code}: archive_status mismatch`)
  if (!song.song_data || typeof song.song_data.has_switch_singer !== 'boolean' ||
      (song.song_data.on_stage_count !== null && typeof song.song_data.on_stage_count !== 'number') ||
      typeof song.song_data.has_solo_singing !== 'boolean') {
    fail(`song ${code}: SongData selection flags missing`)
  }
  if (song.song_data.has_solo_singing && song.song_data.solo_singing_open_at === 4102412400) {
    fail(`song ${code}: solo singing cannot be enabled at the disabled sentinel`)
  }
  const family = songRelatedEntityIndex.families?.[code]
  const expectedWorkCode = family?.work_code || code
  if (song.work_code !== expectedWorkCode) fail(`song ${code}: work_code mismatch`)
  if (song.parent_song_code !== (expectedWorkCode === code ? null : expectedWorkCode)) {
    fail(`song ${code}: parent_song_code mismatch`)
  }
  const rawMapping = meta.performance_selector
  const performance = song.performance_mapping
  if (performance.raw_category !== rawMapping.category || performance.raw_selector_id !== rawMapping.selector_id) {
    fail(`song ${code}: table 46 selector mismatch`)
  }
  if (performance.affiliation_kind !== rawMapping.kind) fail(`song ${code}: affiliation kind mismatch`)
  if (performance.table_46_row_count !== meta.table_46_row_count) {
    fail(`song ${code}: table 46 row count mismatch`)
  }
  const expectedExplicitCodes = (meta.performer_idol_ids || []).map(id =>
    idolUnitDictionary.by_numeric_id?.[String(id)]?.idol_code,
  ).filter(Boolean)
  if (JSON.stringify(performance.explicit_performer_idol_codes) !== JSON.stringify(expectedExplicitCodes)) {
    fail(`song ${code}: explicit performer mapping mismatch`)
  }
  if (rawMapping.kind === 'unit') {
    const unit = idolUnitDictionary.by_unit_id?.[String(rawMapping.unit_id)]
    if (!performance.confirmed_unit || performance.confirmed_unit.unit_code !== unit?.unit_code) {
      fail(`song ${code}: confirmed unit relation missing`)
    }
  } else if (performance.confirmed_unit !== null) {
    fail(`song ${code}: collective-or-special selector must not become a confirmed unit relation`)
  }
  const expectedPerformerScope = performance.confirmed_unit
    ? 'fixed_unit'
    : expectedExplicitCodes.length
      ? 'fixed_special_lineup'
      : song.song_data.has_switch_singer
        ? 'configurable_formation'
        : 'unspecified_special'
  if (performance.performer_scope !== expectedPerformerScope) {
    fail(`song ${code}: performer_scope mismatch`)
  }

  const layers = songAudioCatalog.songs[code]?.audio_layers || []
  const unitCount = layers.filter(l => l.kind === 'unit-cue').reduce((n, l) => n + (l.cue_names || []).length, 0)
  const oneshotCount = layers.filter(l => l.kind === 'oneshot-cue').reduce((n, l) => n + (l.cue_names || []).length, 0)
  const idolVocalCount = layers.filter(l => l.kind === 'idol-vocal').reduce((n, l) => n + (l.files || []).length, 0)
  const backingCount = layers.filter(l => l.kind === 'backing').reduce((n, l) => n + (l.files || []).length, 0)
  const hasFullMix = layers.some(l => l.kind === 'full-mix')
  if (song.audio.unit_cue_count !== unitCount) fail(`song ${code}: unit_cue_count mismatch`)
  if (song.audio.oneshot_cue_count !== oneshotCount) fail(`song ${code}: oneshot_cue_count mismatch`)
  if (song.audio.idol_vocal_file_count !== idolVocalCount) fail(`song ${code}: idol_vocal_file_count mismatch`)
  if (song.audio.backing_file_count !== backingCount) fail(`song ${code}: backing_file_count mismatch`)
  if (song.audio.has_full_mix !== hasFullMix) fail(`song ${code}: has_full_mix mismatch`)
  if (song.audio.unit_codes.length !== unitCount) fail(`song ${code}: unit_codes length mismatch`)
  if (song.audio.oneshot_idol_codes.length !== oneshotCount) fail(`song ${code}: oneshot_idol_codes length mismatch`)
  const expectedForm = unitCount ? 'layered' : (oneshotCount ? 'oneshot' : 'single-cue')
  if (song.audio_form !== expectedForm) fail(`song ${code}: audio_form mismatch`)
}

// Movie relations must be covered exactly once by the catalog songs.
const movieEntries = songMovieIndex.song_movies || []
const catalogMovieKeys = new Set()
for (const song of Object.values(catalog.songs)) {
  for (const movie of song.movies) {
    catalogMovieKeys.add(`${movie.kind}:${movie.resource_id}`)
  }
}
if (catalogMovieKeys.size !== movieEntries.length) {
  fail(`movie relation count mismatch: catalog ${catalogMovieKeys.size}, index ${movieEntries.length}`)
}
for (const entry of movieEntries) {
  if (!catalogMovieKeys.has(`${entry.kind}:${entry.resource_id}`)) {
    fail(`movie relation missing from catalog: ${entry.kind}:${entry.resource_id}`)
  }
}

const s = catalog.summary
if (s.song_count !== expectedSongs.length) fail(`song_count ${s.song_count} != music catalog ${expectedSongs.length}`)
if (s.work_count !== Object.values(catalog.songs).filter(song => song.variant_kind === 'primary').length) fail(`work_count mismatch`)
if (s.special_variant_count !== Object.values(catalog.songs).filter(song => song.archive_status === 'special').length) fail(`special_variant_count mismatch`)

const driveVariant = catalog.songs.drvalv.variants.find(variant => variant.song_code === 'drv999')
if (!driveVariant || driveVariant.variant_kind !== 'april_fools') fail('DRIVE A LIVE April Fools variant missing')
if (catalog.songs.drv999.related_entities?.[0]?.story_section !== '602') fail('drv999 Extra 602 relation missing')
if (s.available_song_count !== Object.values(catalog.songs).filter(song => song.available).length) {
  fail(`available_song_count mismatch`)
}
if (s.mv_resource_count !== movieEntries.length) fail(`mv_resource_count mismatch`)
if (s.three_d_movie_count !== movieEntries.filter(e => e.kind === '3dmv').length) fail(`three_d_movie_count mismatch`)
if (s.mvlive_count !== movieEntries.filter(e => e.kind === 'mvlive').length) fail(`mvlive_count mismatch`)
if (s.layered_song_count !== Object.values(catalog.songs).filter(song => song.audio_form === 'layered').length) fail(`layered_song_count mismatch`)
if (s.oneshot_song_count !== Object.values(catalog.songs).filter(song => song.audio_form === 'oneshot').length) fail(`oneshot_song_count mismatch`)
if (s.switch_singer_song_count !== Object.values(catalog.songs).filter(song => song.song_data.has_switch_singer).length) fail(`switch_singer_song_count mismatch`)
if (s.switch_singer_song_count !== 5) fail(`switch_singer_song_count must be 5`)
if (s.solo_singing_song_count !== Object.values(catalog.songs).filter(song => song.song_data.has_solo_singing).length) fail(`solo_singing_song_count mismatch`)
if (s.solo_singing_song_count !== 3) fail(`solo_singing_song_count must be 3`)
for (const code of ['tkstp1', 'tkstp2']) {
  const songData = catalog.songs[code]?.song_data
  if (songData?.on_stage_count !== 5 || songData?.has_switch_singer !== true) {
    fail(`${code}: five-slot SwitchSinger contract missing`)
  }
}
if (s.confirmed_unit_song_count !== 47) fail(`confirmed_unit_song_count must be 47`)
if (s.explicit_performer_song_count !== 13) fail(`explicit_performer_song_count must be 13 unique songs`)
if (musicCatalog.meta.table_46_row_count !== 99) fail(`music_catalog table_46_row_count must be 99`)
if (musicCatalog.meta.explicit_performer_row_count !== 20) fail(`music_catalog explicit performer row count must be 20`)
if (musicCatalog.meta.explicit_performer_song_count !== 13) fail(`music_catalog explicit performer song count must be 13`)
if (musicCatalog.songs.brndnf.performance_selector?.unit_id !== 1) fail(`BRAND NEW FIELD must map to Jupiter`)
if (musicCatalog.songs.psblts.performance_selector?.unit_id !== 12) fail(`Possibilities must map to S.E.M`)
if (JSON.stringify(musicCatalog.songs.flslgt.performer_idol_ids) !== JSON.stringify([7, 9, 22, 48])) {
  fail(`FLASH LIGHT explicit performers mismatch`)
}
if (catalog.songs.drvalv.performance_mapping.performer_scope !== 'configurable_formation') {
  fail(`DRIVE A LIVE must resolve to configurable formation scope`)
}
if (catalog.songs.flslgt.performance_mapping.performer_scope !== 'fixed_special_lineup') {
  fail(`FLASH LIGHT must resolve to fixed special lineup scope`)
}
if (catalog.songs.drv999.performance_mapping.performer_scope !== 'unspecified_special') {
  fail(`DRIVE A LIVE April Fools version must remain unspecified special scope`)
}
const semMembers = Object.entries(archiveManifest.unit_membership_by_idol || {})
  .filter(([, membership]) => Number(membership.unit_id) === 12)
  .map(([idolCode]) => idolCode)
  .sort()
if (JSON.stringify([...catalog.songs.psblts.performance_mapping.performer_idol_codes].sort()) !== JSON.stringify(semMembers)) {
  fail(`Possibilities performer roster must resolve to all S.E.M members`)
}
if (s.choreography_bundle_count !== Object.values(catalog.songs).filter(song => song.choreography.has_fumen).length) fail(`choreography_bundle_count mismatch`)
if (s.lipsync_coverage !== Object.values(catalog.songs).filter(song => song.choreography.has_for_lipsync).length) fail(`lipsync_coverage mismatch`)
if (s.unit_effect_song_count !== Object.values(catalog.songs).filter(song => song.choreography.live_effect_variants.length).length) fail(`unit_effect_song_count mismatch`)
if (s.jacket_coverage !== Object.values(catalog.songs).filter(song => song.choreography.has_jacket).length) fail(`jacket_coverage mismatch`)
if (s.song_bg_coverage !== Object.values(catalog.songs).filter(song => song.choreography.has_song_bg).length) fail(`song_bg_coverage mismatch`)
if (s.jacket_url_coverage !== Object.values(catalog.songs).filter(song => song.jacket_url).length) fail(`jacket_url_coverage mismatch`)
if (s.jacket_url_coverage !== s.jacket_coverage) fail(`every RAW jacket must be published as jacket_url`)

if (sourceOnly) {
  if (process.exitCode) process.exit(1)
  console.log(
    `Song catalog verified (source-only): ${s.song_count} songs, ` +
      `${s.three_d_movie_count} 3dmv, ${s.mvlive_count} mvlive, ` +
      `${s.layered_song_count} layered, ${s.oneshot_song_count} oneshot`,
  )
  process.exit(0)
}

// Mounted mode: every catalog song must have its RAW audio base and choreography bundle.
const acbFiles = new Set(readdirSync(rawAudioRoot))
const bundleFiles = new Set(readdirSync(rawAssetRoot))
for (const code of catalogSongs) {
  const song = catalog.songs[code]
  const acb = `song3_${code}.acb`
  const bundle = `song_${code}.unity3d`
  if (!acbFiles.has(acb)) fail(`song ${code}: RAW audio base missing: ${acb}`)
  if (songAudioCatalog.songs[code]?.base_file !== acb) fail(`song ${code}: audio catalog base_file mismatch`)
  if (song.choreography.has_fumen && !bundleFiles.has(bundle)) fail(`song ${code}: RAW choreography bundle missing: ${bundle}`)
  if (song.choreography.has_fumen && !song.choreography.has_jacket) fail(`song ${code}: fumen without jacket`)
  if (song.choreography.has_fumen && !song.choreography.has_song_bg) fail(`song ${code}: fumen without song bg`)
}

if (process.exitCode) process.exit(1)
console.log(
  `Song catalog verified: ${s.song_count} songs / ${s.mv_resource_count} movie relations ` +
    `(3dmv ${s.three_d_movie_count}, mvlive ${s.mvlive_count})`,
)
