<template>
  <figure class="domain-media-preview">
    <img v-if="binding?.url && !failed" :key="attempt" :src="binding.url" :alt="name" @load="loaded=true" @error="failed=true;loaded=false"/>
    <div v-else class="domain-resource-empty"><ImageOff :size="28"/><span>{{ binding?.url ? '图片暂时无法读取' : '图片尚未绑定' }}</span><button v-if="binding?.url" type="button" @click="retry">重试图片</button></div>
    <figcaption>{{ loaded?'本地图片预览':binding?.url && !failed?'正在读取图片…':'媒体展示待确认' }}{{ effectStatus && effectStatus!=='none'?' · 原配置效果尚未重建':'' }}</figcaption>
  </figure>
</template>
<script setup>
import {ref,watch} from 'vue'
import {ImageOff} from '@lucide/vue'
const props=defineProps({binding:Object,name:String,effectStatus:String})
const failed=ref(false),loaded=ref(false),attempt=ref(0)
function retry(){failed.value=false;loaded.value=false;attempt.value++}
watch(()=>props.binding?.url,retry)
</script>
