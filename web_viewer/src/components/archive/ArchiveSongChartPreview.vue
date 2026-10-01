<template>
  <section class="chart-preview" aria-label="谱面查看器">
    <button v-if="!opened" type="button" class="chart-open" @click="opened = true">打开谱面预览</button>
    <template v-else>
      <header class="chart-toolbar">
        <div class="chart-difficulties" role="group" aria-label="谱面难度"><button v-for="d in difficulties" :key="d.type" type="button" :class="`difficulty-${d.type}`" :aria-pressed="selected === d.type" @click="selected = d.type">{{ d.label }} <small>Lv {{ d.levelLabel }}</small></button></div>
        <div class="chart-modes" role="group" aria-label="谱面视图"><button type="button" :aria-pressed="mode === 'perspective'" @click="mode = 'perspective'">透视轨道</button><button type="button" :aria-pressed="mode === 'long'" @click="mode = 'long'">长轨图</button></div>
        <div class="chart-actions"><button ref="settingsButton" type="button" :aria-expanded="settingsOpen" :aria-controls="`${uid}-settings`" @click="settingsOpen = !settingsOpen">视图设置</button><button type="button" :aria-expanded="infoOpen" @click="infoOpen = !infoOpen">谱面信息</button><button v-if="chart && mode === 'long'" type="button" :disabled="exporting" :aria-busy="exporting" @click="download">{{ exporting ? '正在导出…' : '导出 SVG' }}</button><button type="button" @click="opened = false">收起谱面</button></div>
      </header>
      <div v-if="settingsOpen" :id="`${uid}-settings`" class="chart-settings" role="region" aria-label="谱面视图设置" @keydown.esc.stop="closeSettings">
        <label>贴图样式 <select v-model="skin" aria-label="轨道音符贴图"><option value="Note1SpriteAtlas">圆形（截图样式）</option><option value="Note2SpriteAtlas">菱形</option><option value="Note3SpriteAtlas">横条</option></select></label>
        <template v-if="mode === 'perspective'"><label class="speed-setting">相对配速 <input v-model.number="speed" type="number" min="1" max="20" step="0.1" aria-label="轨道视觉配速" @input="windowMode = 'speed'" @change="speed = safeSpeed" /><input v-model.number="speed" type="range" min="1" max="20" step="0.1" aria-label="轨道配速滑杆" @input="windowMode = 'speed'" /></label><label>可见区间 <select v-model="windowMode" aria-label="轨道视野"><option value="speed">跟随配速</option><option value="3000">3000 tick</option><option value="6000">6000 tick</option><option value="12000">12000 tick</option></select></label><p class="setting-note">数值越大，音符间距越大；当前可见 {{ span }} tick。1–20 为相对刻度。</p></template>
        <template v-else><label>纵向缩放 <select v-model.number="scale" aria-label="谱面纵向缩放"><option :value="55">紧凑</option><option :value="90">标准</option><option :value="150">放大</option></select></label><label>长轨排布 <select v-model="longLayout" aria-label="长轨排布"><option value="auto">自动：桌面分栏 / 手机单栏</option><option value="columns">分栏横向阅读</option><option value="continuous">单栏纵向阅读</option></select></label></template>
        <label>播放速度 <select v-model.number="playbackRate" aria-label="谱面播放速度"><option :value="0.5">0.5×</option><option :value="0.75">0.75×</option><option :value="1">1×</option><option :value="1.25">1.25×</option><option :value="1.5">1.5×</option></select></label>
        <label>音量 <input v-model.number="volume" type="range" min="0" max="1" step="0.01" aria-label="谱面音量" /></label>
      </div>
      <div v-if="infoOpen" class="chart-info"><p>五轨原生贴图：绿 Tap / 长条，黄左划、青右划、红上划，紫星 P 技能，绿 315 Special。绿色横条为原始滑条中间节点；中途判定规则仍待核实。</p><p>完整混音音频作为播放时钟，与舞台小人使用同一音频资源。谱面按各段 BPM 换算时间。视图的相机、配速刻度及特效仍为复刻估计。</p></div>
      <p v-if="exportError" role="alert">{{ exportError }} <button type="button" @click="download">重试导出</button></p>
      <p v-if="audioError" role="alert">{{ audioError }}</p>
      <p v-if="loading" role="status">正在加载谱面…</p>
      <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="loadChart">重试</button></p>
      <template v-else-if="chart">
        <p class="chart-count">{{ activeDifficulty.label }} · {{ chart.noteObjectCount }} 个原始音符对象 · 最大 Combo {{ activeDifficulty.maxCombo }}（计数规则不同）</p>
        <div class="chart-viewport" tabindex="0" role="region" aria-label="谱面画布" @keydown="onCanvasKey"><ArchiveSongTrackPreview v-if="mode === 'perspective'" :chart="chart" :skin="skin" :title="`${title} ${activeDifficulty.label}`" :cursor="safeCursor" :span="span" /><ArchiveSongLongPreview v-else ref="longPreview" :chart="chart" :skin="skin" :title="`${title} ${activeDifficulty.label}`" :cursor="safeCursor" :scale="scale" :layout="longLayout" @seek="seek" /></div>
        <footer class="chart-transport" aria-label="谱面播放控制台" :data-clock-phase="clockSnapshot.phase">
          <audio v-if="audioTrack?.url" ref="audio" :src="audioTrack.url" preload="none" aria-label="谱面同步完整混音" @loadedmetadata="applyPendingSeek" />
          <div class="chart-timeline"><span class="chart-time">{{ formatChartTime(currentSeconds) }} <small>/ {{ formatChartTime(totalSeconds) }}</small></span><label class="tick-position">位置 <input :value="Math.round(safeCursor)" type="number" min="0" :max="chart.maxTick" step="1" aria-label="轨道位置 tick" @change="seek(Number($event.target.value))" /> <span>tick</span></label><input :value="currentSeconds" type="range" min="0" :max="totalSeconds" step="0.01" aria-label="谱面时间轴" @input="seekSeconds(Number($event.target.value))" /></div>
          <div class="chart-navigation"><div class="chart-step"><button type="button" @click="seek(0)">回到开头</button><button type="button" :disabled="!previousNote" @click="step(-1)">上一个音符</button><button type="button" class="chart-play" :disabled="!audioTrack?.url" @click="togglePlayback">{{ starting || playing ? '暂停' : '播放' }}</button><button type="button" :disabled="!nextNote" @click="step(1)">下一个音符</button><button type="button" @click="seekSeconds(totalSeconds)">谱面末尾</button></div><div class="chart-filter"><label>定位键型 <select v-model="locateRole" aria-label="定位音符类型"><option value="all">全部音符</option><option value="normal">普通 Tap / 长条</option><option value="swipe_left">左划</option><option value="swipe_right">右划</option><option value="swipe_up">上划</option><option value="p_skill">紫星 P 技能</option><option value="sp">315 Special</option><option value="middle">长条中间节点</option></select></label><button type="button" @click="goToFirstNote">首个音符</button><button type="button" :disabled="!nextHold" @click="seek(nextHold.tick)">下一条长条</button></div></div>
          <p class="chart-position-status" role="status">{{ clockSnapshot.phase === 'waiting' ? '正在缓冲音频…' : locateMessage || '拖动时间轴或按键定位 · 聚焦画布：空格播放，← / → 跳音符，Home / End 跳首尾' }}</p>
        </footer>
      </template>
    </template>
  </section>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { validateSongChart } from '../../presentation/SongChartPresentation.js'
