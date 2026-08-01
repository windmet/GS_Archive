#!/usr/bin/env node

import fs from 'node:fs'
import process from 'node:process'

const mounted = process.argv.includes('--mounted')
const root = new URL('..', import.meta.url)
const manifestPath = new URL('public/data/song_experimental_audio.json', root)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const appSource = fs.readFileSync(new URL('src/App.vue', root), 'utf8')
const stageSource = fs.readFileSync(new URL('src/components/ChibiStageViewer.vue', root), 'utf8')

function fail(message) {
  throw new Error(`[song-experimental-audio] ${message}`)
}

if (manifest.schema_version !== 2 || manifest.status !== 'experimental' ||
    !Array.isArray(manifest.scope) || !manifest.scope.includes('song_detail') ||
    !manifest.scope.includes('chibi_stage')) {
  fail('manifest must be the v2 song-detail and Chibi-stage experimental contract')
}
const expectedSongCodes = ['drvalv', 'tkstp1', 'tkstp2']
const mountedUrls = new Set()
for (const songCode of expectedSongCodes) {
  const entry = manifest.songs?.[songCode]
  if (!entry) fail(`${songCode} sample is missing`)
  if (!entry.single_tracks?.full_mix?.url) fail(`${songCode} full-mix single track is missing`)
  if (!entry.backing?.url) fail(`${songCode} backing track is missing`)
  if (entry.stage_vocal?.mode !== 'parallel-performer-slots' || entry.stage_vocal?.slot_count !== 5) {
    fail(`${songCode} five-slot stage-vocal contract is missing`)
  }
  if (entry.stage_vocal?.mix_policy?.status !== 'browser-approximation') {
    fail(`${songCode} must label its stage mix as a browser approximation`)
  }
  const soloEntries = Object.entries(entry.solo_tracks || {})
  if (soloEntries.length !== 49) {
    fail(`${songCode}: expected all 49 idol vocal candidates, found ${soloEntries.length}`)
  }
  mountedUrls.add(entry.single_tracks.full_mix.url)
  mountedUrls.add(entry.backing.url)
  for (const [idolCode, solo] of soloEntries) {
    if (!solo.vocal?.url) fail(`${songCode}/${idolCode} vocal track is missing`)
    if (!solo.backing?.url) fail(`${songCode}/${idolCode} backing relation is missing`)
    if (solo.sync?.sample_delta > 1 || solo.sync?.sample_delta < -1) {
      fail(`${songCode}/${idolCode} solo/backing metadata delta exceeds one sample`)
    }
    mountedUrls.add(solo.vocal.url)
    mountedUrls.add(solo.backing.url)
  }
}
if (!Array.isArray(manifest.songs.drvalv.unit_tracks) || manifest.songs.drvalv.unit_tracks.length < 1) {
  fail('no DRIVE A LIVE unit single-track candidate is listed')
}

for (const [label, source, needles] of [
  ['App', appSource, [':audio-experiments="songExperimentalAudioData?.songs || {}"']],
  ['Chibi stage', stageSource, [
    "currentSingerEvent.value?.performerSlots",
    'stagePositionForPerformerSlot',
    'stageVocalBusGain.value / Math.sqrt(activeSlots.size)',
    '(!stageVocalEnabled.value || stageVocalReady.value)',
    'Math.abs(item.audio.currentTime - clockAudio.currentTime) > 0.08',
    'releaseStageVocalAudio()',
    '浏览器近似，不代表游戏官方混音参数',
  ]],
]) {
  for (const needle of needles) {
    if (!source.includes(needle)) fail(`${label} integration is missing: ${needle}`)
  }
}

if (mounted) {
  const base = process.env.SONG_EXPERIMENTAL_BASE_URL || 'http://127.0.0.1:5174'
  for (const path of mountedUrls) {
    const response = await fetch(new URL(path, base), { method: 'HEAD' })
    if (!response.ok) fail(`${path} returned HTTP ${response.status}`)
  }
}

console.log(`Song experimental audio contract OK${mounted ? ' (mounted)' : ''}`)
