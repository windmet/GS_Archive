<template>
  <div class="chart-preview">
    <button v-if="!opened" type="button" class="chart-open" @click="opened = true">打开长轨谱面预览</button>
    <template v-else>
      <div class="chart-toolbar">
        <label>难度 <select v-model.number="selected" aria-label="谱面难度"><option v-for="d in difficulties" :key="d.type" :value="d.type">{{ d.label }} · Lv {{ d.levelLabel }}</option></select></label>
        <label>视图 <select v-model="mode" aria-label="谱面视图"><option value="long">长轨图</option><option value="perspective">透视轨道</option></select></label>
        <label>贴图 <select v-model="skin" aria-label="轨道音符贴图"><option value="Note1SpriteAtlas">圆形（截图样式）</option><option value="Note2SpriteAtlas">菱形</option><option value="Note3SpriteAtlas">横条</option></select></label>
        <label v-if="mode === 'long'">纵向缩放 <select v-model.number="scale" aria-label="谱面纵向缩放"><option :value="55">紧凑</option><option :value="90">标准</option><option :value="150">放大</option></select></label>
        <button v-if="chart && mode === 'long'" type="button" :disabled="exporting" :aria-busy="exporting" @click="download">{{ exporting ? '正在导出…' : '导出 SVG' }}</button>
        <button v-if="chart && mode === 'long'" type="button" @click="goToFirstNote">首个音符</button>
        <button type="button" @click="opened = false">收起谱面</button>
        <template v-if="chart"><label>定位音符 <select v-model="locateRole" aria-label="定位音符类型"><option value="swipe_left">左划</option><option value="swipe_right">右划</option><option value="swipe_up">上划</option><option value="p_skill">紫星 P 技能</option><option value="sp">Special</option></select></label><button type="button" @click="locateNext">下一个音符</button><span class="chart-note" role="status">{{ locateMessage }}</span></template>
      </div>
      <p v-if="mode === 'long'" class="chart-note">五轨 · 从上往下阅读。原贴图：绿色 Tap / 长条，黄左划、青右划、红上划，紫星 P 技能（LARGE）；绿色徽标 Special 映射暂定。横线连接相同 tick 的头尾。纵轴为原始 tick，尚未与音频同步；密集段可放大阅读。</p>
      <p v-if="exportError" role="alert">{{ exportError }} <button type="button" @click="download">重试导出</button></p>
      <p v-if="loading" role="status">正在加载谱面…</p>
      <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="loadChart">重试</button></p>
      <template v-else-if="chart">
        <p class="chart-note chart-count">{{ activeDifficulty.label }} · {{ chart.noteObjectCount }} 个原始音符对象 · 最大 Combo {{ activeDifficulty.maxCombo }}（两者计数规则不同）</p>
        <ArchiveSongTrackPreview v-if="mode === 'perspective'" ref="trackPreview" :chart="chart" :skin="skin" :title="`${title} ${activeDifficulty.label}`" />
        <div v-else ref="chartScroll" class="chart-scroll" tabindex="0" role="region" :aria-label="`${title} ${activeDifficulty.label} 长轨谱面`">
          <svg ref="svg" class="chart-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" :viewBox="`0 0 ${geometry.width} ${geometry.height}`" :height="geometry.height" width="410" role="img" :aria-label="`${title} ${activeDifficulty.label} 谱面`">
            <title>{{ title }} · {{ activeDifficulty.label }} · 原始 tick</title>
            <defs><template v-for="n in geometry.notes.filter(n => n.held)" :key="n.id"><clipPath v-for="(mesh, i) in n.bodyTriangles" :id="`${uid}-${n.id}-${i}`" :key="i"><polygon :points="mesh.points" /></clipPath></template></defs>
            <rect width="410" :height="geometry.height" fill="#13212e" />
            <line v-for="x in geometry.lanes" :key="x" :x1="x" :x2="x" y1="0" :y2="geometry.height" stroke="#35485a" />
            <g v-for="g in geometry.grid" :key="g.tick"><line x1="78" x2="352" :y1="g.y" :y2="g.y" stroke="#30475c" /><text x="8" :y="g.y + 4" fill="#bccbd8" font-size="11">{{ g.tick }}</text></g>
            <g v-for="(t, i) in geometry.tempos" :key="i"><line x1="78" x2="352" :y1="t.y" :y2="t.y" stroke="#c9a755" stroke-dasharray="3 3" /><text x="358" :y="t.y + 4" fill="#f3ce7b" font-size="10">{{ t.tempo }}</text></g>
            <g v-for="n in geometry.notes.filter(n => n.held)" :key="`hold:${n.id}`" :data-note-path="n.id">
              <g v-for="(mesh, i) in n.bodyTriangles" :key="i" :clip-path="`url(#${uid}-${n.id}-${i})`"><image :href="noteRendering.skins[skin].hold_line.url" width="200" height="200" :transform="mesh.matrix" preserveAspectRatio="none" /></g>
            </g>
            <line v-for="link in geometry.links" :key="link.tick" :data-simultaneous-tick="link.tick" :x1="link.x1" :x2="link.x2" :y1="link.y" :y2="link.y" stroke="#e9faf6" stroke-width="1" opacity=".65" />
            <g v-for="n in geometry.notes.filter(n => n.held)" :key="`tail:${n.id}`" :data-note-tail="n.id" :data-note-role="n.endRole"><ArchiveSongNoteGlyph :role="n.endRole" :skin="skin" :x="n.endX" :y="n.endY" :width="30" /></g>
            <g v-for="n in geometry.notes" :key="n.id" :data-note="n.id" :data-note-type="n.type">
              <ArchiveSongNoteGlyph :role="n.role" :skin="skin" :x="n.x" :y="n.y" :width="30" />
            </g>
          </svg>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { buildSongChartGeometry, validateSongChart } from '../../presentation/SongChartPresentation.js'
