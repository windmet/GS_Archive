<template>
  <StorySynopsisCard v-if="view.primary.text" :data-unit-id="synopsis?.text_ref.unit_id" :data-document-id="document?.document_id" :data-text-catalog="document?.text_catalog_id" :data-revision="entry?.sha256" :view="view" :title="presentProducerAddressingText(displayTitle)" :title-pending="titlePending" :mode="mode" :notice="notice" :pending="pending" :retryable="Boolean(error)" @retry="load" />
</template>
<script setup>
import { computed } from 'vue'
import StorySynopsisCard from './StorySynopsisCard.vue'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'
import { useStorySynopsis } from './useStorySynopsis.js'
const props=defineProps({entry:Object,loadDocument:Function,fallback:Object,title:String})
const { mode, displayTitle, titlePending, document, synopsis, view, pending, notice, error, load } = useStorySynopsis({
  entry: computed(() => props.entry), loadDocument: computed(() => props.loadDocument),
  fallback: computed(() => props.fallback), title: computed(() => props.title) })
</script>
