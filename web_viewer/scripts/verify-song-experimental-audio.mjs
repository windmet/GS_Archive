#!/usr/bin/env node

import fs from 'node:fs'
import process from 'node:process'

const mounted = process.argv.includes('--mounted')
const root = new URL('..', import.meta.url)
const manifestPath = new URL('public/data/song_experimental_audio.json', root)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const appSource = fs.readFileSync(new URL('src/App.vue', root), 'utf8')
const stageSource = fs.readFileSync(new URL('src/components/ChibiStageViewer.vue', root), 'utf8')
const detailPlayerSource = fs.readFileSync(new URL('src/components/archive/ArchiveSongExperimentalPlayer.vue', root), 'utf8')
const lineupPlayerSource = fs.readFileSync(new URL('src/components/archive/ArchiveSongLineupPlayer.vue', root), 'utf8')
const performanceSessionSource = fs.readFileSync(new URL('src/composables/useSongPerformanceSession.js', root), 'utf8')
const performanceDataSource = fs.readFileSync(new URL('src/utils/songPerformanceData.js', root), 'utf8')
const {
  activeLineupIdolCodes,
  buildSingerGateSchedule,
  uniqueLineupIdolCodes,
} = await import(new URL('src/composables/useSongPerformanceSession.js', root))

function fail(message) {
  throw new Error(`[song-experimental-audio] ${message}`)
}

