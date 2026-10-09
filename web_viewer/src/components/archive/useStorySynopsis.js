import { computed, onScopeDispose, ref, watch } from 'vue'
import { useReadingPresentation } from './useReadingPresentation.js'
import { readingSynopsisRow } from '../../presentation/StorySynopsis.js'
import { uiLocale } from '../../utils/LanguageStore.js'
import { useReaderTitle } from './useReaderTitles.js'

// A story's synopsis as readers see it on directory pages (story collections, events): the
// catalogue's source text is only a fallback. With the Chinese interface the synopsis row of the
// first reading document is loaded and shown translated; until it arrives the text is pending so
// pages can keep its space without flashing Japanese.
export function useStorySynopsis({ entry, loadDocument, fallback, title }) {
  const mode = computed(() => uiLocale.value === 'zh-CN' ? 'translation' : 'original')
  const displayTitle = useReaderTitle(entry, title)
  const document = ref(null), loading = ref(false), error = ref('')
  const synopsis = computed(() => readingSynopsisRow(document.value))
  const localizedDocument = computed(() => synopsis.value ? document.value : null)
  const { presentedRows, localization, translationPending } = useReadingPresentation(localizedDocument, mode)
  const view = computed(() => presentedRows.value.find(item => item.row === synopsis.value)?.view
    || { primary: { text: fallback.value?.text || '', locale: 'ja-JP' } })
  const pending = computed(() => mode.value !== 'original' && (loading.value || translationPending.value))
  // The heading above a synopsis is the document's own title row (event synopses name the first
  // episode, not the event), translated with the body; the title index covers the rest.
  const titleRow = computed(() => {
    const rows = document.value?.rows || [], at = rows.indexOf(synopsis.value)
    for (let index = at - 1; index >= 0; index--) if (rows[index].kind === 'title') return rows[index]
    return null
  })
  const heading = computed(() => {
    const row = titleRow.value
    const rowView = row && row.source_text === title.value ? presentedRows.value.find(item => item.row === row)?.view : null
    return rowView?.translation?.available ? rowView.primary.text : displayTitle.value
  })
  const headingPending = computed(() => mode.value !== 'original' && (pending.value || displayTitle.pending.value && !titleRow.value))
  const notice = computed(() => loading.value ? '正在载入简介…' : error.value ? '简介暂时无法载入，保留目录原文。' :
    synopsis.value && mode.value !== 'original' ? localization.loading.value ? '正在读取简介译文…' : view.value.translation?.fallbackUsed ? '简介暂无可用译文，保留原文。' : '' : '')
  let generation = 0
  async function load() {
    const token = ++generation; document.value = null; error.value = ''; loading.value = false
    const target = entry.value, loader = loadDocument.value
    if (!target || !loader) return
    loading.value = true
    try { const result = await loader(target); if (token === generation) document.value = result.status === 'ready' ? result.document : null }
    catch (cause) { if (token === generation) error.value = cause.message || String(cause) }
    finally { if (token === generation) loading.value = false }
  }
  watch(() => [entry.value?.document_id, entry.value?.sha256, Boolean(loadDocument.value)], load, { immediate: true })
  onScopeDispose(() => { generation++ })
  return { mode, displayTitle: heading, titlePending: headingPending, document, synopsis, view, pending, notice, error, load }
}
