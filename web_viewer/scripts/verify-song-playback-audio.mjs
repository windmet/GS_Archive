#!/usr/bin/env node

import fs from 'node:fs'
import process from 'node:process'
import assert from 'node:assert/strict'
import { validateArchivePayload } from '../src/data/archiveDataContracts.js'
import vm from 'node:vm'
import { computed, ref, createSSRApp } from 'vue'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { renderToString } from '@vue/server-renderer'
import { buildSongPresentation } from '../src/presentation/SongPresentation.js'

const root = new URL('..', import.meta.url)
const mounted = process.argv.includes('--mounted')
const read = relative => fs.readFileSync(new URL(relative, root), 'utf8')
const manifest = JSON.parse(read('public/data/song_playback_audio.json'))
const musicCatalog = JSON.parse(read('public/data/masterdata/music_catalog.json'))
const experiment = JSON.parse(read('public/data/song_experimental_audio.json'))
const appSource = read('src/App.vue')
const catalog = JSON.parse(read('public/data/song_catalog.json'))
const identity = JSON.parse(read('public/data/masterdata/idol_unit_dictionary.json'))

validateArchivePayload('songPlaybackAudio', manifest)
assert.throws(() => validateArchivePayload('songPlaybackAudio', { ...manifest, status: 'experimental' }))

function fail(message) {
  throw new Error(`[song-playback-audio] ${message}`)
}

if (
  manifest.schema_version !== 1 ||
  manifest.status !== 'local-derived' ||
  JSON.stringify(manifest.scope) !== JSON.stringify(['song_detail'])
) {
  fail('manifest must retain the v1 local-derived song-detail contract')
}

const expectedCodes = Object.keys(musicCatalog.songs || {}).sort()
const actualCodes = Object.keys(manifest.songs || {}).sort()
if (expectedCodes.length !== 61 || JSON.stringify(actualCodes) !== JSON.stringify(expectedCodes)) {
  fail(`full-mix coverage must equal all 61 music catalog songs (found ${actualCodes.length})`)
}
if (manifest.summary?.catalog_songs !== 61 || manifest.summary?.full_mix_tracks !== 61) {
  fail('summary must report 61 catalog songs and 61 tracks')
}

for (const code of expectedCodes) {
  const entry = manifest.songs[code]
  const exactCue = `song3_${code}`
  const aliases = String(entry.source?.cue_name || '').split(';').map(value => value.trim())
  if (
    entry.song_code !== code ||
    entry.kind !== 'full-mix' ||
    entry.label !== '完整混音' ||
    entry.url !== `/assets/live-chibi/music/${code}.m4a` ||
    entry.source?.path !== `RAW/audio/song3_${code}.acb` ||
    !aliases.includes(exactCue)
  ) {
    fail(`${code}: identity, exact cue, source path, or URL drifted`)
  }
  if (
    !/^[a-f0-9]{64}$/.test(entry.source.sha256 || '') ||
    !/^[a-f0-9]{64}$/.test(entry.derived?.sha256 || '') ||
    entry.source.sample_rate <= 0 ||
    entry.source.samples <= 0 ||
    entry.derived?.bytes <= 0
  ) {
    fail(`${code}: source/derived evidence is incomplete`)
  }
  if ('vocal_settings' in entry || 'solo_tracks' in entry || 'unit_tracks' in entry) {
    fail(`${code}: ordinary playback manifest must not claim vocal-setting semantics`)
  }
}

const experimentalCodes = Object.keys(experiment.songs || {})
if (experimentalCodes.length !== 5) fail('the separate layered experiment must remain bounded to five songs')
const ordinaryCodes = expectedCodes.filter(code => !experiment.songs[code])
if (ordinaryCodes.length !== 56) fail(`expected 56 ordinary single-player songs, found ${ordinaryCodes.length}`)

// Execute the production App projection; the bounded song leaf owns playback.
const projection = appSource.match(/const currentSongPresentation = computed\([^]*?\n[^]*?: null\)/)?.[0]
assert.ok(projection, 'production song projection must be available')
const state = { computed, currentSongId: ref(''), songReadModelDetail: ref(null) }
const selected = vm.runInNewContext(`${projection}\ncurrentSongPresentation`, state)
const server = await createServer({ configFile: false, plugins: [vue()],
  server: { middlewareMode: true, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' })
try {
  const { default: Detail } = await server.ssrLoadModule('/src/components/archive/ArchiveSongDetail.vue')
  for (const code of expectedCodes) {
    const view = buildSongPresentation(catalog.songs[code], identity, {
      playbackTrack: manifest.songs[code], audioExperiment: experiment.songs[code],
    })
    assert.equal(view.playback.track?.url, manifest.songs[code].url)
    state.currentSongId.value = code
    state.songReadModelDetail.value = { id: code, view }
    assert.equal(selected.value?.playback.track?.url, manifest.songs[code].url)
    const html = await renderToString(createSSRApp(Detail, { song: selected.value }))
    if (ordinaryCodes.includes(code)) {
      assert.match(html, /class="[^"]*single-song-player/)
      const audio = html.match(/<audio\b[^>]*>/g) || []
      assert.equal(audio.length, 1, `${code}: exactly one ordinary audio element`)
      assert.ok(audio[0].includes(`src="${manifest.songs[code].url}"`))
      assert.ok(audio[0].includes('preload="metadata"'))
      assert.match(html, /歌曲播放/)
      assert.match(html, /完整混音试听/)
      assert.match(html, /aria-label="音频播放"/)
      assert.match(html, /aria-label="播放进度"/)
    } else {
      assert.ok(view.playback.experiment)
      assert.ok(!html.includes('single-song-player'), `${code}: experiment takes precedence`)
      assert.match(html, /class="[^"]*experimental-player/)
    }
    state.currentSongId.value = 'different-song'
    assert.equal(selected.value, null, 'a stale leaf must never supply another song audio')
  }
  const unavailable = buildSongPresentation(catalog.songs.brndnf, identity)
  assert.equal(unavailable.playback.track, null)
  const html = await renderToString(createSSRApp(Detail, { song: unavailable }))
  assert.ok(!html.includes('<audio'))
  assert.ok(!html.includes('single-song-player'))
} finally {
  await server.close()
}

if (mounted) {
  const base = process.env.SONG_PLAYBACK_BASE_URL || 'http://127.0.0.1:5174'
  for (const code of expectedCodes) {
    const response = await fetch(new URL(manifest.songs[code].url, base), { method: 'HEAD' })
    if (!response.ok) fail(`${code}: mounted track returned HTTP ${response.status}`)
  }
}

console.log(`Song playback audio contract OK: 61 full mixes / 56 ordinary players / 5 experiments; production projection and SSR, not decoded-media or Browser acceptance${mounted ? ' (mounted HTTP)' : ''}`)
