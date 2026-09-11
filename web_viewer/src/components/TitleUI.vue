<template>
  <div
    ref="fxRoot"
    class="title-fx"
    :class="{ play: playing }"
    @animationend="onAnimationEnd"
  >
    <div class="seed-line"></div>

    <div class="ribbon-window">
      <div class="ribbon-bg"></div>

      <svg ref="ringSvg" class="ring-svg" aria-hidden="true">
        <ellipse ref="ringBase" class="ring-base" />
        <ellipse ref="ringBold" class="ring-bold" />
      </svg>
      <div class="core-ellipse"></div>
    </div>

    <!-- Fixed copy layer: intentionally not a child of ribbon-window, whose
         height changes every frame. -->
    <div class="copy">
      <LocalizedTextBlock v-if="badgeDisplay" class="badge" :display="badgeDisplay" />
      <LocalizedTextBlock v-if="mainDisplay" class="title" :display="mainDisplay" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import LocalizedTextBlock from './LocalizedTextBlock.vue'
import { resolveText } from '../utils/TextHelper.js'
import { useStoryLocalization } from '../localization/story/StoryLocalizationContext.js'

const props = defineProps({
  step: { type: Object, default: null },
})

// start/complete mirror the CSS animation lifecycle so the player can hold
// auto-advance for the duration; cancel releases that hold when the animation
// can no longer finish (step left mid-flight, UI hidden).
const emit = defineEmits(['start', 'complete', 'cancel'])

const fxRoot = ref(null)
const ringSvg = ref(null)
const ringBase = ref(null)
const ringBold = ref(null)
const playing = ref(false)

let started = false
let settled = false

const localization = useStoryLocalization()

const display = computed(() => {
  const dialogue = props.step?.dialogue
  return dialogue
    ? (localization?.resolveDialogue(dialogue) ?? resolveText(dialogue))
    : { speaker: '', text: '' }
})

const badgeDisplay = computed(() => {
  const resolved = display.value
  if (!resolved?.speaker) return null
  return resolved.speakerView ? { text: resolved.speaker, view: resolved.speakerView } : resolved.speaker
})

const mainDisplay = computed(() => display.value?.text ? display.value : null)

function syncRingGeometry() {
  const svg = ringSvg.value
  const base = ringBase.value
  const bold = ringBold.value
  const root = fxRoot.value
  if (!svg || !base || !bold || !root) return

  /* clientWidth/clientHeight are the SVG's untransformed layout size, i.e.
     the final ring box before the synchronized scaleX breathing is applied. */
  const w = svg.clientWidth
  const h = svg.clientHeight
  if (!w || !h) return

  const boldWidth = parseFloat(getComputedStyle(bold).strokeWidth) || 13
  const inset = boldWidth / 2 + 0.75 // keep round caps fully inside the SVG viewport
  const cx = w / 2
  const cy = h / 2
  const rx = Math.max(1, cx - inset)
  const ry = Math.max(1, cy - inset)

  /* One SVG user unit is one layout CSS pixel, so dash lengths and the
     rendered ellipse agree. */
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  svg.setAttribute('preserveAspectRatio', 'none')

  for (const ellipse of [base, bold]) {
    ellipse.setAttribute('cx', cx)
    ellipse.setAttribute('cy', cy)
    ellipse.setAttribute('rx', rx)
    ellipse.setAttribute('ry', ry)
  }

  /* Let the browser measure its own ellipse instead of assuming a
     circumference that non-uniform stretching would invalidate. */
  const perimeter = base.getTotalLength()

  /* 120deg bold + 60deg gap + 120deg bold + 60deg gap. Total is exactly one
     measured perimeter, so opposite points share a thick/thin state. */
  const boldArc = perimeter / 3
  const gapArc = perimeter / 6
  bold.setAttribute('stroke-dasharray', `${boldArc} ${gapArc} ${boldArc} ${gapArc}`)

  const phase = deg => perimeter * deg / 360
  root.style.setProperty('--ring-phase-start', `${phase(1.5)}px`)
  root.style.setProperty('--ring-phase-main', `${phase(14.0)}px`)
  root.style.setProperty('--ring-phase-end', `${phase(14.6)}px`)
}

