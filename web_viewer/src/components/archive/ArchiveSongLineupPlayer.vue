<template>
  <div
    class="lineup-player"
    :data-lineup-ready="session.ready.value"
    :data-loaded-vocals="session.loadedIdolCodes.value.join(',')"
    :data-active-performer-slots="session.activePerformerSlots.value.join(',')"
    :data-active-idols="session.activeIdolCodes.value.join(',')"
    data-clock-mode="audio-context-scheduled"
  >
    <p class="lineup-note">
      五个演出槽按 SwitchSinger 时间线切换。空位会静音；重复偶像只播放一条声部，并合并其多个槽的演唱区间。
    </p>

    <label v-if="arrangements.length > 1" class="arrangement-select">
      演唱切换表
      <select v-model="selectedArrangementId" @change="reloadSession">
        <option v-for="entry in arrangements" :key="entry.id" :value="entry.id">{{ entry.title }}</option>
      </select>
    </label>

    <fieldset class="performer-lineup">
      <legend>五槽演唱编组</legend>
      <label
        v-for="slot in slotNumbers"
        :key="slot"
        class="performer-slot"
        :class="{ active: session.activePerformerSlots.value.includes(slot) }"
      >
        <span>槽 {{ slot }}</span>
        <select v-model="performerLineup[slot - 1]" :aria-label="`演唱槽 ${slot}`" @change="reloadSession">
          <option value="">空位</option>
          <option v-for="entry in soloEntries" :key="entry.idol_code" :value="entry.idol_code">
            {{ entry.name }}（{{ entry.idol_code }}）
          </option>
        </select>
        <small>{{ session.activePerformerSlots.value.includes(slot) ? '当前演唱槽' : '等待' }}</small>
      </label>
    </fieldset>

    <div class="current-singers" aria-live="polite">
      <span>当前演唱</span>
      <strong v-if="activeSingerEntries.length">
        {{ activeSingerEntries.map(entry => `${entry.name}（槽 ${entry.slots.join('/')}）`).join('、') }}
      </strong>
      <strong v-else>无人 / 当前槽为空</strong>
    </div>

    <div class="lineup-transport">
      <button type="button" class="lineup-play" :disabled="!session.ready.value" @click="togglePlayback">
        {{ session.playing.value ? '暂停' : '播放' }}
      </button>
      <button type="button" class="lineup-reset" :disabled="!session.ready.value" @click="session.reset">归零</button>
      <input
        type="range"
        min="0"
        :max="session.duration.value || 0"
        step="0.01"
        :value="session.currentTime.value"
        aria-label="五槽播放进度"
        :disabled="!session.ready.value"
        @input="session.seek(Number($event.target.value))"
      />
      <span>{{ formatTime(session.currentTime.value) }} / {{ formatTime(session.duration.value) }}</span>
    </div>

    <div class="lineup-gains">
      <label>
        声部总线
        <input v-model.number="session.vocalGain.value" type="range" min="0" max="1" step="0.01" aria-label="五槽声部音量" />
      </label>
      <label>
        伴奏
        <input v-model.number="session.backingGain.value" type="range" min="0" max="1" step="0.01" aria-label="五槽伴奏音量" />
      </label>
    </div>

    <p class="lineup-evidence">
      所有轨道会在播放前完整解码，并由同一个音频时钟同步启动、预排演唱切换；当前混音采用活动偶像数的 1/√n 归一化与居中声像，仅为浏览器近似。重复选择不代表原游戏允许重复成员编组。
    </p>
    <p v-if="loadingTimeline" class="lineup-status">正在读取演唱切换表并预解码所选轨道…</p>
    <p v-else-if="session.error.value" class="lineup-error" role="alert">{{ session.error.value }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useSongPerformanceSession } from '../../composables/useSongPerformanceSession.js'
import { IDOL_ID_TO_NAME } from '../../utils/IdolNameMap.js'
import { fetchSongPerformanceChoreography } from '../../utils/songPerformanceData.js'

const props = defineProps({
  audioExperiment: { type: Object, required: true },
})

const session = useSongPerformanceSession()
const slotNumbers = [1, 2, 3, 4, 5]
const arrangements = ref([])
const selectedArrangementId = ref('')
const performerLineup = ref([])
const loadingTimeline = ref(false)

const soloEntries = computed(() => Object.values(props.audioExperiment?.solo_tracks || {})
  .map(entry => ({
    ...entry,
    name: IDOL_ID_TO_NAME[entry.idol_code] || entry.name || entry.idol_code,
  })))
const selectedArrangement = computed(() => arrangements.value
  .find(entry => entry.id === selectedArrangementId.value) || null)
