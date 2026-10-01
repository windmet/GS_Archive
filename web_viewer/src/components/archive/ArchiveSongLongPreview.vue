<template>
  <div ref="scroll" class="chart-scroll" :class="{ 'chart-columns': folded }" tabindex="0" role="region" :aria-label="`${title} 长轨谱面`">
    <svg ref="svg" class="chart-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" :viewBox="`0 0 ${drawingWidth} ${drawingHeight}`" :width="pixelWidth" :height="drawingHeight" role="img" :aria-label="`${title} 谱面`" @pointerdown="seekContinuous">
      <title>{{ title }} · {{ folded ? '等时长分栏，左至右，每栏上至下' : '长轨，上至下' }}</title>
      <defs>
        <template v-for="n in geometry.notes.filter(n => n.held)" :key="n.id"><clipPath v-for="(mesh, i) in n.bodyTriangles" :id="`${uid}-${n.id}-${i}`" :key="i"><polygon :points="mesh.points" /></clipPath></template>
        <g :id="`${uid}-source`">
          <rect width="410" :height="geometry.height" fill="#13212e" />
          <line v-for="x in geometry.lanes" :key="x" :x1="x" :x2="x" y1="0" :y2="geometry.height" stroke="#35485a" />
          <g v-for="g in geometry.grid" :key="g.tick"><line x1="78" x2="352" :y1="g.y" :y2="g.y" stroke="#30475c" /><text x="8" :y="g.y + 4" fill="#bccbd8" font-size="11">{{ g.tick }}</text></g>
          <g v-for="(t, i) in geometry.tempos" :key="i"><line x1="78" x2="352" :y1="t.y" :y2="t.y" stroke="#c9a755" stroke-dasharray="3 3" /><text x="358" :y="t.y + 4" fill="#f3ce7b" font-size="10">{{ t.tempo }}</text></g>
          <g v-for="n in geometry.notes.filter(n => n.held)" :key="`hold:${n.id}`" :data-note-path="n.id"><g v-for="(mesh, i) in n.bodyTriangles" :key="i" :clip-path="`url(#${uid}-${n.id}-${i})`"><image :href="noteRendering.skins[skin].hold_line.url" width="200" height="200" :transform="mesh.matrix" preserveAspectRatio="none" /></g></g>
          <line v-for="link in geometry.links" :key="link.tick" :data-simultaneous-tick="link.tick" :x1="link.x1" :x2="link.x2" :y1="link.y" :y2="link.y" stroke="#e9faf6" stroke-width="1" opacity=".65" />
          <g v-for="n in geometry.middleNodes" :key="n.id" :data-hold-middle="n.id" :data-tick="n.tick"><ArchiveSongNoteGlyph role="middle" :skin="skin" :x="n.x" :y="n.y" :width="30" /></g>
          <g v-for="n in geometry.notes.filter(n => n.held)" :key="`tail:${n.id}`" :data-note-tail="n.id" :data-note-role="n.endRole"><ArchiveSongNoteGlyph :role="n.endRole" :skin="skin" :x="n.endX" :y="n.endY" :width="30" /></g>
          <g v-for="n in geometry.notes" :key="n.id" :data-note="n.id" :data-note-type="n.type"><ArchiveSongNoteGlyph :role="n.role" :skin="skin" :x="n.x" :y="n.y" :width="30" /></g>
          <line x1="77" x2="353" :y1="cursorY" :y2="cursorY" stroke="#fff1a2" stroke-width="2" data-chart-cursor="true" />
        </g>
      </defs>
      <template v-if="folded">
        <rect :width="drawingWidth" :height="drawingHeight" fill="#13212e" />
        <g v-for="column in columns" :key="column.index" :transform="`translate(${column.index * 434} 0)`">
          <text x="18" y="22" fill="#d7efee" font-size="14">{{ column.index + 1 }} · {{ formatChartTime(column.fromSeconds) }}–{{ formatChartTime(column.toSeconds) }}</text>
          <rect x="0" y="32" width="410" :height="column.height + 40" fill="none" :stroke="activeColumn === column.index ? '#6ad7c9' : '#35485a'" stroke-width="2" />
          <svg x="0" y="32" width="410" :height="column.height + 40" :viewBox="`0 ${column.startY - 20} 410 ${column.height + 40}`" overflow="hidden" :data-chart-column="column.index" @pointerdown.stop="seekColumn($event, column)"><use :href="`#${uid}-source`" /></svg>
        </g>
      </template>
      <use v-else :href="`#${uid}-source`" />
    </svg>
  </div>
  <p class="chart-reading-note">{{ folded ? `${columns.length} 个等时长区间 · 从左向右，每栏从上往下；可横向滚动。栏边缘保留少量相邻内容方便衔接。` : '从上往下阅读，可在轨道内滚动。' }} 点击轨道可定位；黄色线为当前位置。</p>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { buildSongChartGeometry, buildSongChartColumns, songChartColumnAt } from '../../presentation/SongChartPresentation.js'
