<template>
  <article class="reader-transcript" aria-label="剧情正文">
    <ReadingTranscriptNodes :nodes="tree" :selection="selection" :mode="mode" :anchor="anchor" :idol-directory="idolDirectory" :search-match-ids="searchMatchIds" @select="select" />
  </article>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import ReadingTranscriptNodes from './ReadingTranscriptNodes.vue'
import { readingBranchTree, readingBranchAnchorPath } from '../../presentation/ReadingBranchTabs.js'
const props = defineProps({ rows: Array, mode: String, anchor: String, idolDirectory:{type:Array,default:()=>[]}, searchMatchIds:{type:Set,default:()=>new Set()} })
const tree = computed(() => readingBranchTree(props.rows))
const selection = ref({})
function select({choice,index}) { selection.value = { ...selection.value, [choice]:index } }
watch(() => props.rows?.[0]?.row.anchor.row_id.split(':step-')[0], () => { selection.value = {} }, {flush:'sync'})
watch([() => props.anchor, () => props.rows?.[0]?.row.anchor.row_id], () => {
  const path = readingBranchAnchorPath(tree.value, props.anchor)
  if (path) for (const entry of path) select(entry)
}, {immediate:true,flush:'sync'})
</script>
<style scoped>
.reader-transcript { margin-top:18px; }
</style>
