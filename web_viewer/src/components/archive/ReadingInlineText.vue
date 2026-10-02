<template><template v-for="(part, index) in parts" :key="index"><span v-if="part.type === 'text'">{{ part.text }}</span><img v-else-if="!failed.has(part.id)" class="reading-emoji" :src="getEmojiUrl(part.id)" :alt="part.alt" @error="failed.add(part.id)" /><span v-else>[表情]</span></template></template>
<script setup>
import { computed, reactive } from 'vue'
import { projectCommunicationInlineContent } from '../../presentation/communicationInlineContent.js'
import { getEmojiUrl } from '../../utils/AssetResolver.js'
import { reflowReadingText } from '../../../shared/reading/ReadingTypography.js'
const props = defineProps({ text: String, locale: String })
const failed = reactive(new Set())
const parts = computed(() => projectCommunicationInlineContent(reflowReadingText(props.text, props.locale)))
</script>
<style scoped>
.reading-emoji { display:inline-block; width:1.25em; height:1.25em; object-fit:contain; vertical-align:-.2em; margin:0 .08em; }
</style>