function onAnimationEnd(event) {
  if (event.target !== fxRoot.value) return
  settle('complete')
}

function settle(type) {
  if (!started || settled) return
  settled = true
  emit(type)
}

onMounted(() => {
  syncRingGeometry()
  window.addEventListener('resize', syncRingGeometry, { passive: true })
  // Reduced motion renders the title as a static card; the step then advances
  // through the normal playback flow rather than through this animation.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  started = true
  emit('start')
  playing.value = true
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncRingGeometry)
  settle('cancel')
})
</script>

<style scoped>
.title-fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;

  /* Pixel-matched from the supplied 1920x1080 reference after the snap-open:
     striped ribbon ~176px -> ~211px. */
  --ribbon-h-start: clamp(132px, 9.17vw, 176px);
  --ribbon-h-end:   clamp(156px, 10.99vw, 211px);
  --fx-center-y: 50.37%;

  /* Pixel-matched @1920: white core ~933px -> ~1006px. */
  --core-w-start: clamp(680px, 48.59vw, 933px);
  --core-w-end:   clamp(710px, 52.40vw, 1006px);
  --core-scale-start: .92744;
  --ellipse-h: clamp(650px, 43vw, 830px);

  /* Pixel-matched outer-ring horizontal diameter: ~1015.5px -> ~1099px.
     It has its own scale ratio; do not derive it from the core scale. */
  --ring-w-end: clamp(760px, 57.24vw, 1099px);
  --ring-scale-start: .92402;
  --ring-gap: clamp(54px, 3.2vw, 68px);
  --ring-thin: clamp(3px, .22vw, 4px);
  --ring-bold: clamp(10px, .68vw, 13px);

  --cyan: #0aa7e8;
  --ink: #151827;
  --duration: 2.76s;
}

.title-fx.play { animation: fx-visibility var(--duration) linear forwards; }

/* First hairline. */
.seed-line {
  position: absolute;
  z-index: 8;
  top: var(--fx-center-y);
  left: 8%;
  right: 8%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(240,250,255,.72) 12%, #fff 50%, rgba(240,250,255,.72) 88%, transparent);
  transform: scaleX(0);
  transform-origin: center;
  opacity: 0;
}
.play .seed-line { animation: seed var(--duration) ease-out forwards; }

/* Single clipping window: the enormous ellipses extend far beyond this. */
.ribbon-window {
  position: absolute;
  z-index: 1;
  left: 0;
  right: 0;
  top: var(--fx-center-y);
  height: var(--ribbon-h-end);
  transform: translate3d(0, -50%, 0);
  overflow: hidden;
  contain: paint;
  will-change: clip-path, opacity;
  /* Reveal/collapse by clipping, NOT scaleY: stripes keep their pixel geometry
     while the pale //// frame changes visible height. */
  clip-path: inset(49.7% 0 49.7% 0);
  opacity: 0;
}
.play .ribbon-window {
  animation: ribbon-envelope var(--duration) linear forwards;
}

.ribbon-bg {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(
      135deg,
      rgba(255,255,255,.22) 0 3px,
      rgba(255,255,255,0) 3px 14px
    ),
    rgba(191, 216, 246, .74);
}

/* ---------- GEOMETRY LAYER ----------
   The copy is NOT inside these shapes, so width growth never scales text. */
.core-ellipse {
  position: absolute;
  left: 50%;
  top: 50%;
  height: var(--ellipse-h);
  border-radius: 50%;
  transform: translate3d(-50%, -50%, 0);
  backface-visibility: hidden;
  transform-origin: center;
  will-change: transform;
  z-index: 2;
  width: var(--core-w-end);
  background: rgba(255,255,255,.97);
  box-shadow: 0 0 18px rgba(255,255,255,.16);
}
.play .core-ellipse {
  animation: core-scale-drift var(--duration) linear forwards;
}

