<template>
  <section class="chart-preview" :class="{ 'is-long': mode === 'long' }" aria-label="谱面查看器">
    <button v-if="!opened" type="button" class="chart-open" @click="opened = true">打开谱面预览</button>
    <template v-else>
      <header class="chart-toolbar">
        <div class="chart-difficulties" role="group" aria-label="谱面难度"><button v-for="d in difficulties" :key="d.type" type="button" :class="`difficulty-${d.type}`" :aria-pressed="selected === d.type" @click="selected = d.type">{{ d.label }} <small>Lv {{ d.levelLabel }}</small></button></div>
        <div class="chart-modes" role="group" aria-label="谱面视图"><button type="button" :aria-pressed="mode === 'perspective'" @click="mode = 'perspective'">透视轨道</button><button type="button" :aria-pressed="mode === 'long'" @click="mode = 'long'">长轨图</button></div>
        <button v-if="mode === 'long'" type="button" :aria-pressed="followPlayback" @click="followPlayback = !followPlayback">跟随播放</button>
        <div class="chart-actions"><button ref="settingsButton" type="button" :aria-expanded="settingsOpen" :aria-controls="`${uid}-settings`" aria-haspopup="dialog" @click="toggleSettings"><Settings2 :size="15" aria-hidden="true" />视图设置</button><button type="button" :aria-expanded="infoOpen" @click="infoOpen = !infoOpen"><Info :size="15" aria-hidden="true" />谱面信息</button><button v-if="!standalone" type="button" @click="opened = false"><X :size="15" aria-hidden="true" />收起谱面</button><span v-if="chart && mode === 'long'" class="chart-export-actions"><button type="button" :disabled="exporting" :aria-busy="exporting && exportFormat === 'png'" @click="download('png')"><Download :size="15" aria-hidden="true" />{{ exporting && exportFormat === 'png' ? `正在导出 PNG ${exportProgress}%…` : '保存长轨 PNG' }}</button><button type="button" :disabled="exporting" :aria-busy="exporting && exportFormat === 'svg'" @click="download('svg')"><Download :size="15" aria-hidden="true" />{{ exporting && exportFormat === 'svg' ? '正在导出…' : '导出 SVG' }}</button></span></div>
      </header>
      <Teleport to="body">
        <div v-if="settingsOpen" :id="`${uid}-settings`" ref="settingsPanel" class="chart-settings" :style="settingsPosition" role="dialog" aria-label="谱面视图设置" @keydown.esc.stop.prevent="closeSettings()">
          <header class="settings-heading"><strong>显示与播放</strong><button type="button" aria-label="关闭视图设置" @click="closeSettings()"><X :size="18" aria-hidden="true" /></button></header>
          <label>贴图样式 <select v-model="skin" aria-label="轨道音符贴图"><option value="Note1SpriteAtlas">圆形（截图样式）</option><option value="Note2SpriteAtlas">菱形</option><option value="Note3SpriteAtlas">横条</option></select></label>
          <template v-if="mode === 'perspective'"><label class="speed-setting">视觉配速 <input v-model.number="speed" type="number" min="1" max="30" step="0.1" aria-label="轨道视觉配速" @change="speed = safeSpeed" /><input v-model.number="speed" type="range" min="1" max="30" step="0.1" aria-label="轨道配速滑杆" /></label><p class="setting-note">1–30 为相对刻度，越大落下越快；只改变画面疏密。</p></template>
          <template v-else><label>纵向缩放 <select v-model.number="scale" aria-label="谱面纵向缩放"><option :value="55">紧凑</option><option :value="90">标准</option><option :value="150">放大</option></select></label><label>长轨排布 <select v-model="longLayout" aria-label="长轨排布"><option value="auto">自动：桌面分栏 / 手机单栏</option><option value="columns">分栏横向阅读</option><option value="continuous">单栏纵向阅读</option></select></label></template>
          <div class="settings-audio"><label>播放速度 <select v-model.number="playbackRate" aria-label="谱面播放速度"><option :value="0.5">0.5×</option><option :value="0.75">0.75×</option><option :value="1">1×</option><option :value="1.25">1.25×</option><option :value="1.5">1.5×</option></select></label><label>音量 <input v-model.number="volume" type="range" min="0" max="1" step="0.01" aria-label="谱面音量" /></label></div>
        </div>
      </Teleport>
      <p v-if="exportError" role="alert">{{ exportError }} <button type="button" :disabled="exporting" @click="download(exportFormat)">重试导出</button></p>
      <p v-if="audioError" role="alert">{{ audioError }}</p>
      <p v-if="loading" role="status">正在加载谱面…</p>
      <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="loadChart">重试</button></p>
      <template v-else-if="chart">
        <div class="chart-viewport" :class="{ 'is-long': mode === 'long' }" tabindex="0" role="region" aria-label="谱面画布" @keydown="onCanvasKey"><p class="chart-count chart-hud"><strong>{{ activeDifficulty.label }}</strong><span>Combo {{ activeDifficulty.maxCombo }}</span></p><ArchiveSongTrackPreview v-if="mode === 'perspective'" :chart="chart" :skin="skin" :title="`${title} ${activeDifficulty.label}`" :cursor="safeCursor" :span="span" /><ArchiveSongLongPreview v-else ref="longPreview" :chart="chart" :skin="skin" :title="`${title} ${activeDifficulty.label}`" :cursor="safeCursor" :scale="scale" :layout="longLayout" :follow="followPlayback && playing" @seek="seek" /></div>
        <footer class="chart-transport" aria-label="谱面播放控制台" :data-clock-phase="clockSnapshot.phase">
          <audio v-if="audioTrack?.url" ref="audio" :src="audioTrack.url" preload="none" aria-label="谱面同步完整混音" @loadedmetadata="applyPendingSeek" />
          <div class="chart-timeline"><span class="chart-time">{{ formatChartTime(currentSeconds) }} <small>/ {{ formatChartTime(totalSeconds) }}</small></span><input :value="currentSeconds" type="range" min="0" :max="totalSeconds" step="0.01" aria-label="谱面时间轴" @input="seekSeconds(Number($event.target.value))" /><div class="tick-position"><button v-if="!editingTick" ref="tickButton" type="button" class="tick-readout" aria-label="编辑谱面 tick 位置" title="点击输入 tick 精确定位" :data-tick="Math.round(safeCursor)" @click="editTick">Tick {{ Math.round(safeCursor) }} <span>/ {{ chart.maxTick }}</span></button><label v-else>Tick <input ref="tickInput" v-model="tickDraft" type="number" min="0" :max="chart.maxTick" step="1" aria-label="轨道位置 tick" @blur="commitTick()" @keydown.enter.prevent="commitTick(true)" @keydown.esc.stop.prevent="cancelTick(true)" /> <span>/ {{ chart.maxTick }}</span></label></div></div>
          <div class="chart-navigation"><div class="chart-step" role="group" aria-label="谱面播放操作"><button type="button" aria-label="回到开头" title="歌曲开头 · 0 秒" @click="seek(0)"><SkipBack :size="19" aria-hidden="true" /></button><button type="button" aria-label="上一个音符" title="上一个音符 · ←" :disabled="!previousNote" @click="step(-1)"><ChevronLeft :size="23" aria-hidden="true" /></button><button type="button" class="chart-play" :aria-label="starting || playing ? '暂停' : '播放'" :disabled="!audioTrack?.url" @click="togglePlayback"><component :is="starting || playing ? Pause : Play" :size="21" aria-hidden="true" />{{ starting || playing ? '暂停' : '播放' }}</button><button type="button" aria-label="下一个音符" title="下一个音符 · →" :disabled="!nextNote" @click="step(1)"><ChevronRight :size="23" aria-hidden="true" /></button><button type="button" aria-label="播放末尾" title="播放末尾（含尾奏）" @click="seekSeconds(totalSeconds)"><SkipForward :size="19" aria-hidden="true" /></button></div></div>
          <p v-if="clockSnapshot.phase === 'waiting' || locateMessage" class="chart-position-status" role="status">{{ clockSnapshot.phase === 'waiting' ? '正在缓冲音频…' : locateMessage }}</p>
          <p class="chart-shortcuts">聚焦画布：<kbd>空格</kbd> 播放 / 暂停 <span>·</span> <kbd>←</kbd><kbd>→</kbd> 跳音符 <span>·</span> <kbd>Home</kbd><kbd>End</kbd> 首尾</p>
        </footer>
      </template>
      <div v-if="infoOpen" class="chart-info"><p v-if="chart">{{ activeDifficulty.label }} · {{ chart.noteObjectCount }} 个原始音符对象 · 最大 Combo {{ activeDifficulty.maxCombo }}。音符对象和判定点计数不同。</p><p v-if="chart && mode === 'long'">PNG 保存完整单栏长轨（2×，宽 820px）；SVG 保存当前排布。超出浏览器 PNG 预算时，可保存 SVG 后离线导出。</p><p>五轨原生贴图：绿 Tap / 长条，黄左划、青右划、红上划，紫星 P 技能，绿 315 Special。绿色横条为原始滑条中间节点；中途判定规则仍待核实。</p><p>完整混音音频作为播放时钟，与舞台小人使用同一音频资源。谱面按各段 BPM 换算时间。视图的相机、配速刻度及特效仍为复刻估计。</p></div>
    </template>
  </section>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ChevronLeft, ChevronRight, Download, Info, Pause, Play, Settings2, SkipBack, SkipForward, X } from '@lucide/vue'
