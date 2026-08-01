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
  const family = songRelatedEntityIndex.families?.[code]
  const expectedWorkCode = family?.work_code || code
  if (song.work_code !== expectedWorkCode) fail(`song ${code}: work_code mismatch`)
  if (song.parent_song_code !== (expectedWorkCode === code ? null : expectedWorkCode)) {
    fail(`song ${code}: parent_song_code mismatch`)
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
