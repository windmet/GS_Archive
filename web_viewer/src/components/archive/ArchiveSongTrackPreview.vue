<template>
  <!-- The cursor is an attribute, not part of the svg <title>: rewriting the title every frame patched an svg that the
       canvas covers. -->
  <div class="track-preview" :data-tick="safeCursor">
    <svg class="track-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" role="img" :aria-label="`${title} 五轨透视预览`">
      <title>{{ title }} · 五轨</title>
      <defs>
        <clipPath :id="`${uid}-lane`"><polygon :points="laneOutline" /></clipPath>
        <template v-if="holdCanvasUnavailable"><template v-for="hold in scene.holds" :key="hold.id"><clipPath v-for="(mesh, i) in hold.triangles" :id="`${uid}-${hold.id}-${i}`" :key="i"><polygon :points="mesh.points" /></clipPath></template></template>
      </defs>
      <rect width="1280" height="720" fill="#162b36" />
      <image href="/assets/song-chart-track/live_lane_gradation.png" x="0" y="0" width="1280" height="720" preserveAspectRatio="none" :clip-path="`url(#${uid}-lane)`" />
      <polygon :points="laneOutline" fill="#07151b" opacity=".25" />
      <g v-if="!canvasMode && demonstrationEnabled && laneAlphas.some(a => a > 0)" class="track-lane-flashes" pointer-events="none">
        <polygon
          v-for="i in 5"
          :key="`lane-flash-${i - 1}`"
          :data-lane-flash="i - 1"
          :points="`${scene.lanes[i - 1].topX},${scene.topY} ${scene.lanes[i].topX},${scene.topY} ${scene.lanes[i].bottomX},${scene.height} ${scene.lanes[i - 1].bottomX},${scene.height}`"
          fill="rgb(132, 232, 255)"
          :opacity="laneAlphas[i - 1] * 0.28"
        />
      </g>
      <line v-for="(lane, i) in scene.lanes" :key="i" :data-lane-boundary="i" :x1="lane.topX" :y1="scene.topY" :x2="lane.bottomX" :y2="scene.height" :stroke="i === 0 || i === 5 ? '#91e5e8' : '#a4bac6'" :stroke-width="i === 0 || i === 5 ? 5 : 1.2" :opacity="i === 0 || i === 5 ? .7 : .5" />
      <template v-if="holdCanvasUnavailable"><g v-for="hold in scene.holds" :key="hold.id" :data-track-hold="hold.id">
        <g v-for="(mesh, i) in hold.triangles" :key="i" :clip-path="`url(#${uid}-${hold.id}-${i})`"><image :href="holdSprite" width="200" height="200" :transform="mesh.matrix" preserveAspectRatio="none" /></g>
      </g></template>
    </svg>
    <!-- Every layer is a sibling box of the same size, not a foreignObject: WebKit does not scale a canvas inside one
         with the svg's viewBox, which moved the long notes and effects off the lanes on iPad. -->
    <!-- Everything that moves is one WebGL frame. As separate SVG and canvas layers, Android Chrome presented the
         notes, holds, links and particles from different frames, so parts slid off each other during playback. -->
    <ArchiveSongTrackCanvas
      v-if="canvasMode"
      :scene="scene"
      :skin="skin"
      :lane-alphas="demonstrationEnabled ? laneAlphas : null"
      :hits="hits"
      :hold-effects="holds"
      :audit-frame="auditFrame"
      @unavailable="trackCanvasUnavailable = true"
      @texture-status="emit('texture-status', $event)"
    />
    <template v-else>
    <ArchiveSongHoldMeshPreview v-if="audit?.mode !== 'A' && !holdCanvasUnavailable" :holds="scene.holds" :skin="skin" :audit-frame="auditFrame" @unavailable="holdCanvasUnavailable = true" />
    <!-- Note images carry no clip-path: the affine image already lands on the native quad, and a clipPath whose
         polygon moves every frame was painted out of step with its image on Android Chrome, cutting notes in half. -->
    <svg class="track-layer" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" aria-hidden="true">
      <line v-for="link in scene.links" :key="link.id" :data-simultaneous-tick="link.tick" :x1="link.a.x" :x2="link.b.x" :y1="link.a.y" :y2="link.b.y" stroke="#e9faf6" :stroke-width="Math.max(.5, 2 * link.a.scale)" opacity=".8" />
      <g v-for="n in scene.middleNodes" :key="n.id" :data-hold-middle="n.id" :data-tick="n.tick" data-native-role="middle"><image :href="n.image.url" :width="n.image.pngWidth" :height="n.image.pngHeight" :transform="n.image.transform" preserveAspectRatio="none" /></g>
      <image href="/assets/song-chart-track/live_target_line_gradation.png" x="0" :y="scene.judgeY - 12" width="1280" height="24" preserveAspectRatio="none" />
      <image href="/assets/song-chart-track/live_target_line.png" x="0" :y="scene.judgeY - 10" width="1280" height="20" preserveAspectRatio="none" />
      <g v-for="(p, i) in scene.judges" :key="i" :data-judge-lane="i">
        <!-- The glow is a soft wide ring, not an SVG blur: the track redraws up to 60 times a second and a
             filter is re-rasterised on every one of them, which is what made iOS stutter. -->
        <circle :cx="p.x" :cy="p.y" r="10" fill="none" stroke="#70efff" stroke-width="10" opacity=".3" />
        <circle :cx="p.x" :cy="p.y" r="9" fill="none" stroke="#befaff" stroke-width="2.5" />
      </g>
      <g v-for="n in scene.glyphs" :key="n.id" :data-track-note="n.sourceIndex" :data-endpoint="n.endpoint" :data-tick="n.tick" :data-note-role="n.role" :data-note-speed="n.speed" :data-note-fraction="n.fraction">
        <image :href="n.image.url" :width="n.image.pngWidth" :height="n.image.pngHeight" :transform="n.image.transform" preserveAspectRatio="none" />
        <ArchiveSongNoteGlyph :role="n.role" :skin="skin" :x="n.x" :y="n.y" :width="n.width" :show-body="false" :hint="n.hint" />
      </g>
    </svg>
    <ArchiveSongHitEffectPreview
      v-if="demonstrationEnabled && (hits.length || holds.length || autoEval.active)"
      :hits="hits"
      :holds="holds"
      :auto-eval="autoEval"
      :judge-y="scene.judgeY"
      :audit-frame="auditFrame"
    />
    </template>
    <svg class="track-layer" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" aria-hidden="true">
      <ArchiveSongAutoEvaluationPreview v-if="demonstrationEnabled" :state="autoEval" />
      <g v-if="demonstrationEnabled && holds.length" class="track-hold-effects" pointer-events="none" aria-hidden="true">
          <g v-for="h in holds" :key="'hold-fx-' + h.sourceIndex" :data-hold-fx="h.sourceIndex" />
      </g>
      <g v-if="demonstrationEnabled && hits.length" class="track-hit-effects" pointer-events="none" aria-hidden="true">
          <g v-for="hit in hits" :key="hit.instanceId" :data-hit-fx="hit.instanceId" :data-hit-type="hit.hitType" />
      </g>
      <ArchiveSongComboPreview v-if="comboEnabled" :state="combo?.state?.value" />
    </svg>
  </div>
