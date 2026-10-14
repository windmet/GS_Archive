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
    <details class="lineup-note"><summary>编成规则</summary><p>五个位置对应舞台位置，选满五位后才能试听。每位偶像的声部约 3 MB，选中后才下载；重复偶像共用声部与演唱区间。</p></details>

    <label v-if="arrangements.length > 1" class="arrangement-select">
      演唱切换表
      <select v-model="selectedArrangementId" @change="syncLineup">
        <option v-for="entry in arrangements" :key="entry.id" :value="entry.id">{{ entry.title }}</option>
      </select>
    </label>

    <fieldset class="performer-lineup">
      <legend>自由编成 · 已选 {{ filledCount }}/5</legend>
      <div
        v-for="stagePosition in stagePositions"
        :key="stagePosition"
        class="performer-slot"
        :class="{ active: activeStagePositions.includes(stagePosition), filled: Boolean(idolForStagePosition(stagePosition)) }"
        :data-slot-state="slotState(stagePosition)"
      >
        <button
          type="button"
          class="slot-pick"
          :aria-label="`舞台位置 ${stagePosition}${stagePosition === 3 ? '，中心' : ''}：${idolForStagePosition(stagePosition) ? slotName(stagePosition) : '未选择'}`"
          @click="emit('pick-slot', stagePosition)"
        >
          <span class="slot-position"><span class="slot-word">位置 </span>{{ stagePosition }}<span v-if="stagePosition === 3" class="slot-center"> · 中心</span></span>
          <img v-if="idolForStagePosition(stagePosition)" class="slot-avatar" :src="getCharaIconUrl(idolForStagePosition(stagePosition))" alt="" loading="lazy" />
          <span v-else class="slot-avatar slot-empty" aria-hidden="true">+</span>
          <strong>{{ idolForStagePosition(stagePosition) ? slotName(stagePosition) : '选择偶像' }}</strong>
          <small>{{ slotStatusLabel(stagePosition) }}</small>
        </button>
        <button v-if="idolForStagePosition(stagePosition)" type="button" class="slot-clear" :aria-label="`清空位置 ${stagePosition}`" @click="assignStagePosition(stagePosition, '')">×</button>
      </div>
    </fieldset>

    <p class="lineup-progress" role="status">
      <template v-if="filledCount < 5">还差 {{ 5 - filledCount }} 位偶像。点空位选择，选满五位后即可试听。</template>
      <template v-else-if="!armed">这是你上次的编成。<button type="button" class="lineup-load" @click="arm">载入并试听 · 约 {{ estimatedMegabytes }} MB</button></template>
      <template v-else-if="!session.ready.value">正在载入 {{ readyCount }}/{{ trackUrls.length }} 条音轨…</template>
      <template v-else>编成已就绪，可以播放。</template>
    </p>

    <div class="current-singers" aria-live="polite">
      <span>当前演唱</span>
      <strong v-if="activeSingerEntries.length">
        {{ activeSingerEntries.map(entry => `${entry.name}（舞台位 ${entry.stagePositions.join('/')}）`).join('、') }}
      </strong>
      <strong v-else>{{ filledCount < 5 ? '尚未选满五位' : !session.ready.value ? '尚未载入' : '间奏 / 无人演唱' }}</strong>
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
    <p v-if="loadingTimeline" class="lineup-status">正在读取演唱切换表…</p>
    <ArchiveErrorNote v-else-if="session.error.value" class="lineup-error">{{ session.error.value }}</ArchiveErrorNote>
  </div>
</template>

<script setup>
import ArchiveMediaTransport from './ArchiveMediaTransport.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ArchiveErrorNote from './ArchiveErrorNote.vue'
import { useSongPerformanceSession } from '../../composables/useSongPerformanceSession.js'
import ArchiveSongLyrics from './ArchiveSongLyrics.vue'
import ArchiveTechnicalDetails from './ArchiveTechnicalDetails.vue'
import { isMaintainerMode } from '../../core/maintainerMode.js'
import { fetchSongPerformanceArrangements } from '../../utils/songPerformanceData.js'
import { createSongStageHandoff } from '../../core/songStageHandoff.js'
import { getCharaIconUrl } from '../../utils/AssetResolver.js'

