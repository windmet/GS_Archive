<template>
  <section ref="previewRoot" class="chart-preview" :class="{ 'is-long': mode === 'long', 'is-immersive': immersive }" aria-label="谱面查看器" @keydown.esc="immersive && leaveImmersive()">
    <button v-if="!opened" type="button" class="chart-open" @click="opened = true">打开谱面预览</button>
    <template v-else>
      <header class="chart-toolbar">
        <div v-if="$slots.lead" class="chart-lead"><slot name="lead" /></div>
        <div class="chart-difficulties" role="group" aria-label="谱面难度"><button v-for="d in difficulties" :key="d.type" type="button" :class="`difficulty-${d.type}`" :aria-pressed="selected === d.type" @click="selected = d.type">{{ d.label }} <small>Lv {{ d.levelLabel }}</small></button></div>
        <GsSegmented class="chart-modes" v-model="mode" :options="MODE_OPTIONS" aria-label="谱面视图" />
        <button v-if="mode === 'long'" type="button" :aria-pressed="followPlayback" @click="followPlayback = !followPlayback">跟随播放</button>
        <button v-if="chart && !immersive" type="button" class="chart-immersive-enter" @click="enterImmersive"><Maximize :size="15" aria-hidden="true" />沉浸查看</button>
        <button v-if="immersive" type="button" class="chart-immersive-exit" @click="leaveImmersive"><Minimize :size="15" aria-hidden="true" />退出沉浸</button>
        <div class="chart-actions"><button type="button" :aria-expanded="infoOpen" @click="infoOpen = !infoOpen"><Info :size="15" aria-hidden="true" />谱面信息</button><button v-if="!standalone" type="button" @click="opened = false"><X :size="15" aria-hidden="true" />收起谱面</button><slot name="actions" /><span v-if="chart && mode === 'long'" class="chart-export-actions"><button type="button" :disabled="exporting" :aria-busy="exporting && exportFormat === 'png'" @click="download('png')"><Download :size="15" aria-hidden="true" />{{ exporting && exportFormat === 'png' ? `正在导出 PNG ${exportProgress}%…` : '保存长轨 PNG' }}</button><button type="button" :disabled="exporting" :aria-busy="exporting && exportFormat === 'svg'" @click="download('svg')"><Download :size="15" aria-hidden="true" />{{ exporting && exportFormat === 'svg' ? '正在导出…' : '导出 SVG' }}</button></span></div>
      </header>
      <div class="chart-layout" :class="{ 'has-panel': residentPanel }">
      <div class="chart-main">
      <p v-if="exportError" role="alert">{{ exportError }} <button type="button" :disabled="exporting" @click="download(exportFormat)">重试导出</button></p>
      <p v-if="audioError" role="alert">{{ audioError }}</p>
      <p v-if="soundError" role="alert">{{ soundError }}</p>
      <p v-if="loading" role="status">正在加载谱面…</p>
      <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="loadChart">重试</button></p>
      <template v-else-if="chart">
        <div class="chart-viewport" :class="{ 'is-long': mode === 'long' }" tabindex="0" role="region" aria-label="谱面画布" @keydown="onCanvasKey"><p class="chart-count chart-hud"><strong>{{ activeDifficulty.label }}</strong><span>最大 Combo {{ activeDifficulty.maxCombo }}</span></p><ArchiveSongTrackPreview v-if="mode === 'perspective'" :chart="chart" :skin="skin" :title="`${title} ${activeDifficulty.label}`" :position="trackPosition" :speed="safeSpeed" :effects="trackEffects" :combo="trackCombo" :combo-enabled="comboEnabled" :demonstration-enabled="demonstrationEnabled" /><ArchiveSongLongPreview v-else ref="longPreview" :chart="chart" :skin="skin" :title="`${title} ${activeDifficulty.label}`" :cursor="safeCursor" :scale="scale" :layout="longLayout" :follow="followPlayback && playing" @seek="seek" /></div>
        <footer class="chart-transport" aria-label="谱面播放控制台" :data-clock-phase="clockSnapshot.phase" :data-sound-set="soundSet" :data-sound-scheduled="soundStats.scheduled" :data-sound-active="soundStats.active" :data-sound-decoded="soundStats.decoded" :data-sound-context="soundStats.context">
          <audio v-if="audioTrack?.url" ref="audio" :src="audioTrack.url" preload="none" aria-label="谱面同步完整混音" @loadedmetadata="applyPendingSeek" />
          <div class="chart-timeline"><span class="chart-time">{{ formatChartTime(currentSeconds) }} <small>/ {{ formatChartTime(totalSeconds) }}</small></span><input :value="currentSeconds" type="range" min="0" :max="totalSeconds" step="0.01" aria-label="谱面时间轴" @input="seekSeconds(Number($event.target.value))" /><div v-if="maintainer" class="tick-position"><button v-if="!editingTick" ref="tickButton" type="button" class="tick-readout" aria-label="编辑谱面 tick 位置" title="点击输入 tick 精确定位" :data-tick="Math.round(safeCursor)" @click="editTick">Tick {{ Math.round(safeCursor) }} <span>/ {{ chart.maxTick }}</span></button><label v-else>Tick <input ref="tickInput" v-model="tickDraft" type="number" min="0" :max="chart.maxTick" step="1" aria-label="轨道位置 tick" @blur="commitTick()" @keydown.enter.prevent="commitTick(true)" @keydown.esc.stop.prevent="cancelTick(true)" /> <span>/ {{ chart.maxTick }}</span></label></div></div>
          <div class="chart-navigation"><div class="chart-step" role="group" aria-label="谱面播放操作"><button type="button" aria-label="回到开头" title="歌曲开头 · 0 秒" @click="seek(0)"><SkipBack :size="19" aria-hidden="true" /></button><button type="button" aria-label="上一个音符" title="上一个音符 · ←" :disabled="!previousNote" @click="step(-1)"><ChevronLeft :size="23" aria-hidden="true" /></button><button type="button" class="chart-play" :aria-label="starting || playing ? '暂停' : '播放'" :disabled="!audioTrack?.url" @click="togglePlayback"><component :is="starting || playing ? Pause : Play" :size="21" aria-hidden="true" />{{ starting || playing ? '暂停' : '播放' }}</button><button type="button" aria-label="下一个音符" title="下一个音符 · →" :disabled="!nextNote" @click="step(1)"><ChevronRight :size="23" aria-hidden="true" /></button><button type="button" aria-label="播放末尾" title="播放末尾（含尾奏）" @click="seekSeconds(totalSeconds)"><SkipForward :size="19" aria-hidden="true" /></button></div></div>
          <p v-if="clockSnapshot.phase === 'waiting' || locateMessage" class="chart-position-status" role="status">{{ clockSnapshot.phase === 'waiting' ? '正在缓冲音频…' : locateMessage }}</p>
          <p v-if="maintainer && demonstrationEnabled && demonstrationState" class="chart-demonstration chart-position-status" aria-label="自动演示事件统计" :data-count="demonstrationState.count" :data-total="demonstrationState.total" :data-epoch="demonstrationState.epoch" :data-seconds="demonstrationState.seconds">演示事件 {{ demonstrationState.count }} / {{ demonstrationState.total }} <span>· 持续长条 {{ demonstrationState.holds.length }}</span><span v-for="hold in demonstrationState.holds" :key="hold.sourceIndex" :data-hold-source="hold.sourceIndex" :data-lane="hold.lane"> · 轨位 {{ (hold.lane + 1).toFixed(1) }}</span></p>        </footer>
      </template>
      </div>
        <div v-if="panelVisible" :id="`${uid}-settings`" class="chart-settings" :class="wide ? 'is-resident' : 'is-tabbed'" role="group" aria-label="谱面视图设置">
          <div v-if="!wide" class="chart-settings-tabs" role="tablist" aria-label="谱面设置分组" @keydown="onSettingsTabKey"><button v-for="group in SETTINGS_GROUPS" :id="`${uid}-tab-${group.id}`" :key="group.id" type="button" role="tab" :aria-selected="settingsTab === group.id" :aria-controls="`${uid}-panel-${group.id}`" :tabindex="settingsTab === group.id ? 0 : -1" @click="settingsTab = group.id">{{ group.label }}</button></div>
          <section v-show="wide || settingsTab === 'view'" :id="`${uid}-panel-view`" class="chart-group" :role="wide ? undefined : 'tabpanel'" :aria-labelledby="wide ? `${uid}-g-view` : `${uid}-tab-view`">
            <h3 v-if="wide" :id="`${uid}-g-view`">观看</h3>
            <GsRow label="贴图样式"><select v-model="skin" aria-label="轨道音符贴图"><option value="Note1SpriteAtlas">圆形</option><option value="Note2SpriteAtlas">菱形</option><option value="Note3SpriteAtlas">横条</option></select></GsRow>
            <template v-if="mode === 'perspective'"><GsRow label="音符速度"><template #info>1.0–11.0，沿用原作设置刻度；越大落下越快。</template><input v-model.number="speed" class="chart-number" type="number" min="1" max="11" step="0.1" aria-label="轨道视觉配速" @change="speed = safeSpeed" /><input v-model.number="speed" class="chart-range" type="range" min="1" max="11" step="0.1" aria-label="轨道配速滑杆" /></GsRow></template>
            <template v-else><GsRow label="纵向缩放"><select v-model.number="scale" aria-label="谱面纵向缩放"><option :value="55">紧凑</option><option :value="90">标准</option><option :value="150">放大</option></select></GsRow><GsRow label="长轨排布"><select v-model="longLayout" aria-label="长轨排布"><option value="auto">自动</option><option value="columns">分栏横向阅读</option><option value="continuous">单栏纵向阅读</option></select></GsRow></template>
          </section>
          <section v-show="wide || settingsTab === 'sound'" :id="`${uid}-panel-sound`" class="chart-group" :role="wide ? undefined : 'tabpanel'" :aria-labelledby="wide ? `${uid}-g-sound` : `${uid}-tab-sound`">
            <h3 v-if="wide" :id="`${uid}-g-sound`">声音</h3>
            <GsRow label="播放速度"><select v-model.number="playbackRate" aria-label="谱面播放速度"><option :value="0.5">0.5×</option><option :value="0.75">0.75×</option><option :value="1">1×</option><option :value="1.25">1.25×</option><option :value="1.5">1.5×</option></select></GsRow>
            <GsRow label="音量"><input v-model.number="volume" class="chart-range" type="range" min="0" max="1" step="0.01" aria-label="谱面音量" /></GsRow>
            <GsRow label="打击音"><template #info>所有套装均可用于任意歌曲，播放时独立于自动演示开关。</template><select v-model="soundSet" aria-label="谱面打击音套装"><option value="off">关闭</option><option value="se1">SE1</option><option value="se2">SE2</option><option value="se3">SE3</option><option value="president">社长愚人节</option></select></GsRow>
            <GsRow label="音效音量"><input v-model.number="soundVolume" class="chart-range" type="range" min="0" max="1" step="0.01" aria-label="谱面音效音量" /></GsRow>
            <GsRow label="音符时机"><template #info>{{ noteTimingMilliseconds }} ms · 原作刻度 -30～30，每格约 16.67ms。正值延后、负值提前谱面与打击音，0 为关闭；歌曲音频不变。</template><input v-model.number="noteTiming" class="chart-number" type="number" min="-30" max="30" step="1" aria-label="音符时机调整" @change="noteTiming = Math.max(-30,Math.min(30,Math.round(Number(noteTiming)||0)))" /></GsRow>
          </section>
          <section v-show="wide || settingsTab === 'demo'" :id="`${uid}-panel-demo`" class="chart-group" :role="wide ? undefined : 'tabpanel'" :aria-labelledby="wide ? `${uid}-g-demo` : `${uid}-tab-demo`">
            <h3 v-if="wide" :id="`${uid}-g-demo`">演示</h3>
            <GsRow label="自动演示"><template #info>显示当前位置已过事件与持续长条，不进行触摸判定或评分。</template><GsSwitch v-model="demonstrationEnabled" aria-label="自动演示事件统计" /></GsRow>
            <GsRow label="Combo 提示"><template #info>显示已过谱面事件的 Combo，数字动画随播放暂停，不进行评分。</template><GsSwitch v-model="comboEnabled" aria-label="Combo 提示动画" /></GsRow>
          </section>
        </div>
      </div>
      <div v-if="infoOpen" class="chart-info"><p v-if="chart" class="chart-shortcuts">聚焦画布：<kbd>空格</kbd> 播放 / 暂停 <span>·</span> <kbd>←</kbd><kbd>→</kbd> 跳音符 <span>·</span> <kbd>Home</kbd><kbd>End</kbd> 首尾</p><p v-if="chart">{{ activeDifficulty.label }} · {{ chart.noteObjectCount }} 个原始音符对象 · 最大 Combo {{ activeDifficulty.maxCombo }}。音符对象和判定点计数不同。<template v-if="chart.hiddenAfterSongEnd">原始数据另有 {{ chart.hiddenAfterSongEnd }} 个音符位于歌曲结束之后，游戏中不会出现，此处不显示。</template></p><p v-if="chart && mode === 'long'">PNG 保存完整单栏长轨（2×，宽 820px）；SVG 保存当前排布。超出浏览器 PNG 预算时，可保存 SVG 后离线导出。</p><p v-if="maintainer">五轨原生贴图：绿 Tap / 长条，黄左划、青右划、红上划，紫星 P 技能，绿 315 Special。绿色横条依照原生 poly 内部索引生成；预览不进行游戏判定。</p><p v-if="maintainer">完整混音音频作为播放时钟，与 2D 舞台使用同一音频资源。谱面按各段 BPM 换算时间。视图的基础读取时长、逐音符速度（含 Special）、轨道坐标、音符四角及长条网格已有原生依据；滑键箭头随歌曲时间循环移动，暂停时冻结。打击音的四套样式可用于任意歌曲，也可单独关闭；预览不进行触摸判定。</p></div>
    </template>
  </section>
