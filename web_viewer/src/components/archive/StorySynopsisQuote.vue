<template>
  <!-- A synopsis set as a quotation (idol stories): the translated synopsis row of the first reading
       document, its space kept while the translation loads, the catalogue text as the fallback. -->
  <div v-if="view.primary.text" :aria-busy="pending || undefined">
    <span :lang="view.primary.locale" :class="{ 'is-pending': pending }">{{ presentProducerAddressingText(view.primary.text) }}</span>
    <small v-if="notice" class="synopsis-quote-notice" role="status">{{ notice }}</small>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { useStorySynopsis } from './useStorySynopsis.js'
// entries: the chapter's reading documents in order. They share one synopsis; when a document has no
// translation yet (a newly split birthday small talk) the next one supplies it.
const props = defineProps({ entries: { type: Array, default: () => [] }, loadDocument: Function, fallback: Object })
const index = ref(0)
watch(() => props.entries.map(entry => entry.document_id).join(), () => { index.value = 0 })
const synopsis = useStorySynopsis({ entry: computed(() => props.entries[index.value]), loadDocument: computed(() => props.loadDocument),
  fallback: computed(() => props.fallback), title: computed(() => '') })
// Settled without a translated synopsis: the document failed, had no synopsis row, or no translation.
const untranslated = computed(() => synopsis.mode.value !== 'original' && !synopsis.pending.value && Boolean(props.entries[index.value]) &&
  (Boolean(synopsis.error.value) || !synopsis.synopsis.value || Boolean(synopsis.view.value.translation?.fallbackUsed)))
const hasNext = computed(() => index.value < props.entries.length - 1)
watch(untranslated, value => { if (value && hasNext.value) index.value++ })
const view = synopsis.view
const pending = computed(() => synopsis.pending.value || (untranslated.value && hasNext.value))
const notice = computed(() => pending.value ? '正在载入简介…' : synopsis.notice.value)
</script>
<style scoped>
.is-pending { visibility: hidden; }
.synopsis-quote-notice { display: block; margin-top: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); white-space: normal; }
</style>
