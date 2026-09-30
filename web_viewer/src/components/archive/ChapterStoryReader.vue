<template>
  <section ref="root" class="story-reader" aria-label="整话阅读" data-testid="chapter-reader" :data-anchor-follow="anchoring" :data-scroll-input="scrollInput" :data-scroll-input-count="scrollInputCount" @wheel.passive="stopAnchoring('wheel')" @touchstart.passive="stopAnchoring('touch')" @keydown="onUserKey">
    <ArchivePageChrome class="reader-top" @back="emit('back')"><template #title><span>{{ uiText('reader.chapter') }}</span></template></ArchivePageChrome>
    <div class="reader-body">
      <h1>{{ presentProducerAddressingText(chapter.title) }}</h1><p>{{ chapter.label }} · {{ chapter.segments.length }} 段</p>
      <nav aria-label="本话阅读目录" class="chapter-reader-directory"><button v-for="segment in chapter.segments" :key="segment.episodeKey" :aria-current="segment.documentId === documentId ? 'location' : undefined" @click="select(segment)">{{ presentIdolEpisodeLabel({ sourceName: segment.label }) }}{{ segment.status === 'ready' ? '' : ` · ${statusLabel(segment.status)}` }}</button></nav>
      <div class="reader-toolbar"><div role="group" aria-label="正文语言"><button v-for="item in modes" :key="item.id" :aria-pressed="mode === item.id" @click="emit('mode', item.id)">{{ item.label }}</button></div><label>Producer 显示名<input :value="producerName" @input="saveProducerName($event.target.value)" autocomplete="off" /></label><button @click="searchOpen = !searchOpen">篇内查找</button></div>
      <form v-if="searchOpen" role="search" aria-label="篇内查找" @submit.prevent="moveMatch(1)"><label>篇内查找<input v-model="query" type="search" placeholder="查找已载入的整话正文或说话人" /></label><p role="status">已处理 {{ loadedCount }}/{{ chapter.segments.length }} 段（{{ readableCount }} 段可读）；{{ searchMatches.length }} 处匹配{{ loadedCount < chapter.segments.length ? '（尚未载入的段落未搜索）' : '' }}</p><button type="button" :disabled="!searchMatches.length" @click="moveMatch(-1)">上一处</button><button :disabled="!searchMatches.length">下一处</button><button type="button" @click="searchOpen = false; query = ''">关闭查找</button></form>
      <p v-if="notice" role="alert">{{ notice }} <button @click="emit('refresh')">重新载入正文</button></p>
      <p v-if="missingAnchor" role="alert">原定位行已不存在，请确认当前正文后重新选择。</p>
      <ChapterReadingSegment v-for="(segment, index) in chapter.segments" :key="segment.episodeKey" :ref="el => sections[index] = el" :segment="segment" :mode="mode" :anchor="segment.documentId === documentId ? anchor : ''" :query="query" :busy="busy" @play="emit('play', $event)" @retry="emit('retry', $event)" />
    </div>
  </section>
</template>
<script setup>
import { computed, nextTick, onBeforeUpdate, onUpdated, ref, watch } from 'vue'
import ArchivePageChrome from './ArchivePageChrome.vue'
import ChapterReadingSegment from './ChapterReadingSegment.vue'
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { producerName, saveProducerName } from '../../utils/LanguageStore.js'
import { resolveUiText as uiText } from '../../localization/ui/UiTextResolver.js'
const props = defineProps({ chapter: Object, documentId: String, anchor: String, mode: String, notice: String, busy: Boolean })
const emit = defineEmits(['select', 'mode', 'back', 'retry', 'play', 'locate', 'refresh'])
const root = ref(null), sections = ref([]), query = ref(''), searchOpen = ref(false)
const modes = [{ id:'original',label:'原文' },{ id:'translation',label:'译文' },{ id:'bilingual',label:'双语' }]
const loadedCount = computed(() => props.chapter.segments.filter(segment => !['idle','loading'].includes(segment.status)).length)
const readableCount = computed(() => props.chapter.segments.filter(segment => segment.status === 'ready').length)
const searchMatches = computed(() => sections.value.flatMap(section => section?.matches(query.value) || []))
const focused = computed(() => props.chapter.segments.find(segment => segment.documentId === props.documentId))
const missingAnchor = computed(() => focused.value?.status === 'ready' && props.anchor && !focused.value.document.rows.some(row => row.anchor.row_id === props.anchor))
function statusLabel(status) { return ({idle:'待载入',loading:'载入中',error:'载入失败',unsupported:'暂不支持',empty:'无正文','not-generated':'未生成'})[status] || '' }
function select(segment) { if (segment.documentId) emit('select', segment.documentId); else root.value?.querySelector(`[id="reading-document-${segment.episodeKey}"]`)?.scrollIntoView({ block:'start' }) }
function moveMatch(direction) {
  const list = searchMatches.value
  if (!list.length) return
  const current = list.findIndex(item => item.documentId === props.documentId && item.rowId === props.anchor)
  emit('locate', list[(current < 0 ? direction > 0 ? 0 : list.length - 1 : (current + direction + list.length) % list.length)])
}
let positioned = '', beforeTop = null
const anchoring = ref(false), scrollInput = ref(''), scrollInputCount = ref(0)
function target() { return root.value?.querySelector(`[id="${props.anchor && !missingAnchor.value ? 'reading-'+props.anchor : 'reading-document-'+props.documentId}"]`) }
function stopAnchoring(kind) { anchoring.value = false; scrollInput.value = kind; scrollInputCount.value++ }
function onUserKey(event) { if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key) && !event.target.closest('input,select')) stopAnchoring('key') }
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
onBeforeUpdate(() => { beforeTop = anchoring.value ? target()?.getBoundingClientRect().top ?? null : null })
onUpdated(() => {
  if (anchoring.value && beforeTop !== null && target() && root.value) root.value.scrollTop += target().getBoundingClientRect().top - beforeTop
  if (loadedCount.value === props.chapter.segments.length) anchoring.value = false
  beforeTop = null
})
</script>
<style scoped>
.story-reader { height:100%; overflow-y:auto; overflow-x:hidden; background:#f3f7f7; color:#183846; font-family:Inter,"Noto Sans JP","Noto Sans SC",system-ui,sans-serif; }
.reader-top { min-height:64px; border-bottom:1px solid #d7e1e6; }
.reader-body { max-width:1000px; margin:0 auto; padding:28px max(24px,var(--archive-safe-right)) 60px max(24px,var(--archive-safe-left)); }
h1 { margin:0; font-size:26px; line-height:1.5; }
.chapter-reader-directory,.reader-toolbar { display:flex; flex-wrap:wrap; gap:8px; margin:20px 0; }
button { min-height:44px; padding:8px 14px; border:1px solid #cddde4; border-radius:6px; background:white; color:#16838d; font:inherit; cursor:pointer; }
button[aria-current],button[aria-pressed=true] { background:#16838d; color:white; }
button:disabled { opacity:.5; cursor:default; }
input { box-sizing:border-box; min-height:44px; width:min(250px,100%); border:1px solid #becdd5; border-radius:6px; padding:8px; font:inherit; }
label { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
form { padding:16px; background:#fff; border:1px solid #cbd8df; border-radius:12px; }
:focus-visible { outline:2px solid #168f98; outline-offset:3px; }
@media(max-width:620px) { .reader-body { padding:20px 14px 40px; } h1 { font-size:22px; } }
</style>
