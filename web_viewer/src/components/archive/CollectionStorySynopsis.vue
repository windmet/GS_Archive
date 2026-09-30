<template>
  <StorySynopsisCard v-if="view.primary.text" :data-unit-id="synopsis?.text_ref.unit_id" :data-document-id="document?.document_id" :data-text-catalog="document?.text_catalog_id" :data-revision="entry?.sha256" :view="view" :title="presentProducerAddressingText(title)" :mode="mode" :switchable="Boolean(synopsis)" :notice="notice" :retryable="Boolean(error)" @mode="mode=$event" @retry="load" />
</template>
<script setup>
import { computed, onScopeDispose, ref, watch } from 'vue'
import StorySynopsisCard from './StorySynopsisCard.vue'
import { useReadingPresentation } from './useReadingPresentation.js'
import { readingSynopsisRow } from '../../presentation/StorySynopsis.js'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { storyContentMode } from '../../utils/LanguageStore.js'
const props=defineProps({entry:Object,loadDocument:Function,fallback:Object,title:String})
const mode=ref(storyContentMode.value),document=ref(null),loading=ref(false),error=ref('')
const synopsis=computed(()=>readingSynopsisRow(document.value))
const localizedDocument=computed(()=>synopsis.value ? document.value : null)
const {presentedRows,localization}=useReadingPresentation(localizedDocument,mode)
const view=computed(()=>presentedRows.value.find(item=>item.row===synopsis.value)?.view || {primary:{text:props.fallback?.text || '',locale:'ja-JP'}})
const notice=computed(()=>loading.value ? '正在载入简介…' : error.value ? '简介暂时无法载入，保留目录原文。' :
  synopsis.value && mode.value !== 'original' ? localization.loading.value ? '正在读取简介译文…' : view.value.translation?.fallbackUsed ? '简介暂无可用译文，保留原文。' : '' : '')
let generation=0
async function load() {
  const token=++generation; document.value=null; error.value=''; loading.value=false
  if (!props.entry || !props.loadDocument) return
  loading.value=true
  try { const result=await props.loadDocument(props.entry); if(token===generation) document.value=result.status==='ready' ? result.document : null }
  catch(cause) { if(token===generation) error.value=cause.message || String(cause) }
  finally { if(token===generation) loading.value=false }
}
watch(()=>[props.entry?.document_id,props.entry?.sha256],load,{immediate:true})
onScopeDispose(()=>{generation++})
</script>