import ArchiveSongTrackPreview from './ArchiveSongTrackPreview.vue'
import ArchiveSongNoteGlyph from './ArchiveSongNoteGlyph.vue'
import { embedSongChartImages, noteRendering, songNoteEndpoints } from '../../presentation/SongNotePresentation.js'
const props = defineProps({ songCode: { type: String, required: true }, title: { type: String, required: true }, difficulties: { type: Array, required: true } })
const opened = ref(false), selected = ref(props.difficulties[0]?.type || 1), scale = ref(90)
const chart = ref(null), error = ref(''), loading = ref(false), svg = ref(null)
const chartScroll = ref(null)
const mode = ref('long')
const uid = `long-chart-${getCurrentInstance().uid}`
const skin = ref('Note1SpriteAtlas'), trackPreview = ref(null), locateRole = ref('swipe_left'), locateMessage = ref('')
const exporting = ref(false), exportError = ref('')
let lastLocateTick = -1
const activeDifficulty = computed(() => props.difficulties.find(d => d.type === selected.value))
const geometry = computed(() => chart.value ? buildSongChartGeometry(chart.value, scale.value) : null)
let controller, generation = 0
async function loadChart() {
  const current = ++generation
  controller?.abort()
  chart.value = null; error.value = ''; loading.value = false
  lastLocateTick = -1; locateMessage.value = ''; exportError.value = ''
  if (!opened.value) return
  controller = new AbortController()
  loading.value = true
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
      chart.value = parsed
      loading.value = false
      await nextTick()
      if (current === generation) goToFirstNote()
    }
  } catch (e) {
    if (current === generation && e.name !== 'AbortError') error.value = e.message || '谱面加载失败'
  } finally { if (current === generation) loading.value = false }
}
watch([opened, selected, () => props.songCode], loadChart)
watch(mode, async () => { await nextTick(); goToFirstNote() })
watch(locateRole, () => { lastLocateTick = -1; locateMessage.value = '' })
onBeforeUnmount(() => { generation++; controller?.abort() })
function goToFirstNote() {
  if (!chartScroll.value || !chart.value?.notes.length) return
  const firstTick = Math.min(...chart.value.notes.map(n => n.tick))
  chartScroll.value.scrollTop = Math.max(0, 42 + firstTick * scale.value / 1000 - 80)
}
function locateNext() {
  const notes = songNoteEndpoints(chart.value).filter(n => n.role === locateRole.value)
  const note = notes.find(n => n.tick > lastLocateTick) || notes[0]
  if (!note) { locateMessage.value = '这档谱面没有此类音符'; return }
  lastLocateTick = note.tick; locateMessage.value = `tick ${note.tick} · 第 ${note.lane + 1} 轨`
  if (mode.value === 'perspective') trackPreview.value.goToTick(note.tick)
  else chartScroll.value.scrollTop = Math.max(0, 42 + note.tick * scale.value / 1000 - 100)
}
async function download() {
  if (!svg.value || !chart.value) return
  const fileName = `${props.songCode}-${activeDifficulty.value.label}.svg`
  const current = generation
  exporting.value = true; exportError.value = ''
  try {
  const content = await embedSongChartImages(svg.value)
  const blob = new Blob([content], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = fileName; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) { if (current === generation) exportError.value = `SVG 导出失败：${e.message || '贴图读取失败'}` }
  finally { exporting.value = false }
}
</script>

<style scoped>
.chart-preview { margin-top: 16px; }
.chart-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.chart-toolbar label { font-size: .78rem; color: #485b67; }
select, button { min-height: 44px; padding: 6px 12px; border: 1px solid #9cbbc1; border-radius: 6px; background: #f4faf9; color: #205c59; font: inherit; font-size: .78rem; }
button { cursor: pointer; }
button:focus-visible, select:focus-visible, .chart-scroll:focus-visible { outline: 3px solid #1d938a; outline-offset: 2px; }
.chart-note { font-size: .75rem; line-height: 1.7; color: #617380; }
.chart-scroll { height: 580px; overflow: auto; background: #13212e; border: 1px solid #35485a; border-radius: 6px; overscroll-behavior: contain; }
.chart-svg { display: block; margin: 0 auto; width: 100%; max-width: 410px; }
@media (max-width: 560px) { .chart-scroll { height: 460px; } }
</style>
