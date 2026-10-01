<template>
  <div class="chart-preview">
    <button v-if="!opened" type="button" class="chart-open" @click="opened = true">打开长轨谱面预览</button>
    <template v-else>
      <div class="chart-toolbar">
        <label>难度 <select v-model.number="selected" aria-label="谱面难度"><option v-for="d in difficulties" :key="d.type" :value="d.type">{{ d.label }} · Lv {{ d.levelLabel }}</option></select></label>
        <label>纵向缩放 <select v-model.number="scale" aria-label="谱面纵向缩放"><option :value="55">紧凑</option><option :value="90">标准</option><option :value="150">放大</option></select></label>
        <button v-if="chart" type="button" @click="download">导出 SVG</button>
        <button type="button" @click="opened = false">收起谱面</button>
      </div>
      <p class="chart-note">五轨 · 从上往下阅读。蓝色 Tap，绿色长按 / 滑条，粉色 Flick，金色 Special；宽音符加宽显示。纵轴为原始 tick，尚未与音频同步。</p>
      <p v-if="loading" role="status">正在加载谱面…</p>
      <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="loadChart">重试</button></p>
      <template v-else-if="chart">
        <p class="chart-note chart-count">{{ activeDifficulty.label }} · {{ chart.noteObjectCount }} 个原始音符对象 · 最大 Combo {{ activeDifficulty.maxCombo }}（两者计数规则不同）</p>
        <div class="chart-scroll" tabindex="0" role="region" :aria-label="`${title} ${activeDifficulty.label} 长轨谱面`">
          <svg ref="svg" class="chart-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" :viewBox="`0 0 ${geometry.width} ${geometry.height}`" :height="geometry.height" width="410" role="img" :aria-label="`${title} ${activeDifficulty.label} 谱面`">
            <title>{{ title }} · {{ activeDifficulty.label }} · 原始 tick</title>
            <rect width="410" :height="geometry.height" fill="#13212e" />
            <line v-for="x in geometry.lanes" :key="x" :x1="x" :x2="x" y1="0" :y2="geometry.height" stroke="#35485a" />
            <g v-for="g in geometry.grid" :key="g.tick"><line x1="78" x2="352" :y1="g.y" :y2="g.y" stroke="#30475c" /><text x="8" :y="g.y + 4" fill="#bccbd8" font-size="11">{{ g.tick }}</text></g>
            <g v-for="(t, i) in geometry.tempos" :key="i"><line x1="78" x2="352" :y1="t.y" :y2="t.y" stroke="#c9a755" stroke-dasharray="3 3" /><text x="358" :y="t.y + 4" fill="#f3ce7b" font-size="10">{{ t.tempo }}</text></g>
            <g v-for="n in geometry.notes.filter(n => n.held)" :key="`hold:${n.id}`" :data-note-path="n.id">
              <path :d="n.path" fill="none" stroke="#40ba99" :stroke-width="n.wide ? 18 : 11" stroke-linecap="round" stroke-linejoin="round" opacity=".7" />
              <circle :cx="n.endX" :cy="n.endY" r="6" :fill="n.endFlick ? '#fa8cbd' : '#8ee8cb'" />
              <text v-if="n.endFlick" :x="n.endX" :y="n.endY + 4" text-anchor="middle" fill="#17212b" font-size="13">{{ n.endFlick }}</text>
            </g>
            <g v-for="n in geometry.notes" :key="n.id" :data-note="n.id" :data-note-type="n.type">
              <rect :x="n.x - (n.wide ? 23 : 15)" :y="n.y - 5" :width="n.wide ? 46 : 30" height="10" rx="4" :fill="n.special ? '#f9ce68' : n.flick ? '#fa8cbd' : n.held ? '#8ee8cb' : '#7dbbff'" />
              <text v-if="n.flick || n.special" :x="n.x" :y="n.y + 4" text-anchor="middle" fill="#17212b" font-size="13">{{ n.special ? '★' : n.flick }}</text>
            </g>
          </svg>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { buildSongChartGeometry, validateSongChart } from '../../presentation/SongChartPresentation.js'
const props = defineProps({ songCode: { type: String, required: true }, title: { type: String, required: true }, difficulties: { type: Array, required: true } })
const opened = ref(false), selected = ref(props.difficulties[0]?.type || 1), scale = ref(90)
const chart = ref(null), error = ref(''), loading = ref(false), svg = ref(null)
const activeDifficulty = computed(() => props.difficulties.find(d => d.type === selected.value))
const geometry = computed(() => chart.value ? buildSongChartGeometry(chart.value, scale.value) : null)
let controller, generation = 0
async function loadChart() {
  const current = ++generation
  controller?.abort()
  chart.value = null; error.value = ''; loading.value = false
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
    if (current === generation) chart.value = parsed
  } catch (e) {
    if (current === generation && e.name !== 'AbortError') error.value = e.message || '谱面加载失败'
  } finally { if (current === generation) loading.value = false }
}
watch([opened, selected, () => props.songCode], loadChart)
onBeforeUnmount(() => { generation++; controller?.abort() })
function download() {
  if (!svg.value || !chart.value) return
  const blob = new Blob([new XMLSerializer().serializeToString(svg.value)], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${props.songCode}-${activeDifficulty.value.label}.svg`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
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
