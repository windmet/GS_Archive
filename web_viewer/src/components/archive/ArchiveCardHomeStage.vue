<template>
  <picture v-if="card && !failed" class="card-home-stage" :style="positions">
    <source media="(orientation: portrait)" :srcset="card.portrait.url" />
    <img :src="card.landscape.url" alt="" @error="failed = true" />
  </picture>
  <div v-if="loading || error || failed || !card" class="card-home-status" role="status">
    <span>{{ loading ? '正在载入首页卡面…' : error || (failed ? '卡面图片暂时不可用。' : '当前偶像暂无可用的首页卡面。') }}</span>
    <button v-if="!loading" type="button" @click="retry">重试卡面</button>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
const props = defineProps({ card: Object, loading: Boolean, error: String })
const emit = defineEmits(['retry'])
const failed = ref(false)
watch(() => props.card, () => { failed.value = false })
const position = value => (value || [50, 40]).map(n => `${n}%`).join(' ')
const positions = computed(() => ({ '--portrait-position': position(props.card?.portrait.position), '--landscape-position': position(props.card?.landscape.position) }))
function retry() { failed.value = false; emit('retry') }
</script>
<style scoped>
.card-home-stage { position: absolute; inset: 0; z-index: 1; }
.card-home-stage img { width: 100%; height: 100%; object-fit: cover; object-position: var(--landscape-position); }
.card-home-status { position: absolute; z-index: 6; top: 35%; left: 10%; right: 10%; padding: 16px; background: #fffffff0; color: #19354c; border-radius: 6px; text-align: center; }
.card-home-status button { margin-left: 12px; min-height: 44px; }
@media (orientation: portrait) { .card-home-stage img { object-position: var(--portrait-position); } }
</style>