</template>

<script setup>
import { PlayerPreferencesRepository } from '../../core/story-runtime/PlayerPreferencesRepository.js'
const masterVolume = new PlayerPreferencesRepository().load().volumes.master
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ChevronLeft, ChevronRight, Download, Info, Maximize, Minimize, Pause, Play, SkipBack, SkipForward, X } from '@lucide/vue'
import { usePlayerImmersiveMode } from '../../composables/usePlayerImmersiveMode.js'
import { playableSongChart, validateSongChart } from '../../presentation/SongChartPresentation.js'
import { buildSongChartTiming, formatChartTime } from '../../presentation/SongChartTiming.js'
import { createSongChartPlaybackCadence } from '../../presentation/SongChartPlaybackCadence.js'
import { compileSongChartDemonstration, createSongChartDemonstration } from '../../presentation/SongChartDemonstration.js'
import { createSongChartHitEffectPool } from '../../presentation/SongChartHitEffectSelection.js'
import { createSongChartSoundPlayer } from '../../presentation/SongChartSoundPlayer.js'
import { createSongComboPresentation, delayedChartSeconds, noteTimingSeconds } from '../../presentation/SongComboTiming.js'
import { createMediaElementClock } from '../../utils/mediaElementClock.js'
import { assertBrowserSongChartPng, exportSongChartPng } from '../../presentation/SongChartPngExport.js'
import ArchiveSongTrackPreview from './ArchiveSongTrackPreview.vue'
import GsRow from '../gs/GsRow.vue'
import GsSegmented from '../gs/GsSegmented.vue'
import GsSwitch from '../gs/GsSwitch.vue'
import { isMaintainerMode } from '../../core/maintainerMode.js'
import ArchiveSongLongPreview from './ArchiveSongLongPreview.vue'
import { embedSongChartImages, songNoteEndpoints } from '../../presentation/SongNotePresentation.js'
const props = defineProps({ songCode: { type: String, required: true }, title: { type: String, required: true }, difficulties: { type: Array, required: true }, initialDifficulty: { type: Number, default: null }, audioTrack: { type: Object, default: null }, standalone: Boolean })
const emit = defineEmits(['request-play'])
// 沉浸查看: the track fills the screen and owns every touch, so several fingers on it neither
// scroll nor zoom the page. Fullscreen is asked for inside the tap; where the browser refuses it
// (iPhone Safari) the fixed full-window view still applies.
const previewRoot = ref(null), immersive = ref(false)
const { active: fullscreenActive, enter: enterFullscreen, leave: leaveFullscreen } = usePlayerImmersiveMode()
function enterImmersive() {
  mode.value = 'perspective'; infoOpen.value = false
  immersive.value = true
  void enterFullscreen(previewRoot.value)
}
function leaveImmersive() {
  immersive.value = false
  if (fullscreenActive.value) void leaveFullscreen()
}
watch(fullscreenActive, (active, was) => { if (was && !active) immersive.value = false })
const uid = `chart-viewer-${getCurrentInstance().uid}`
// Start on the difficulty the song page asked for when this song has it, otherwise the first.
const startDifficulty = props.difficulties.some(d => d.type === props.initialDifficulty) ? props.initialDifficulty : props.difficulties[0]?.type || 1
const opened = ref(props.standalone), selected = ref(startDifficulty), mode = ref('perspective')
const scale = ref(90), skin = ref('Note1SpriteAtlas'), speed = ref(5), longLayout = ref('auto'), followPlayback = ref(false)
const infoOpen = ref(false), longPreview = ref(null)
// Wide viewers keep the settings as a resident 292px column beside the canvas; narrow ones put the same three
// groups under the canvas as underline tabs, adjusted in place instead of in a popover that has to scroll.
const MODE_OPTIONS = [{ value: 'perspective', label: '透视' }, { value: 'long', label: '长轨' }]
const maintainer = isMaintainerMode()
const wide = ref(false)
const residentPanel = computed(() => wide.value && !immersive.value && opened.value)
const panelVisible = computed(() => opened.value && !immersive.value)
const SETTINGS_GROUPS = [{ id: 'view', label: '观看' }, { id: 'sound', label: '声音' }, { id: 'demo', label: '演示' }]
const settingsTab = ref('view')
let widthObserver
const editingTick = ref(false), tickDraft = ref(''), tickInput = ref(null), tickButton = ref(null)
const chart = shallowRef(null), error = ref(''), loading = ref(false), cursor = ref(0), locateMessage = ref('')
// A stable, non-reactive container passes the ref itself into the track. The
// parent template never reads its value, so a track frame cannot rerender it.
const trackPosition = Object.freeze({ tick: shallowRef(0), ended: shallowRef(false) })
const trackEffects = Object.freeze({ state: shallowRef(null) })
const trackCombo = Object.freeze({ state: shallowRef(null) })
const comboEnabled = ref(true), noteTiming = ref(0), transportSeconds = ref(0)
const noteTimingMilliseconds = computed(() => (noteTimingSeconds(noteTiming.value)*1000).toFixed(1))
const chartSeconds = seconds => delayedChartSeconds(seconds,noteTiming.value)
let comboPresentation = createSongComboPresentation()
let effectPool = null
const exporting = ref(false), exportError = ref(''), audio = ref(null), audioError = ref(''), starting = ref(false)
const exportFormat = ref('svg'), exportProgress = ref(0)
const playbackRate = ref(1), volume = ref(1), clockSnapshot = ref({ phase: 'idle', currentTime: 0, duration: null })
const soundSet = ref('se1'), soundVolume = ref(.7), soundError = ref('')
const sounds = createSongChartSoundPlayer()
const soundStats = shallowRef(sounds.stats)
watch(soundSet, async set => {
  soundError.value = ''; sounds.cancel()
  if (!playing.value) return
  try { if (await sounds.prepare(set) === false) return; sounds.seek(chartSeconds(audio.value?.currentTime || 0)) }
  catch { soundError.value = '打击音加载失败，请重新选择套装重试。' }
})
const activeDifficulty = computed(() => props.difficulties.find(d => d.type === selected.value))
const timing = computed(() => chart.value ? buildSongChartTiming(chart.value) : null)
const safeCursor = computed(() => Math.min(chart.value?.maxTick || 0, Math.max(0, Number(cursor.value) || 0)))
const safeSpeed = computed(() => Math.round(Math.max(1, Math.min(11, Number(speed.value) || 5)) * 10) / 10)
const currentSeconds = computed(() => Math.max(0,transportSeconds.value))
const totalSeconds = computed(() => Math.max(timing.value?.duration || 0, clockSnapshot.value.duration || props.audioTrack?.source?.duration_seconds || 0))
const playing = computed(() => ['playing','waiting'].includes(clockSnapshot.value.phase) || (clockSnapshot.value.phase === 'seeking' && !audio.value?.paused))
const endpoints = computed(() => chart.value ? songNoteEndpoints(chart.value) : [])
// Defaults: perspective track, auto demonstration, hit sound SE1 at 70%, Combo on.
const demonstrationEnabled = ref(true), demonstrationState = shallowRef(null)
let demonstration = null, demonstrationFrame = null
function sampleDemonstration(seconds, discontinuity = false) {
  if (!demonstration) return
  seconds = chartSeconds(seconds)
  demonstrationFrame = discontinuity ? demonstration.seek(seconds) : demonstration.advance(seconds)
  trackCombo.state.value = comboPresentation.sample(demonstrationFrame,discontinuity)
  if (demonstrationEnabled.value && effectPool) {
    trackEffects.state.value = discontinuity
      ? effectPool.seek(seconds, demonstrationFrame?.holds || [])
      : effectPool.advance(seconds, demonstrationFrame?.crossed || [], demonstrationFrame?.holds || [])
  }
}
function seekDemonstration(seconds) {
  sampleDemonstration(seconds, true)
  demonstrationState.value = demonstrationFrame
}
watch(demonstrationEnabled, enabled => {
  if (!enabled) {
    effectPool?.clear()
    trackEffects.state.value = null
    demonstrationState.value = null
  } else {
    seekDemonstration(audio.value?.readyState >= 1 ? audio.value.currentTime : pendingSeconds)
  }
})
const previousNote = computed(() => endpoints.value.filter(n => n.tick < safeCursor.value - .001).at(-1))
const nextNote = computed(() => endpoints.value.find(n => n.tick > safeCursor.value + .001))
let controller, generation = 0, frame = 0, playGeneration = 0, pendingSeconds = 0
const cadence = createSongChartPlaybackCadence({
  track: seconds => {
    if (timing.value) trackPosition.tick.value = timing.value.secondsToTick(chartSeconds(seconds))
    sampleDemonstration(seconds)
  },
  controls: seconds => {
    transportSeconds.value = seconds
    soundStats.value = sounds.stats
    if (timing.value) cursor.value = timing.value.secondsToTick(chartSeconds(seconds))
    if (demonstrationEnabled.value) demonstrationState.value = demonstrationFrame
  },
})
watch(mode, () => {
  if (audio.value?.readyState >= 1) syncMediaPosition()
  else cadence.sync(pendingSeconds)
})
const clock = createMediaElementClock(snapshot => {
  clockSnapshot.value = snapshot
  trackPosition.ended.value = snapshot.phase === 'ended'
  if (['seeking', 'waiting', 'ready', 'paused', 'ended', 'error'].includes(snapshot.phase)) sounds.seek(chartSeconds(snapshot.currentTime))
  soundStats.value = sounds.stats
  if (snapshot.phase === 'seeking') seekDemonstration(snapshot.currentTime)
  if (snapshot.phase === 'ended') syncMediaPosition()
  if (snapshot.phase === 'error') { audioError.value = '歌曲音频加载失败，请点击播放重试。'; stopPlayback() }
})
watch(audio, element => { clock.bind(element); if (element) { element.playbackRate = playbackRate.value; element.volume = volume.value * masterVolume } })
watch(playbackRate, value => { sounds.seek(chartSeconds(audio.value?.currentTime || 0)); if (audio.value) audio.value.playbackRate = value })
watch(noteTiming, () => {
  const seconds = audio.value?.readyState >= 1 ? audio.value.currentTime : pendingSeconds
  sounds.seek(chartSeconds(seconds)); seekDemonstration(seconds); cadence.sync(seconds)
})
watch(volume, value => { if (audio.value) audio.value.volume = value * masterVolume })
async function loadChart() {
  stopPlayback(); const current = ++generation; controller?.abort()
  editingTick.value = false
  chart.value = null; error.value = ''; loading.value = false; locateMessage.value = ''; exportError.value = ''; audioError.value = ''
  demonstration = null; demonstrationFrame = null; demonstrationState.value = null; effectPool?.clear(); effectPool = null; trackEffects.state.value = null
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
    if (current === generation) {
      chart.value = playableSongChart(parsed, props.audioTrack?.source?.duration_seconds)
      const timeline = compileSongChartDemonstration(chart.value)
      demonstration = createSongChartDemonstration(timeline)
      comboPresentation = createSongComboPresentation(timeline)
      sounds.setTimeline(timeline)
      effectPool = createSongChartHitEffectPool({ setIndex: 1 })
      loading.value = false; seekSeconds(0)
    }
  } catch (e) { if (current === generation && e.name !== 'AbortError') error.value = e.message || '谱面加载失败' }
  finally { if (current === generation) loading.value = false }
}
watch([opened, selected, () => props.songCode], loadChart)
onMounted(() => {
  if (props.standalone) void loadChart()
  if (typeof ResizeObserver === 'function' && previewRoot.value) { widthObserver = new ResizeObserver(([entry]) => { wide.value = entry.contentRect.width >= 860 }); widthObserver.observe(previewRoot.value) }
})
onBeforeUnmount(() => {
  widthObserver?.disconnect()
  stopPlayback(); sounds.dispose(); generation++; controller?.abort(); clock.dispose()
})
function applyPendingSeek() { clock.seek(pendingSeconds) }
function seekSeconds(seconds) {
  trackPosition.ended.value = false
  const time = Math.max(0, Math.min(totalSeconds.value, Number(seconds) || 0))
  pendingSeconds = time; sounds.seek(chartSeconds(time)); seekDemonstration(time); cadence.sync(time); locateMessage.value = ''
  if (audio.value?.readyState >= 1) clock.seek(time)
  void nextTick(() => longPreview.value?.scrollToTick())
}
function seek(tick) { seekSeconds(timing.value.tickToSeconds(Math.max(0, Math.min(chart.value.maxTick, Number(tick) || 0))) + noteTimingSeconds(noteTiming.value)) }
function step(direction) {
  syncMediaPosition()
  const note = direction > 0 ? nextNote.value : previousNote.value
  if (note) { seek(note.tick); locateMessage.value = `tick ${note.tick} · 轨位 ${note.lane + 1}` }
}
function syncMediaPosition() {
  if (audio.value && timing.value && audio.value.readyState >= 1) {
    pendingSeconds = audio.value.currentTime
    cadence.sync(pendingSeconds)
  }
}
function stopPlayback() {
  sounds.cancel()
  playGeneration++; starting.value = false
  if (frame) cancelAnimationFrame(frame)
  frame = 0; cadence.reset()
  // Preserve the exact media position when pausing between visual frames.
  syncMediaPosition()
  audio.value?.pause()
}
defineExpose({ pause: stopPlayback })
function updatePlayback(now = 0) {
  const element = audio.value
  if (!element || element.paused || !timing.value) {
    syncMediaPosition(); cadence.reset(); frame = 0; return
  }
  pendingSeconds = element.currentTime
  // During seek/buffering retain the last media-derived state. The seek event
  // rebuilds holds; the first playing sample resumes from that new position.
  if (!element.seeking && clockSnapshot.value.phase === 'playing') {
    cadence.paint(now, pendingSeconds, mode.value === 'perspective')
    if (soundSet.value !== 'off') sounds.paint(chartSeconds(pendingSeconds), playbackRate.value, soundVolume.value * masterVolume)
  }
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
  // Explicit seek/loadedmetadata already applies pendingSeconds. Seeking again
  // on resume would discard the frozen effects and restart their epoch.
  try {
    soundError.value = ''
    try { await sounds.prepare(soundSet.value) }
    catch { soundError.value = '打击音加载失败，歌曲仍可播放；请重新选择套装重试。' }
    if (current !== playGeneration) return
    sounds.seek(chartSeconds(element.currentTime))
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
// Arrow keys move between the three tabs, as a tablist does.
function onSettingsTabKey(event) {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!step) return
  event.preventDefault()
  const index = SETTINGS_GROUPS.findIndex(group => group.id === settingsTab.value)
  settingsTab.value = SETTINGS_GROUPS[(index + step + SETTINGS_GROUPS.length) % SETTINGS_GROUPS.length].id
  void nextTick(() => document.getElementById(`${uid}-tab-${settingsTab.value}`)?.focus())
}
async function editTick() {
  syncMediaPosition()
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
/* Chart viewer: the canvas is the stage (dark, like the game); the controls around it are archive
   controls on the paper. Difficulty colours are game semantics, like attribute colours. */
.chart-preview { container: chart-preview / inline-size; margin-top: var(--gs-space-5); padding-top: var(--gs-space-4); border-top: 1px solid var(--gs-line); color: var(--gs-ink); }
button, select, input[type=number] { box-sizing: border-box; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); cursor: pointer; }
button:disabled { opacity: .4; cursor: default; }
button:not(:disabled):hover { border-color: var(--gs-ink-3); }
.chart-toolbar > button[aria-pressed=true] { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); color: var(--gs-selected-ink); }
select { max-width: 100%; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-3); }
input[type=number] { min-height: var(--gs-control-compact); padding: 0 var(--gs-space-2); }
.chart-open { min-height: var(--gs-control-touch); }
.chart-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-3); margin-bottom: var(--gs-space-3); }
.chart-difficulties, .chart-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-2); }
.chart-difficulties button { flex-direction: column; gap: var(--gs-space-1); min-width: 76px; height: var(--gs-control-touch); padding: 0 var(--gs-space-3); border-color: var(--diff-color); color: var(--diff-color); font-size: var(--gs-text-meta); line-height: 1.2; white-space: nowrap; }
.chart-difficulties small { font-family: var(--gs-font-stage); font-size: var(--gs-text-caption); }
.difficulty-1 { --diff-color: #247145; }
.difficulty-2 { --diff-color: #24649c; }
.difficulty-3 { --diff-color: #936309; }
.difficulty-4 { --diff-color: #994070; }
.chart-difficulties button[aria-pressed=true] { background: var(--diff-color); color: var(--gs-surface); }
.chart-actions { margin-left: auto; }
/* lead: what the host puts first in the row (the chart tool's song); it gives way before the controls wrap. */
.chart-lead { display: flex; flex: 1 1 160px; min-width: 0; }
.chart-actions button { height: var(--gs-control-touch); gap: 6px; }
.chart-actions svg { flex-shrink: 0; }
.chart-export-actions { display: flex; align-items: center; gap: var(--gs-space-2); }
.chart-settings { box-sizing: border-box; display: flex; flex-direction: column; color: var(--gs-ink); }
/* Under the canvas: three panel tabs (40px, underline), then the chosen group's rows. */
.chart-settings.is-tabbed { margin-top: var(--gs-gap-group); }
.chart-settings-tabs { display: flex; height: 40px; border-bottom: 1px solid var(--gs-line); }
.chart-settings-tabs button { flex: 1; min-width: 0; padding: 0; border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); cursor: pointer; }
.chart-settings-tabs button:hover { color: var(--gs-ink); }
.chart-settings-tabs button[aria-selected=true] { border-bottom-color: var(--gs-selected-line); color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
.chart-settings-tabs button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
.chart-layout.has-panel { display: grid; grid-template-columns: minmax(0, 1fr) var(--gs-tool-panel-compact); gap: var(--gs-gap-group); align-items: start; }
.chart-main { min-width: 0; }
/* Resident column: three groups on the paper, a hairline under each heading; no box. */
.chart-settings.is-resident { gap: var(--gs-gap-group); }
.chart-group { display: flex; flex-direction: column; }
.chart-group h3 { margin: 0; padding-bottom: var(--gs-space-2); border-bottom: 1px solid var(--gs-line); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); letter-spacing: var(--gs-track-label); }
.chart-group select { min-width: 0; max-width: 150px; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.chart-group .chart-number { width: 56px; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-2); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.chart-group .chart-range { flex: 0 1 96px; width: auto; min-width: 48px; margin: 0; }
/* Labels keep one line: the label column takes its own width and the control gives way (a slider narrows first).
   The ⓘ bubble spans its row, under it, so a scrolling settings column never cuts it off at the side. */
.chart-group .gs-row:not(.stacked) { position: relative; grid-template-columns: auto minmax(0, 1fr); }
.chart-group :deep(.gs-row-label) { white-space: nowrap; }
.chart-group :deep(.gs-info) { position: static; }
.chart-group :deep(.gs-info-bubble) { top: calc(100% - var(--gs-space-2)); right: 0; left: 0; width: auto; max-width: none; transform: none; white-space: normal; }
/* The scoped `button` rule above reaches GsSwitch's root; give the switch its own box back. */
.chart-group .gs-switch { min-height: 0; padding: 0; border: 0; border-radius: var(--gs-radius-pill); background: var(--gs-switch-off); }
.chart-group .gs-switch[aria-checked=true] { background: var(--gs-switch-on); }
.chart-settings label { display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: center; gap: var(--gs-space-3); color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.chart-settings input[type=range] { width: 100%; min-width: 0; margin: 0; }
.chart-settings .speed-setting { grid-template-columns: 76px 65px minmax(0, 1fr); gap: var(--gs-space-3); }
.speed-setting input[type=number] { width: 65px; }
.settings-audio { display: flex; flex-direction: column; gap: var(--gs-space-3); padding-top: var(--gs-space-4); border-top: 1px solid var(--gs-line); }
.setting-note { margin: calc(-1 * var(--gs-space-3)) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.6; }
.chart-viewport { position: relative; border-radius: var(--gs-radius-media); }
.chart-hud { position: absolute; z-index: 2; top: 12px; left: 12px; display: flex; align-items: center; gap: 10px; margin: 0; padding: 6px 10px; border: 1px solid #9bc3d333; border-radius: var(--gs-radius-control); background: #10212ad9; color: #dcebed; backdrop-filter: blur(6px); font-size: var(--gs-text-meta); pointer-events: none; }
.chart-hud strong { color: var(--gs-surface); font-size: var(--gs-text-meta); }
.chart-hud span { font-variant-numeric: tabular-nums; }
.is-long .chart-hud { position: static; padding: var(--gs-space-3) var(--gs-space-4); border: 0; border-radius: 0; border-top-left-radius: var(--gs-radius-media); border-top-right-radius: var(--gs-radius-media); background: var(--gs-chrome); }
/* The transport sits on the paper under the canvas: a hairline, then time and the step controls (one row when there is room). */
.chart-transport { margin-top: var(--gs-space-3); padding: var(--gs-space-3) 0 0; border-top: 1px solid var(--gs-line); }
.chart-timeline { display: flex; align-items: center; gap: var(--gs-space-4); }
.chart-time { color: var(--gs-ink); font-family: var(--gs-font-stage); font-size: var(--gs-text-body); font-variant-numeric: tabular-nums; white-space: nowrap; }
.chart-time small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.chart-timeline > input[type=range] { flex: 1; width: 100%; min-width: 60px; margin: 0; }
.tick-position { min-width: 156px; color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-variant-numeric: tabular-nums; }
.tick-position label { display: flex; align-items: center; justify-content: flex-end; gap: var(--gs-space-2); white-space: nowrap; }
.tick-position input { width: 78px; font-size: var(--gs-text-meta); }
.tick-readout { width: 100%; justify-content: flex-end; padding: var(--gs-space-1) 0; border-color: transparent; background: none; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.chart-navigation { display: flex; align-items: center; justify-content: center; margin-top: var(--gs-space-3); }
.chart-step { display: flex; align-items: center; gap: var(--gs-space-2); }
.chart-step button { width: var(--gs-control-normal); height: var(--gs-control-normal); padding: 0; border-color: transparent; background: none; color: var(--gs-ink-2); }
.chart-step .chart-play { width: 100px; height: 48px; margin: 0 var(--gs-space-2); border-color: var(--gs-play-bg); border-radius: var(--gs-radius-pill); background: var(--gs-play-bg); color: var(--gs-play-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
input[type=range] { min-height: var(--gs-control-compact); accent-color: var(--gs-mint); cursor: pointer; }
.chart-position-status, .chart-shortcuts { margin: var(--gs-space-3) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.7; }
.chart-shortcuts { display: flex; flex-wrap: wrap; align-items: center; gap: var(--gs-space-1); }
kbd { padding: 0 var(--gs-space-1); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-media); background: var(--gs-surface); color: var(--gs-ink-2); font-family: inherit; font-size: var(--gs-text-caption); }
.chart-shortcuts > span { margin: 0 var(--gs-space-1); color: var(--gs-ink-3); }
.chart-info { margin-top: var(--gs-space-3); padding-left: var(--gs-space-4); border-left: 2px solid var(--gs-mint); color: var(--gs-ink-2); font-size: var(--gs-text-ui); line-height: 1.7; }
.chart-info p { margin: var(--gs-space-1) 0; }
button:focus-visible, select:focus-visible, input:focus-visible, .chart-viewport:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
/* 沉浸查看: one fixed screen; the track takes the room left by the difficulty row and the transport
   and keeps its 16:9. touch-action: none stops pans and pinches from reaching the page. */
.chart-immersive-exit { display: none; }
section.chart-preview.is-immersive { position: fixed; z-index: 1100; inset: 0; display: flex; flex-direction: column; gap: var(--gs-space-2); margin: 0; padding: max(8px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)); border: 0; background: var(--gs-paper); overscroll-behavior: none; touch-action: none; }
.is-immersive .chart-toolbar { flex: none; margin: 0; }
.is-immersive .chart-lead, .is-immersive .chart-modes, .is-immersive .chart-actions, .is-immersive .chart-info, .is-immersive .chart-shortcuts, .is-immersive .tick-position { display: none; }
.is-immersive .chart-immersive-exit { display: inline-flex; height: var(--gs-control-touch); margin-left: auto; }
.is-immersive .chart-viewport { display: grid; flex: 1 1 0; place-items: center; min-height: 0; container-type: size; }
.is-immersive .chart-viewport :deep(.track-preview) { width: min(100cqw, calc(100cqh * 16 / 9)); }
.is-immersive .chart-transport { flex: none; margin: 0; padding-top: var(--gs-space-2); }
.is-immersive .chart-navigation { margin-top: var(--gs-space-1); }
@media (max-height: 500px) {
  .is-immersive .chart-difficulties button { height: var(--gs-control-normal); }
  .is-immersive .chart-transport { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-4); }
  .is-immersive .chart-navigation { margin: 0; }
}
@container chart-preview (min-width: 561px) {
  .chart-transport { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: var(--gs-space-5); }
  .chart-transport > .chart-navigation { margin: 0; }
  .chart-transport > p { grid-column: 1 / -1; }
}
@container chart-preview (max-width: 560px) {
  .chart-lead { flex-basis: 100%; }
  .chart-difficulties { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); width: 100%; gap: var(--gs-space-2); }
  .chart-difficulties button { min-width: 0; padding: 0 var(--gs-space-1); }
  .chart-toolbar { gap: var(--gs-space-3); }
  .chart-actions { width: 100%; margin-left: 0; gap: var(--gs-space-2); }
  .chart-actions > button { flex: 1; padding: 0 var(--gs-space-2); }
  .chart-export-actions { width: 100%; justify-content: flex-end; }
  .chart-export-actions button { flex: 1; }
  .chart-hud { top: var(--gs-space-3); left: var(--gs-space-3); gap: var(--gs-space-2); padding: var(--gs-space-1) var(--gs-space-3); }
  .chart-timeline { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--gs-space-1) var(--gs-space-3); }
  .chart-timeline > input[type=range] { grid-row: 2; grid-column: 1 / -1; min-height: var(--gs-control-touch); }
  .tick-position { min-width: 0; }
  .tick-position input { width: 76px; min-height: var(--gs-control-normal); }
  .tick-readout { min-height: var(--gs-control-touch); }
  .chart-navigation { margin-top: 0; }
  .chart-step { width: 100%; justify-content: center; gap: var(--gs-space-1); }
  .chart-step button { width: var(--gs-control-touch); height: var(--gs-control-touch); }
  .chart-step .chart-play { width: 96px; height: 48px; }
  .chart-settings select, .chart-settings input[type=range] { min-height: var(--gs-control-touch); }
}
</style>
