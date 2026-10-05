<template>
  <div v-if="idol" class="catalog-idol-scope" role="group" aria-label="目录偶像筛选">
    <ArchiveIdolAvatar :idol-code="idol.id" :size="28" decorative />
    <span>当前筛选：<strong>{{ name || idol.name }}</strong></span>
    <button type="button" @click="$emit('clear')">查看全量目录</button>
  </div>
</template>
<script setup>
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
defineProps({ idol: { type: Object, default: null }, name: { type: String, default: '' } })
defineEmits(['clear'])
</script>
<style scoped>
.catalog-idol-scope{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:12px 20px;background:#edf7f6;color:#285a5a;font:inherit;}
.catalog-idol-scope button{margin-left:auto;min-height:36px;padding:6px 12px;border:1px solid #bad8d5;border-radius:8px;background:#fff;color:inherit;font:inherit;cursor:pointer;}
.catalog-idol-scope button:focus-visible{outline:2px solid #278e87;outline-offset:2px;}
@media(max-width:760px){.catalog-idol-scope{padding:10px;}.catalog-idol-scope button{min-height:44px;}}
</style>
