import { computed, nextTick, onBeforeUnmount, reactive, ref, toValue, watch } from 'vue'
import { useSongPerformanceSession } from './useSongPerformanceSession.js'
import { fetchSongPerformanceArrangements } from '../utils/songPerformanceData.js'
import { createSongStageHandoff } from '../core/songStageHandoff.js'

const STAGE_POSITIONS = [1, 2, 3, 4, 5]
const PERFORMER_SLOTS = [1, 2, 3, 4, 5]

function readStorage(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// One owner for a stem song's audition: which version plays, the five-slot lineup, the transport and the
// stage handoff. The version panel and the console are two views of this state; neither keeps its own copy.
export function useSongAudition(experimentSource, { idolName = () => '' } = {}) {
  const experiment = computed(() => toValue(experimentSource) || null)
  const songCode = computed(() => experiment.value?.song_code || '')
  const label = entry => (entry?.idol_code && idolName(entry.idol_code, entry.displayName)) || entry?.displayName || '姓名待确认'

  // ── Versions ────────────────────────────────────────────────────────────
  const hasVocalSetting = id => (experiment.value?.vocal_settings?.modes || []).some(entry => entry.id === id)
  const soloEntries = computed(() => Object.values(experiment.value?.solo_tracks || {}))
  const unitOptions = computed(() => (experiment.value?.unit_tracks || []).map(track => ({ key: `unit:${track.unit_code}`, ...track })))
  const trackOptions = computed(() => {
    const source = experiment.value || {}
    const options = []
    if (source.single_tracks?.full_mix && !hasVocalSetting('all_stars')) options.push({ key: 'full_mix', ...source.single_tracks.full_mix })
    if (source.backing) options.push({ key: 'backing', ...source.backing, label: '伴奏' })
    for (const track of source.special_tracks || []) options.push({ key: `special:${track.song_code}`, ...track, label: `特殊版：${track.label}` })
    return options
  })
  const modes = computed(() => [
    ...(hasVocalSetting('all_stars') ? [{ id: 'all_stars', label: '全员合唱' }] : []),
    ...(hasVocalSetting('unit') && unitOptions.value.length ? [{ id: 'unit', label: '组合预设' }] : []),
    ...(hasVocalSetting('formation') ? [{ id: 'lineup', label: '自由编成 · 5 槽' }] : []),
    ...(hasVocalSetting('center') && soloEntries.value.length ? [{ id: 'solo', label: 'Solo 试听' }] : []),
    ...(trackOptions.value.length ? [{ id: 'single', label: '收录音轨' }] : []),
  ])
  const mode = ref('single')
  const unitKey = ref('')
  const trackKey = ref('')
  const idolCode = ref('')
  const soloStorageKey = () => `sidem:song-solo:${songCode.value}`

  // Every tab switches at once; a mode that needs a choice starts on its remembered or first one.
  function chooseMode(id) {
    if (!modes.value.some(item => item.id === id)) return
    if (id === 'solo' && !experiment.value?.solo_tracks?.[idolCode.value]) idolCode.value = soloEntries.value[0]?.idol_code || ''
    mode.value = id
  }
  function selectSolo(id) {
    if (!hasVocalSetting('center') || !experiment.value?.solo_tracks?.[id]) return
    idolCode.value = id
    writeStorage(soloStorageKey(), id)
    mode.value = 'solo'
  }
  const isSingleTrackMode = computed(() => ['all_stars', 'unit', 'single'].includes(mode.value))
  const currentTrack = computed(() => {
    if (mode.value === 'all_stars') return experiment.value?.single_tracks?.full_mix || null
    if (mode.value === 'unit') return unitOptions.value.find(option => option.key === unitKey.value) || unitOptions.value[0] || null
    if (mode.value === 'single') return trackOptions.value.find(option => option.key === trackKey.value) || trackOptions.value[0] || null
    return null
  })
  const currentSoloTrack = computed(() => experiment.value?.solo_tracks?.[idolCode.value] || null)

  // ── Single track (all stars, unit preset, collected tracks) ──────────────
  const singleTime = ref(0), singleDuration = ref(0), singlePlaying = ref(false), singleVolume = ref(1)
  const error = ref('')
  let audio = null
  function singleAudio() {
    if (audio || typeof globalThis.document?.createElement !== 'function') return audio
    audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.addEventListener('loadedmetadata', () => { singleDuration.value = Number.isFinite(audio.duration) ? audio.duration : 0 })
    audio.addEventListener('timeupdate', () => { singleTime.value = audio.currentTime })
    audio.addEventListener('ended', () => { singlePlaying.value = false })
    audio.addEventListener('error', () => { if (audio.getAttribute('src')) error.value = '音轨暂时无法读取，请重新选择或稍后重试。' })
    audio.volume = singleVolume.value
    return audio
  }
  watch(singleVolume, value => { if (audio) audio.volume = value })
  function stopSingle() {
    if (audio) { audio.pause(); audio.currentTime = 0 }
    singlePlaying.value = false
    singleTime.value = 0
  }

  // ── Solo: vocal and backing decoded up front, started on one AudioContext clock ──
  const soloSession = useSongPerformanceSession()

  // ── Five-slot lineup ────────────────────────────────────────────────────
  const lineupSession = useSongPerformanceSession()
  const arrangements = ref([])
  const arrangementId = ref('')
  const stageLineup = ref(['', '', '', '', ''])
  const loadingTimeline = ref(false)
  // Nothing downloads until the reader picks an idol in this visit (or asks to load a remembered lineup).
  const armed = ref(false)
  let arrangementsFor = '', arrangementsLoad = Promise.resolve(), loadGeneration = 0, disposed = false

  const selectedArrangement = computed(() => arrangements.value.find(entry => entry.id === arrangementId.value) || null)
  function stagePositionForSlot(performerSlot) {
    return selectedArrangement.value?.stagePositionMap?.find(item => Number(item.performerSlot) === Number(performerSlot))?.stagePosition || performerSlot
  }
  function performerSlotForStagePosition(stagePosition) {
    return selectedArrangement.value?.stagePositionMap?.find(item => Number(item.stagePosition) === Number(stagePosition))?.performerSlot || stagePosition
  }
  const idolForStagePosition = stagePosition => stageLineup.value[Number(stagePosition) - 1] || ''
  const slotName = stagePosition => label(experiment.value?.solo_tracks?.[idolForStagePosition(stagePosition)])
  const filledCount = computed(() => stageLineup.value.filter(Boolean).length)
  const selectedIdolCodes = computed(() => [...new Set(stageLineup.value.filter(Boolean))])
  const vocalUrl = code => experiment.value?.solo_tracks?.[code]?.vocal?.url || ''
  const trackUrls = computed(() => selectedIdolCodes.value.length
    ? [experiment.value?.backing?.url, ...selectedIdolCodes.value.map(vocalUrl)].filter(Boolean)
    : [])
  const readyCount = computed(() => trackUrls.value.filter(url => lineupSession.bufferStates.value[url] === 'ready').length)
  // Measured tracks run 2.6–3.1 MB (vocals) and 2.7–3.2 MB (backing); 3 MB each is the honest round figure.
  const estimatedMegabytes = computed(() => trackUrls.value.length * 3)
  const activeStagePositions = computed(() => lineupSession.activePerformerSlots.value.map(stagePositionForSlot).sort((a, b) => a - b))
  const activeSingers = computed(() => {
    const byIdol = new Map()
    for (const slot of lineupSession.activePerformerSlots.value) {
      const stagePosition = stagePositionForSlot(slot)
      const code = stageLineup.value[Number(stagePosition) - 1]
      if (!code) continue
      if (!byIdol.has(code)) byIdol.set(code, { idolCode: code, name: label(experiment.value?.solo_tracks?.[code]), stagePositions: [] })
      byIdol.get(code).stagePositions.push(stagePosition)
    }
    return [...byIdol.values()]
  })
  function slotState(stagePosition) {
    const code = idolForStagePosition(stagePosition)
    if (!code) return 'empty'
    if (!armed.value) return 'remembered'
    return lineupSession.bufferStates.value[vocalUrl(code)] || 'loading'
  }
  function slotStatusLabel(stagePosition) {
    if (activeStagePositions.value.includes(stagePosition) && lineupSession.playing.value) return '正在演唱'
    return ({ empty: '空位', remembered: '上次的编成', loading: '载入中…', ready: '已就绪', error: '载入失败，点此重选' })[slotState(stagePosition)]
  }
  const lineupStorageKey = () => `sidem:song-lineup:${songCode.value}`
  function rememberedLineup() {
    const value = readStorage(lineupStorageKey())
    if (Array.isArray(value) && value.length === 5) return value.map(code => (code && experiment.value?.solo_tracks?.[code] ? code : ''))
    return ['', '', '', '', '']
  }
  function nextEmptyStagePosition(after = 0) {
    const order = [...STAGE_POSITIONS.filter(position => position > after), ...STAGE_POSITIONS.filter(position => position <= after)]
    return order.find(position => !idolForStagePosition(position)) || 0
  }
  async function assignStagePosition(stagePosition, code) {
    const lineup = [...stageLineup.value]
    lineup[Number(stagePosition) - 1] = code
    stageLineup.value = lineup
    writeStorage(lineupStorageKey(), lineup)
    if (code) armed.value = true
    await syncLineup()
  }
  // Downloads follow the picks: each chosen idol's vocal (and the backing once anyone is chosen) starts
  // at selection; tracks of idols taken out are dropped. The graph is built only when all five are set.
  async function syncLineup() {
    lineupSession.retainBuffers(armed.value ? trackUrls.value : [])
    if (!armed.value) return
    lineupSession.prefetch(trackUrls.value)
    if (filledCount.value === 5) await configureLineup()
    else lineupSession.release({ resetTime: false })
  }
  async function arm() {
    armed.value = true
    await syncLineup()
  }
  async function selectArrangement(id) {
    if (id === arrangementId.value || !arrangements.value.some(entry => entry.id === id)) return
    arrangementId.value = id
    await syncLineup()
  }
  async function configureLineup() {
    if (filledCount.value < 5) return
    const arrangement = selectedArrangement.value
    if (!arrangement) {
      lineupSession.release()
      lineupSession.error.value = '当前歌曲没有可用的五槽演唱切换表。'
      return
    }
    await lineupSession.configure({
      experiment: experiment.value,
      events: arrangement.singerEvents,
      performerLineup: PERFORMER_SLOTS.map(performerSlot => stageLineup.value[Number(stagePositionForSlot(performerSlot)) - 1] || ''),
    })
  }
  function loadArrangements() {
    const source = experiment.value
    if (!source || arrangementsFor === source.song_code) return arrangementsLoad
    arrangementsFor = source.song_code
    const generation = ++loadGeneration
    arrangementsLoad = (async () => {
      loadingTimeline.value = true
      try {
        const timelines = await fetchSongPerformanceArrangements(source.song_code)
        if (disposed || generation !== loadGeneration) return
        arrangements.value = timelines.filter(entry => (
          entry.songCode === source.song_code
          && !entry.variant
          && Array.isArray(entry.singerEvents)
          && entry.singerEvents.length > 0
          && entry.performerSlots?.length === source.stage_vocal.slot_count
          && entry.positions?.length === source.stage_vocal.slot_count
        ))
        arrangementId.value = arrangements.value[0]?.id || ''
        if (!selectedArrangement.value) lineupSession.error.value = '当前歌曲没有可用的五槽演唱切换表。'
      } catch (failure) {
        if (!disposed && generation === loadGeneration) lineupSession.error.value = `演唱切换表读取失败：${failure.message || failure}`
      } finally {
        if (!disposed && generation === loadGeneration) loadingTimeline.value = false
      }
    })()
    return arrangementsLoad
  }
  // Entering the lineup shows the remembered picks without downloading them; leaving it drops its tracks.
  function enterLineup() {
    stageLineup.value = rememberedLineup()
    armed.value = false
    loadArrangements()
  }
  function leaveLineup() {
    lineupSession.release()
    lineupSession.retainBuffers([])
    armed.value = false
  }

  // ── Transport: one face for whichever engine the mode uses ───────────────
  const engine = computed(() => (mode.value === 'solo' ? 'solo' : mode.value === 'lineup' ? 'lineup' : 'single'))
  const session = () => (engine.value === 'solo' ? soloSession : lineupSession)
  const ready = computed(() => engine.value === 'single' ? Boolean(currentTrack.value?.url) : session().ready.value)
  const playing = computed(() => engine.value === 'single' ? singlePlaying.value : session().playing.value || session().starting.value)
  const currentTime = computed(() => engine.value === 'single' ? singleTime.value : session().currentTime.value)
  const duration = computed(() => engine.value === 'single' ? singleDuration.value : session().duration.value)
  const vocalGain = computed({ get: () => session().vocalGain.value, set: value => { session().vocalGain.value = value } })
  const backingGain = computed({ get: () => session().backingGain.value, set: value => { session().backingGain.value = value } })
  const failure = computed(() => error.value || (engine.value === 'single' ? '' : session().error.value || ''))

  async function toggle() {
    error.value = ''
    if (engine.value !== 'single') {
      const target = session()
      if (target.playing.value || target.starting.value) target.pause()
      else if (!await target.play() && engine.value === 'solo') error.value = target.error.value
      return
    }
    const element = singleAudio()
    if (!element?.getAttribute('src')) { error.value = '当前试听资源暂时不可用，请稍后重试。'; return }
    if (singlePlaying.value) { element.pause(); singlePlaying.value = false; return }
    try {
      element.currentTime = singleTime.value
      await element.play()
      singlePlaying.value = true
    } catch (rejection) {
      console.warn('[song-audition] play rejected', rejection)
      error.value = '浏览器没有允许播放，请再点一次播放。'
      singlePlaying.value = false
    }
  }
  function seek(seconds) {
    const next = Number(seconds)
    if (engine.value !== 'single') { session().seek(next); return }
    if (audio) audio.currentTime = next
    singleTime.value = next
  }
  function restart() {
    if (engine.value !== 'single') { session().reset(); return }
    stopSingle()
  }
  function pause() {
    audio?.pause()
    singlePlaying.value = false
    soloSession.pause()
    lineupSession.pause()
  }

  // What the console says is playing, in one line.
  const nowPlaying = computed(() => {
    if (mode.value === 'all_stars') return '全员合唱'
    if (mode.value === 'unit') return `组合预设 · ${currentTrack.value?.label || '未选择'}`
    if (mode.value === 'solo') return `Solo · ${label(currentSoloTrack.value)}`
    if (mode.value === 'single') return currentTrack.value?.label || '收录音轨'
    if (filledCount.value < 5) return `自由编成 · 已选 ${filledCount.value}/5`
    if (!armed.value) return '自由编成 · 上次的编成'
    if (!lineupSession.ready.value) return `自由编成 · 载入中 ${readyCount.value}/${trackUrls.value.length}`
    return '自由编成 · 五人已就绪'
  })
  const lyrics = computed(() => mode.value === 'lineup'
    ? { key: 'lineup', audioUrl: '', stageClock: true, sourceTimeline: selectedArrangement.value, ready: lineupSession.ready.value }
    : { key: 'track', audioUrl: isSingleTrackMode.value ? currentTrack.value?.url || '' : '', stageClock: ['solo', 'unit'].includes(mode.value), sourceTimeline: null,
        ready: ready.value && duration.value > 0 && !failure.value })
  const evidence = computed(() => {
    if (mode.value === 'lineup') return '所有轨道会在播放前完整解码，并由同一个音频时钟同步启动、预排演唱切换；当前混音采用活动偶像数的 1/√n 归一化与居中声像，仅为浏览器近似。重复选择不代表原游戏允许重复成员编组。'
    if (mode.value !== 'solo') return '单轨，无需双轨同步；实验状态仍未完成完整听感校准。'
    const delta = currentSoloTrack.value?.sync?.sample_delta
    return `${delta == null ? '未提供双轨元数据' : `44.1 kHz，声部与伴奏差 ${delta} sample`}。声部与伴奏已在播放前完整解码，并由同一个 AudioContext 时钟同步启动。混音仍为浏览器实验值。`
  })

  // The console's stage button carries a loaded lineup; everything else opens the default choreography.
  const stageTarget = computed(() => {
    if (mode.value !== 'lineup' || !lineupSession.ready.value || selectedArrangement.value?.capabilities?.stage?.kind !== 'choreography_candidate') return null
    const handoff = createSongStageHandoff({
      songCode: songCode.value,
      arrangement: selectedArrangement.value,
      stageLineup: stageLineup.value,
      audioExperiment: experiment.value,
      vocalGain: lineupSession.vocalGain.value,
      backingGain: lineupSession.backingGain.value,
      sourceTimeSeconds: lineupSession.currentTime.value,
    })
    return handoff ? { songCode: handoff.songCode, choreographyId: handoff.choreographyId, stageHandoff: handoff } : null
  })

  async function reloadSources() {
    stopSingle()
    soloSession.reset()
    error.value = ''
    if (mode.value !== 'lineup') leaveLineup()
    if (mode.value === 'solo') {
      if (!experiment.value || !currentSoloTrack.value?.vocal?.url) {
        soloSession.release()
        error.value = '当前偶像缺少 Solo 声部或伴奏资源。'
        return
      }
      await soloSession.configure({ experiment: experiment.value, events: [], performerLineup: [idolCode.value], continuous: true })
      error.value = soloSession.error.value
      return
    }
    soloSession.release()
    if (mode.value === 'lineup') return
    await nextTick()
    const element = singleAudio()
    if (!element) return
    singleDuration.value = 0
    const url = currentTrack.value?.url || ''
    if (url) element.setAttribute('src', url)
    else element.removeAttribute('src')
    element.load()
  }
  watch(mode, (next, previous) => { if (next === 'lineup' && previous !== 'lineup') enterLineup() })
  watch([mode, trackKey, unitKey, idolCode], reloadSources)
  watch(experiment, async source => {
    loadGeneration += 1
    arrangementsFor = ''
    arrangements.value = []
    arrangementId.value = ''
    loadingTimeline.value = false
    const remembered = readStorage(soloStorageKey())
    idolCode.value = source?.solo_tracks?.[remembered] ? remembered : Object.keys(source?.solo_tracks || {})[0] || ''
    unitKey.value = unitOptions.value[0]?.key || ''
    trackKey.value = trackOptions.value[0]?.key || ''
    const next = hasVocalSetting('all_stars') ? 'all_stars' : 'single'
    if (mode.value === next) await reloadSources()
    else mode.value = next
  }, { immediate: true })
  onBeforeUnmount(() => {
    disposed = true
    loadGeneration += 1
    stopSingle()
    audio?.removeAttribute('src')
  })

  return reactive({
    experiment, modes, mode, chooseMode,
    unitOptions, unitKey, trackOptions, trackKey,
    soloEntries, idolCode, currentSoloTrack, selectSolo,
    arrangements, arrangementId, selectArrangement, loadingTimeline, stageLineup, armed, arm,
    stagePositions: STAGE_POSITIONS, idolForStagePosition, slotName, slotState, slotStatusLabel, filledCount,
    readyCount, trackUrls, estimatedMegabytes, activeStagePositions, activeSingers, nextEmptyStagePosition, assignStagePosition,
    performerSlotForStagePosition, lineupSession, soloSession,
    ready, playing, currentTime, duration, toggle, seek, restart, pause,
    singleVolume, vocalGain, backingGain, error: failure,
    nowPlaying, lyrics, evidence, stageTarget,
  })
}