const activeSingerEntries = computed(() => {
  const byIdol = new Map()
  for (const slot of session.activePerformerSlots.value) {
    const idolCode = performerLineup.value[Number(slot) - 1]
    if (!idolCode) continue
    if (!byIdol.has(idolCode)) byIdol.set(idolCode, {
      idolCode,
      name: IDOL_ID_TO_NAME[idolCode] || idolCode,
      slots: [],
    })
    byIdol.get(idolCode).slots.push(slot)
  }
  return [...byIdol.values()]
})

function initializeLineup() {
  const candidates = soloEntries.value.map(entry => entry.idol_code)
  performerLineup.value = slotNumbers.map((_, index) => candidates[index] || '')
}

async function loadArrangements() {
  loadingTimeline.value = true
  session.release()
  try {
    const choreography = await fetchSongPerformanceChoreography()
    arrangements.value = (choreography?.songs || []).filter(entry => (
      entry.songCode === props.audioExperiment.song_code
      && Array.isArray(entry.singerEvents)
      && entry.singerEvents.length > 0
      && entry.performerSlots?.length === props.audioExperiment.stage_vocal.slot_count
    ))
    selectedArrangementId.value = arrangements.value[0]?.id || ''
    initializeLineup()
    await reloadSession()
  } catch (error) {
    session.error.value = `演唱切换表读取失败：${error.message || error}`
  } finally {
    loadingTimeline.value = false
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
    performerLineup: performerLineup.value,
  })
}

async function togglePlayback() {
  if (session.playing.value) session.pause()
  else await session.play()
}

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

watch(() => props.audioExperiment, loadArrangements)
onMounted(loadArrangements)
</script>

<style scoped>
.lineup-player { margin-top: 14px; padding: 12px; border: 1px solid #cfe2ed; border-radius: 7px; background: #f4f9fc; }
.lineup-note, .lineup-evidence, .lineup-status, .lineup-error { margin: 0; color: #60717d; font-size: 0.7rem; line-height: 1.6; }
.arrangement-select { display: grid; gap: 5px; margin-top: 12px; color: #5c6771; font-size: 0.72rem; font-weight: 700; }
.arrangement-select select { max-width: 320px; padding: 7px 9px; border: 1px solid #c9d8d8; border-radius: 5px; background: #fff; }
.performer-lineup { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin: 14px 0 0; padding: 10px; border: 1px solid #d6e4eb; border-radius: 7px; }
.performer-lineup legend { padding: 0 6px; color: #3f697e; font-size: 0.7rem; font-weight: 800; }
.performer-slot { min-width: 0; display: grid; gap: 5px; padding: 8px; border: 1px solid transparent; border-radius: 6px; background: #fff; }
.performer-slot.active { border-color: #20a59c; background: #e9faf7; box-shadow: 0 0 0 2px rgba(32, 165, 156, 0.08); }
.performer-slot > span { color: #356578; font-size: 0.68rem; font-weight: 800; }
.performer-slot select { min-width: 0; width: 100%; padding: 6px; border: 1px solid #c8d7de; border-radius: 5px; background: #fff; font-size: 0.68rem; }
.performer-slot small { color: #84939c; font-size: 0.62rem; }
.performer-slot.active small { color: #14877f; font-weight: 700; }
.current-singers { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-top: 12px; padding: 9px 11px; border-left: 3px solid #20a59c; background: #eaf8f6; }
.current-singers span { color: #668079; font-size: 0.66rem; font-weight: 700; }
.current-singers strong { color: #235d58; font-size: 0.76rem; }
.lineup-transport { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.lineup-transport button { padding: 7px 12px; border: 0; border-radius: 5px; cursor: pointer; font: inherit; font-size: 0.72rem; }
.lineup-transport button:disabled { cursor: wait; opacity: 0.55; }
.lineup-play { background: #158f87; color: #fff; }
.lineup-reset { background: #dceeed; color: #316a67; }
.lineup-transport input { flex: 1 1 180px; min-width: 120px; accent-color: #158f87; }
.lineup-transport span { color: #5c6771; font-variant-numeric: tabular-nums; font-size: 0.7rem; }
.lineup-gains { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 12px; }
.lineup-gains label { display: grid; gap: 5px; color: #5c6771; font-size: 0.7rem; font-weight: 700; }
.lineup-gains input { accent-color: #158f87; }
.lineup-evidence { margin-top: 12px; }
.lineup-status { margin-top: 8px; }
.lineup-error { margin-top: 8px; color: #a04747; }
@media (max-width: 820px) {
  .performer-lineup { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .performer-lineup { grid-template-columns: 1fr; }
  .lineup-gains { grid-template-columns: 1fr; }
}
</style>
