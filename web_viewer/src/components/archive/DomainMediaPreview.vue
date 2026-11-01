<template>
  <figure ref="figure" class="domain-media-preview" :class="{'domain-media-compact':compact}">
    <img v-if="binding?.url && !failed" :key="attempt" :src="near ? binding.url : undefined" :alt="name" @load="loaded=true" @error="onError"/>
    <div v-else class="domain-resource-empty" :title="binding?.url ? '图片暂时无法读取' : '图片尚未绑定'"><ImageOff v-if="!compact || !binding?.url" :size="compact?18:28"/><span v-if="!compact">{{ binding?.url ? '图片暂时无法读取' : '图片尚未绑定' }}</span><button v-if="binding?.url" type="button" :aria-label="`重试图片 ${name}`" @click="retry">{{ compact?'':'重试图片' }}<RefreshCw v-if="compact" :size="16" aria-hidden="true"/></button></div>
    <figcaption v-if="!compact && binding?.url && !failed && !loaded" role="status">正在读取图片…</figcaption>
  </figure>
</template>
<script setup>
import {onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {useNearViewport} from './useNearViewport.js'
import {ImageOff,RefreshCw} from '@lucide/vue'
const props=defineProps({binding:Object,name:String,effectStatus:String,compact:Boolean,deferred:Boolean})
const failed=ref(false),loaded=ref(false),attempt=ref(0)
// deferred: request the image only once it nears the viewport (below-the-fold Portal rows); otherwise at once.
const figure=ref(null)
const near=useNearViewport(figure,{eagerMedia:props.deferred?'':'all'})
function retry(){failed.value=false;loaded.value=false;attempt.value++}
// One dropped request must not leave a picture failed for good: retry after 1s and 3s on its own, and once more when
// the network comes back. The button stays for whoever is still failing after that.
const RETRY_DELAYS=[1000,3000]
let autoRetries=0,timer=0
function onError(){
  failed.value=true;loaded.value=false
  if(autoRetries<RETRY_DELAYS.length)timer=setTimeout(()=>{if(failed.value)retry()},RETRY_DELAYS[autoRetries++])
}
function onOnline(){if(failed.value&&props.binding?.url){autoRetries=0;retry()}}
onMounted(()=>window.addEventListener('online',onOnline))
onBeforeUnmount(()=>{window.removeEventListener('online',onOnline);clearTimeout(timer)})
watch(()=>props.binding?.url,()=>{autoRetries=0;clearTimeout(timer);retry()})
</script>
<style scoped>
.domain-media-preview img:not([src]){visibility:hidden}
.domain-media-compact{display:inline-flex;flex:none;vertical-align:middle;width:44px;height:44px;min-width:44px;max-width:100%;margin:0 9px 0 0;padding:0;background:transparent;border:0;align-items:center;justify-content:center}.domain-media-compact img{display:block;width:100%;height:100%;min-height:0;max-height:100%;object-fit:contain;margin:0}.domain-media-compact .domain-resource-empty{min-height:0;width:44px;height:44px;gap:0;font-size:10px;padding:0}.domain-media-compact button{min-height:44px;width:44px;padding:0;font-size:10px}
</style>
