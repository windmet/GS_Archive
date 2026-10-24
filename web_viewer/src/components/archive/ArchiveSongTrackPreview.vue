<template>
  <div class="track-preview">
    <svg class="track-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" role="img" :aria-label="`${title} 五轨透视预览`">
      <title>{{ title }} · 五轨 · 原始 tick {{ safeCursor }}</title>
      <defs>
        <clipPath :id="`${uid}-lane`"><polygon :points="laneOutline" /></clipPath>
        <template v-if="holdCanvasUnavailable"><template v-for="hold in scene.holds" :key="hold.id"><clipPath v-for="(mesh, i) in hold.triangles" :id="`${uid}-${hold.id}-${i}`" :key="i"><polygon :points="mesh.points" /></clipPath></template></template>
        <clipPath v-for="note in [...scene.glyphs, ...scene.middleNodes]" :id="`${uid}-note-${note.id}`" :key="`note-${note.id}`"><polygon :points="note.image.points" /></clipPath>
      </defs>
      <rect width="1280" height="720" fill="#162b36" />
      <image href="/assets/song-chart-track/live_lane_gradation.png" x="0" y="0" width="1280" height="720" preserveAspectRatio="none" :clip-path="`url(#${uid}-lane)`" />
      <polygon :points="laneOutline" fill="#07151b" opacity=".25" />
      <g v-if="demonstrationEnabled && laneAlphas.some(a => a > 0)" class="track-lane-flashes" pointer-events="none">
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
      <foreignObject v-if="!holdCanvasUnavailable" width="1280" height="720"><ArchiveSongHoldMeshPreview :holds="scene.holds" :skin="skin" @unavailable="holdCanvasUnavailable = true" /></foreignObject>
      <template v-else><g v-for="hold in scene.holds" :key="hold.id" :data-track-hold="hold.id">
        <g v-for="(mesh, i) in hold.triangles" :key="i" :clip-path="`url(#${uid}-${hold.id}-${i})`"><image :href="holdSprite" width="200" height="200" :transform="mesh.matrix" preserveAspectRatio="none" /></g>
      </g></template>
      <line v-for="link in scene.links" :key="link.id" :data-simultaneous-tick="link.tick" :x1="link.a.x" :x2="link.b.x" :y1="link.a.y" :y2="link.b.y" stroke="#e9faf6" :stroke-width="Math.max(.5, 2 * link.a.scale)" opacity=".8" />
      <g v-for="n in scene.middleNodes" :key="n.id" :data-hold-middle="n.id" :data-tick="n.tick" data-native-role="middle" :clip-path="`url(#${uid}-note-${n.id})`"><image :href="n.image.url" :width="n.image.pngWidth" :height="n.image.pngHeight" :transform="n.image.transform" preserveAspectRatio="none" /></g>
      <image href="/assets/song-chart-track/live_target_line_gradation.png" x="0" :y="scene.judgeY - 12" width="1280" height="24" preserveAspectRatio="none" />
      <image href="/assets/song-chart-track/live_target_line.png" x="0" :y="scene.judgeY - 10" width="1280" height="20" preserveAspectRatio="none" />
      <g v-for="(p, i) in scene.judges" :key="i" :data-judge-lane="i">
        <!-- The glow is a soft wide ring, not an SVG blur: the track redraws up to 60 times a second and a
             filter is re-rasterised on every one of them, which is what made iOS stutter. -->
        <circle :cx="p.x" :cy="p.y" r="10" fill="none" stroke="#70efff" stroke-width="10" opacity=".3" />
        <circle :cx="p.x" :cy="p.y" r="9" fill="none" stroke="#befaff" stroke-width="2.5" />
      </g>
      <g v-for="n in scene.glyphs" :key="n.id" :data-track-note="n.sourceIndex" :data-endpoint="n.endpoint" :data-tick="n.tick" :data-note-role="n.role" :data-note-speed="n.speed" :data-note-fraction="n.fraction">
        <g :clip-path="`url(#${uid}-note-${n.id})`"><image :href="n.image.url" :width="n.image.pngWidth" :height="n.image.pngHeight" :transform="n.image.transform" preserveAspectRatio="none" /></g>
        <ArchiveSongNoteGlyph :role="n.role" :skin="skin" :x="n.x" :y="n.y" :width="n.width" :show-body="false" :hint="n.hint" />
      </g>
      <!-- Continuous Hold Effects along the Judge Line -->
      <g v-if="demonstrationEnabled && holds.length" class="track-hold-effects" pointer-events="none">
        <g v-for="h in holds" :key="`hold-fx-${h.sourceIndex}`" :data-hold-fx="h.sourceIndex" :transform="`translate(${projectTrackPoint(h.lane, 0).x}, ${scene.judgeY})`">
          <circle r="22" fill="none" stroke="rgb(126, 255, 218)" stroke-width="3" opacity="0.85" />
          <circle r="15" fill="rgb(77, 255, 201)" opacity="0.35" />
          <circle r="8" fill="white" opacity="0.9" />
          <circle cx="-16" cy="0" r="2.5" fill="rgb(168, 255, 235)" opacity="0.75" />
          <circle cx="16" cy="0" r="2.5" fill="rgb(168, 255, 235)" opacity="0.75" />
        </g>
      </g>
      <!-- Transient Hit Effects along the Judge Line -->
      <g v-if="demonstrationEnabled && hits.length" class="track-hit-effects" pointer-events="none">
        <g v-for="hit in hits" :key="hit.instanceId" :data-hit-fx="hit.instanceId" :data-hit-type="hit.hitType" :transform="`translate(${projectTrackPoint(hit.targetLane, 0).x}, ${scene.judgeY})`">
          <!-- Hit type 5: P-Skill (Square gold/purple burst) -->
          <template v-if="hit.hitType === 5">
            <rect
              :x="-(18 + hit.progress * 38)"
              :y="-(18 + hit.progress * 38)"
              :width="(18 + hit.progress * 38) * 2"
              :height="(18 + hit.progress * 38) * 2"
              fill="none"
              stroke="rgb(226, 180, 255)"
              :stroke-width="Math.max(1, (1 - hit.progress) * 4)"
              :opacity="1 - hit.progress"
              :transform="`rotate(${hit.progress * 45})`"
            />
            <rect
              v-if="hit.progress < 0.5"
              :x="-(12 + hit.progress * 20)"
              :y="-(12 + hit.progress * 20)"
              :width="(12 + hit.progress * 20) * 2"
              :height="(12 + hit.progress * 20) * 2"
              fill="rgb(212, 140, 255)"
              :opacity="(1 - hit.progress * 2) * 0.6"
            />
            <circle v-if="hit.progress < 0.4" r="14" fill="white" :opacity="(1 - hit.progress / 0.4) * 0.9" />
          </template>

          <!-- Hit type 6: Special (SP golden / cyan double ring & SP mark) -->
          <template v-else-if="hit.hitType === 6">
            <circle
              :r="18 + hit.progress * 52"
              fill="none"
              stroke="rgb(255, 226, 112)"
              :stroke-width="Math.max(1, (1 - hit.progress) * 4.5)"
              :opacity="1 - hit.progress"
            />
            <circle
              :r="12 + hit.progress * 32"
              fill="none"
              stroke="rgb(120, 245, 255)"
              :stroke-width="Math.max(1, (1 - hit.progress) * 3)"
              :opacity="1 - hit.progress"
            />
            <circle v-if="hit.progress < 0.45" r="16" fill="rgb(255, 245, 184)" :opacity="(1 - hit.progress / 0.45) * 0.8" />
            <text v-if="hit.progress < 0.7" y="4" text-anchor="middle" font-size="11" font-weight="bold" fill="rgb(255, 251, 224)" :opacity="1 - hit.progress / 0.7">SP</text>
          </template>

          <!-- Hit type 1: Flick Up (Red/amber up chevron & ring) -->
          <template v-else-if="hit.hitType === 1">
            <circle
              :r="16 + hit.progress * 44"
              fill="none"
              stroke="rgb(255, 125, 125)"
              :stroke-width="Math.max(1, (1 - hit.progress) * 3.5)"
              :opacity="1 - hit.progress"
            />
            <path
              :d="`M -14 ${-8 - hit.progress * 22} L 0 ${-22 - hit.progress * 26} L 14 ${-8 - hit.progress * 22}`"
              fill="none"
              stroke="rgb(255, 161, 161)"
              :stroke-width="Math.max(1.5, (1 - hit.progress) * 3.5)"
              :opacity="1 - hit.progress"
            />
            <circle v-if="hit.progress < 0.35" r="12" fill="white" :opacity="(1 - hit.progress / 0.35) * 0.85" />
          </template>

          <!-- Hit type 2: Flick Right (Cyan/blue right chevron & ring) -->
          <template v-else-if="hit.hitType === 2">
            <circle
              :r="16 + hit.progress * 44"
              fill="none"
              stroke="rgb(106, 232, 255)"
              :stroke-width="Math.max(1, (1 - hit.progress) * 3.5)"
              :opacity="1 - hit.progress"
            />
            <path
              :d="`M ${8 + hit.progress * 22} -14 L ${22 + hit.progress * 26} 0 L ${8 + hit.progress * 22} 14`"
              fill="none"
              stroke="rgb(168, 243, 255)"
              :stroke-width="Math.max(1.5, (1 - hit.progress) * 3.5)"
              :opacity="1 - hit.progress"
            />
            <circle v-if="hit.progress < 0.35" r="12" fill="white" :opacity="(1 - hit.progress / 0.35) * 0.85" />
          </template>

          <!-- Hit type 3: Flick Left (Yellow/gold left chevron & ring) -->
          <template v-else-if="hit.hitType === 3">
            <circle
              :r="16 + hit.progress * 44"
              fill="none"
              stroke="rgb(255, 214, 89)"
              :stroke-width="Math.max(1, (1 - hit.progress) * 3.5)"
              :opacity="1 - hit.progress"
            />
            <path
              :d="`M ${-8 - hit.progress * 22} -14 L ${-22 - hit.progress * 26} 0 L ${-8 - hit.progress * 22} 14`"
              fill="none"
              stroke="rgb(255, 234, 159)"
              :stroke-width="Math.max(1.5, (1 - hit.progress) * 3.5)"
              :opacity="1 - hit.progress"
            />
            <circle v-if="hit.progress < 0.35" r="12" fill="white" :opacity="(1 - hit.progress / 0.35) * 0.85" />
          </template>

          <!-- Hit type 0: Normal / Touch (Circle perfect emerald / cyan) -->
          <template v-else>
            <circle
              :r="16 + hit.progress * 46"
              fill="none"
              stroke="rgb(126, 255, 203)"
              :stroke-width="Math.max(1, (1 - hit.progress) * 3.5)"
              :opacity="1 - hit.progress"
            />
            <circle
              v-if="hit.progress < 0.65"
              :r="10 + hit.progress * 24"
              fill="none"
              stroke="rgb(186, 255, 234)"
              :stroke-width="Math.max(1, (1 - hit.progress / 0.65) * 2)"
              :opacity="1 - hit.progress / 0.65"
            />
            <circle v-if="hit.progress < 0.35" r="12" fill="white" :opacity="(1 - hit.progress / 0.35) * 0.9" />
          </template>
        </g>
      </g>
      <!-- Auto Evaluation Badge Floating Above Target Line -->
      <g v-if="demonstrationEnabled && autoEval.active" class="track-auto-eval" pointer-events="none" :opacity="autoEval.alpha" transform="translate(640, 526)">
        <rect x="-42" y="-14" width="84" height="26" rx="13" fill="rgb(13, 36, 48)" fill-opacity="0.85" stroke="rgb(122, 255, 223)" stroke-width="1.8" />
        <text y="4" text-anchor="middle" font-size="13" font-weight="900" letter-spacing="2" fill="rgb(122, 255, 223)">AUTO</text>
      </g>
    </svg>
  </div>
