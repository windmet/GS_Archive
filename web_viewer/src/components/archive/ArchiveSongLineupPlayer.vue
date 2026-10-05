<template>
  <div
    class="lineup-player"
    :data-lineup-ready="session.ready.value"
    :data-loaded-vocals="session.loadedIdolCodes.value.join(',')"
    :data-output-peak="session.outputPeak.value"
    :data-active-performer-slots="session.activePerformerSlots.value.join(',')"
    :data-active-stage-positions="activeStagePositions.join(',')"
    :data-active-idols="session.activeIdolCodes.value.join(',')"
    data-clock-mode="audio-context-scheduled"
  >
    <details class="lineup-note"><summary>编成规则</summary><p>五个位置对应舞台位置。空位静音；重复偶像共用声部与演唱区间。</p></details>

    <label v-if="arrangements.length > 1" class="arrangement-select">
      演唱切换表
      <select v-model="selectedArrangementId" @change="reloadSession">
        <option v-for="entry in arrangements" :key="entry.id" :value="entry.id">{{ entry.title }}</option>
      </select>
    </label>

    <fieldset class="performer-lineup">
      <legend>自由编成 · 五个舞台位置</legend>
      <label
        v-for="stagePosition in stagePositions"
        :key="stagePosition"
        class="performer-slot"
        :class="{ active: activeStagePositions.includes(stagePosition) }"
      >
        <span>槽 {{ stagePosition }} · 舞台位 {{ stagePosition }}{{ stagePosition === 3 ? '（中心）' : '' }}</span>
        <select
          :value="idolForStagePosition(stagePosition)"
          :aria-label="`舞台位置 ${stagePosition}${stagePosition === 3 ? '，中心' : ''}`"
          @change="handleStagePositionChange(stagePosition, $event.target.value)"
        >
          <option value="">空 / 静音</option>
          <option v-for="entry in soloEntries" :key="entry.idol_code" :value="entry.idol_code">
            {{ idolLabel(entry) }}
          </option>
        </select>
        <small>
          {{ activeStagePositions.includes(stagePosition) ? '当前演唱' : '等待' }}
        </small>
      </label>
    </fieldset>

    <div class="current-singers" aria-live="polite">
      <span>当前演唱</span>
      <strong v-if="activeSingerEntries.length">
        {{ activeSingerEntries.map(entry => `${entry.name}（舞台位 ${entry.stagePositions.join('/')}）`).join('、') }}
      </strong>
      <strong v-else>无人 / 当前槽为空</strong>
    </div>

    <ArchiveMediaTransport music :ready="session.ready.value" :playing="session.playing.value || session.starting.value" :duration="session.duration.value" :current-time="session.currentTime.value" @toggle="togglePlayback" @restart="session.reset" @seek="session.seek" />

    <details><summary>音轨平衡</summary><div class="lineup-gains">
      <label>
        演唱音量
        <input v-model.number="session.vocalGain.value" type="range" min="0" max="1" step="0.01" aria-label="五槽声部音量" />
      </label>
      <label>
        伴奏
        <input v-model.number="session.backingGain.value" type="range" min="0" max="1" step="0.01" aria-label="五槽伴奏音量" />
      </label>
    </div>

    </details>
    <div v-if="selectedArrangement?.capabilities?.stage?.kind === 'choreography_candidate'" class="lineup-stage-handoff">
      <button type="button" :disabled="!session.ready.value || !stageLineup.some(Boolean)" @click="openStageWithLineup">进入 Chibi 舞台 →</button>

    </div>

    <ArchiveSongLyrics :song-code="audioExperiment.song_code" :source-timeline="selectedArrangement"
      stage-clock :current-time="session.currentTime.value" :ready="session.ready.value" @seek="session.seek" />
    <ArchiveTechnicalDetails v-if="maintainer" label="编成试听说明" :evidence="{ stagePositions: stagePositions.map(stagePosition => ({ stagePosition, performerSlot: performerSlotForStagePosition(stagePosition) })) }">
      <p class="lineup-evidence">
        所有轨道会在播放前完整解码，并由同一个音频时钟同步启动、预排演唱切换；当前混音采用活动偶像数的 1/√n 归一化与居中声像，仅为浏览器近似。重复选择不代表原游戏允许重复成员编组。
      </p>
    </ArchiveTechnicalDetails>
    <p v-if="loadingTimeline" class="lineup-status">正在准备所选演唱成员的音频…</p>
    <p v-else-if="session.error.value" class="lineup-error" role="alert">{{ session.error.value }}</p>
  </div>
