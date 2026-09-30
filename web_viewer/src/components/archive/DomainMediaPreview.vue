<template>
  <figure class="domain-media-preview" :class="{'domain-media-compact':compact}">
    <img v-if="binding?.url && !failed" :key="attempt" :src="binding.url" :alt="name" @load="loaded=true" @error="failed=true;loaded=false"/>
    <div v-else class="domain-resource-empty" :title="binding?.url ? '图片暂时无法读取' : '图片尚未绑定'"><ImageOff :size="compact?18:28"/><span v-if="!compact">{{ binding?.url ? '图片暂时无法读取' : '图片尚未绑定' }}</span><button v-if="binding?.url" type="button" :aria-label="`重试图片 ${name}`" @click="retry">{{ compact?'重试':'重试图片' }}</button></div>
    <figcaption v-if="!compact">{{ loaded?'本地图片预览':binding?.url && !failed?'正在读取图片…':'媒体展示待确认' }}{{ effectStatus && effectStatus!=='none'?' · 原配置效果尚未重建':'' }}</figcaption>
  </figure>
</template>
<script setup>
import {ref,watch} from 'vue'
import {ImageOff} from '@lucide/vue'
const props=defineProps({binding:Object,name:String,effectStatus:String,compact:Boolean})
const failed=ref(false),loaded=ref(false),attempt=ref(0)
function retry(){failed.value=false;loaded.value=false;attempt.value++}
watch(()=>props.binding?.url,retry)
</script>
<style scoped>
.domain-media-compact{display:inline-flex;vertical-align:middle;width:44px;height:44px;min-width:44px;margin:0 9px 0 0;padding:0;background:transparent;border:0;align-items:center;justify-content:center}.domain-media-compact img{width:44px;height:44px;max-height:44px;object-fit:contain}.domain-media-compact .domain-resource-empty{min-height:0;width:44px;gap:0;font-size:10px;padding:0}.domain-media-compact button{padding:0;font-size:10px}
</style>