/* ---------- RING: one exact SVG ellipse centerline ----------
   A real <ellipse> rather than a stretched <circle>: JS makes its viewBox
   match the rendered box, then asks getTotalLength() for the ACTUAL perimeter,
   so the two bold arcs stay exactly opposite and stroke-linecap round supplies
   genuine attached caps. */
.ring-svg {
  position: absolute;
  z-index: 3;
  left: 50%;
  top: 50%;
  width: var(--ring-w-end);
  height: calc(var(--ellipse-h) + (var(--ring-gap) * 2));
  overflow: visible;
  transform: translate3d(-50%, -50%, 0) scaleX(var(--ring-scale-start));
  transform-origin: center;
  will-change: transform;
  backface-visibility: hidden;
}
.play .ring-svg {
  animation: outer-scale-drift var(--duration) linear forwards;
}

.ring-base,
.ring-bold {
  fill: none;
  stroke: rgba(255,255,255,.99);
  vector-effect: non-scaling-stroke;
  shape-rendering: geometricPrecision;
}
.ring-base {
  stroke-width: var(--ring-thin);
}
.ring-bold {
  stroke-width: var(--ring-bold);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dashoffset: var(--ring-phase-start, 0px);
  will-change: stroke-dashoffset;
}
.play .ring-bold {
  animation: ring-phase-rotate var(--duration) linear forwards;
}

/* COPY LAYER: viewport-centered and OUTSIDE the resizing ribbon window.
   The ribbon changes height every frame, and keeping text inside that
   reflowing box can make font rasterization hop between subpixels. */
.copy {
  position: absolute;
  z-index: 6;
  left: 0;
  right: 0;
  top: var(--fx-center-y);
  min-height: 92px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 14px;
  opacity: 0;
  transform: translate3d(0, -50%, 0);
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
  will-change: opacity;
}
.play .copy { animation: copy-in var(--duration) linear forwards; }

