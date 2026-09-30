<template>
  <ChapterStoryReader v-if="chapter" :chapter="chapter" :chapter-navigation="chapterNavigation" @chapter="emit('chapter', $event)" :document-id="documentId" :mode="mode" :anchor="anchor" :notice="notice" :busy="busy" :idol-directory="idolDirectory" @select="emit('select', $event)" @mode="emit('mode', $event)" @back="emit('back')" @retry="emit('retry-segment', $event)" @play="emit('play-segment', $event)" @locate="emit('locate-segment', $event)" @refresh="emit('refresh')" />
  <section v-else ref="readerRoot" class="story-reader reader-container" :data-theme="readerTheme" :aria-busy="busy" aria-labelledby="reading-heading">
    <ReaderPageHeader @back="emit('back')">剧情阅读</ReaderPageHeader>
    <div class="reader-body">
      <h1 id="reading-heading" ref="heading" tabindex="-1">{{ title }}</h1>
      <p class="reader-subtitle">{{ episodeLabel }}</p>
      <ReaderStoryNavigation :segments="segmentEntries.map(entry => ({documentId:entry.document_id,label:entry.episode_label,status:entry.status}))" :document-id="documentId" :chapter-navigation="chapterNavigation" @select="emit('select', $event.documentId)" @chapter="emit('chapter', $event)" />
      <ReaderControlBar ref="controlBar" :mode="mode" :searchable="state.status === 'ready'" :search-open="searchOpen" search-id="reader-search" @mode="emit('mode',$event)" @search="toggleSearch" />
      <p v-if="state.status === 'ready' && mode !== 'original'" class="reader-notice" role="status">
        已选择{{ mode === 'bilingual' ? '双语' : '译文' }}。{{ translationStatus }}
        <button v-if="translationLoadFailed" :disabled="localization.loading.value" @click="localization.retryTranslation()">重试译文</button>
      </p>
      <button v-if="state.status === 'ready'" class="reader-full-play" :disabled="busy" @click="emit('play-document')">{{ busy ? '正在准备演出…' : '播放完整剧情（实验）' }}</button>
      <p v-if="notice" ref="playbackNotice" tabindex="-1" class="reader-notice" role="alert">{{ notice }} <button class="reader-play" :disabled="busy" @click="emit('refresh')">重新载入正文</button></p>
      <GsLoadingIndicator v-if="state.status === 'loading'" class="reader-loading"
        variant="inline" message="正在载入正文…" />
      <div v-else-if="state.status === 'error'" class="reader-feedback" role="alert"><h2>正文暂时无法载入</h2><p>请重试，或选择其他分段。</p><button @click="emit('retry')">重试</button><details><summary>加载详情</summary><p>{{ state.error }}</p></details></div>
      <p v-else-if="state.status === 'not-generated'" role="status">这个分段尚未生成阅读正文，请选择已有分段。</p>
      <p v-else-if="state.status === 'empty'" role="status">这个分段没有可显示的正文。</p>
      <div v-else-if="state.status === 'unsupported'" class="reader-feedback" role="status"><h2>这个分段暂不支持完整阅读</h2><p>部分分支或来源字段无法可靠还原，正文尚未开放。</p><details><summary>分支与来源说明</summary><ul><li v-for="(control, i) in state.document.controls" :key="i">选项：<span v-for="(option, j) in choiceRows(control)" :key="j">{{ presentProducerAddressingText(option.source_text) }}{{ j < choiceRows(control).length - 1 ? ' ／ ' : '' }}</span></li></ul><p>选项目标已保留，分支结束位置未确认。</p></details></div>
      <template v-else-if="state.status === 'ready'">
        <form v-if="searchOpen" id="reader-search" class="reader-search" role="search" aria-label="篇内查找" @submit.prevent="moveMatch(1)" @keydown.esc.prevent="closeSearch">
          <label>篇内查找<input ref="searchInput" v-model="searchQuery" type="search" placeholder="查找本段正文、全部分支或说话人" /></label>
          <div class="reader-search-actions">
            <span role="status">{{ searchQuery.trim() ? (searchMatches.length ? `${matchIndex >= 0 ? `${matchIndex + 1} / ` : ''}${searchMatches.length} 处匹配` : '未找到匹配内容') : '仅查找当前分段' }}</span>
            <button type="button" :disabled="!searchMatches.length" @click="moveMatch(-1)">上一处</button>
            <button type="submit" :disabled="!searchMatches.length">下一处</button>
            <button type="button" @click="closeSearch">关闭查找</button>
          </div>
        </form>
        <p v-if="missingAnchor" class="reader-notice" role="status">原定位行已不存在，现显示本篇正文。</p>

        <ReadingTranscriptSection :rows="presentedRows" :mode="mode" :anchor="anchor" :idol-directory="idolDirectory" :search-match-ids="searchMatchIds" />
      </template>
    </div>
  </section>