import { validateSongChart } from '../../presentation/SongChartPresentation.js'
import { buildSongChartTiming, formatChartTime } from '../../presentation/SongChartTiming.js'
import { songTrackSpanForSpeed } from '../../presentation/SongTrackPresentation.js'
import { createMediaElementClock } from '../../utils/mediaElementClock.js'
import { assertBrowserSongChartPng, exportSongChartPng } from '../../presentation/SongChartPngExport.js'
import ArchiveSongTrackPreview from './ArchiveSongTrackPreview.vue'
import ArchiveSongLongPreview from './ArchiveSongLongPreview.vue'
import { embedSongChartImages, songNoteEndpoints } from '../../presentation/SongNotePresentation.js'
const props = defineProps({ songCode: { type: String, required: true }, title: { type: String, required: true }, difficulties: { type: Array, required: true }, audioTrack: { type: Object, default: null }, standalone: Boolean })
const emit = defineEmits(['request-play'])
const uid = `chart-viewer-${getCurrentInstance().uid}`
const opened = ref(props.standalone), selected = ref(props.difficulties[0]?.type || 1), mode = ref('perspective')
const scale = ref(90), skin = ref('Note1SpriteAtlas'), speed = ref(10), longLayout = ref('auto'), followPlayback = ref(false)
const settingsOpen = ref(false), infoOpen = ref(false), settingsButton = ref(null), longPreview = ref(null)
const settingsPanel = ref(null), settingsPosition = ref({ left: '12px', top: '12px' })
const editingTick = ref(false), tickDraft = ref(''), tickInput = ref(null), tickButton = ref(null)
const chart = shallowRef(null), error = ref(''), loading = ref(false), cursor = ref(0), locateMessage = ref('')
const exporting = ref(false), exportError = ref(''), audio = ref(null), audioError = ref(''), starting = ref(false)
const exportFormat = ref('svg'), exportProgress = ref(0)
const playbackRate = ref(1), volume = ref(1), clockSnapshot = ref({ phase: 'idle', currentTime: 0, duration: null })
const activeDifficulty = computed(() => props.difficulties.find(d => d.type === selected.value))
const timing = computed(() => chart.value ? buildSongChartTiming(chart.value) : null)
const safeCursor = computed(() => Math.min(chart.value?.maxTick || 0, Math.max(0, Number(cursor.value) || 0)))
const safeSpeed = computed(() => Math.max(1, Math.min(30, Number(speed.value) || 10)))
const span = computed(() => songTrackSpanForSpeed(safeSpeed.value))
const currentSeconds = computed(() => Math.max(0, timing.value?.tickToSeconds(Math.max(0, Number(cursor.value) || 0)) || 0))
const totalSeconds = computed(() => Math.max(timing.value?.duration || 0, clockSnapshot.value.duration || props.audioTrack?.source?.duration_seconds || 0))
const playing = computed(() => ['playing','waiting'].includes(clockSnapshot.value.phase) || (clockSnapshot.value.phase === 'seeking' && !audio.value?.paused))
const endpoints = computed(() => chart.value ? songNoteEndpoints(chart.value) : [])
const previousNote = computed(() => endpoints.value.filter(n => n.tick < safeCursor.value - .001).at(-1))
const nextNote = computed(() => endpoints.value.find(n => n.tick > safeCursor.value + .001))
let controller, generation = 0, frame = 0, playGeneration = 0, pendingSeconds = 0, lastPaint = 0
const clock = createMediaElementClock(snapshot => {
  clockSnapshot.value = snapshot
  if (snapshot.phase === 'error') { audioError.value = '歌曲音频加载失败，请点击播放重试。'; stopPlayback() }
})
watch(audio, element => { clock.bind(element); if (element) { element.playbackRate = playbackRate.value; element.volume = volume.value } })
watch(playbackRate, value => { if (audio.value) audio.value.playbackRate = value })
watch(volume, value => { if (audio.value) audio.value.volume = value })
async function loadChart() {
  stopPlayback(); const current = ++generation; controller?.abort()
  editingTick.value = false
  chart.value = null; error.value = ''; loading.value = false; locateMessage.value = ''; exportError.value = ''; audioError.value = ''
  if (!opened.value) { settingsOpen.value = false; return }
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
onMounted(() => {
  if (props.standalone) { if (window.matchMedia('(max-width: 760px)').matches) mode.value = 'long'; void loadChart() }
  document.addEventListener('pointerdown', onOutsideSettings)
  document.addEventListener('keydown', onSettingsEscape)
  window.addEventListener('resize', positionSettings)
  window.addEventListener('scroll', positionSettings, true)
})
onBeforeUnmount(() => {
  stopPlayback(); generation++; controller?.abort(); clock.dispose()
  document.removeEventListener('pointerdown', onOutsideSettings)
  document.removeEventListener('keydown', onSettingsEscape)
  window.removeEventListener('resize', positionSettings)
  window.removeEventListener('scroll', positionSettings, true)
})
function applyPendingSeek() { clock.seek(pendingSeconds) }
function seekSeconds(seconds) {
  const time = Math.max(0, Math.min(totalSeconds.value, Number(seconds) || 0))
  pendingSeconds = time; cursor.value = timing.value.secondsToTick(time); locateMessage.value = ''
  if (audio.value?.readyState >= 1) clock.seek(time)
  void nextTick(() => longPreview.value?.scrollToTick())
}
function seek(tick) { seekSeconds(timing.value.tickToSeconds(Math.max(0, Math.min(chart.value.maxTick, Number(tick) || 0)))) }
function goToFirstNote() { seek(Math.min(...chart.value.notes.map(n => n.tick), chart.value.maxTick)) }
function step(direction) {
  const note = direction > 0 ? nextNote.value : previousNote.value
  if (note) { seek(note.tick); locateMessage.value = `tick ${note.tick} · 轨位 ${note.lane + 1}` }
}
function stopPlayback() { playGeneration++; starting.value = false; if (frame) cancelAnimationFrame(frame); frame = 0; audio.value?.pause() }
defineExpose({ pause: stopPlayback })
function updatePlayback(now = 0) {
  const element = audio.value
  if (!element || element.paused || !timing.value) { frame = 0; return }
  // The audio remains the clock; a 30 Hz visual cursor avoids invalidating the
  // chart/toolbars at the iPad's 120 Hz display rate.
  if (now - lastPaint >= 33) { cursor.value = timing.value.secondsToTick(element.currentTime); lastPaint = now }
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
function positionSettings() {
  if (!settingsOpen.value || !settingsButton.value || !settingsPanel.value) return
  const box = settingsButton.value.getBoundingClientRect(), width = Math.min(384, window.innerWidth - 24)
  if (box.bottom < 12 || box.top > window.innerHeight - 12) { void closeSettings(false); return }
  const below = Math.max(0, window.innerHeight - box.bottom - 20), above = Math.max(0, box.top - 20)
  const openAbove = below < settingsPanel.value.scrollHeight && above > below
  const height = Math.min(settingsPanel.value.scrollHeight, openAbove ? above : below)
  settingsPosition.value = {
    width: `${width}px`, left: `${Math.max(12, Math.min(box.right - width, window.innerWidth - width - 12))}px`,
    top: `${openAbove ? Math.max(12, box.top - height - 8) : box.bottom + 8}px`,
    maxHeight: `${Math.max(0, openAbove ? above : below)}px`,
  }
}
watch([settingsOpen, mode], async ([open]) => {
  if (!open) return
  await nextTick(); positionSettings()
})
async function toggleSettings() {
  if (settingsOpen.value) { await closeSettings(); return }
  settingsOpen.value = true
  await nextTick(); positionSettings(); settingsPanel.value?.querySelector('select')?.focus({ preventScroll: true })
}
async function closeSettings(restoreFocus = true) {
  settingsOpen.value = false
  if (restoreFocus) { await nextTick(); settingsButton.value?.focus({ preventScroll: true }) }
}
function onOutsideSettings(event) {
  if (settingsOpen.value && !settingsPanel.value?.contains(event.target) && !settingsButton.value?.contains(event.target)) void closeSettings(false)
}
function onSettingsEscape(event) {
  if (settingsOpen.value && event.key === 'Escape') { event.preventDefault(); void closeSettings() }
}
async function editTick() {
  tickDraft.value = String(Math.round(safeCursor.value)); editingTick.value = true
  await nextTick(); tickInput.value?.focus({ preventScroll: true }); tickInput.value?.select()
}
function commitTick(restoreFocus = false) {
  if (!editingTick.value) return
  if (tickDraft.value !== '' && Number.isFinite(Number(tickDraft.value))) seek(Number(tickDraft.value))
  void cancelTick(restoreFocus)
}
async function cancelTick(restoreFocus = false) {
  editingTick.value = false
  if (restoreFocus) { await nextTick(); tickButton.value?.focus({ preventScroll: true }) }
}
async function download(format = 'svg') {
  if (exporting.value || !longPreview.value || !chart.value) return
  const fileName = `${props.songCode}-${activeDifficulty.value.label}.${format}`, current = generation
  exporting.value = true; exportError.value = ''; exportFormat.value = format; exportProgress.value = 0
  const check = () => { if (current !== generation) throw new Error('谱面已切换，请重新导出') }
  try {
    if (format === 'png') {
      const box = longPreview.value.getSourceDimensions()
      assertBrowserSongChartPng(box.width, box.height)
    }
    const svg = format === 'png' ? longPreview.value.getSourceSvg() : longPreview.value.getSvg()
    const content = await embedSongChartImages(svg)
    check()
    const blob = format === 'png' ? await exportSongChartPng(content, { check, onProgress: n => { exportProgress.value = n } }) : new Blob([content], { type: 'image/svg+xml;charset=utf-8' })
    check()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) { if (current === generation) exportError.value = `${format.toUpperCase()} 导出失败：${e.message || '贴图读取失败'}` }
  finally { exporting.value = false }
}
</script>

<style scoped>
.chart-preview { margin-top: 18px; border-top: 1px solid #dfe8ec; padding-top: 14px; }
button, select, input[type=number] { box-sizing: border-box; border: 1px solid #b5c8cc; border-radius: 6px; font: inherit; font-size: .76rem; color: #295a60; background: #f7fbfb; }
button { display: inline-flex; justify-content: center; align-items: center; gap: 6px; min-height: 36px; padding: 6px 10px; cursor: pointer; }
button:disabled { opacity: .4; cursor: default; }
button:not(:disabled):hover { border-color: #438d8a; background: #eaf4f2; }
.chart-toolbar > button[aria-pressed=true] { background: #205d60; border-color: #205d60; color: #fff; }
select { min-height: 36px; padding: 6px 8px; max-width: 100%; }
input[type=number] { min-height: 32px; padding: 4px 7px; }
.chart-open { min-height: 44px; }
.chart-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
.chart-difficulties, .chart-modes, .chart-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
.chart-difficulties button { flex-direction: column; height: 44px; min-width: 76px; border-color: var(--diff-color); color: var(--diff-color); gap: 2px; padding: 5px 10px; font-size: .7rem; line-height: 1.2; white-space: nowrap; }
.chart-difficulties small { font-size: .65rem; opacity: .85; }
.difficulty-1 { --diff-color: #247145; }.difficulty-2 { --diff-color: #24649c; }.difficulty-3 { --diff-color: #936309; }.difficulty-4 { --diff-color: #994070; }
.chart-difficulties button[aria-pressed=true] { background: var(--diff-color); color: #fff; }
.chart-modes { height: 44px; padding: 2px; box-sizing: border-box; gap: 2px; border-radius: 6px; background: #eaf2f3; }
.chart-modes button { min-height: 40px; height: 40px; border-color: transparent; background: transparent; font-size: .7rem; }
.chart-modes button[aria-pressed=true] { background: #205d60; color: #fff; }
.chart-actions { margin-left: auto; }.chart-actions button { height: 44px; font-size: .7rem; gap: 6px; }.chart-actions svg { flex-shrink: 0; }.chart-export-actions { display: flex; align-items: center; gap: 5px; }
.chart-settings { position: fixed; z-index: 1200; box-sizing: border-box; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 15px; padding: 16px; border: 1px solid #b5cdcc; border-radius: 10px; background: #f8fcfb; box-shadow: 0 10px 35px #173e4638; color: #295a60; }
.settings-heading { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px solid #dde9e6; font-size: .83rem; }
.settings-heading button { width: 32px; min-height: 32px; padding: 0; border: 0; background: transparent; }
.chart-settings label { display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: center; gap: 9px; font-size: .76rem; }
.chart-settings input[type=range] { width: 100%; min-width: 0; margin: 0; }
.chart-settings .speed-setting { grid-template-columns: 76px 65px minmax(0, 1fr); gap: 8px; }
.speed-setting input[type=number] { width: 65px; }
.settings-audio { display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #dde9e6; padding-top: 12px; }
.setting-note { margin: -8px 0 0; font-size: .7rem; color: #6b8184; line-height: 1.6; }
.chart-viewport { position: relative; border-radius: 8px; }
.chart-hud { position: absolute; z-index: 2; top: 12px; left: 12px; display: flex; align-items: center; gap: 10px; margin: 0; padding: 6px 10px; border: 1px solid #9bc3d333; border-radius: 6px; background: #10212ad9; color: #dcebed; backdrop-filter: blur(6px); font-size: .68rem; pointer-events: none; }
.chart-hud strong { color: #fff; font-size: .67rem; letter-spacing: .03em; }.chart-hud span { font-variant-numeric: tabular-nums; }
.is-long .chart-hud { position: static; border-radius: 8px 8px 0 0; background: #13212e; padding: 8px 12px; border: 1px solid #35485a; border-bottom: 0; }
.chart-transport { margin-top: 10px; padding: 10px 12px; border: 1px solid #c9dcdd; border-radius: 8px; background: #f1f7f7; }
.chart-timeline { display: flex; align-items: center; gap: 12px; }
.chart-time { font-size: .86rem; white-space: nowrap; font-variant-numeric: tabular-nums; color: #22565e; }.chart-time small { font-size: .73rem; color: #627981; }
.chart-timeline > input[type=range] { flex: 1; width: 100%; min-width: 60px; margin: 0; }
.tick-position { min-width: 156px; font-size: .67rem; color: #617980; font-variant-numeric: tabular-nums; }
.tick-position span { color: #84949a; }.tick-position label { display: flex; align-items: center; justify-content: flex-end; gap: 5px; white-space: nowrap; }
.tick-position input { width: 78px; font-size: .69rem; }.tick-readout { width: 100%; justify-content: flex-end; border-color: transparent; background: transparent; padding: 3px 0; font-size: .67rem; color: #617980; }
.chart-navigation { display: flex; align-items: center; justify-content: center; margin-top: 8px; }
.chart-step { display: flex; align-items: center; gap: 6px; }.chart-step button { width: 38px; height: 38px; padding: 0; border-color: transparent; background: transparent; }
.chart-step .chart-play { width: 100px; height: 48px; margin: 0 6px; border-radius: 24px; border-color: #1e716b; background: #1e716b; color: #fff; font-size: .8rem; font-weight: 600; }.chart-step .chart-play:not(:disabled):hover { background: #145d58; }
input[type=range] { min-height: 32px; accent-color: #167e79; cursor: pointer; }
.chart-position-status, .chart-shortcuts { margin: 8px 0 0; color: #6a8288; font-size: .66rem; line-height: 1.7; }.chart-shortcuts { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px; }
kbd { font-family: inherit; padding: 0 3px; border: 1px solid #d7e3e3; border-radius: 3px; color: #5b757d; background: #f7fafb; font-size: .61rem; }.chart-shortcuts > span { margin: 0 3px; color: #a0b2b6; }
.chart-info { margin-top: 10px; padding: 10px 14px; background: #f2f6fa; border-radius: 8px; font-size: .74rem; line-height: 1.7; color: #597080; }.chart-info p { margin: 4px 0; }
button:focus-visible, select:focus-visible, input:focus-visible, .chart-viewport:focus-visible { outline: 3px solid #1d938a; outline-offset: 2px; }
@media (max-width: 560px) {
 .chart-difficulties { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); width: 100%; gap: 4px; }.chart-difficulties button { height: 44px; min-width: 0; padding: 5px 2px; gap: 2px; font-size: .7rem; }.chart-difficulties small { font-size: .63rem; }
 .chart-toolbar { gap: 8px; }.chart-actions { margin-left: 0; gap: 5px; width: 100%; }.chart-actions > button { flex: 1; }.chart-actions button { height: 44px; padding: 6px; gap: 4px; }.chart-export-actions { width: 100%; justify-content: flex-end; }.chart-export-actions button { flex: 1; }
 .chart-hud { top: 8px; left: 8px; padding: 4px 7px; font-size: .6rem; gap: 7px; }.chart-hud strong { font-size: .58rem; }
 .chart-timeline { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 10px; }.chart-timeline > input[type=range] { grid-row: 2; grid-column: 1 / -1; min-height: 44px; }.tick-position { min-width: 0; }.tick-position input { width: 76px; min-height: 36px; }.tick-readout { min-height: 44px; }
 .chart-navigation { margin-top: 0; }.chart-step { width: 100%; justify-content: center; gap: 4px; }.chart-step button { width: 44px; height: 44px; }.chart-step .chart-play { width: 96px; height: 48px; margin: 0 4px; }.chart-shortcuts { margin-top: 8px; font-size: .6rem; }
 .chart-settings select, .chart-settings input[type=range] { min-height: 44px; }.chart-settings { padding: 14px; }.settings-heading button { min-height: 44px; width: 44px; }
}
</style>
