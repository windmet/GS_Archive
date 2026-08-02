#!/usr/bin/env node

import fs from 'node:fs'
import process from 'node:process'

const root = new URL('..', import.meta.url)
const mounted = process.argv.includes('--mounted')
const read = relative => fs.readFileSync(new URL(relative, root), 'utf8')
const manifest = JSON.parse(read('public/data/song_playback_audio.json'))
const musicCatalog = JSON.parse(read('public/data/masterdata/music_catalog.json'))
const experiment = JSON.parse(read('public/data/song_experimental_audio.json'))
const appSource = read('src/App.vue')
const detailSource = read('src/components/archive/ArchiveSongDetail.vue')
const playerSource = read('src/components/archive/ArchiveSongSinglePlayer.vue')
const repositorySource = read('src/data/ArchiveDataRepository.js')

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

for (const [label, source, needles] of [
  ['App', appSource, [
    ':playback-track="songPlaybackAudioData?.songs?.[currentSongId] || null"',
    'const songPlaybackAudioData = ref(null)',
    'songPlaybackAudioData.value = data.songPlaybackAudio',
  ]],
  ['ArchiveSongDetail', detailSource, [
    '<ArchiveSongExperimentalPlayer',
    'v-if="audioExperiment"',
    '<ArchiveSongSinglePlayer',
    'v-else-if="playbackTrack"',
    'playbackTrack: { type: Object, default: null }',
  ]],
  ['ordinary player', playerSource, [
    '<h3 id="song-single-player-title">歌曲播放</h3>',
    '这是普通单轨播放，不代表存在编成偶像、Unit 或 Center 声部',
    ':src="track.url"',
    'controls',
    'preload="metadata"',
    'aria-label="完整混音来源"',
    '@media (max-width: 560px)',
  ]],
  ['data repository', repositorySource, [
    "songPlaybackAudio: '/data/song_playback_audio.json'",
    "payload.status !== 'local-derived'",
    "throw new Error('songPlaybackAudio must include the 61-song local full-mix contract')",
  ]],
]) {
  for (const needle of needles) {
    if (!source.includes(needle)) fail(`${label} integration is missing: ${needle}`)
  }
}

if (mounted) {
  const base = process.env.SONG_PLAYBACK_BASE_URL || 'http://127.0.0.1:5174'
  for (const code of expectedCodes) {
    const response = await fetch(new URL(manifest.songs[code].url, base), { method: 'HEAD' })
    if (!response.ok) fail(`${code}: mounted track returned HTTP ${response.status}`)
  }
}

console.log(`Song playback audio contract OK: 61 full mixes / 56 ordinary players${mounted ? ' (mounted)' : ''}`)
