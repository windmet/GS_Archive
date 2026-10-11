<template>
  <span class="resource-image" :style="{aspectRatio:binding?.width&&binding?.height?`${binding.width}/${binding.height}`:'940/510'}">
    <img v-if="binding?.url&&!failed" :src="binding.url" :alt="name" :width="binding.width" :height="binding.height" loading="lazy" decoding="async" @error="failed=true" />
    <span v-else class="resource-placeholder">{{ name }}<small>图片暂不可用</small></span>
  </span>
</template>
<script setup>
import {ref,watch} from 'vue'
const props=defineProps({binding:Object,name:String})
const failed=ref(false)
watch(()=>props.binding?.url,()=>{failed.value=false})
</script>
<style scoped>
.resource-image{display:block;overflow:hidden;min-width:0;background:#eef2f3;border-radius:4px}.resource-image img{display:block;width:100%;height:100%;object-fit:contain}.resource-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:12px;text-align:center;color:#60777b;font-size:13px;gap:8px}.resource-placeholder small{font-size:11px}
</style>