</template>

<script setup>
import { computed, getCurrentInstance, inject, onBeforeUpdate, onMounted, onUpdated, ref } from 'vue'
import { createSongTrackRenderer, projectTrackPoint } from '../../presentation/SongTrackPresentation.js'
import { buildSongChartTiming } from '../../presentation/SongChartTiming.js'
import { songTrackSpanForSpeed } from '../../presentation/SongTrackNativeTiming.js'
import { noteRendering } from '../../presentation/SongNotePresentation.js'
import ArchiveSongNoteGlyph from './ArchiveSongNoteGlyph.vue'
import ArchiveSongTrackCanvas from './ArchiveSongTrackCanvas.vue'
import ArchiveSongHoldMeshPreview from './ArchiveSongHoldMeshPreview.vue'
import ArchiveSongHitEffectPreview from './ArchiveSongHitEffectPreview.vue'
import ArchiveSongAutoEvaluationPreview from './ArchiveSongAutoEvaluationPreview.vue'
import ArchiveSongComboPreview from './ArchiveSongComboPreview.vue'

const props = defineProps({
  combo: { type: Object, default: null },
  comboEnabled: { type: Boolean, default: true },
  chart: { type: Object, required: true },
  title: { type: String, required: true },
  skin: { type: String, default: 'Note1SpriteAtlas' },
  position: { type: Object, required: true },
  speed: { type: Number, required: true },
  effects: { type: Object, default: () => ({ state: ref(null) }) },
  demonstrationEnabled: { type: Boolean, default: false },
})