.badge {
  min-width: 112px;
  padding: 4px 18px 5px;
  border-radius: 2px;
  background: var(--cyan);
  color: #fff;
  text-align: center;
  font-size: clamp(16px, 1.15vw, 22px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: .05em;
  --localized-secondary-color: rgba(255,255,255,.76);
  --localized-secondary-size: .82em;
  --localized-secondary-gap: .18em;
}

.title {
  font-size: clamp(24px, 1.65vw, 32px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: .01em;
  color: #151827;
  text-align: center;
  --localized-secondary-color: #5d6677;
  --localized-secondary-size: .72em;
  --localized-secondary-gap: .22em;
}

@keyframes fx-visibility {
  0%, 1% { opacity: 0; }
  3%, 93% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes seed {
  0%   { transform: scaleX(0); opacity: 0; }
  5%   { transform: scaleX(.58); opacity: .65; }
  10%  { transform: scaleX(1); opacity: .95; }
  17%  { transform: scaleX(1); opacity: .14; }
  86%  { transform: scaleX(1); opacity: 0; }
  91%  { transform: scaleX(1); opacity: .45; }
  97%  { transform: scaleX(.9); opacity: .2; }
  100% { transform: scaleX(.6); opacity: 0; }
}

/*
   Measured from the reference: ~2.95s: 176px, ~4.85s: 210px, ~4.90s: 211px.
   So after the snap-open there is a real ~19% vertical "breathing" of the
   pale //// ribbon. The final-height box stays fixed; clip-path handles both
   the slow vertical reveal and the fast entrance/exit, so no layout-height
   animation or stripe stretching is involved.
*/
@keyframes ribbon-envelope {
  /* Entrance reveal is separate from the later synchronized expansion.
     By ~13% the band has snapped open to the measured ~176px state. */
  0% {
    clip-path: inset(49.7% 0);
    opacity: 0;
    animation-timing-function: cubic-bezier(.18,.82,.22,1);
  }
  7% {
    clip-path: inset(40.5% 0);
    opacity: .9;
  }
  11% {
    clip-path: inset(9.7% 0);
    opacity: 1;
  }
  13% {
    /* 176px visible out of a fixed 211px box => ~8.29% inset each side. */
    clip-path: inset(8.29% 0);
    opacity: 1;
    animation-timing-function: linear;
  }

  /* The stripe band, white core and outer ring share essentially the same
     normalized progress from here onward. */
  83% {
    clip-path: inset(0 0);
    opacity: 1;
  }
  89% {
    clip-path: inset(0 0);
    opacity: .98;
    animation-timing-function: cubic-bezier(.55,.02,.82,.28);
  }
  100% {
    clip-path: inset(49.8% 0);
    opacity: 0;
  }
}

/* Fixed final-size ellipses; only their compositor transform changes.
   The copy layer is separate, so this does not scale the text. */
@keyframes core-scale-drift {
  0%, 13% {
    transform: translate3d(-50%, -50%, 0) scaleX(var(--core-scale-start));
    animation-timing-function: linear;
  }
  83%, 100% {
    transform: translate3d(-50%, -50%, 0) scaleX(1);
  }
}

/* @keyframes names cannot be comma-separated; doing so makes browsers discard
   the whole rule. */
@keyframes outer-scale-drift {
  0%, 13% {
    transform: translate3d(-50%, -50%, 0) scaleX(var(--ring-scale-start));
    animation-timing-function: linear;
  }
  83%, 100% {
    transform: translate3d(-50%, -50%, 0) scaleX(1);
  }
}

/* Phase values come from the ellipse's real perimeter. The visible round
   junction sweeps for about .85-.9s and then settles very briefly. */
@keyframes ring-phase-rotate {
  0%, 7% {
    stroke-dashoffset: var(--ring-phase-start, 0px);
    animation-timing-function: linear;
  }
  39% {
    stroke-dashoffset: var(--ring-phase-main, 0px);
    animation-timing-function: cubic-bezier(.35,.65,.55,1);
  }
  42%, 100% {
    stroke-dashoffset: var(--ring-phase-end, 0px);
  }
}

@keyframes copy-in {
  0%, 13% { opacity: 0; }
  20%     { opacity: 1; }
  83%     { opacity: 1; }
  89%     { opacity: 0; }
  100%    { opacity: 0; }
}

@media (max-width: 900px) {
  .title-fx {
    --ribbon-h-start: 124px;
    --ribbon-h-end: 148px;
    --core-w-start: 63vw;
    --core-w-end: 68vw;
    --core-scale-start: .92744;
    --ring-w-end: 76vw;
    --ring-scale-start: .92402;
    --ellipse-h: 560px;
    --ring-gap: 34px;
    --ring-thin: 3px;
    --ring-bold: 10px;
  }
  .copy { gap: 10px; }
  .badge { min-width: 80px; padding-inline: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .title-fx,
  .title-fx.play,
  .play .seed-line,
  .play .ribbon-window,
  .play .core-ellipse,
  .play .ring-svg,
  .play .ring-bold,
  .play .copy { animation: none; }
  .title-fx { opacity: 1; }
  .ribbon-window { height: var(--ribbon-h-end); transform: translate3d(0,-50%,0); clip-path: inset(0); opacity: 1; }
  .seed-line { display: none; }
  .core-ellipse { width: var(--core-w-end); }
  .ring-svg { transform: translate3d(-50%,-50%,0) scaleX(1); }
  .ring-bold { stroke-dashoffset: var(--ring-phase-end, 0px); }
  .copy { opacity: 1; transform: translate3d(0,-50%,0); }
}
</style>
