<template>
  <div class="track-preview">
    <div class="track-controls">
      <label>视觉配速 <input v-model.number="speed" type="number" min="1" max="20" step="0.1" aria-label="轨道视觉配速" @input="windowMode = 'speed'" @change="speed = safeSpeed" /></label>
      <input v-model.number="speed" class="speed-slider" type="range" min="1" max="20" step="0.1" aria-label="轨道配速滑杆" @input="windowMode = 'speed'" />
      <label>视野 <select v-model="windowMode" aria-label="轨道视野"><option value="speed">跟随配速</option><option value="3000">3000 tick</option><option value="6000">6000 tick</option><option value="12000">12000 tick</option></select></label>
      <button type="button" @click="cursor = firstTick">首个音符</button>
      <button type="button" @click="nextHold">下一条长条</button>
    </div>
    <p class="track-caption">可见 {{ span }} tick · 1–20 相对配速，数值越大，音符间距越大；默认 10。此刻度与游戏原版流速尚未校准。</p>
    <label class="track-position">判定线位置 <input v-model.number="cursor" type="number" min="0" :max="chart.maxTick" step="1" aria-label="轨道位置 tick" /> / {{ chart.maxTick }} tick
      <input v-model.number="cursor" class="track-slider" type="range" min="0" :max="chart.maxTick" step="1" aria-label="轨道位置滑杆" />
    </label>
    <svg class="track-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" role="img" :aria-label="`${title} 五轨透视预览`">
      <title>{{ title }} · 五轨 · 原始 tick {{ safeCursor }}</title>
      <defs>
        <clipPath :id="`${uid}-lane`"><polygon :points="laneOutline" /></clipPath>
        <filter :id="`${uid}-glow`" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3" /></filter>
        <template v-for="hold in scene.holds" :key="hold.id"><clipPath v-for="(mesh, i) in hold.triangles" :id="`${uid}-${hold.id}-${i}`" :key="i"><polygon :points="mesh.points" /></clipPath></template>
      </defs>
      <rect width="1280" height="720" fill="#162b36" />
      <image href="/assets/song-chart-track/live_lane_gradation.png" x="0" y="0" width="1280" height="720" preserveAspectRatio="none" :clip-path="`url(#${uid}-lane)`" />
      <polygon :points="laneOutline" fill="#07151b" opacity=".25" />
      <line v-for="(lane, i) in scene.lanes" :key="i" :data-lane-boundary="i" :x1="lane.topX" y1="8" :x2="lane.bottomX" y2="720" :stroke="i === 0 || i === 5 ? '#91e5e8' : '#a4bac6'" :stroke-width="i === 0 || i === 5 ? 5 : 1.2" :opacity="i === 0 || i === 5 ? .7 : .5" />
      <g v-for="hold in scene.holds" :key="hold.id" :data-track-hold="hold.id">
        <g v-for="(mesh, i) in hold.triangles" :key="i" :clip-path="`url(#${uid}-${hold.id}-${i})`"><image :href="holdSprite" width="200" height="200" :transform="mesh.matrix" preserveAspectRatio="none" /></g>
      </g>
      <line v-for="link in scene.links" :key="link.tick" :data-simultaneous-tick="link.tick" :x1="link.a.x" :x2="link.b.x" :y1="link.a.y" :y2="link.b.y" stroke="#e9faf6" :stroke-width="Math.max(.5, 2 * link.a.scale)" opacity=".8" />
      <g v-for="n in scene.middleNodes" :key="n.id" :data-hold-middle="n.id" :data-tick="n.tick"><ArchiveSongNoteGlyph role="middle" :skin="skin" :x="n.x" :y="n.y" :width="n.width" /></g>
      <image href="/assets/song-chart-track/live_target_line_gradation.png" x="0" y="558" width="1280" height="24" preserveAspectRatio="none" />
      <image href="/assets/song-chart-track/live_target_line.png" x="0" y="560" width="1280" height="20" preserveAspectRatio="none" />
      <g v-for="(p, i) in scene.judges" :key="i" :data-judge-lane="i">
        <circle :cx="p.x" :cy="p.y" r="10" fill="none" stroke="#70efff" stroke-width="6" :filter="`url(#${uid}-glow)`" />
        <circle :cx="p.x" :cy="p.y" r="9" fill="none" stroke="#befaff" stroke-width="2.5" />
      </g>
      <g v-for="n in scene.glyphs" :key="n.id" :data-track-note="n.sourceIndex" :data-endpoint="n.endpoint" :data-tick="n.tick" :data-note-role="n.role">
        <ArchiveSongNoteGlyph :role="n.role" :skin="skin" :x="n.x" :y="n.y" :width="n.width" />
      </g>
    </svg>
    <p class="track-caption">原生音符与长条贴图；可拖动 tick 查看长按和跨轨滑条。紫星为 LARGE，绿色 315 徽标为 Special。绿色横条标记原始滑条中间节点，中途判定规则待核实。透视、尺寸、方向提示的位置及条带合成仍为估计，尚未与音频同步。</p>
  </div>
