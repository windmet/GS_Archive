<template>
  <img v-if="!failed" class="mobile-stamp" :src="getStampUrl(id)" alt="贴图" loading="lazy" @error="failed = true" />
  <span v-else role="img" aria-label="贴图">［贴图］</span>
</template>
<script setup>
import { ref, watch } from 'vue'
import { getStampUrl } from '../../utils/AssetResolver.js'
const props = defineProps({ id: { type: String, required: true } })
const failed = ref(false)
watch(() => props.id, () => { failed.value = false })
</script>
<style scoped>
.mobile-stamp { display: block; width: 144px; max-width: 100%; height: auto; margin-top: 12px; }
</style>