</template>

<script setup>
import ArchiveMediaTransport from './ArchiveMediaTransport.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSongPerformanceSession } from '../../composables/useSongPerformanceSession.js'
import ArchiveSongLyrics from './ArchiveSongLyrics.vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import { isMaintainerMode } from '../../core/maintainerMode.js'
import { fetchSongPerformanceArrangements } from '../../utils/songPerformanceData.js'
import { createSongStageHandoff } from '../../core/songStageHandoff.js'

// Decoding, clocks and the 1/√n mix are maintainer notes, not reader copy.
const maintainer = isMaintainerMode()

const props = defineProps({
  audioExperiment: { type: Object, required: true },
  idolName: { type: Function, default: () => '' },
})
const emit = defineEmits(['open-stage', 'request-play'])

const session = useSongPerformanceSession()
defineExpose({ pause: () => session.pause() })
const slotNumbers = [1, 2, 3, 4, 5]
const stagePositions = [1, 2, 3, 4, 5]
const arrangements = ref([])
const selectedArrangementId = ref('')
const stageLineup = ref([])
const loadingTimeline = ref(false)
let loadGeneration = 0
let disposed = false

const soloEntries = computed(() => Object.values(props.audioExperiment?.solo_tracks || {}))
function idolLabel(entry) { return (entry?.idol_code && props.idolName(entry.idol_code, entry.displayName)) || entry?.displayName || '姓名待确认' }
const selectedArrangement = computed(() => arrangements.value
  .find(entry => entry.id === selectedArrangementId.value) || null)
const activeStagePositions = computed(() => session.activePerformerSlots.value
  .map(stagePositionForSlot)
  .sort((left, right) => left - right))
const activeSingerEntries = computed(() => {
  const byIdol = new Map()
  for (const slot of session.activePerformerSlots.value) {
    const stagePosition = stagePositionForSlot(slot)
    const idolCode = stageLineup.value[Number(stagePosition) - 1]
    if (!idolCode) continue
    if (!byIdol.has(idolCode)) byIdol.set(idolCode, {
      idolCode,
      name: idolLabel(props.audioExperiment.solo_tracks?.[idolCode]),
      slots: [],
      stagePositions: [],
    })
    byIdol.get(idolCode).slots.push(slot)
    byIdol.get(idolCode).stagePositions.push(stagePosition)
  }
  return [...byIdol.values()]
})

function stagePositionForSlot(performerSlot) {
  return selectedArrangement.value?.stagePositionMap
    ?.find(item => Number(item.performerSlot) === Number(performerSlot))?.stagePosition
    || performerSlot
}

function performerSlotForStagePosition(stagePosition) {
  return selectedArrangement.value?.stagePositionMap
    ?.find(item => Number(item.stagePosition) === Number(stagePosition))?.performerSlot
    || stagePosition
}

function idolForStagePosition(stagePosition) {
  return stageLineup.value[Number(stagePosition) - 1] || ''
}

async function handleStagePositionChange(stagePosition, idolCode) {
  stageLineup.value[Number(stagePosition) - 1] = idolCode
  await reloadSession()
}

function initializeLineup() {
  const candidates = soloEntries.value.map(entry => entry.idol_code)
  stageLineup.value = stagePositions.map((_, index) => candidates[index] || '')
}

async function loadArrangements() {
  const generation = ++loadGeneration
  loadingTimeline.value = true
  session.release()
  try {
    const timelines = await fetchSongPerformanceArrangements(props.audioExperiment.song_code)
    if (disposed || generation !== loadGeneration) return
    arrangements.value = timelines.filter(entry => (
      entry.songCode === props.audioExperiment.song_code
      && !entry.variant
      && Array.isArray(entry.singerEvents)
      && entry.singerEvents.length > 0
      && entry.performerSlots?.length === props.audioExperiment.stage_vocal.slot_count
      && entry.positions?.length === props.audioExperiment.stage_vocal.slot_count
    ))
    selectedArrangementId.value = arrangements.value[0]?.id || ''
    initializeLineup()
    await reloadSession()
  } catch (error) {
    if (!disposed && generation === loadGeneration) {
      session.error.value = `演唱切换表读取失败：${error.message || error}`
    }
  } finally {
    if (!disposed && generation === loadGeneration) loadingTimeline.value = false
  }
}

