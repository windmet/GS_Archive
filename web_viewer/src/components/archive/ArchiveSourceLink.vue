<template><a v-if="safeUrl" :href="safeUrl" target="_blank" rel="noopener noreferrer external" class="archive-source-link"><ExternalLink :size="14" />{{ label }} <small>站外原始记录</small></a></template>
<script setup>
import {computed} from 'vue'
import {ExternalLink} from '@lucide/vue'
const props=defineProps({url:String,label:{type:String,default:'资料来源'}})
const safeUrl=computed(()=>{try{const url=new URL(props.url);return ['https:','http:'].includes(url.protocol)?url.href:''}catch{return ''}})
</script>
<style scoped>.archive-source-link{display:inline-flex;align-items:center;gap:6px;color:#247f77;text-decoration:none;font-size:12px;flex-wrap:wrap}.archive-source-link:hover{text-decoration:underline}.archive-source-link small{font-size:10px;color:#7e8d92}</style>
