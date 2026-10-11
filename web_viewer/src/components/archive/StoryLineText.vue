<template>
  <!-- One line of a story shown outside the Reader (a work row's opening line, a call's title or first
       line): the translated row of its reading document, matched by its source text. The slot gets
       the text and whether it is still waiting for the translation. -->
  <slot :text="text" :pending="pending" :locale="locale" />
</template>
<script setup>
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useReadingPresentation } from './useReadingPresentation.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { uiLocale } from '../../utils/LanguageStore.js'

// entry: a reading entry or a document id; kind: 'line' (dialogue) or 'title'.
const props = defineProps({ entry: [Object, String], loadDocument: Function, source: { type: String, default: '' }, kind: { type: String, default: 'line' } })
const mode = computed(() => uiLocale.value === 'zh-CN' ? 'translation' : 'original')
const document = ref(null), loading = ref(false)
const { presentedRows, translationPending } = useReadingPresentation(document, mode)
const compact = value => String(value || '').replace(/[\s　]/gu, '')
const match = computed(() => {
  const kinds = props.kind === 'title' ? ['title'] : ['dialogue', 'narration']
  const rows = presentedRows.value.filter(item => kinds.includes(item.row.kind))
  return rows.find(item => compact(item.row.source_text) === compact(props.source)) || null
})
const translated = computed(() => match.value?.view.translation?.available ? match.value.view.primary : null)
const text = computed(() => presentProducerAddressingText(translated.value?.text || props.source))
const locale = computed(() => translated.value?.locale || 'ja-JP')
const pending = computed(() => mode.value !== 'original' && (loading.value || translationPending.value))
let generation = 0
async function load() {
  const token = ++generation; document.value = null; loading.value = false
  if (mode.value === 'original' || !props.entry || !props.loadDocument || !props.source) return
  loading.value = true
  try { const result = await props.loadDocument(props.entry); if (token === generation) document.value = result?.status === 'ready' ? result.document : null }
  catch { /* Optional: the source line stands. */ }
  finally { if (token === generation) loading.value = false }
}
watch(() => [typeof props.entry === 'string' ? props.entry : props.entry?.document_id, props.source, mode.value], load, { immediate: true })
onScopeDispose(() => { generation++ })
</script>
