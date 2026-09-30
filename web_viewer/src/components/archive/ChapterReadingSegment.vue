<template>
  <section :id="`reading-document-${segment.documentId || segment.episodeKey}`" class="chapter-reading-segment" :data-document-id="segment.documentId" :data-revision="segment.entry?.sha256" :data-source-file="segment.source_file" :data-text-catalog="segment.document?.text_catalog_id" tabindex="-1">
    <header><h2>{{ label }}</h2><button v-if="segment.status === 'ready'" :disabled="busy" @click="emit('play', { documentId: segment.documentId, rowId: anchor })">{{ uiText('reader.playSegment') }}</button></header>
    <template v-if="segment.status === 'ready'">
      <p v-if="mode !== 'original'" role="status" class="segment-notice">{{ translationNotice }} <button v-if="localization.diagnostics.value?.code === 'translation_invalid'" @click="localization.retryTranslation()">重试译文</button></p>
      <ReadingTranscriptSection :rows="presentedRows" :mode="mode" :anchor="anchor" :idol-directory="idolDirectory" :search-match-ids="new Set(matches(query).map(item => item.rowId))" />
    </template>
    <div v-else class="segment-placeholder" :aria-busy="segment.status === 'loading'">
      <p v-if="segment.status === 'idle' || segment.status === 'loading'" role="status">正在载入本段正文…</p>
      <template v-else-if="segment.status === 'error'"><p role="alert">本段正文暂时无法载入，其他分段仍可阅读。</p><button @click="emit('retry', segment.documentId)">重试本段</button><details><summary>加载详情</summary>{{ segment.error }}</details></template>
      <p v-else-if="segment.status === 'unsupported'">本段暂不支持完整阅读，分支或来源尚未可靠还原。</p>
      <p v-else-if="segment.status === 'empty'">本段没有可显示正文。</p>
      <p v-else>本段尚未生成阅读正文。</p>
    </div>
  </section>
</template>
<script setup>
import { computed } from 'vue'
import ReadingTranscriptSection from './ReadingTranscriptSection.vue'
import { useReadingPresentation } from './useReadingPresentation.js'
import { presentIdolEpisodeLabel } from '../../presentation/idolEpisodeLabel.js'
import { resolveUiText as uiText } from '../../localization/ui/UiTextResolver.js'
const props = defineProps({ segment: Object, mode: String, anchor: String, query: String, busy: Boolean, idolDirectory:{type:Array,default:()=>[]} })
const emit = defineEmits(['play', 'retry'])
const label = computed(() => presentIdolEpisodeLabel({ sourceName: props.segment.label }))
const document = computed(() => props.segment.status === 'ready' ? props.segment.document : null)
const { localization, presentedRows } = useReadingPresentation(document, computed(() => props.mode))
const translationNotice = computed(() => localization.loading.value ? '正在读取本段译文，暂时显示原文。' :
  presentedRows.value.some(item => item.view.translation.fallbackUsed) ? '本段部分台词暂无可用译文，保留原文。' : props.mode === 'bilingual' ? '本段显示原文与译文。' : '本段显示译文。')
const normalize = value => String(value || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase()
function matches(query) {
  const text = normalize(query)
  return text && document.value ? presentedRows.value.filter(item => !item.mergedTitle &&
    [item.view.primary.text, item.view.secondary?.text, item.view.speaker.display].some(value => normalize(value).includes(text)))
    .map(item => ({ documentId: props.segment.documentId, rowId: item.row.anchor.row_id, revision: props.segment.entry.sha256 })) : []
}
defineExpose({ matches })
</script>
<style scoped>
.chapter-reading-segment { scroll-margin-top:20px; outline:none; margin:32px 0; overflow-anchor:auto; }
header { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:12px 0; border-bottom:1px solid #cbd8df; }
h2 { margin:0; font-size:20px; color:#183846; }
button { min-height:44px; padding:8px 14px; border:1px solid #cddde4; border-radius:8px; background:#fff; color:#16838d; font:inherit; cursor:pointer; }
button:disabled { opacity:.5; cursor:wait; }
.segment-placeholder { min-height:240px; padding:20px; background:#edf3f3; color:#60727e; }
.segment-notice { color:#60727e; font-size:14px; }
</style>