</template>

<script setup>
import ReaderStoryNavigation from './ReaderStoryNavigation.vue'
import ReadingTranscriptSection from './ReadingTranscriptSection.vue'
import ChapterStoryReader from './ChapterStoryReader.vue'
import { readerTheme } from '../../presentation/ReaderTheme.js'
import '../../presentation/reader-theme.css'
import GsLoadingIndicator from '../GsLoadingIndicator.vue'
import ReaderControlBar from './ReaderControlBar.vue'
import { useReadingPresentation } from './useReadingPresentation.js'
import { computed, nextTick, ref, watch } from 'vue'
import ReaderPageHeader from './ReaderPageHeader.vue'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'

const props = defineProps({ state: { type: Object, required: true }, chapter: { type: Object, default: null }, chapterNavigation: { type: Object, default: null }, documentId: String, mode: String, anchor: String, notice: String, busy: Boolean, idolDirectory:{type:Array,default:()=>[]} })
const emit = defineEmits(['chapter', 'select', 'mode', 'back', 'retry', 'play-document', 'refresh', 'locate', 'retry-segment', 'play-segment', 'locate-segment'])
const searchQuery = ref('')
const searchOpen = ref(false)
const searchInput = ref(null)
const controlBar = ref(null)
async function closeSearch() {
  searchOpen.value = false
  searchQuery.value = ''
  await nextTick()
  controlBar.value?.focusSearch()
}
async function toggleSearch() {
  if (searchOpen.value) return closeSearch()
  searchOpen.value = true
  await nextTick()
  searchInput.value?.focus()
}
const heading = ref(null)
const readerRoot = ref(null)
const playbackNotice = ref(null)
const document = computed(() => props.state.document)
const segmentEntries = computed(() => {
  const logicalId = document.value?.logical_id || props.state.entries.find(entry => entry.document_id === props.documentId)?.logical_id
  return logicalId ? props.state.entries.filter(entry => entry.logical_id === logicalId) : []
})
const { localization, sourceTitle, presentedRows } = useReadingPresentation(document, computed(() => props.mode))
const title = computed(() => presentProducerAddressingText(sourceTitle.value))
const episodeLabel = computed(() => presentIdolEpisodeLabel({ sourceName: document.value?.presentation?.episode_label }))
const fallbackCount = computed(() => presentedRows.value.filter(item => !item.mergedTitle && item.row.kind !== 'stamp' && item.view.translation.fallbackUsed).length)
const translationLoadFailed = computed(() => localization.diagnostics.value?.code === 'translation_invalid')
const translationStatus = computed(() => {
  if (localization.loading.value) return '正在读取译文，暂时显示原文。'
  if (translationLoadFailed.value) return '译文暂时无法载入，当前显示原文。'
  if (fallbackCount.value) return `${fallbackCount.value} 处暂无可用译文，已显示原文。`
  return props.mode === 'bilingual' ? '当前显示原文与译文。' : '当前显示译文。'
})
const searchText = text => String(text || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase()
const searchMatches = computed(() => {
  const query = searchText(searchQuery.value)
  if (!query || props.state.status !== 'ready') return []
  return presentedRows.value.filter(item => !item.mergedTitle && [item.view.primary.text, item.view.secondary?.text, item.view.speaker.display]
    .some(text => searchText(text).includes(query)))
})
const searchMatchIds = computed(() => new Set(searchMatches.value.map(item => item.row.anchor.row_id)))
const matchIndex = computed(() => searchMatches.value.findIndex(item => item.row.anchor.row_id === props.anchor))
function moveMatch(direction) {
  const count = searchMatches.value.length
  if (!count) return
  const index = matchIndex.value < 0 ? (direction > 0 ? 0 : count - 1) : (matchIndex.value + direction + count) % count
  emit('locate', searchMatches.value[index].row.anchor.row_id)
}
watch(() => props.documentId, () => { searchQuery.value = ''; searchOpen.value = false })
const missingAnchor = computed(() => props.anchor && !document.value?.rows.some(r => r.anchor.row_id === props.anchor))
const choiceRows = control => document.value.rows.filter(r => r.kind === 'choice' && r.anchor.step_index === control.step_index)
watch(() => [props.state.status, props.documentId, props.anchor, props.notice], async () => {
  await nextTick()
  if (props.chapter) return
  if (props.notice && playbackNotice.value) {
    playbackNotice.value.focus({ preventScroll: true })
    playbackNotice.value.scrollIntoView({ block: 'start' })
    return
  }
  if (props.state.status !== 'ready') return
  const target = props.anchor && readerRoot.value?.querySelector(`[id="reading-${props.anchor}"]`)
  if (target) {
    const visibleTarget = target.classList.contains('merged-title') ? heading.value : target.closest('.reader-row') || target
    visibleTarget?.focus({ preventScroll: true })
    visibleTarget?.scrollIntoView({ block: 'start' })
  }
  else { readerRoot.value?.scrollTo({ top: 0 }); heading.value?.focus({ preventScroll: true }) }
}, { immediate: true })
</script>

<style scoped>
.reader-search { margin: 20px 0; padding: 16px; background: var(--reader-bg-card); border: 1px solid var(--reader-border); border-radius: 12px; }
.reader-search label { display: flex; align-items: center; gap: 12px; font-size: 14px; white-space: nowrap; }
.reader-search input { min-width: 0; width: 100%; min-height: 44px; padding: 8px; background:var(--reader-bg-card); color:var(--reader-text-main); font: inherit; border: 1px solid var(--reader-border); border-radius: 6px; }
.reader-search-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: 13px; }
.reader-search-actions span { margin-right: auto; }
.reader-search-actions button:disabled { opacity: .45; cursor: default; }
.reader-notice[role="alert"] { scroll-margin-top: 20px; padding: 12px; border: 1px solid var(--reader-border); border-radius: 8px; outline: none; }
.reader-play { min-height: 44px; padding: 8px 12px; margin-top: 8px; border: 1px solid var(--reader-border); border-radius: 8px; background: var(--reader-bg-card); color: var(--reader-accent-text); font: inherit; font-size: 13px; cursor: pointer; }
.reader-play:disabled { opacity: .5; cursor: wait; }
.reader-play:focus-visible { outline: 2px solid var(--reader-accent-text); outline-offset: 3px; }
.story-reader { height: 100%; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--reader-border) transparent; background: var(--reader-bg-page); color: var(--reader-text-main); font-family: Inter, "Noto Sans JP", "Noto Sans SC", system-ui, sans-serif; }
button, select { font: inherit; font-size: 15px; color: inherit; cursor: pointer; }
button { min-height: 44px; border: 0; background: none; color: var(--reader-accent-text); }
button:focus-visible, select:focus-visible { outline: 3px solid var(--reader-accent-text); outline-offset: 3px; }
.reader-body { max-width: 1000px; margin: 0 auto; padding: 28px max(24px, var(--archive-safe-right)) 60px max(24px, var(--archive-safe-left)); }
h1 { margin: 0; font-size: 26px; line-height: 1.5; letter-spacing: -.5px; outline: none; }
.reader-subtitle { font-size: 14px; color: var(--reader-text-sub); margin: 4px 0 22px; }
.reader-full-play { padding: 10px 20px; border-radius: 8px; background: var(--reader-active); color: var(--reader-on-accent); }
.reader-full-play:disabled { opacity: .5; cursor: wait; }
.reader-notice, .reader-feedback { font-size: 14px; line-height: 1.8; color: var(--reader-text-sub); }
.reader-feedback h2 { font-size: 18px; color: var(--reader-text-main); }
.reader-feedback details { margin-top: 18px; overflow-wrap: anywhere; }
.reader-feedback summary { cursor: pointer; }
@media (max-width:760px) { .reader-search { padding:12px; } .reader-search label { display:block; white-space:normal; } .reader-search input { box-sizing:border-box; margin-top:8px; } .reader-body { padding:20px 14px 40px; } h1 { font-size:22px; } }
.reader-loading { margin-block: 18px; max-width: 100%; }
.reader-container .reader-loading :deep(.gs-loading-indicator__badge) { background:var(--reader-bg-card); border-color:var(--reader-border); }
.reader-container .reader-loading :deep(.gs-loading-indicator__message) { color:var(--reader-text-sub); }
</style>