const emit = defineEmits(['texture-status'])
const audit = inject('song-chart-audit', null)
const auditFrame = computed(() => props.position.auditFrame?.value ?? null)
const uid = `track-${getCurrentInstance().uid}`
const holdCanvasUnavailable = ref(false)
// The SVG layers stay as the fallback for a browser without WebGL, for audit mode A, which measures them, and for
// fixtures that check the SVG layer contract (they provide 'song-track-renderer' = 'svg').
const trackCanvasUnavailable = ref(inject('song-track-renderer', 'canvas') === 'svg')
const canvasMode = computed(() => !trackCanvasUnavailable.value && audit?.mode !== 'A')
// The media clock continues through the outro. Clamping to maxTick leaves the
// final note sitting exactly on its inclusive draw boundary forever.
const safeCursor = computed(() => Math.max(0, props.position.tick.value))
const timing = computed(() => buildSongChartTiming(props.chart))
// Integrate from this frame's cursor, including a BPM transition in the read
// window. A slower transport cursor must never determine the track window.
const span = computed(() => songTrackSpanForSpeed(props.speed, timing.value, safeCursor.value))
const renderTrack = computed(() => createSongTrackRenderer(props.chart))
const scene = computed(() => {
  const render = renderTrack.value, cursor = safeCursor.value, readSpan = span.value
  const start = audit && performance.now()
  const result = render(cursor, readSpan, props.skin)
  audit?.record(auditFrame.value, 'geometry', { ms: performance.now() - start, notes: result.glyphs.length, holds: result.holds.length })
  if (props.position.ended?.value) return { ...result, glyphs: [], holds: [], middleNodes: [], links: [] }
  if (audit?.mode === 'A') return { ...result, holds: [], middleNodes: [], links: [] }
  return result
})
const holdSprite = computed(() => noteRendering.skins[props.skin].hold_line.url)
const laneOutline = computed(() => {
  const a = scene.value.lanes[0], b = scene.value.lanes[5]
  return `${a.topX},${scene.value.topY} ${b.topX},${scene.value.topY} ${b.bottomX},${scene.value.height} ${a.bottomX},${scene.value.height}`
})

const activeEffects = computed(() => (props.demonstrationEnabled ? props.effects?.state?.value : null))
const laneAlphas = computed(() => activeEffects.value?.laneAlphas || [0, 0, 0, 0, 0])
const hits = computed(() => activeEffects.value?.hits || [])
const holds = computed(() => activeEffects.value?.holds || [])
const autoEval = computed(() => activeEffects.value?.autoEval || { active: false, age: 0, alpha: 0 })

if (audit) {
  let updateStart
  const recordSvg = () => audit.record(auditFrame.value, 'svg', {
    ms: updateStart === undefined ? null : performance.now() - updateStart,
    canvas: canvasMode.value,
    holdExpected: !canvasMode.value && audit.mode !== 'A' && !holdCanvasUnavailable.value,
    holdFallback: holdCanvasUnavailable.value,
    combo315: props.comboEnabled && props.combo?.state?.value?.specialAge != null,
    effectExpected: !canvasMode.value && props.demonstrationEnabled && Boolean(hits.value.length || holds.value.length || autoEval.value.active),
  })
  onBeforeUpdate(() => { updateStart = performance.now() })
  onMounted(recordSvg)
  onUpdated(recordSvg)
}
</script>

<style scoped>
.track-preview { position: relative; display: block; width: 100%; overflow: hidden; border: 1px solid #35485a; border-radius: 6px; isolation: isolate; }
.track-svg { display: block; width: 100%; }
/* Upper layers share the base svg's box, and so its 16:9 letterboxing. */
.track-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }

</style>
