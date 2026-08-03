import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import { loadArchiveSources } from './lib/archive-sources.mjs'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = path.join(projectRoot, 'public', 'data', 'song_audio_relation_catalog.json')
const schemaPath = path.join(projectRoot, 'schemas', 'song-audio-relation-catalog-v1.schema.json')
const musicCatalogPath = path.join(projectRoot, 'public', 'data', 'masterdata', 'music_catalog.json')

const sourceOnly = process.argv.includes('--source-only')
const sources = loadArchiveSources()
const rawConfig = JSON.parse(readFileSync(sources.configPath, 'utf8'))
const rawAudioRoot = path.resolve(sources.archiveRoot, rawConfig.raw_root, 'audio')

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exitCode = 1
}

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
const musicCatalog = JSON.parse(readFileSync(musicCatalogPath, 'utf8'))

const ajv = new Ajv2020({ allErrors: true })
const validate = ajv.compile(schema)
if (!validate(catalog)) {
  fail(`catalog schema invalid: ${JSON.stringify(validate.errors, null, 1)}`)
}

// Cross-check against the RAW audio population (mounted mode only).
const acbFiles = sourceOnly
  ? []
  : readdirSync(rawAudioRoot)
      .filter(name => name.startsWith('song3_') && name.endsWith('.acb'))
      .sort()

const rawBase = new Set(
  acbFiles.map(name => name.slice('song3_'.length).split('_')[0]),
)
const rawIdolFiles = new Map()
const rawBackingFiles = new Map()
for (const name of acbFiles) {
  const stem = name.replace(/\.acb$/, '')
  const rest = stem.slice('song3_'.length)
  const code = rest.split('_')[0]
  const suffix = rest.slice(code.length + 1)
  if (/^\d{3}[a-z]{3}$/.test(suffix)) {
    rawIdolFiles.set(code, (rawIdolFiles.get(code) || 0) + 1)
  } else if (suffix === 'bgm') {
    rawBackingFiles.set(code, (rawBackingFiles.get(code) || 0) + 1)
  }
}

const expectedSongs = Object.keys(musicCatalog.songs).sort()
const catalogSongs = Object.keys(catalog.songs).sort()
if (JSON.stringify(expectedSongs) !== JSON.stringify(catalogSongs)) {
  fail(`catalog song set mismatch: expected ${expectedSongs.join(',')}, got ${catalogSongs.join(',')}`)
}

// Every catalog song must have a base file (existence checked in mounted mode).
const acbSet = new Set(acbFiles)
for (const code of catalogSongs) {
  const entry = catalog.songs[code]
  const baseFile = entry.base_file
  if (!baseFile || (!sourceOnly && !acbSet.has(baseFile))) {
    fail(`song ${code}: base file missing from RAW: ${baseFile}`)
  }
  if (!entry.title || typeof entry.title !== 'string') {
    fail(`song ${code}: missing title`)
  }
  if (!Array.isArray(entry.audio_layers) || entry.audio_layers.length === 0) {
    fail(`song ${code}: no audio layers`)
  }
  for (const layer of entry.audio_layers) {
    for (const file of layer.files || []) {
      if (!sourceOnly && !acbSet.has(file)) {
        fail(`song ${code}: layer file not in RAW: ${file}`)
      }
    }
    if (!layer.evidence || !layer.evidence.source) {
      fail(`song ${code}: layer missing evidence`)
    }
  }
}

// Extra entities must be exactly the test entities present in RAW.
const catalogTest = catalog.extra_entities.map(e => e.code).sort()

// Summary invariants that hold in both modes.
const s = catalog.summary
if (s.catalog_song_count !== expectedSongs.length) {
  fail(`catalog_song_count ${s.catalog_song_count} != music catalog ${expectedSongs.length}`)
}
const layeredCount = catalogSongs.filter(code =>
  catalog.songs[code].audio_layers.some(l => l.kind === 'unit-cue'),
).length
const oneshotCount = catalogSongs.filter(code =>
  catalog.songs[code].audio_layers.some(l => l.kind === 'oneshot-cue'),
).length
if (s.layered_song_count !== layeredCount) {
  fail(`layered_song_count ${s.layered_song_count} != derived ${layeredCount}`)
}
if (s.oneshot_song_count !== oneshotCount) {
  fail(`oneshot_song_count ${s.oneshot_song_count} != derived ${oneshotCount}`)
}

if (sourceOnly) {
  if (process.exitCode) process.exit(1)
  console.log(
    `Song audio relation catalog verified (source-only): ${s.catalog_song_count} songs, ` +
      `${s.layered_song_count} layered, ${s.oneshot_song_count} oneshot, ` +
      `${s.test_entity_count} test entities`,
  )
  process.exit(0)
}

const rawTest = acbFiles
  .map(name => name.replace(/\.acb$/, '').slice('song3_'.length).split('_')[0])
  .filter(code => code.startsWith('0') && /test$/.test(code))
  .filter((code, index, all) => all.indexOf(code) === index)
  .sort()
if (JSON.stringify(rawTest) !== JSON.stringify(catalogTest)) {
  fail(`test entity mismatch: RAW ${rawTest.join(',')} vs catalog ${catalogTest.join(',')}`)
}

if (s.acb_file_count !== acbFiles.length) {
  fail(`acb_file_count ${s.acb_file_count} != RAW ${acbFiles.length}`)
}
const expectedIdolFiles = [...rawIdolFiles.values()].reduce((a, b) => a + b, 0)
if (s.idol_vocal_file_count !== expectedIdolFiles) {
  fail(`idol_vocal_file_count ${s.idol_vocal_file_count} != RAW ${expectedIdolFiles}`)
}
const expectedBackingFiles = [...rawBackingFiles.values()].reduce((a, b) => a + b, 0)
if (s.bgm_backing_file_count !== expectedBackingFiles) {
  fail(`bgm_backing_file_count ${s.bgm_backing_file_count} != RAW ${expectedBackingFiles}`)
}

if (process.exitCode) {
  process.exit(1)
}
console.log(
  `Song audio relation catalog verified: ${s.catalog_song_count} songs / ${s.acb_file_count} ACB ` +
    `(idol ${s.idol_vocal_file_count}, backing ${s.bgm_backing_file_count}, ` +
    `layered ${s.layered_song_count}, oneshot ${s.oneshot_song_count})`,
)
