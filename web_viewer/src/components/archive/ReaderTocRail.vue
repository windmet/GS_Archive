<template>
  <aside ref="rail" class="reader-toc-rail" aria-label="本话目录">
    <small v-if="chapterLabel">{{ chapterLabel }}</small>
    <h2><span :class="{ 'is-title-pending': titlePending }">{{ title || '剧情阅读' }}</span></h2>
    <nav v-if="segments.length" ref="episodes" class="toc-episodes" aria-label="本话 EP">
      <!-- One white chip per group; it slides to the current EP (selection rule A). -->
      <span v-if="indicator" class="toc-indicator" :class="{ 'is-ready': indicatorReady }" :style="{ transform: `translateY(${indicator.top}px)`, height: `${indicator.height}px` }" aria-hidden="true"></span>
      <button v-for="segment in segments" :key="segment.episodeKey || segment.documentId" :data-toc-key="segment.documentId || segment.episodeKey" :aria-current="(segment.documentId || segment.episodeKey) === activeDocumentId ? 'location' : undefined" :disabled="!segment.documentId && !allowUnlinked" :aria-label="`${segmentLabel(segment)}${statusLabel(segment.status) ? ` · ${statusLabel(segment.status)}` : ''}`" @click="emit('select', segment)">
        <span>{{ segmentLabel(segment) }}</span><i v-if="statusLabel(segment.status)" :class="`status-${segment.status}`" :title="statusLabel(segment.status)" aria-hidden="true"></i>
      </button>
    </nav>
    <nav v-if="chapterNavigation?.chapters.length > 1" class="toc-chapters" aria-label="其他话目">
      <button v-for="chapter in chapterNavigation.chapters" :key="chapter.id" :aria-current="chapter.id === chapterNavigation.chapterId ? 'page' : undefined" :disabled="!chapter.documentId || !chapter.storyFile" @click="emit('chapter', chapter.id)">
        <b>{{ presentChapter(chapter.label) }}</b><span>{{ presentProducerAddressingText(displayTitle({document_id:chapter.documentId,sha256:chapter.revision},chapter.title)) }}{{ chapter.documentId ? '' : '（暂无阅读正文）' }}</span>
      </button>
    </nav>
  </aside>
</template>
<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { chapterLabel as presentChapter } from '../../presentation/chapterLabel.js'
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { useReaderTitles } from './useReaderTitles.js'
// The wide-screen reader's resident directory (236): this chapter's EPs, then the other chapters.
// Narrower readers reach the same lists through the directory sheet (ReaderStoryNavigation).
const props = defineProps({ title:String, titlePending:Boolean, chapterLabel:String, segments:{type:Array,default:()=>[]}, activeDocumentId:String, chapterNavigation:{type:Object,default:null}, allowUnlinked:Boolean })
const emit = defineEmits(['select','chapter'])
const displayTitle = useReaderTitles()
const rail = ref(null), episodes = ref(null), indicator = ref(null), indicatorReady = ref(false)
const segmentLabel = segment => presentIdolEpisodeLabel({sourceName:segment.label,format:'reader'})
function statusLabel(status) { return ({loading:'载入中',error:'载入失败',unsupported:'暂不支持',empty:'无正文','not-generated':'未生成'})[status] || '' }
async function placeIndicator() {
  await nextTick()
  const current = episodes.value?.querySelector('[aria-current]')
  if (!current) { indicator.value = null; return }
  indicator.value = { top: current.offsetTop, height: current.offsetHeight }
  // Keep the current EP in view inside the rail only; scrollIntoView would also move the reader.
  const box = rail.value
  if (box && (current.offsetTop < box.scrollTop || current.offsetTop + current.offsetHeight > box.scrollTop + box.clientHeight)) box.scrollTop = Math.max(0, current.offsetTop - 80)
  if (!indicatorReady.value) requestAnimationFrame(() => { indicatorReady.value = true })
}
watch(() => [props.activeDocumentId, props.segments.length], placeIndicator)
onMounted(placeIndicator)
</script>
<style scoped>
.is-title-pending { visibility:hidden; }
.reader-toc-rail { box-sizing:border-box; width:236px; flex:none; overflow-y:auto; overscroll-behavior:contain; scrollbar-width:thin; padding:22px 14px 32px 18px; border-right:1px solid var(--reader-border); background:var(--reader-bg-page); color:var(--reader-text-main); --reader-hover:color-mix(in oklab, var(--reader-text-main) 6%, transparent); }
small { display:block; color:var(--reader-text-sub); font-size:var(--gs-text-meta); }
h2 { margin:2px 0 14px; font-size:var(--gs-text-body); font-weight:var(--gs-weight-bold); line-height:1.45; overflow-wrap:anywhere; }
nav { position:relative; display:grid; gap:2px; }
button { position:relative; z-index:1; display:flex; align-items:center; gap:10px; min-height:40px; padding:0 10px; border:0; border-radius:var(--gs-radius-control); background:transparent; color:var(--reader-text-sub); font:inherit; font-size:var(--gs-text-ui); text-align:left; cursor:pointer; }
button:hover:not(:disabled):not([aria-current]) { background:var(--reader-hover); }
button[aria-current] { color:var(--reader-text-main); }
button:disabled { opacity:.45; cursor:default; }
button:focus-visible { outline:2px solid var(--reader-accent-text); outline-offset:-2px; }
.toc-episodes button { font-variant-numeric:tabular-nums; }
.toc-indicator { position:absolute; top:0; left:0; right:0; border-radius:var(--gs-radius-control); background:var(--reader-bg-card); box-shadow:0 1px 2px rgb(19 33 58 / 12%); }
.toc-indicator.is-ready { transition:transform var(--gs-current-motion), height var(--gs-current-motion); }
i { width:5px; height:5px; margin-inline-start:auto; border-radius:50%; background:var(--reader-text-sub); }
.status-error { background:var(--gs-critical); }
.toc-chapters { margin-top:18px; padding-top:12px; border-top:1px solid var(--reader-border); }
.toc-chapters button { align-items:baseline; padding-block:10px; line-height:1.45; }
.toc-chapters b { flex:none; min-width:42px; font-size:var(--gs-text-meta); font-weight:var(--gs-weight-semibold); font-variant-numeric:tabular-nums; }
.toc-chapters span { min-width:0; overflow-wrap:anywhere; }
.toc-chapters button[aria-current] { background:var(--reader-hover); }
@media (prefers-reduced-motion: reduce) { .toc-indicator.is-ready { transition:none; } }
</style>