import { buildSongChartTiming, formatChartTime } from '../../presentation/SongChartTiming.js'
import { songTrackSpanForSpeed } from '../../presentation/SongTrackPresentation.js'
import { createMediaElementClock } from '../../utils/mediaElementClock.js'
import ArchiveSongTrackPreview from './ArchiveSongTrackPreview.vue'
import ArchiveSongLongPreview from './ArchiveSongLongPreview.vue'
import { embedSongChartImages, songNoteEndpoints, songHoldMiddleNodes } from '../../presentation/SongNotePresentation.js'
const props = defineProps({ songCode: { type: String, required: true }, title: { type: String, required: true }, difficulties: { type: Array, required: true }, audioTrack: { type: Object, default: null } })
const emit = defineEmits(['request-play'])
const uid = `chart-viewer-${getCurrentInstance().uid}`
const opened = ref(false), selected = ref(props.difficulties[0]?.type || 1), mode = ref('perspective')
const scale = ref(90), skin = ref('Note1SpriteAtlas'), speed = ref(10), windowMode = ref('speed'), longLayout = ref('auto')
const settingsOpen = ref(false), infoOpen = ref(false), settingsButton = ref(null), longPreview = ref(null)
const chart = ref(null), error = ref(''), loading = ref(false), cursor = ref(0), locateRole = ref('all'), locateMessage = ref('')
const exporting = ref(false), exportError = ref(''), audio = ref(null), audioError = ref(''), starting = ref(false)
const playbackRate = ref(1), volume = ref(1), clockSnapshot = ref({ phase: 'idle', currentTime: 0, duration: null })
const activeDifficulty = computed(() => props.difficulties.find(d => d.type === selected.value))
const timing = computed(() => chart.value ? buildSongChartTiming(chart.value) : null)
const safeCursor = computed(() => Math.max(0, Number(cursor.value) || 0))
const safeSpeed = computed(() => Math.max(1, Math.min(20, Number(speed.value) || 10)))
const span = computed(() => windowMode.value === 'speed' ? songTrackSpanForSpeed(safeSpeed.value) : Number(windowMode.value))
const currentSeconds = computed(() => Math.max(0, timing.value?.tickToSeconds(safeCursor.value) || 0))
const totalSeconds = computed(() => Math.max(timing.value?.duration || 0, clockSnapshot.value.duration || props.audioTrack?.source?.duration_seconds || 0))
const playing = computed(() => ['playing','waiting'].includes(clockSnapshot.value.phase))
const endpoints = computed(() => chart.value ? songNoteEndpoints(chart.value) : [])
const targets = computed(() => locateRole.value === 'all' ? endpoints.value : locateRole.value === 'middle' ? songHoldMiddleNodes(chart.value) : endpoints.value.filter(n => n.role === locateRole.value))
const previousNote = computed(() => targets.value.filter(n => n.tick < safeCursor.value - .001).at(-1))
const nextNote = computed(() => targets.value.find(n => n.tick > safeCursor.value + .001))
const nextHold = computed(() => chart.value?.notes.filter(n => n.duration > 0 && n.tick > safeCursor.value + .001).sort((a, b) => a.tick - b.tick)[0])
let controller, generation = 0, frame = 0, playGeneration = 0, pendingSeconds = 0
const clock = createMediaElementClock(snapshot => {
  clockSnapshot.value = snapshot
  if (snapshot.phase === 'error') { audioError.value = '歌曲音频加载失败，请点击播放重试。'; stopPlayback() }
})
watch(audio, element => { clock.bind(element); if (element) { element.playbackRate = playbackRate.value; element.volume = volume.value } })
watch(playbackRate, value => { if (audio.value) audio.value.playbackRate = value })
watch(volume, value => { if (audio.value) audio.value.volume = value })
async function loadChart() {
  stopPlayback(); const current = ++generation; controller?.abort()
  chart.value = null; error.value = ''; loading.value = false; locateMessage.value = ''; exportError.value = ''; audioError.value = ''
  if (!opened.value) return
  controller = new AbortController(); loading.value = true
  const difficulty = activeDifficulty.value
  try {
    if (!difficulty?.chart) throw new Error('这档谱面暂未收录')
    const response = await fetch(difficulty.chart.url, { signal: controller.signal })
    if (!response.ok) throw new Error(`谱面加载失败（${response.status}）`)
    const bytes = await response.arrayBuffer()
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('')
    if (hash !== difficulty.chart.sha256 || bytes.byteLength !== difficulty.chart.bytes) throw new Error('谱面校验失败，请刷新页面后重试')
    const parsed = validateSongChart(JSON.parse(new TextDecoder().decode(bytes)), props.songCode, difficulty.type)
    if (current === generation) { chart.value = parsed; loading.value = false; goToFirstNote() }
  } catch (e) { if (current === generation && e.name !== 'AbortError') error.value = e.message || '谱面加载失败' }
  finally { if (current === generation) loading.value = false }
}
watch([opened, selected, () => props.songCode], loadChart)
watch(locateRole, () => { locateMessage.value = '' })
onBeforeUnmount(() => { stopPlayback(); generation++; controller?.abort(); clock.dispose() })
function applyPendingSeek() { clock.seek(pendingSeconds) }
function seekSeconds(seconds) {
  const time = Math.max(0, Math.min(totalSeconds.value, Number(seconds) || 0))
  pendingSeconds = time; cursor.value = timing.value.secondsToTick(time); locateMessage.value = ''
  if (audio.value?.readyState >= 1) clock.seek(time)
}
function seek(tick) { seekSeconds(timing.value.tickToSeconds(Math.max(0, Math.min(chart.value.maxTick, Number(tick) || 0)))) }
function goToFirstNote() { seek(Math.min(...chart.value.notes.map(n => n.tick), chart.value.maxTick)) }
function step(direction) {
  const note = direction > 0 ? nextNote.value : previousNote.value
  if (note) { seek(note.tick); locateMessage.value = `tick ${note.tick} · 轨位 ${note.lane + 1}` }
}
function stopPlayback() { playGeneration++; starting.value = false; if (frame) cancelAnimationFrame(frame); frame = 0; audio.value?.pause() }
defineExpose({ pause: stopPlayback })
function updatePlayback() {
  const element = audio.value
  if (!element || element.paused || !timing.value) { frame = 0; return }
  cursor.value = timing.value.secondsToTick(element.currentTime)
  pendingSeconds = element.currentTime
  frame = requestAnimationFrame(updatePlayback)
}
async function togglePlayback() {
  if (playing.value || starting.value) { stopPlayback(); return }
  const element = audio.value
  if (!element) return
  if (currentSeconds.value >= totalSeconds.value - .01) seekSeconds(0)
  emit('request-play'); audioError.value = ''; starting.value = true
  const current = ++playGeneration
  if (element.error) element.load()
  if (element.readyState >= 1) clock.seek(currentSeconds.value)
  try {
    await element.play()
    if (current !== playGeneration) { element.pause(); return }
    starting.value = false; frame = requestAnimationFrame(updatePlayback)
  } catch (e) { if (current === playGeneration) { starting.value = false; if (e.name !== 'AbortError') audioError.value = '无法播放歌曲，请点击播放重试。' } }
}
function onCanvasKey(event) {
  if (!['ArrowLeft','ArrowRight','Home','End',' '].includes(event.key)) return
  event.preventDefault()
  if (event.key === ' ') void togglePlayback()
  else if (event.key === 'Home') seek(0)
  else if (event.key === 'End') seekSeconds(totalSeconds.value)
  else step(event.key === 'ArrowRight' ? 1 : -1)
}
async function closeSettings() { settingsOpen.value = false; await nextTick(); settingsButton.value?.focus() }
async function download() {
  const svg = longPreview.value?.getSvg()
  if (!svg || !chart.value) return
  const fileName = `${props.songCode}-${activeDifficulty.value.label}.svg`, current = generation
  exporting.value = true; exportError.value = ''
  try {
    const content = await embedSongChartImages(svg)
    const url = URL.createObjectURL(new Blob([content], { type: 'image/svg+xml;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) { if (current === generation) exportError.value = `SVG 导出失败：${e.message || '贴图读取失败'}` }
  finally { exporting.value = false }
}
</script>

<style scoped>
.chart-preview { margin-top: 18px; border-top: 1px solid #dfe8ec; padding-top: 16px; }
.chart-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
.chart-difficulties, .chart-modes, .chart-actions, .chart-step, .chart-filter { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.chart-actions { margin-left: auto; }
button, select, input[type=number] { min-height: 44px; border: 1px solid #a7bec5; border-radius: 7px; padding: 7px 11px; font: inherit; font-size: .76rem; color: #295a60; background: #f7fbfb; box-sizing: border-box; }
button { cursor: pointer; } button:disabled { opacity: .45; cursor: default; }
.chart-difficulties button { border-color: var(--diff-color); color: var(--diff-color); }
.difficulty-1 { --diff-color: #247145; }.difficulty-2 { --diff-color: #24649c; }.difficulty-3 { --diff-color: #936309; }.difficulty-4 { --diff-color: #994070; }
.chart-difficulties button[aria-pressed=true] { background: var(--diff-color); color: #fff; }
.chart-difficulties small { display: block; margin-top: 2px; font-size: .66rem; }
.chart-modes { padding: 4px; background: #eaf2f3; border-radius: 9px; }
.chart-modes button { border-color: transparent; background: transparent; }.chart-modes button[aria-pressed=true] { background: #205d60; color: #fff; }
.chart-settings { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; padding: 14px; margin-bottom: 12px; border: 1px solid #c7dddd; border-radius: 8px; background: #f1f8f7; }
.chart-settings label { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: .76rem; }
.chart-settings input[type=range] { width: 140px; }.chart-settings input[type=number] { width: 80px; }
.setting-note { flex-basis: 100%; margin: 0; font-size: .72rem; color: #627981; }
.chart-info { margin: 0 0 12px; padding: 10px 14px; background: #f2f6fa; border-radius: 8px; font-size: .74rem; line-height: 1.7; color: #597080; }.chart-info p { margin: 4px 0; }
.chart-count { font-size: .73rem; color: #617380; margin: 8px 0; }.chart-viewport { border-radius: 8px; }
.chart-transport { margin-top: 12px; padding: 12px 14px; border: 1px solid #c4d8db; border-radius: 9px; background: #f1f7f8; }
.chart-timeline { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: .74rem; color: #486773; }
.chart-time { font-size: .94rem; font-variant-numeric: tabular-nums; color: #22565e; }.chart-time small { font-size: .75rem; color: #627981; }
.tick-position { display: flex; align-items: center; gap: 6px; }.tick-position input { width: 105px; }
.chart-timeline input[type=range] { flex: 1; min-width: 180px; }
input[type=range] { min-height: 44px; accent-color: #167e79; cursor: pointer; }
.chart-navigation { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
.chart-play { background: #1e716b; color: #fff; min-width: 78px; }
.chart-filter label { display: flex; align-items: center; gap: 8px; font-size: .74rem; color: #486773; }
.chart-position-status { margin: 10px 0 0; color: #5b7480; font-size: .7rem; min-height: 1.4em; }
button:focus-visible, select:focus-visible, input:focus-visible, .chart-viewport:focus-visible { outline: 3px solid #1d938a; outline-offset: 2px; }
@media (max-width: 560px) {
  .chart-difficulties { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); width: 100%; gap: 4px; }.chart-difficulties button { padding: 7px 3px; font-size: .63rem; }
  .chart-actions { margin-left: 0; }.chart-toolbar { gap: 8px; }.chart-transport { padding: 10px; }
  .chart-timeline input[type=range] { flex-basis: 100%; min-width: 0; }.chart-settings { gap: 10px; }.chart-settings label, .chart-settings select { max-width: 100%; }
  .chart-step { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; }.chart-step button { padding: 7px 3px; font-size: .7rem; }.chart-filter { width: 100%; }
}
</style>
