import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'

const root = resolve(import.meta.dirname, '..')
const read = path => JSON.parse(readFileSync(join(root, path), 'utf8'))
const sha256 = input => createHash('sha256').update(input).digest('hex')
const sourcePath = 'public/assets/live-chibi/choreography/index.json'
const audioPath = 'public/data/song_playback_audio.json'
const catalogPath = 'public/data/song_catalog.json'
const source = read(sourcePath)
const audio = read(audioPath)
const catalog = read(catalogPath)
const manifest = read('public/data/song_timelines/manifest.json')
const validator = new Ajv2020({ allErrors: true })
const validateManifest = validator.compile(read('schemas/song-timeline-manifest-v1.schema.json'))
const validateTimeline = validator.compile(read('schemas/song-timeline-v1.schema.json'))
assert.ok(validateManifest(manifest), JSON.stringify(validateManifest.errors))
assert.equal(manifest.schemaVersion, 1)
assert.equal(manifest.timeUnit, 'ms')
assert.equal(manifest.source.indexSha256, sha256(readFileSync(join(root, sourcePath))))
assert.equal(manifest.source.audioCatalogSha256, sha256(readFileSync(join(root, audioPath))))
assert.equal(manifest.source.songCatalogSha256, sha256(readFileSync(join(root, catalogPath))))
assert.equal(manifest.arrangementCount, source.songs.length)
assert.equal(manifest.songCount, new Set(source.songs.map(entry => entry.songCode)).size)
assert.deepEqual(manifest.unmappedSongs, Object.fromEntries(Object.entries(catalog.songs)
  .filter(([songCode]) => !source.songs.some(entry => entry.songCode === songCode))
  .map(([songCode, song]) => [songCode, { title: song.title, reason: 'no_choreography_entry' }])))
assert.deepEqual(manifest.unmappedSongs.reason, { title: 'Reason!!', reason: 'no_choreography_entry' })

const sourceById = new Map(source.songs.map(entry => [entry.id, entry]))
const allRefs = Object.values(manifest.songs).flat()
assert.equal(allRefs.length, source.songs.length)
assert.equal(new Set(allRefs.map(entry => entry.id)).size, allRefs.length)
for (const ref of allRefs) {
  const original = sourceById.get(ref.id)
  assert.ok(original, `unknown timeline ${ref.id}`)
  const detail = read(`public${ref.url}`)
  assert.ok(validateTimeline(detail), `${ref.id}: ${JSON.stringify(validateTimeline.errors)}`)
  assert.equal(detail.schemaVersion, 1)
  assert.equal(detail.id, original.id)
  assert.equal(detail.songCode, original.songCode)
  assert.equal(detail.variant, original.variant || '')
  assert.equal(detail.timeUnit, 'ms')
  assert.equal(detail.startTimeMs, original.startTime, `negative start preserved: ${ref.id}`)
  assert.equal(detail.durationMs, original.duration, `zero duration preserved: ${ref.id}`)
  assert.deepEqual(detail.positions, original.positions)
  assert.deepEqual(detail.performerSlots, original.performerSlots)
  assert.deepEqual(detail.stagePositionMap, original.stagePositionMap)
  assert.deepEqual(detail.singerEvents, original.singerEvents, `singer event order preserved: ${ref.id}`)
  assert.deepEqual(detail.lyricEvents, original.lyricEvents, `timed text and overlap preserved: ${ref.id}`)
  assert.equal(detail.source.entrySha256, sha256(JSON.stringify(original)))
  assert.equal(ref.entrySha256, detail.source.entrySha256)
  assert.equal(detail.source.indexSha256, manifest.source.indexSha256)
  assert.equal(detail.source.audioCatalogSha256, manifest.source.audioCatalogSha256)
  assert.equal(ref.lyricCount, original.lyricEvents.length)
  assert.equal(ref.singerCount, original.singerEvents.length)
  assert.equal(detail.audioRef?.url, audio.songs[original.songCode]?.url)
  assert.equal(detail.audioRef?.derivedSha256, audio.songs[original.songCode]?.derived?.sha256)
  assert.deepEqual(detail.timelineToAudio, { status: 'unverified', offsetMs: null },
    `no unmeasured lyric alignment: ${ref.id}`)
  assert.equal(detail.capabilities.lyrics.alignment, 'unverified')
  assert.equal(detail.capabilities.audio.tested, 'not_tested')
  assert.equal(detail.capabilities.stage.tested, 'not_tested')
}
const special = read('public/data/song_timelines/entries/drv999_live_effect.json')
assert.equal(special.durationMs, 0)
assert.equal(special.capabilities.stage.kind, 'special_single')
assert.equal(special.positions.length, 1)
assert.equal(special.lyricEvents.length, 21)
assert.ok(source.songs.every(entry => entry.startTime < 0), 'negative source starts are a real production case')
assert.ok(source.songs.some(entry => entry.lyricEvents.some((event, index, events) =>
  index > 0 && event.time < events[index - 1].time + events[index - 1].duration)),
  'overlapping lyric windows are a real production case')

const previousFetch = globalThis.fetch
const requested = []
globalThis.fetch = async url => {
  requested.push(url)
  const path = `public${url}`
  try { return { ok: true, json: async () => read(path) } }
  catch { return { ok: false, status: 404 } }
}
try {
  const api = await import(`../src/utils/songPerformanceData.js?timeline-probe=${Date.now()}`)
  const arrangements = await api.fetchSongPerformanceArrangements('drvalv')
  assert.equal(arrangements.length, 1, 'lineup needs only the base arrangement')
  assert.equal(arrangements[0].id, 'drvalv_live_effect')
  assert.deepEqual(requested, [
    '/data/song_timelines/manifest.json',
    '/data/song_timelines/entries/drvalv_live_effect.json',
  ], 'lineup must not fetch the 8 MiB choreography index or all variants')
  assert.deepEqual(await api.fetchSongPerformanceArrangements('unknown'), [])
  assert.equal(await api.fetchSongTimeline('not_registered'), null)
  assert.equal(requested.length, 2, 'unknown ids cannot request arbitrary paths')
  const drv = await api.fetchSongTimeline('drv999_live_effect')
  assert.equal(drv.capabilities.stage.kind, 'special_single')

  let failOnce = true
  globalThis.fetch = async url => {
    if (url.endsWith('/brndnf_live_effect.json') && failOnce) {
      failOnce = false
      return { ok: false, status: 503 }
    }
    return { ok: true, json: async () => read(`public${url}`) }
  }
  await assert.rejects(api.fetchSongTimeline('brndnf_live_effect'), /503/)
  assert.equal((await api.fetchSongTimeline('brndnf_live_effect')).id, 'brndnf_live_effect',
    'failed detail request must be retryable')
} finally {
  globalThis.fetch = previousFetch
}
const sourceBytes = statSync(join(root, sourcePath)).size
const manifestBytes = statSync(join(root, 'public/data/song_timelines/manifest.json')).size
const baseBytes = statSync(join(root, 'public/data/song_timelines/entries/drvalv_live_effect.json')).size
assert.ok(manifestBytes + baseBytes < sourceBytes / 20, 'lineup path should be materially smaller than full index')
console.log(`Song timeline projection verified: ${manifest.songCount} songs, ${manifest.arrangementCount} arrangements; lineup ${manifestBytes + baseBytes} bytes vs source ${sourceBytes} bytes`)