// Decoding, clocks and the 1/√n mix are maintainer notes, not reader copy.
const maintainer = isMaintainerMode()

const props = defineProps({
  audioExperiment: { type: Object, required: true },
  idolName: { type: Function, default: () => '' },
})
const emit = defineEmits(['open-stage', 'request-play', 'pick-slot'])

const session = useSongPerformanceSession()
const slotNumbers = [1, 2, 3, 4, 5]
const stagePositions = [1, 2, 3, 4, 5]
const arrangements = ref([])
const selectedArrangementId = ref('')
const stageLineup = ref([])
const loadingTimeline = ref(false)
// Nothing downloads until the reader picks an idol in this visit (or asks to load a remembered lineup).
const armed = ref(false)
defineExpose({ pause: () => session.pause(), assignStagePosition, nextEmptyStagePosition, addIdol, stageLineup })
let loadGeneration = 0
let arrangementsLoad = Promise.resolve()
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

function slotName(stagePosition) {
  return idolLabel(props.audioExperiment.solo_tracks?.[idolForStagePosition(stagePosition)])
}

const filledCount = computed(() => stageLineup.value.filter(Boolean).length)
const selectedIdolCodes = computed(() => [...new Set(stageLineup.value.filter(Boolean))])
function vocalUrl(idolCode) { return props.audioExperiment.solo_tracks?.[idolCode]?.vocal?.url || '' }
const trackUrls = computed(() => selectedIdolCodes.value.length
  ? [props.audioExperiment.backing?.url, ...selectedIdolCodes.value.map(vocalUrl)].filter(Boolean)
  : [])
const readyCount = computed(() => trackUrls.value.filter(url => session.bufferStates.value[url] === 'ready').length)
// Measured tracks run 2.6–3.1 MB (vocals) and 2.7–3.2 MB (backing); 3 MB each is the honest round figure.
const estimatedMegabytes = computed(() => trackUrls.value.length * 3)

function slotState(stagePosition) {
  const idolCode = idolForStagePosition(stagePosition)
  if (!idolCode) return 'empty'
  if (!armed.value) return 'remembered'
  return session.bufferStates.value[vocalUrl(idolCode)] || 'loading'
}

function slotStatusLabel(stagePosition) {
  if (activeStagePositions.value.includes(stagePosition) && session.playing.value) return '正在演唱'
  return ({ empty: '空位', remembered: '上次的编成', loading: '载入中…', ready: '已就绪', error: '载入失败，点此重选' })[slotState(stagePosition)]
}

const lineupStorageKey = () => `sidem:song-lineup:${props.audioExperiment.song_code}`
function rememberLineup() {
  try { localStorage.setItem(lineupStorageKey(), JSON.stringify(stageLineup.value)) } catch {}
}
function rememberedLineup() {
  try {
    const value = JSON.parse(localStorage.getItem(lineupStorageKey()) || 'null')
    if (Array.isArray(value) && value.length === 5) return value.map(code => (code && props.audioExperiment.solo_tracks?.[code] ? code : ''))
  } catch {}
  return ['', '', '', '', '']
}

function nextEmptyStagePosition(after = 0) {
  const order = [...stagePositions.filter(position => position > after), ...stagePositions.filter(position => position <= after)]
  return order.find(position => !idolForStagePosition(position)) || 0
}

async function assignStagePosition(stagePosition, idolCode) {
  const lineup = [...stageLineup.value]
  lineup[Number(stagePosition) - 1] = idolCode
  stageLineup.value = lineup
  rememberLineup()
  if (idolCode) armed.value = true
  await syncLineup()
}

// Downloads follow the picks: each chosen idol's vocal (and the backing once anyone is chosen) starts
// at selection; tracks of idols taken out are dropped. The graph is built only when all five are set.
async function syncLineup() {
  session.retainBuffers(armed.value ? trackUrls.value : [])
  if (!armed.value) return
  session.prefetch(trackUrls.value)
  if (filledCount.value === 5) await reloadSession()
  else session.release({ resetTime: false })
}

