<template>
  <div class="reader-workspace-controls">
    <!-- One language choice in the reader: the text's own (原文 / 译文 / 双语). The archive-wide
         switch for names and descriptions is hidden here so the two do not nest. -->
    <header class="reader-compact-header">
      <button class="icon-button" aria-label="返回来源目录" title="返回来源目录" @click="emit('back')"><ArrowLeft :size="20" aria-hidden="true" /></button>
      <h1 ref="heading" tabindex="-1"><button class="reader-title-button" :disabled="!hasChapters" :aria-expanded="panel === 'chapters'" aria-haspopup="dialog" @click="openPanel('chapters', $event)"><span>{{ chapterLabel ? `${chapterLabel} · ` : '' }}<span :class="{ 'is-title-pending': titlePending }">{{ title || '剧情阅读' }}</span></span><ChevronDown v-if="hasChapters" :size="16" aria-hidden="true" /></button></h1>
    </header>
    <div v-if="$slots.context" class="reader-context"><slot name="context" /></div>
    <div class="reader-frame">
      <!-- Wide readers: the chapter directory stays on the left (236) and the text column is centred beside it. -->
      <ReaderTocRail v-if="hasDirectory || hasChapters" class="reader-rail" :title="title" :title-pending="titlePending" :chapter-label="chapterLabel" :segments="segments" :active-document-id="activeDocumentId" :chapter-navigation="chapterNavigation" :allow-unlinked="allowUnlinked" @select="emit('select', $event)" @chapter="emit('chapter', $event)" />
      <div class="reader-main" @scroll.capture.passive="onReadingScroll">
        <!-- Thin toolbar: B-level text language, theme dots, then search and P name; its row is the
             text column's width and axis, so the eye does not cross the screen to reach the text. -->
        <div class="reader-desktop-toolbar"><div class="toolbar-column">
          <button v-if="hasDirectory" class="toolbar-directory icon-button" aria-label="本话 EP 目录" title="本话 EP 目录" aria-haspopup="dialog" :aria-expanded="panel === 'directory'" @click="openPanel('directory', $event)"><ListOrdered :size="19" aria-hidden="true" /></button>
          <div class="compact-languages" role="group" aria-label="正文语言" :style="{'--modes':modes.length,'--mode-index':Math.max(0, modes.findIndex(item => item.id === mode))}"><span v-if="modes.some(item => item.id === mode)" class="mode-thumb" aria-hidden="true"></span><button v-for="item in modes" :key="item.id" :aria-pressed="mode === item.id" @click="emit('mode', item.id)">{{ item.label }}</button></div>
          <div class="compact-themes" role="group" aria-label="阅读主题"><button v-for="theme in READER_THEMES" :key="theme.id" :title="theme.label" :aria-label="theme.label" :aria-pressed="readerTheme === theme.id" @click="setReaderTheme(theme.id)"><span :style="{background:theme.swatch}" /></button></div>
          <span class="toolbar-spacer" aria-hidden="true"></span>
          <button class="icon-button" :disabled="!searchable" aria-label="篇内查找" title="篇内查找" @click="openPanel('search', $event)"><Search :size="19" aria-hidden="true" /></button>
          <button class="icon-button" aria-label="P 名字" title="P 名字" @click="openPanel('producer', $event)"><UserRound :size="19" aria-hidden="true" /></button>
        </div></div>
        <slot />
      </div>
    </div>
    <nav class="reader-floating-dock" :class="{ 'is-tucked': dockTucked && !panel }" aria-label="阅读浮动导航">
      <button class="icon-button" :disabled="!previousSegment" aria-label="上一 EP" :title="previousSegment ? `上一 EP · ${segmentLabel(previousSegment)}` : '已到本话首个 EP'" @click="emit('select', previousSegment)"><ChevronLeft :size="21" aria-hidden="true" /></button>
      <button class="dock-directory" :disabled="!hasDirectory" aria-haspopup="dialog" :aria-expanded="panel === 'directory'" @click="openPanel('directory', $event)"><span class="dock-episode">{{ activeLabel }}</span><span class="dock-position">{{ activePosition ? `${activePosition} · ` : '' }}目录</span></button>
      <button class="icon-button" :disabled="!nextSegment" aria-label="下一 EP" :title="nextSegment ? `下一 EP · ${segmentLabel(nextSegment)}` : '本话末个 EP；下一话入口在正文末尾'" @click="emit('select', nextSegment)"><ChevronRight :size="21" aria-hidden="true" /></button>
      <!-- The text language lives in the settings sheet (原文 / 译文 / 双语); the dock only moves through the chapter. -->
      <button class="icon-button" aria-label="阅读设置" title="阅读设置" aria-haspopup="dialog" :aria-expanded="panel === 'settings' || panel === 'search'" @click="openPanel('settings', $event)"><Settings2 :size="19" aria-hidden="true" /></button>
    </nav>
    <dialog ref="dialog" class="reader-sheet gs-dialog-motion" :aria-label="panelTitle" @cancel.prevent="closePanel" @click="onBackdrop">
      <div class="reader-sheet-content">
        <header class="sheet-header"><h2>{{ panelTitle }}<GsInfo v-if="panelNote" class="sheet-info" :label="`${panelTitle}说明`">{{ panelNote }}</GsInfo></h2><button class="icon-button" aria-label="关闭面板" @click="closePanel"><X :size="20" aria-hidden="true" /></button></header>
        <template v-if="shownPanel === 'directory' || shownPanel === 'chapters'">
          <p class="sheet-context">{{ chapterLabel }} · {{ title }}</p>
          <ReaderStoryNavigation :segments="shownPanel === 'directory' ? segments : []" :document-id="activeDocumentId" :chapter-navigation="shownPanel === 'chapters' ? chapterNavigation : null" :expand-chapters="shownPanel === 'chapters'" :allow-unlinked="allowUnlinked" @select="selectSegment" @chapter="selectChapter" />
        </template>
        <template v-else>
          <ReaderControlBar v-if="shownPanel === 'settings' || shownPanel === 'producer'" :producer-only="shownPanel === 'producer'" :mode="mode" :searchable="searchable" @mode="emit('mode', $event)" @search="openPanel('search')" />
          <slot v-if="shownPanel === 'search'" name="search" />
        </template>
      </div>
    </dialog>
  </div>