import { noteRendering } from '../../presentation/SongNotePresentation.js'
import { formatChartTime } from '../../presentation/SongChartTiming.js'
import ArchiveSongNoteGlyph from './ArchiveSongNoteGlyph.vue'
const props = defineProps({ chart: { type: Object, required: true }, title: String, skin: String, scale: Number, cursor: Number, layout: { type: String, default: 'auto' } })
const emit = defineEmits(['seek'])
const uid = `long-chart-${getCurrentInstance().uid}`
const scroll = ref(null), svg = ref(null), viewportWidth = ref(0)
const geometry = computed(() => buildSongChartGeometry(props.chart, props.scale))
const columns = computed(() => buildSongChartColumns(props.chart, props.scale))
const folded = computed(() => props.layout === 'columns' || (props.layout === 'auto' && viewportWidth.value >= 720))
const activeColumn = computed(() => songChartColumnAt(columns.value, props.cursor))
const cursorY = computed(() => 42 + props.cursor * props.scale / 1000)
const drawingWidth = computed(() => folded.value ? columns.value.length * 434 - 24 : 410)
const drawingHeight = computed(() => folded.value ? Math.ceil(Math.max(...columns.value.map(c => c.height)) + 80) : geometry.value.height)
const panelWidth = computed(() => viewportWidth.value / Math.max(1, Math.floor(viewportWidth.value / 260)))
const pixelWidth = computed(() => folded.value ? drawingWidth.value / 434 * panelWidth.value : Math.min(410, viewportWidth.value))
let resize
onMounted(() => {
  resize = new ResizeObserver(entries => { viewportWidth.value = entries[0].contentRect.width })
  resize.observe(scroll.value)
})
onBeforeUnmount(() => resize?.disconnect())
async function scrollToTick() {
  await nextTick()
  if (!scroll.value) return
  if (folded.value) {
    const left = activeColumn.value * panelWidth.value
    if (left < scroll.value.scrollLeft || left + panelWidth.value > scroll.value.scrollLeft + scroll.value.clientWidth) scroll.value.scrollLeft = left
    scroll.value.scrollTop = 0
  } else scroll.value.scrollTop = Math.max(0, cursorY.value - 100)
}
watch([() => props.cursor, folded, () => props.scale, () => props.chart], scrollToTick, { immediate: true })
function seekColumn(event, column) {
  const matrix = event.currentTarget.getScreenCTM()
  if (!matrix) return
  const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  emit('seek', Math.max(column.from, Math.min(column.to, (local.y - 42) * 1000 / props.scale)))
}
function seekContinuous(event) {
  if (folded.value) return
  const matrix = svg.value.getScreenCTM()
  if (!matrix) return
  const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  emit('seek', Math.max(0, Math.min(props.chart.maxTick, (local.y - 42) * 1000 / props.scale)))
}
defineExpose({ getSvg: () => svg.value, scrollToTick })
</script>

<style scoped>
.chart-scroll { height: 620px; overflow: auto; background: #13212e; border: 1px solid #35485a; border-radius: 8px; overscroll-behavior: contain; }
.chart-svg { display: block; margin: 0 auto; cursor: crosshair; }
.chart-columns .chart-svg { margin: 0; max-width: none; }
.chart-reading-note { margin: 8px 0 0; font-size: .73rem; color: #617380; line-height: 1.6; }
.chart-scroll:focus-visible { outline: 3px solid #1d938a; outline-offset: 2px; }
@media (max-width: 560px) { .chart-scroll { height: 460px; } }
</style>