async function reloadSession() {
  const arrangement = selectedArrangement.value
  if (!arrangement) {
    session.release()
    session.error.value = '当前歌曲没有可用的五槽演唱切换表。'
    return
  }
  await session.configure({
    experiment: props.audioExperiment,
    events: arrangement.singerEvents,
    performerLineup: slotNumbers.map(performerSlot => (
      stageLineup.value[Number(stagePositionForSlot(performerSlot)) - 1] || ''
    )),
  })
}

async function togglePlayback() {
  if (session.playing.value || session.starting.value) session.pause()
  else { emit('request-play'); await session.play() }
}

function openStageWithLineup() {
  if (!session.ready.value) return
  const handoff = createSongStageHandoff({
    songCode: props.audioExperiment.song_code,
    arrangement: selectedArrangement.value,
    stageLineup: stageLineup.value,
    audioExperiment: props.audioExperiment,
    vocalGain: session.vocalGain.value,
    backingGain: session.backingGain.value,
    sourceTimeSeconds: session.currentTime.value,
  })
  if (!handoff) return
  session.release()
  emit('open-stage', {
    songCode: handoff.songCode,
    choreographyId: handoff.choreographyId,
    stageHandoff: handoff,
  })
}


watch(() => props.audioExperiment, loadArrangements)
onMounted(loadArrangements)
onBeforeUnmount(() => { disposed = true; loadGeneration += 1 })
</script>

<style scoped>
/* Five-slot lineup: on the paper; slots are a row of plain selects, the singing ones marked with stage light. */
.lineup-player { margin-top: var(--gs-space-4); }
.lineup-note, .lineup-evidence, .lineup-status, .lineup-error { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.6; }
.arrangement-select { display: grid; gap: var(--gs-space-2); margin-top: var(--gs-space-3); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.arrangement-select select { max-width: 320px; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.performer-lineup { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--gs-space-3); margin: var(--gs-space-4) 0 0; padding: 0; border: 0; }
.performer-lineup legend { margin-bottom: var(--gs-space-3); padding: 0; color: var(--gs-ink-2); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.performer-slot { display: grid; gap: var(--gs-space-2); min-width: 0; padding-top: var(--gs-space-2); border-top: 2px solid var(--gs-line); }
.performer-slot.active { border-top-color: var(--gs-mint); }
.performer-slot > span { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.performer-slot select { width: 100%; min-width: 0; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.performer-slot small { color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
.performer-slot.active small { color: var(--gs-mint-ink); }
.current-singers { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--gs-space-3); margin-top: var(--gs-space-4); padding-left: var(--gs-space-4); border-left: 2px solid var(--gs-mint); }
.current-singers span { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.current-singers strong { color: var(--gs-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.lineup-gains { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-5); margin-top: var(--gs-space-3); }
.lineup-gains label { display: grid; gap: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.lineup-gains input { accent-color: var(--gs-mint-ink); }
.lineup-stage-handoff { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3) var(--gs-space-4); margin-top: var(--gs-space-4); padding-top: var(--gs-space-4); border-top: 1px solid var(--gs-line); }
.lineup-stage-handoff button { min-height: var(--gs-control-touch); padding: 0 var(--gs-space-5); border: 0; border-radius: var(--gs-radius-control); background: var(--gs-action-bg); color: var(--gs-action-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
.lineup-stage-handoff button:disabled { opacity: .45; cursor: wait; }
.lineup-stage-handoff p { flex: 1 1 230px; margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.5; }
.lineup-evidence { margin-top: var(--gs-space-3); }
.lineup-status, .lineup-error { margin-top: var(--gs-space-3); }
.lineup-error { color: var(--gs-critical); }
summary { display: flex; align-items: center; min-height: var(--gs-control-touch); color: var(--gs-ink-2); font-size: var(--gs-text-ui); cursor: pointer; }
.lineup-player :is(button, select, input, summary):focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@container (max-width: 640px) { .performer-lineup { grid-template-columns: repeat(2, minmax(0, 1fr)); } .lineup-gains { grid-template-columns: 1fr; } }
</style>