if (manifest.schema_version !== 2 || manifest.status !== 'experimental' ||
    !Array.isArray(manifest.scope) || !manifest.scope.includes('song_detail') ||
    !manifest.scope.includes('chibi_stage')) {
  fail('manifest must be the v2 song-detail and Chibi-stage experimental contract')
}
const fullVocalSettingSongCodes = ['byndtd', 'drvalv', 'grwsml']
const expectedSongCodes = [...fullVocalSettingSongCodes, 'tkstp1', 'tkstp2']
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
    const delta = Number(solo.sync?.sample_delta)
    if (songCode === 'grwsml') {
      if (![-33700, -33724].includes(delta) || solo.sync?.status !== 'extra-vocal-tail-experimental') {
        fail(`${songCode}/${idolCode}: expected the audited bounded extra vocal tail`)
      }
    } else if (Math.abs(delta) > 1 || solo.sync?.status !== 'sample-aligned-experimental') {
      fail(`${songCode}/${idolCode}: solo/backing metadata must remain sample-aligned`)
    }
    mountedUrls.add(solo.vocal.url)
    mountedUrls.add(solo.backing.url)
  }
}
for (const songCode of fullVocalSettingSongCodes) {
  const entry = manifest.songs[songCode]
  const modeIds = new Set(entry.vocal_settings?.modes?.map(mode => mode.id) || [])
  for (const expectedMode of ['formation', 'unit', 'all_stars', 'center']) {
    if (!modeIds.has(expectedMode)) fail(`${songCode}: vocal setting ${expectedMode} is missing`)
  }
  if (entry.vocal_settings.status !== 'game-help-and-raw-convergent') {
    fail(`${songCode}: four-way vocal settings must retain convergent evidence status`)
  }
  if (!Array.isArray(entry.unit_tracks) || entry.unit_tracks.length !== 16) {
    fail(`${songCode}: expected all 16 Unit single-track candidates`)
  }
}
for (const songCode of ['tkstp1', 'tkstp2']) {
  const modeIds = new Set(manifest.songs[songCode].vocal_settings?.modes?.map(mode => mode.id) || [])
  if (JSON.stringify([...modeIds]) !== JSON.stringify(['formation'])) {
    fail(`${songCode}: must expose only Formation without claiming Center, Unit, or 315 ALL STARS settings`)
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
    '(!stageVocalEnabled.value || stageVocalReady.value)',
    'useSongPerformanceSession()',
    'stageVocalSession.configure({',
    "const stageVocalMode = computed(() => isSoloChoreography.value ? 'center-solo' : 'switch-singer')",
    'onStagePerformerSlots || [1]',
    'continuous: isSoloChoreography.value',
    "selectedSong.value?.vocalSetting?.mode === 'formation-or-all-stars'",
    '编成偶像：五人声部＋伴奏',
    'stageVocalSession.currentTime.value * 1000',
    'if (wasPlaying && stageVocalEnabled.value && stageVocalReady.value)',
    'data-stage-vocal-clock="stageVocalEnabled ? \'audio-context-scheduled\' : \'media-element\'"',
    'releaseStageVocalAudio()',
    '浏览器近似，不代表游戏官方混音参数',
  ]],
  ['song detail player', detailPlayerSource, [
    'ArchiveSongLineupPlayer',
    'data-vocal-setting-selector',
    '编成偶像（五槽合唱）',
    'Unit（组合单轨）',
    'Center（中心偶像＋伴奏）',
    '315 ALL STARS（完整混音候选）',
    '其他音轨（审计）',
    "if (mode.value === 'all_stars')",
    "if (mode.value === 'unit')",
    'useSongPerformanceSession()',
    'soloSession.configure({',
    'continuous: true',
    'data-solo-clock="mode === \'solo\' ? \'audio-context-scheduled\' : undefined"',
    '声部与伴奏已在播放前完整解码',
  ]],
  ['portal lineup player', lineupPlayerSource, [
    '<option value="">空位</option>',
    '重复偶像只播放一条声部',
    '五个选择位与 Chibi 舞台位置 1–5 完全对应',
    'stagePositionForSlot(slot)',
    'performerSlotForStagePosition(stagePosition)',
    'stageLineup.value[Number(stagePosition) - 1] = idolCode',
    'stageLineup.value[Number(stagePositionForSlot(performerSlot)) - 1]',
    ':data-active-stage-positions="activeStagePositions.join(\',\')"',
    "entry.positions?.length === props.audioExperiment.stage_vocal.slot_count",
    '&& !entry.variant',
    'activeSingerEntries',
    '当前演唱',
    'fetchSongPerformanceChoreography',
    'data-clock-mode="audio-context-scheduled"',
    '播放前完整解码',
  ]],
  ['shared performance session', performanceSessionSource, [
    'uniqueLineupIdolCodes(lineup.value)',
    'activeLineupIdolCodes(',
    '1 / Math.sqrt(active.size)',
    'currentSingerEvent.value?.performerSlots',
    'decodeAudioData(bytes)',
    'const startAt = ctx.currentTime + START_LEAD_SECONDS',
    'source.start(startAt, offset)',
    'gate.gain.setValueAtTime(',
    'source.playbackRate.value = playbackRate.value',
    'Math.max(0, entry.timeSeconds - offset) / playbackRate.value',
    'if (continuousVocals)',
    'gate.gain.setValueAtTime(1, startAt)',
  ]],
  ['lightweight performance data loader', performanceDataSource, [
    '/assets/live-chibi/choreography/index.json',
    'choreographyPromise',
  ]],
]) {
  for (const needle of needles) {
    if (!source.includes(needle)) fail(`${label} integration is missing: ${needle}`)
  }
}
if (lineupPlayerSource.includes('liveChibiSpine')) {
  fail('portal lineup player must not pull Pixi/Spine runtime into the archive bundle')
}
const duplicateAndEmptyLineup = ['001tom', '001tom', '', '004ter', '005kao']
if (JSON.stringify(uniqueLineupIdolCodes(duplicateAndEmptyLineup)) !==
    JSON.stringify(['001tom', '004ter', '005kao'])) {
  fail('duplicate/empty lineup must create exactly one media element per unique idol')
}
if (JSON.stringify(activeLineupIdolCodes(duplicateAndEmptyLineup, [1, 2, 3, 5])) !==
    JSON.stringify(['001tom', '005kao'])) {
  fail('active slots must OR duplicate idols and exclude empty slots')
}
const gateSchedule = buildSingerGateSchedule(duplicateAndEmptyLineup, [
  { time: 1000, performerSlots: [1, 2] },
  { time: 3000, performerSlots: [3, 5] },
  { time: 5000, performerSlots: [4, 5] },
], 2)
if (JSON.stringify(gateSchedule) !== JSON.stringify([
  { timeSeconds: 2, idolCodes: ['001tom'] },
  { timeSeconds: 3, idolCodes: ['005kao'] },
  { timeSeconds: 5, idolCodes: ['004ter', '005kao'] },
])) {
  fail('gate schedule must restore the state at seek time and preserve future switch times')
}
if (/new Audio\s*\(/.test(performanceSessionSource) || performanceSessionSource.includes('DRIFT_LIMIT_SECONDS') ||
    stageSource.includes('Math.abs(item.audio.currentTime - clockAudio.currentTime) > 0.08') ||
    detailPlayerSource.includes('Math.abs(backingAudio.value.currentTime - primary.currentTime) > 0.08') ||
    detailPlayerSource.includes('ref="vocalAudio"') || detailPlayerSource.includes('ref="backingAudio"')) {
  fail('layered portal and Chibi modes must not use independently clocked HTMLAudio tracks or drift repair')
}

if (mounted) {
  const base = process.env.SONG_EXPERIMENTAL_BASE_URL || 'http://127.0.0.1:5174'
  for (const path of mountedUrls) {
    const response = await fetch(new URL(path, base), { method: 'HEAD' })
    if (!response.ok) fail(`${path} returned HTTP ${response.status}`)
  }
}

console.log(`Song experimental audio contract OK${mounted ? ' (mounted)' : ''}`)
