import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const choreographyPath = join(root, 'public/assets/live-chibi/choreography/index.json')
const audioPath = join(root, 'public/data/song_playback_audio.json')
const catalogPath = join(root, 'public/data/song_catalog.json')
const output = join(root, 'public/data/song_timelines')
const entriesPath = join(output, 'entries')
const check = process.argv.includes('--check')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const json = value => `${JSON.stringify(value)}\n`
const choreographyBytes = readFileSync(choreographyPath)
const audioBytes = readFileSync(audioPath)
const catalogBytes = readFileSync(catalogPath)
const choreography = JSON.parse(choreographyBytes)
const audio = JSON.parse(audioBytes)
const catalog = JSON.parse(catalogBytes)
if (!Array.isArray(choreography.songs) || !audio.songs || typeof audio.songs !== 'object' ||
    !catalog.songs || typeof catalog.songs !== 'object') {
  throw new Error('Song timeline source shape changed')
}

const indexSha256 = hash(choreographyBytes)
const audioCatalogSha256 = hash(audioBytes)
const songCatalogSha256 = hash(catalogBytes)
const projected = new Map()
const bySongCode = {}
for (const entry of [...choreography.songs].sort((left, right) => left.id.localeCompare(right.id))) {
  const { id, songCode, variant = '', title, source, startTime, duration } = entry
  if (!/^[a-z0-9_]+$/.test(id) || !/^[a-z0-9]+$/.test(songCode) || projected.has(id)) {
    throw new Error(`Invalid or duplicate choreography identity: ${id}`)
  }
  if (!Number.isFinite(startTime) || !Number.isFinite(duration) || duration < 0 ||
      !Array.isArray(entry.lyricEvents) || !Array.isArray(entry.singerEvents)) {
    throw new Error(`Invalid timeline shape: ${id}`)
  }
  for (const event of entry.lyricEvents) {
    if (!Number.isFinite(event.time) || !Number.isFinite(event.duration) || event.duration < 0 || typeof event.text !== 'string') {
      throw new Error(`Invalid lyric event: ${id}`)
    }
  }
  for (const event of entry.singerEvents) {
    if (!Number.isFinite(event.time) || !Array.isArray(event.performerSlots) || !Array.isArray(event.stagePositions)) {
      throw new Error(`Invalid singer event: ${id}`)
    }
  }
  const fullMix = audio.songs[songCode]
  const audioRef = fullMix?.kind === 'full-mix' ? {
    url: fullMix.url,
    sourceSha256: fullMix.source?.sha256 || null,
    derivedSha256: fullMix.derived?.sha256 || null,
    durationSeconds: fullMix.source?.duration_seconds || null,
  } : null
  const audioResource = audioRef?.url && existsSync(join(root, 'public', audioRef.url.replace(/^\//, '')))
    ? 'local_present' : 'not_found'
  const stageKind = songCode === 'drv999' ? 'special_single' : 'choreography_candidate'
  const detail = {
    schemaVersion: 1, id, songCode, variant, title,
    source: { liveEffectCsv: source, indexSha256, entrySha256: hash(JSON.stringify(entry)), audioCatalogSha256 },
    timeUnit: 'ms', startTimeMs: startTime, durationMs: duration,
    positions: entry.positions, performerSlots: entry.performerSlots,
    stagePositionMap: entry.stagePositionMap,
    singerEvents: entry.singerEvents, lyricEvents: entry.lyricEvents,
    audioRef,
    timelineToAudio: { status: 'unverified', offsetMs: null },
    capabilities: {
      audio: { evidence: audioRef ? 'full_mix_catalog' : 'none', resource: audioResource, tested: 'not_tested' },
      lyrics: { evidence: entry.lyricEvents.length ? 'timed_source' : 'none', alignment: 'unverified', tested: 'not_tested' },
      stage: { kind: stageKind, evidence: 'live_effect_index', resource: 'not_assessed', tested: 'not_tested' },
    },
  }
  projected.set(`${id}.json`, json(detail))
  if (!bySongCode[songCode]) bySongCode[songCode] = []
  bySongCode[songCode].push({
    id, variant, url: `/data/song_timelines/entries/${id}.json`,
    entrySha256: detail.source.entrySha256,
    lyricCount: entry.lyricEvents.length, singerCount: entry.singerEvents.length,
    stageKind, audioResource,
  })
}

const unmappedSongs = Object.fromEntries(Object.entries(catalog.songs)
  .filter(([songCode]) => !bySongCode[songCode])
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([songCode, song]) => [songCode, { title: song.title, reason: 'no_choreography_entry' }]))

const manifest = {
  schemaVersion: 1,
  source: { indexSha256, audioCatalogSha256, songCatalogSha256 },
  timeUnit: 'ms',
  songCount: Object.keys(bySongCode).length,
  arrangementCount: projected.size,
  unmappedSongs,
  songs: Object.fromEntries(Object.entries(bySongCode).sort(([left], [right]) => left.localeCompare(right))),
}
if (check) {
  const expectedFiles = [...projected.keys()].sort()
  const actualFiles = readdirSync(entriesPath).filter(name => name.endsWith('.json')).sort()
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new Error('Generated timeline entry set is stale')
  if (readFileSync(join(output, 'manifest.json'), 'utf8') !== json(manifest)) throw new Error('Generated timeline manifest is stale')
  for (const [name, content] of projected) {
    if (readFileSync(join(entriesPath, name), 'utf8') !== content) throw new Error(`Generated timeline is stale: ${name}`)
  }
} else {
  mkdirSync(entriesPath, { recursive: true })
  const existing = readdirSync(entriesPath).filter(name => name.endsWith('.json'))
  const unexpected = existing.filter(name => !projected.has(name))
  if (unexpected.length) throw new Error(`Review obsolete timeline files before regeneration: ${unexpected.join(', ')}`)
  writeFileSync(join(output, 'manifest.json'), json(manifest))
  for (const [name, content] of projected) writeFileSync(join(entriesPath, name), content)
}
console.log(`Song timelines ${check ? 'verified' : 'generated'}: ${manifest.songCount} songs, ${manifest.arrangementCount} arrangements, ${[...projected.values()].reduce((sum, item) => sum + Buffer.byteLength(item), 0)} detail bytes`)
