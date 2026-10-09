<template>
  <div class="reader-workspace reader-container" :data-theme="readerTheme">
    <ReaderWorkspaceControls ref="controls" :title="title" :title-pending="titlePending" :segments="chapter.segments" :document-id="documentId" :active-document-id="visibleDocumentId || documentId" :chapter-navigation="chapterNavigation" :mode="mode" allow-unlinked @back="emit('back')" @chapter="emit('chapter', $event)" @select="select" @mode="emit('mode', $event)">
      <template v-if="relatedEvent" #context><button class="reader-event-link" @click="emit('open-event')">查看本期活动档案 →</button></template>
      <template #search>
        <form role="search" aria-label="篇内查找" @submit.prevent="moveMatch(1)">
          <label>篇内查找<input v-model="query" type="search" placeholder="查找已载入正文、全部分支或说话人" /></label>
          <p role="status">已处理 {{ loadedCount }}/{{ chapter.segments.length }} 段（{{ readableCount }} 段可读）；{{ searchMatches.length }} 处匹配{{ loadedCount < chapter.segments.length ? '（尚未载入的段落未搜索）' : '' }}</p>
          <div class="search-actions"><button type="button" :disabled="!searchMatches.length" @click="moveMatch(-1)">上一处</button><button :disabled="!searchMatches.length">下一处</button><button type="button" @click="closeSearch">关闭查找</button></div>
        </form>
      </template>
    </ReaderWorkspaceControls>
  <section ref="root" class="story-reader" @scroll.passive="trackVisibleSegment" aria-label="整话阅读" data-testid="chapter-reader" :data-anchor-follow="anchoring" :data-scroll-input="scrollInput" :data-scroll-input-count="scrollInputCount" @wheel.passive="stopAnchoring('wheel')" @touchstart.passive="stopAnchoring('touch')" @keydown="onUserKey">
    <div class="reader-body">
      <p v-if="notice" role="alert">{{ notice }} <button @click="emit('refresh')">重新载入正文</button></p>
      <p v-if="missingAnchor" role="alert">原定位行已不存在，请确认当前正文后重新选择。</p>
      <p v-if="title !== originalTitle" class="reader-source-title" lang="ja">{{ originalTitle }}</p>
      <ChapterReadingSegment v-for="(segment, index) in chapter.segments" :key="segment.episodeKey" :ref="el => sections[index] = el" :segment="segment" :mode="mode" :anchor="segment.documentId === documentId ? anchor : ''" :query="query" :busy="busy" :idol-directory="idolDirectory" @play="emit('play', $event)" @retry="emit('retry', $event)" @before-layout="beforeSegmentLayout" @after-layout="afterSegmentLayout" />
      <ReaderChapterEnd :chapter-navigation="chapterNavigation" @chapter="emit('chapter', $event)" />
    </div>
  </section>
  </div>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onBeforeUpdate, onUpdated, ref, watch } from 'vue'
