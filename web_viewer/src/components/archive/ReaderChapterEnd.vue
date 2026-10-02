<template>
  <aside class="reader-chapter-end" aria-label="本话末尾">
    <p>已到本话末尾</p>
    <button v-if="nextChapter" @click="emit('chapter', nextChapter.id)"><span>进入{{ nextChapter.label }}</span><strong>{{ presentProducerAddressingText(displayTitle({document_id:nextChapter.documentId,sha256:nextChapter.revision},nextChapter.title)) }}</strong><ChevronRight :size="18" aria-hidden="true" /></button>
    <span v-else class="end-note">可通过目录选择其他话目。</span>
  </aside>
</template>
<script setup>
import { computed } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { readerChapterNeighbour } from '../../presentation/ReaderControls.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { useReaderTitles } from './useReaderTitles.js'
const displayTitle = useReaderTitles()
const props = defineProps({chapterNavigation:Object})
const emit = defineEmits(['chapter'])
const nextChapter = computed(() => readerChapterNeighbour(props.chapterNavigation,1))
</script>
<style scoped>
.reader-chapter-end { margin-top:32px; padding:24px 0; border-top:1px solid var(--reader-border); text-align:center; }
p,.end-note { color:var(--reader-text-sub); font-size:13px; }
button { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:4px 16px; width:min(100%,440px); margin:12px auto 0; min-height:64px; padding:12px 18px; border:1px solid var(--reader-border); border-radius:12px; color:var(--reader-accent-text); background:var(--reader-bg-card); font:inherit; cursor:pointer; text-align:left; }
button span { font-size:13px; }
strong { grid-row:2; font-size:15px; font-weight:600; overflow-wrap:anywhere; }
svg { grid-row:1 / 3; grid-column:2; }
button:focus-visible { outline:2px solid var(--reader-accent); outline-offset:3px; }
</style>