</template>
<script setup>
import { chapterLabel as presentChapter } from '../../presentation/chapterLabel.js'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ListOrdered, Search, Settings2, UserRound, X } from '@lucide/vue'
import GsInfo from '../gs/GsInfo.vue'
import ReaderControlBar from './ReaderControlBar.vue'
import ReaderStoryNavigation from './ReaderStoryNavigation.vue'
import ReaderTocRail from './ReaderTocRail.vue'
import { READER_THEMES, readerTheme, setReaderTheme } from '../../presentation/ReaderTheme.js'
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { readerSegmentNeighbour } from '../../presentation/ReaderControls.js'
const props = defineProps({ title:String, titlePending:Boolean, subtitle:String, segments:{type:Array,default:()=>[]}, documentId:String, activeDocumentId:String, chapterNavigation:{type:Object,default:null}, mode:String, searchable:{type:Boolean,default:true}, allowUnlinked:Boolean })
const emit = defineEmits(['back','chapter','select','mode'])
const modes = [{id:'original',label:'原文'},{id:'translation',label:'译文'},{id:'bilingual',label:'双语'}]
const dialog = ref(null), heading = ref(null), panel = ref(''), dockTucked = ref(false)
// What the sheet shows. It outlives panel by the exit fade (gs-motion.css) so a closing sheet keeps
// its content instead of flashing to the settings view; it then clears and the content unmounts.
const shownPanel = ref(''), SHEET_EXIT_MS = 160
let opener = null, releaseTimer = 0
const chapterLabel = computed(() => presentChapter(props.chapterNavigation?.chapters.find(chapter => chapter.id === props.chapterNavigation.chapterId)?.label || ''))
const previousSegment = computed(() => readerSegmentNeighbour(props.segments, props.activeDocumentId, -1, props.allowUnlinked))
const nextSegment = computed(() => readerSegmentNeighbour(props.segments, props.activeDocumentId, 1, props.allowUnlinked))
const hasDirectory = computed(() => props.segments.length > 0)
const hasChapters = computed(() => props.chapterNavigation?.chapters.length > 1)
const segmentLabel = segment => presentIdolEpisodeLabel({sourceName:segment.label,format:'reader'})
const activeIndex = computed(() => props.segments.findIndex(segment => (segment.documentId || segment.episodeKey) === props.activeDocumentId))
const activeLabel = computed(() => segmentLabel(props.segments[activeIndex.value] || {label:props.subtitle}) || '目录')
const activePosition = computed(() => activeIndex.value >= 0 && props.segments.length > 1 ? `${activeIndex.value + 1} / ${props.segments.length}` : '')
const panelTitle = computed(() => shownPanel.value === 'chapters' ? '切换话目' : shownPanel.value === 'directory' ? '本话 EP 目录' : shownPanel.value === 'search' ? '篇内查找' : shownPanel.value === 'producer' ? 'P 名字' : '阅读设置')
// How-to notes live behind ⓘ (copy tier 2), not as paragraphs under the controls.
const panelNote = computed(() => shownPanel.value === 'settings' ? '配色和 P 名字会保存在本机。篇内查找包含已载入的所有分支。'
  : shownPanel.value === 'producer' ? '显示名保存在本机，用于剧情、首页与卡面中的制作人称呼。留空时保留来源占位符。' : '')