import ReaderWorkspaceControls from './ReaderWorkspaceControls.vue'
import ReaderChapterEnd from './ReaderChapterEnd.vue'
import { useReaderTitle } from './useReaderTitles.js'
import { visibleReaderDocument } from '../../presentation/ReaderControls.js'
import ChapterReadingSegment from './ChapterReadingSegment.vue'
import { readerTheme } from '../../presentation/ReaderTheme.js'
import '../../presentation/reader-theme.css'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
const props = defineProps({ relatedEvent:String,chapter: Object, chapterNavigation: {type:Object,default:null}, documentId: String, anchor: String, mode: String, notice: String, busy: Boolean, idolDirectory:{type:Array,default:()=>[]} })
const emit = defineEmits(['open-event','chapter', 'select', 'mode', 'back', 'retry', 'play', 'locate', 'refresh'])
const root = ref(null), sections = ref([]), query = ref(''), controls = ref(null), visibleDocumentId = ref(props.documentId)
const loadedCount = computed(() => props.chapter.segments.filter(segment => !['idle','loading'].includes(segment.status)).length)
const readableCount = computed(() => props.chapter.segments.filter(segment => segment.status === 'ready').length)
const searchMatches = computed(() => sections.value.flatMap(section => section?.matches(query.value) || []))
const focused = computed(() => props.chapter.segments.find(segment => segment.documentId === props.documentId))
const originalTitle = computed(() => presentProducerAddressingText(props.chapter.title))
const title = useReaderTitle(computed(() => focused.value?.entry),originalTitle)
const titlePending = title.pending
const missingAnchor = computed(() => focused.value?.status === 'ready' && props.anchor && !focused.value.document.rows.some(row => row.anchor.row_id === props.anchor))
function select(segment) { if (segment.documentId) emit('select', segment.documentId); else root.value?.querySelector(`[id="reading-document-${segment.episodeKey}"]`)?.scrollIntoView({ block:'start' }) }
async function moveMatch(direction) {
  const list = searchMatches.value
  if (!list.length) return
  const current = list.findIndex(item => item.documentId === props.documentId && item.rowId === props.anchor)
  const match = list[(current < 0 ? direction > 0 ? 0 : list.length - 1 : (current + direction + list.length) % list.length)]
  const alreadyLocated = match.documentId === props.documentId && match.rowId === props.anchor
  controls.value?.closePanel({restoreFocus:false})
  await nextTick()
  emit('locate', match)
  if (alreadyLocated) { const node = target(); node?.focus({preventScroll:true}); node?.scrollIntoView({block:'start'}) }
}
function closeSearch() { query.value = ''; controls.value?.closePanel() }
let scrollFrame = 0
function trackVisibleSegment() {
  if (scrollFrame) return
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0
    if (!root.value) return
    const rectangles = [...root.value.querySelectorAll('.chapter-reading-segment')].map(node => ({documentId:node.dataset.documentId || node.id.slice('reading-document-'.length),top:node.getBoundingClientRect().top,bottom:node.getBoundingClientRect().bottom}))
    visibleDocumentId.value = visibleReaderDocument(rectangles, root.value.getBoundingClientRect().top, props.documentId)
  })
}
watch(() => props.documentId, id => { visibleDocumentId.value = id })
watch(() => props.chapter.chapterId, () => { query.value = ''; positioned = ''; controls.value?.closePanel({restoreFocus:false}) })
onBeforeUnmount(() => cancelAnimationFrame(scrollFrame))
let positioned = '', beforeTop = null
const anchoring = ref(false), scrollInput = ref(''), scrollInputCount = ref(0)
function target() {
  const node = root.value?.querySelector(`[id="${props.anchor && !missingAnchor.value ? 'reading-'+props.anchor : 'reading-document-'+props.documentId}"]`)
  return node?.closest('.reader-row') || node
}
function stopAnchoring(kind) { anchoring.value = false; scrollInput.value = kind; scrollInputCount.value++ }
function onUserKey(event) { controls.value?.onReaderKey(event); if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key) && !event.target.closest('input,select')) stopAnchoring('key') }
watch(() => [props.documentId, props.anchor, focused.value?.status], async () => {
  if (focused.value?.status !== 'ready' && focused.value?.status !== 'error' && focused.value?.status !== 'unsupported') return
  const key = `${props.documentId}:${props.anchor || ''}`
  if (positioned === key) return
  await nextTick()
  const node = target()
  if (!node) return
  positioned = key; anchoring.value = true
  node.focus({ preventScroll:true }); node.scrollIntoView({ block:'start', behavior:'instant' })
}, { immediate:true })
const segmentTops = new Map()
function finishAnchoring() {
  if (loadedCount.value === props.chapter.segments.length && sections.value.length === props.chapter.segments.length && sections.value.every(section => section && !section.presentationLoading)) anchoring.value = false
}
function beforeSegmentLayout(id) { segmentTops.set(id, anchoring.value ? target()?.getBoundingClientRect().top ?? null : null) }
function afterSegmentLayout(id) {
  const top = segmentTops.get(id)
  segmentTops.delete(id)
  if (anchoring.value && top != null && target() && root.value) root.value.scrollTop += target().getBoundingClientRect().top - top
  finishAnchoring()
}
onBeforeUpdate(() => { beforeTop = anchoring.value ? target()?.getBoundingClientRect().top ?? null : null })
onUpdated(() => {
  if (anchoring.value && beforeTop !== null && target() && root.value) root.value.scrollTop += target().getBoundingClientRect().top - beforeTop
  finishAnchoring()
  beforeTop = null
})
</script>
<style scoped>
.story-reader { flex:1; min-height:0; overflow-y:auto; overflow-x:hidden; background:var(--reader-bg-page); color:var(--reader-text-main); font-family:var(--gs-font-body); }
.reader-body { max-width:1000px; margin:0 auto; padding:0 max(24px,var(--archive-safe-right)) 60px max(24px,var(--archive-safe-left)); }
.reader-source-title { font-size:13px; color:var(--reader-text-sub); margin:20px 0 0; }
button { min-height:44px; padding:8px 14px; border:1px solid var(--reader-border); border-radius:6px; background:var(--reader-bg-card); color:var(--reader-accent-text); font:inherit; cursor:pointer; }
button[aria-current],button[aria-pressed=true] { background:var(--reader-active); color:var(--reader-on-accent); }
button:disabled { opacity:.5; cursor:default; }
input { box-sizing:border-box; min-height:44px; width:min(250px,100%); border:1px solid var(--reader-border); border-radius:6px; padding:8px; background:var(--reader-bg-card); color:var(--reader-text-main); font:inherit; }
label { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
.search-actions { display:flex; flex-wrap:wrap; gap:8px; }
form { padding:16px; background:var(--reader-bg-card); border:1px solid var(--reader-border); border-radius:12px; }
button:focus-visible,input:focus-visible { outline:2px solid var(--reader-accent-text); outline-offset:3px; }
@media(max-width:760px) { .reader-body { padding:16px 14px calc(100px + env(safe-area-inset-bottom,0px)); } }
</style>