async function arm() {
  armed.value = true
  await syncLineup()
}

// From the song page's idol list: wait for the remembered lineup, then fill the first empty position.
// Returns that position, or 0 when all five are taken.
async function addIdol(idolCode) {
  await arrangementsLoad
  const position = nextEmptyStagePosition(0)
  if (position) assignStagePosition(position, idolCode)
  return position
}

function initializeLineup() {
  stageLineup.value = rememberedLineup()
  armed.value = false
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
    if (!selectedArrangement.value) session.error.value = '当前歌曲没有可用的五槽演唱切换表。'
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
  if (filledCount.value < 5) return
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


watch(() => props.audioExperiment, () => { arrangementsLoad = loadArrangements() })
onMounted(() => { arrangementsLoad = loadArrangements() })
onBeforeUnmount(() => { disposed = true; loadGeneration += 1 })
</script>

<style scoped>
/* Five-slot lineup: on the paper; slots are a row of plain selects, the singing ones marked with stage light. */
.lineup-player { container-type: inline-size; margin-top: var(--gs-space-4); }
.lineup-note, .lineup-evidence, .lineup-status, .lineup-error { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.6; }
.arrangement-select { display: grid; gap: var(--gs-space-2); margin-top: var(--gs-space-3); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.arrangement-select select { max-width: 320px; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.performer-lineup { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--gs-space-3); margin: var(--gs-space-4) 0 0; padding: 0; border: 0; }
.performer-lineup legend { margin-bottom: var(--gs-space-3); padding: 0; color: var(--gs-ink-2); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
/* A slot is the place on stage: its number on top, the idol's face and name, then what the slot is doing. */
.performer-slot { position: relative; min-width: 0; border-top: 2px solid var(--gs-line); }
.performer-slot.active { border-top-color: var(--gs-mint); }
.slot-pick { display: grid; justify-items: center; gap: var(--gs-space-1); width: 100%; min-width: 0; padding: var(--gs-space-3) var(--gs-space-1) var(--gs-space-2); border: 0; background: none; color: var(--gs-ink); font: inherit; text-align: center; cursor: pointer; }
.slot-position { color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
.slot-avatar { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; background: var(--gs-rule); }
.slot-empty { display: grid; place-items: center; box-sizing: border-box; border: 1.5px dashed var(--gs-ink-3); background: none; color: var(--gs-ink-3); font-size: 22px; line-height: 1; }
.slot-pick strong { max-width: 100%; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.performer-slot:not(.filled) .slot-pick strong { color: var(--gs-mint-ink); }
.slot-pick small { color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
.performer-slot.active .slot-pick small, .performer-slot[data-slot-state=ready] .slot-pick small { color: var(--gs-mint-ink); }
.performer-slot[data-slot-state=error] .slot-pick small { color: var(--gs-critical); }
.performer-slot[data-slot-state=loading] .slot-avatar { opacity: .55; }
.slot-clear { position: absolute; top: var(--gs-space-1); right: 0; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--gs-ink-3); font: inherit; font-size: 18px; line-height: 1; cursor: pointer; }
.lineup-progress { margin: var(--gs-space-3) 0 0; color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.lineup-load { margin-left: var(--gs-space-2); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-control); background: var(--gs-action-bg); color: var(--gs-action-ink); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); cursor: pointer; }
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
@media (hover: hover) { .slot-pick:hover strong { color: var(--gs-mint-ink); } .slot-clear:hover { color: var(--gs-ink); } }
.lineup-player :is(button, select, input, summary):focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@container (max-width: 640px) { .performer-lineup { gap: var(--gs-space-1); } .slot-word { display: none; } .slot-avatar { width: 44px; height: 44px; } .slot-pick { padding-bottom: var(--gs-space-1); } .slot-pick small { display: none; } .performer-slot { display: grid; justify-items: center; } .slot-clear { position: static; } .lineup-gains { grid-template-columns: 1fr; } }
</style>