async function openPanel(name, event) {
  if (!dialog.value?.open) opener = event?.currentTarget || globalThis.document?.activeElement
  clearTimeout(releaseTimer)
  panel.value = shownPanel.value = name
  await nextTick()
  if (!dialog.value?.open) dialog.value?.showModal()
  if (name === 'search') dialog.value?.querySelector('input[type="search"]')?.focus()
}
function closePanel({ restoreFocus = true } = {}) {
  dialog.value?.close(); panel.value = ''
  clearTimeout(releaseTimer)
  releaseTimer = setTimeout(() => { if (!panel.value) shownPanel.value = '' }, SHEET_EXIT_MS)
  if (restoreFocus) {
    if (opener?.isConnected && opener.getClientRects().length) opener.focus({preventScroll:true})
    else heading.value?.focus({preventScroll:true})
  }
}
function onBackdrop(event) { if (event.target === dialog.value) { const rect = dialog.value.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePanel() } }
async function selectSegment(segment) { closePanel({restoreFocus:false}); await nextTick(); emit('select', segment) }
async function selectChapter(id) { closePanel({restoreFocus:false}); await nextTick(); emit('chapter', id) }
function onReaderKey(event) {
  if (!['ArrowLeft','ArrowRight'].includes(event.key) || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || dialog.value?.open || event.target.closest('input,select,textarea,button,[role="tab"],[contenteditable="true"]')) return
  const segment = readerSegmentNeighbour(props.segments, props.activeDocumentId, event.key === 'ArrowLeft' ? -1 : 1, props.allowUnlinked)
  if (segment) { event.preventDefault(); emit('select', segment) }
}
// Phones: reading down tucks the dock away so it covers no line; any upward scroll, or reaching
// the top or the end of the text, brings it back.
const scrollTops = new WeakMap()
function onReadingScroll(event) {
  const box = event.target
  if (!(box instanceof Element) || !box.classList.contains('story-reader')) return
  const top = box.scrollTop, delta = top - (scrollTops.get(box) ?? top)
  scrollTops.set(box, top)
  if (top < 80 || box.scrollHeight - top - box.clientHeight < 120) dockTucked.value = false
  else if (delta > 6) dockTucked.value = true
  else if (delta < -6) dockTucked.value = false
}
watch(() => [props.activeDocumentId, props.chapterNavigation?.chapterId], () => { dockTucked.value = false })
watch(() => props.chapterNavigation?.chapterId, () => closePanel({restoreFocus:false}))
onBeforeUnmount(() => { clearTimeout(releaseTimer); dialog.value?.close() })
defineExpose({openSearch:() => openPanel('search'),closePanel,focusHeading:() => heading.value?.focus({preventScroll:true}),onReaderKey})
</script>
<style scoped>
/* A title still waiting for its translation keeps its place but stays hidden (no Japanese flash). */
.is-title-pending { visibility:hidden; }
.reader-workspace-controls { flex:1; min-height:0; display:flex; flex-direction:column; background:var(--reader-bg-page); padding-top:var(--archive-safe-top); }
button { min-height:44px; border:0; background:transparent; color:var(--reader-text-main); font:inherit; font-size:13px; cursor:pointer; }
button:disabled { opacity:.4; cursor:default; }
button:focus-visible { outline:2px solid var(--reader-accent); outline-offset:-2px; }
.icon-button { width:44px; flex:none; display:grid; place-items:center; padding:0; border-radius:50%; color:var(--reader-accent-text); }
.reader-compact-header { flex:none; z-index:10; display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:4px max(20px,var(--archive-safe-right)) 4px max(20px,var(--archive-safe-left)); border-bottom:1px solid var(--reader-border); }
h1 { flex:1; min-width:0; margin:0; font-size:17px; line-height:1.4; outline:none; }
.reader-title-button { display:flex; align-items:center; gap:8px; max-width:100%; text-align:left; font-size:inherit; font-weight:700; }
.reader-title-button:disabled { opacity:1; }
.reader-title-button span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.reader-title-button svg { flex:none; }
.reader-frame { flex:1; min-height:0; display:flex; container-type:inline-size; }
.reader-rail { display:none; }
.reader-main { flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; }
.reader-main > :deep(.story-reader) { flex:1; min-height:0; }
.reader-desktop-toolbar { flex:none; height:52px; overflow:hidden; scrollbar-gutter:stable; border-bottom:1px solid var(--reader-border); }
/* Same box as the reading sheet (reading width, 40 inside), and the same scrollbar gutter as the text below. */
.toolbar-column { box-sizing:border-box; display:flex; align-items:center; gap:12px; height:100%; max-width:var(--gs-reading-width); margin:0 auto; padding:0 40px; }
.toolbar-column > .icon-button:last-child { margin-right:-10px; }
.toolbar-spacer { flex:1; }
/* B-level switch: recessed track, one raised thumb sliding to the chosen text language. */
.compact-languages { position:relative; display:grid; grid-template-columns:repeat(var(--modes),minmax(0,1fr)); padding:2px; border-radius:var(--gs-radius-control); background:color-mix(in oklab, var(--reader-text-main) 7%, var(--reader-bg-page)); }
.compact-languages button { position:relative; z-index:1; min-height:32px; min-width:52px; padding:0 12px; color:var(--reader-text-sub); white-space:nowrap; }
.compact-languages button[aria-pressed=true] { color:var(--reader-text-main); }
.mode-thumb { position:absolute; top:2px; bottom:2px; left:2px; width:calc((100% - 4px) / var(--modes)); border-radius:var(--gs-radius-segment); background:var(--reader-bg-card); box-shadow:0 1px 2px rgb(19 33 58 / 12%); transform:translateX(calc(var(--mode-index) * 100%)); transition:transform var(--gs-current-motion); }
.compact-themes { display:flex; }
.compact-themes button { display:grid; place-items:center; width:32px; padding:0; }
.compact-themes span { width:17px; height:17px; border-radius:50%; border:1px solid #94a3b8; }
.compact-themes button[aria-pressed=true] span { outline:2px solid var(--reader-accent); outline-offset:3px; }
@container (min-width: 900px) {
  .reader-rail { display:block; }
  .toolbar-directory { display:none; }
}
.reader-floating-dock { display:none; }
.reader-sheet { box-sizing:border-box; width:min(600px,calc(100% - 48px)); max-height:min(80dvh,720px); padding:0; border:1px solid var(--reader-border); border-radius:18px; background:var(--reader-bg-card); color:var(--reader-text-main); color-scheme:var(--reader-color-scheme); box-shadow:0 16px 64px #0003; overscroll-behavior:contain; }
.reader-sheet::backdrop { background:#0f172a66; }
.reader-sheet-content { padding:12px 22px 24px; }
.sheet-header { display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom:1px solid var(--reader-border); margin-bottom:16px; }
.sheet-header h2 { display:flex; align-items:center; gap:6px; font-size:17px; margin:0; }
.sheet-info :deep(.gs-info-button) { color:var(--reader-text-sub); }
.sheet-context { font-size:13px; line-height:1.7; color:var(--reader-text-sub); overflow-wrap:anywhere; }
.reader-sheet :deep(.reader-control-bar) { margin:0; padding:0; border:0; background:transparent; gap:20px 12px; }
.reader-sheet :deep(.reader-languages) { flex-basis:100%; }
.reader-sheet :deep(.reader-producer-name) { flex-basis:100%; }
.reader-sheet :deep(.reader-producer-name input) { max-width:none; }
.reader-sheet :deep(.reader-theme-switchers) { margin:0; }
@media(max-width:760px) {
  .reader-desktop-toolbar { display:none; }
  .reader-compact-header { padding:0 max(10px,var(--archive-safe-right)) 0 max(8px,var(--archive-safe-left)); gap:6px; }
  h1 { font-size:14px; }
  .reader-floating-dock { position:absolute; left:50%; bottom:calc(10px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%); display:flex; align-items:center; gap:2px; width:min(400px,calc(100% - 24px)); box-sizing:border-box; height:52px; padding:4px 6px; border:1px solid var(--reader-border); border-radius:var(--gs-radius-panel); background:var(--reader-bg-card); box-shadow:0 6px 24px #0002; }
  .reader-floating-dock { transition:transform var(--gs-motion-sheet) var(--gs-ease-out), opacity var(--gs-motion-sheet) var(--gs-ease-out); }
  .reader-floating-dock.is-tucked:not(:focus-within) { transform:translate(-50%, calc(100% + 16px + env(safe-area-inset-bottom,0px))); opacity:0; pointer-events:none; }
  .reader-floating-dock .icon-button { width:40px; }
  .dock-directory { flex:1; min-width:0; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:0 4px; gap:1px; line-height:1.25; }
  .dock-episode { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; font-variant-numeric:tabular-nums; }
  .dock-position { font-size:12px; color:var(--reader-text-sub); font-variant-numeric:tabular-nums; }
  .reader-sheet { width:100%; max-height:80dvh; max-width:100%; margin:0; inset:auto 0 0; border-radius:20px 20px 0 0; border-bottom:0; --gs-dialog-travel:translateY(100%); --gs-dialog-duration:var(--gs-motion-sheet); }
  .reader-sheet-content { padding:8px max(16px,var(--archive-safe-right)) calc(20px + env(safe-area-inset-bottom,0px)) max(16px,var(--archive-safe-left)); }
}
@media (prefers-reduced-motion: reduce) { .mode-thumb, .reader-floating-dock { transition:none; } }
</style>
