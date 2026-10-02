<template>
  <div class="reader-workspace-controls">
    <header class="reader-compact-header">
      <ArchiveLanguageSwitch />
      <button class="icon-button" aria-label="返回来源目录" title="返回来源目录" @click="emit('back')"><ArrowLeft :size="20" aria-hidden="true" /></button>
      <h1 ref="heading" tabindex="-1"><button class="reader-title-button" :disabled="!hasChapters" :aria-expanded="panel === 'chapters'" aria-haspopup="dialog" @click="openPanel('chapters', $event)"><span>{{ chapterLabel ? `${chapterLabel} · ` : '' }}{{ title || '剧情阅读' }}</span><ChevronDown v-if="hasChapters" :size="16" aria-hidden="true" /></button></h1>
      <button class="desktop-search icon-button" :disabled="!searchable" aria-label="篇内查找" title="篇内查找" @click="openPanel('search', $event)"><Search :size="19" aria-hidden="true" /></button>
      <button class="desktop-settings icon-button" aria-label="P 名字" title="P 名字" @click="openPanel('producer', $event)"><UserRound :size="19" aria-hidden="true" /></button>
    </header>
    <div v-if="$slots.context" class="reader-context"><slot name="context" /></div>
    <div class="reader-desktop-toolbar">
      <nav class="compact-episodes" aria-label="本话快速定位">
        <button v-for="segment in segments" :key="segment.episodeKey || segment.documentId" :aria-current="(segment.documentId || segment.episodeKey) === activeDocumentId ? 'location' : undefined" :disabled="!segment.documentId && !allowUnlinked" :title="segmentLabel(segment)" @click="emit('select', segment)">{{ segmentLabel(segment) }}</button>
      </nav>
      <div class="compact-languages" role="group" aria-label="正文语言"><button v-for="item in modes" :key="item.id" :aria-pressed="mode === item.id" @click="emit('mode', item.id)">{{ item.short }}</button></div>
      <div class="compact-themes" role="group" aria-label="阅读主题"><button v-for="theme in READER_THEMES" :key="theme.id" :title="theme.label" :aria-label="theme.label" :aria-pressed="readerTheme === theme.id" @click="setReaderTheme(theme.id)"><span :style="{background:theme.swatch}" /></button></div>
    </div>
    <nav class="reader-floating-dock" aria-label="阅读浮动导航">
      <button class="icon-button" :disabled="!previousSegment" aria-label="上一 EP" :title="previousSegment ? `上一 EP · ${segmentLabel(previousSegment)}` : '已到本话首个 EP'" @click="emit('select', previousSegment)"><ChevronLeft :size="21" aria-hidden="true" /></button>
      <button class="dock-directory" :disabled="!hasDirectory" aria-haspopup="dialog" :aria-expanded="panel === 'directory'" @click="openPanel('directory', $event)"><span class="dock-story">{{ chapterLabel ? `${chapterLabel} · ` : '' }}{{ title || '剧情阅读' }}</span><span class="dock-episode">{{ activeLabel }} <ChevronDown :size="12" aria-hidden="true" /></span></button>
      <button class="icon-button" :disabled="!nextSegment" aria-label="下一 EP" :title="nextSegment ? `下一 EP · ${segmentLabel(nextSegment)}` : '本话末个 EP；下一话入口在正文末尾'" @click="emit('select', nextSegment)"><ChevronRight :size="21" aria-hidden="true" /></button>
      <span class="dock-divider" aria-hidden="true"></span>
      <button class="icon-button" aria-label="阅读设置" title="阅读设置" aria-haspopup="dialog" :aria-expanded="panel === 'settings' || panel === 'search'" @click="openPanel('settings', $event)"><Settings2 :size="19" aria-hidden="true" /></button>
    </nav>
    <dialog ref="dialog" class="reader-sheet" :aria-label="panelTitle" @cancel.prevent="closePanel" @click="onBackdrop">
      <div class="reader-sheet-content">
        <header class="sheet-header"><h2>{{ panelTitle }}</h2><button class="icon-button" aria-label="关闭面板" @click="closePanel"><X :size="20" aria-hidden="true" /></button></header>
        <template v-if="panel === 'directory' || panel === 'chapters'">
          <p class="sheet-context">{{ chapterLabel }} · {{ title }}</p>
          <ReaderStoryNavigation :segments="panel === 'directory' ? segments : []" :document-id="activeDocumentId" :chapter-navigation="panel === 'chapters' ? chapterNavigation : null" :expand-chapters="panel === 'chapters'" :allow-unlinked="allowUnlinked" @select="selectSegment" @chapter="selectChapter" />
        </template>
        <template v-else>
          <ReaderControlBar v-if="panel === 'settings' || panel === 'producer'" :producer-only="panel === 'producer'" :mode="mode" :searchable="searchable" @mode="emit('mode', $event)" @search="openPanel('search')" />
          <slot v-if="panel === 'search'" name="search" />
          <p v-if="panel === 'settings'" class="settings-note">配色和 P 名字会保存在本机。篇内查找包含已载入的所有分支。</p>
          <p v-if="panel === 'producer'" class="settings-note">显示名保存在本机，用于剧情、首页与卡面中的制作人称呼。留空时保留来源占位符。</p>
        </template>
      </div>
    </dialog>
  </div>