</template>

<script setup>
import { computed, getCurrentInstance, ref, watch } from 'vue'
import { buildSongTrackGeometry, songTrackSpanForSpeed } from '../../presentation/SongTrackPresentation.js'
import { noteRendering } from '../../presentation/SongNotePresentation.js'
import ArchiveSongNoteGlyph from './ArchiveSongNoteGlyph.vue'
const props = defineProps({ chart: { type: Object, required: true }, title: { type: String, required: true }, skin: { type: String, default: 'Note1SpriteAtlas' } })
const uid = `track-${getCurrentInstance().uid}`
const firstTick = computed(() => Math.min(...props.chart.notes.map(n => n.tick), props.chart.maxTick))
const cursor = ref(firstTick.value), speed = ref(10), windowMode = ref('speed')
const safeSpeed = computed(() => Math.max(1, Math.min(20, Number(speed.value) || 10)))
const span = computed(() => windowMode.value === 'speed' ? songTrackSpanForSpeed(safeSpeed.value) : Number(windowMode.value))
const safeCursor = computed(() => Math.max(0, Math.min(props.chart.maxTick, Number(cursor.value) || 0)))
watch(() => props.chart, () => { cursor.value = firstTick.value })
const scene = computed(() => buildSongTrackGeometry(props.chart, safeCursor.value, span.value))
const holdSprite = computed(() => noteRendering.skins[props.skin].hold_line.url)
const laneOutline = computed(() => {
  const a = scene.value.lanes[0], b = scene.value.lanes[5]
  return `${a.topX},8 ${b.topX},8 ${b.bottomX},720 ${a.bottomX},720`
})
defineExpose({ goToTick: tick => { cursor.value = Math.max(0, tick - span.value * .2) } })
function nextHold() {
  const holds = props.chart.notes.filter(n => n.duration > 0).sort((a, b) => a.tick - b.tick)
  const n = holds.find(n => n.tick > safeCursor.value + span.value * .2) || holds[0]
  if (n) cursor.value = Math.max(0, n.tick - span.value * .2)
}
</script>

<style scoped>
.track-controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.track-controls label, .track-position { font-size: .78rem; color: #485b67; }
select, button, input[type=number] { min-height: 44px; padding: 6px 10px; border: 1px solid #9cbbc1; border-radius: 6px; background: #f4faf9; color: #205c59; font: inherit; }
button { cursor: pointer; }
input[type=number] { width: 105px; box-sizing: border-box; }
.track-position { display: block; margin: 12px 0; }
.track-slider { display: block; width: 100%; min-height: 44px; accent-color: #167e79; }
.speed-slider { width: 150px; min-height: 44px; accent-color: #167e79; }
.track-svg { display: block; width: 100%; border: 1px solid #35485a; border-radius: 6px; }
.track-caption { font-size: .75rem; line-height: 1.7; color: #617380; }
button:focus-visible, select:focus-visible, input:focus-visible { outline: 3px solid #1d938a; outline-offset: 2px; }
</style>