</template>

<script setup>
import { computed, getCurrentInstance, ref } from 'vue'
import { createSongTrackRenderer, projectTrackPoint } from '../../presentation/SongTrackPresentation.js'
import { buildSongChartTiming } from '../../presentation/SongChartTiming.js'
import { songTrackSpanForSpeed } from '../../presentation/SongTrackNativeTiming.js'
import { noteRendering } from '../../presentation/SongNotePresentation.js'
import ArchiveSongNoteGlyph from './ArchiveSongNoteGlyph.vue'
import ArchiveSongHoldMeshPreview from './ArchiveSongHoldMeshPreview.vue'

const props = defineProps({
  chart: { type: Object, required: true },
  title: { type: String, required: true },
  skin: { type: String, default: 'Note1SpriteAtlas' },
  position: { type: Object, required: true },
  speed: { type: Number, required: true },
  effects: { type: Object, default: () => ({ state: ref(null) }) },
  demonstrationEnabled: { type: Boolean, default: false },
})

const uid = `track-${getCurrentInstance().uid}`
const holdCanvasUnavailable = ref(false)
const safeCursor = computed(() => Math.min(props.chart.maxTick, Math.max(0, props.position.tick.value)))
const timing = computed(() => buildSongChartTiming(props.chart))
// Integrate from this frame's cursor, including a BPM transition in the read
// window. A slower transport cursor must never determine the track window.
const span = computed(() => songTrackSpanForSpeed(props.speed, timing.value, safeCursor.value))
const renderTrack = computed(() => createSongTrackRenderer(props.chart))
const scene = computed(() => renderTrack.value(safeCursor.value, span.value, props.skin))
const holdSprite = computed(() => noteRendering.skins[props.skin].hold_line.url)
const laneOutline = computed(() => {
  const a = scene.value.lanes[0], b = scene.value.lanes[5]
  return `${a.topX},${scene.value.topY} ${b.topX},${scene.value.topY} ${b.bottomX},${scene.value.height} ${a.bottomX},${scene.value.height}`
})

const activeEffects = computed(() => (props.demonstrationEnabled ? props.effects?.state?.value : null))
const laneAlphas = computed(() => activeEffects.value?.laneAlphas || [0, 0, 0, 0, 0])
const hits = computed(() => activeEffects.value?.hits || [])
const holds = computed(() => activeEffects.value?.holds || [])
const autoEval = computed(() => activeEffects.value?.autoEval || { active: false, alpha: 0 })
</script>

<style scoped>
.track-preview { display: block; width: 100%; }
.track-svg { display: block; width: 100%; border: 1px solid #35485a; border-radius: 6px; }
.track-auto-eval text { font-family: 'Barlow Semi Condensed', 'Outfit', system-ui, sans-serif; }
</style>