</template>
<script setup>
import ArchiveLanguageSwitch from './ArchiveLanguageSwitch.vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Search, Settings2, UserRound, X } from '@lucide/vue'
import ReaderControlBar from './ReaderControlBar.vue'
import ReaderStoryNavigation from './ReaderStoryNavigation.vue'
import { READER_THEMES, readerTheme, setReaderTheme } from '../../presentation/ReaderTheme.js'
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { readerSegmentNeighbour } from '../../presentation/ReaderControls.js'
const props = defineProps({ title:String, subtitle:String, segments:{type:Array,default:()=>[]}, documentId:String, activeDocumentId:String, chapterNavigation:{type:Object,default:null}, mode:String, searchable:{type:Boolean,default:true}, allowUnlinked:Boolean })
const emit = defineEmits(['back','chapter','select','mode'])
const modes = [{id:'original',short:'日'},{id:'translation',short:'中'},{id:'bilingual',short:'双'}]
const dialog = ref(null), heading = ref(null), panel = ref('')
let opener = null
const chapterLabel = computed(() => props.chapterNavigation?.chapters.find(chapter => chapter.id === props.chapterNavigation.chapterId)?.label || '')
const previousSegment = computed(() => readerSegmentNeighbour(props.segments, props.activeDocumentId, -1, props.allowUnlinked))
const nextSegment = computed(() => readerSegmentNeighbour(props.segments, props.activeDocumentId, 1, props.allowUnlinked))
const hasDirectory = computed(() => props.segments.length > 0)
const hasChapters = computed(() => props.chapterNavigation?.chapters.length > 1)
const segmentLabel = segment => presentIdolEpisodeLabel({sourceName:segment.label,format:'reader'})
const activeLabel = computed(() => segmentLabel(props.segments.find(segment => (segment.documentId || segment.episodeKey) === props.activeDocumentId) || {label:props.subtitle}) || '目录')
const panelTitle = computed(() => panel.value === 'chapters' ? '切换话目' : panel.value === 'directory' ? '本话 EP 目录' : panel.value === 'search' ? '篇内查找' : panel.value === 'producer' ? 'P 名字' : '阅读设置')
async function openPanel(name, event) {
  if (!dialog.value?.open) opener = event?.currentTarget || globalThis.document?.activeElement
  panel.value = name
  await nextTick()
  if (!dialog.value?.open) dialog.value?.showModal()
  if (name === 'search') dialog.value?.querySelector('input[type="search"]')?.focus()
}
function closePanel({ restoreFocus = true } = {}) {
  dialog.value?.close(); panel.value = ''
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
watch(() => props.chapterNavigation?.chapterId, () => closePanel({restoreFocus:false}))
onBeforeUnmount(() => dialog.value?.close())
defineExpose({openSearch:() => openPanel('search'),closePanel,focusHeading:() => heading.value?.focus({preventScroll:true}),onReaderKey})
</script>
<style scoped>
.reader-workspace-controls { flex:none; z-index:10; background:var(--reader-bg-page); border-bottom:1px solid var(--reader-border); padding-top:var(--archive-safe-top); }
button { min-height:44px; border:0; background:transparent; color:var(--reader-text-main); font:inherit; font-size:13px; cursor:pointer; }
button:disabled { opacity:.4; cursor:default; }
button:focus-visible { outline:2px solid var(--reader-accent); outline-offset:-2px; }
.icon-button { width:44px; flex:none; display:grid; place-items:center; padding:0; border-radius:50%; color:var(--reader-accent-text); }
.reader-compact-header { display:flex; align-items:center; gap:8px; padding:4px max(20px,var(--archive-safe-right)) 4px max(20px,var(--archive-safe-left)); max-width:1100px; margin:auto; }
h1 { flex:1; min-width:0; margin:0; font-size:17px; line-height:1.4; outline:none; }
.reader-title-button { display:flex; align-items:center; gap:8px; max-width:100%; text-align:left; font-size:inherit; font-weight:700; }
.reader-title-button:disabled { opacity:1; }
.reader-title-button span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.reader-title-button svg { flex:none; }
.reader-desktop-toolbar { display:flex; align-items:center; gap:12px; max-width:1100px; margin:auto; padding:0 24px 6px; }
.compact-episodes { display:flex; gap:4px; flex:1; min-width:0; overflow-x:auto; scrollbar-width:thin; }
.compact-episodes button { flex:none; padding:0 10px; border-radius:18px; font-size:12px; white-space:nowrap; font-variant-numeric:tabular-nums; }
.compact-episodes button[aria-current] { background:var(--reader-active); color:var(--reader-on-accent); }
.compact-languages { display:flex; padding:2px; border-radius:8px; background:var(--reader-bg-card); border:1px solid var(--reader-border); }
.compact-languages button { min-height:36px; min-width:36px; padding:0 8px; border-radius:5px; }
.compact-languages button[aria-pressed=true] { background:var(--reader-active); color:var(--reader-on-accent); }
.compact-themes { display:flex; }
.compact-themes button { display:grid; place-items:center; width:36px; padding:0; }
.compact-themes span { width:17px; height:17px; border-radius:50%; border:1px solid #94a3b8; }
.compact-themes button[aria-pressed=true] span { outline:2px solid var(--reader-accent); outline-offset:3px; }
.reader-floating-dock { display:none; }
.reader-sheet { box-sizing:border-box; width:min(600px,calc(100% - 48px)); max-height:min(80dvh,720px); padding:0; border:1px solid var(--reader-border); border-radius:18px; background:var(--reader-bg-card); color:var(--reader-text-main); color-scheme:var(--reader-color-scheme); box-shadow:0 16px 64px #0003; overscroll-behavior:contain; }
.reader-sheet::backdrop { background:#0f172a66; }
.reader-sheet-content { padding:12px 22px 24px; }
.sheet-header { display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom:1px solid var(--reader-border); margin-bottom:16px; }
.sheet-header h2 { font-size:17px; margin:0; }
.sheet-context,.settings-note { font-size:13px; line-height:1.7; color:var(--reader-text-sub); overflow-wrap:anywhere; }
.reader-sheet :deep(.reader-control-bar) { margin:0; padding:0; border:0; background:transparent; gap:20px 12px; }
.reader-sheet :deep(.reader-languages) { flex-basis:100%; }
.reader-sheet :deep(.reader-producer-name) { flex-basis:100%; }
.reader-sheet :deep(.reader-producer-name input) { max-width:none; }
.reader-sheet :deep(.reader-theme-switchers) { margin:0; }
@media(max-width:760px) {
  .reader-desktop-toolbar,.desktop-search,.desktop-settings { display:none; }
  .reader-compact-header { padding:0 max(10px,var(--archive-safe-right)) 0 max(8px,var(--archive-safe-left)); gap:6px; }
  h1 { font-size:14px; }
  .reader-floating-dock { position:absolute; left:50%; bottom:calc(10px + env(safe-area-inset-bottom,0px)); transform:translateX(-50%); display:flex; align-items:center; width:min(420px,calc(100% - 24px)); box-sizing:border-box; height:52px; padding:4px; border:1px solid var(--reader-border); border-radius:28px; background:var(--reader-bg-card); box-shadow:0 6px 24px #0002; }
  .dock-directory { flex:1; min-width:0; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:0 5px; gap:2px; }
  .dock-story { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; font-weight:600; }
  .dock-episode { display:flex; align-items:center; gap:4px; font-size:11px; color:var(--reader-accent-text); }
  .dock-divider { width:1px; height:20px; background:var(--reader-border); margin:0 2px; }
  .reader-sheet { width:100%; max-height:80dvh; max-width:100%; margin:0; inset:auto 0 0; border-radius:20px 20px 0 0; border-bottom:0; }
  .reader-sheet-content { padding:8px max(16px,var(--archive-safe-right)) calc(20px + env(safe-area-inset-bottom,0px)) max(16px,var(--archive-safe-left)); }
}
</style>

<style scoped>
.reader-compact-header { flex-wrap:wrap; }
.reader-compact-header :deep(.archive-language-switch) { order:5; margin-left:auto; }
</style>
