<template>
  <section class="terminal-idol-picker">
    <label class="terminal-search"><span>查找偶像或组合</span><input v-model="query" type="search" placeholder="输入姓名或组合名" autocomplete="off" /></label>
    <p class="terminal-help" role="status">{{ matches.length }} 位偶像<span v-if="selectedName"> · 已选：{{ selectedName }}</span></p>
    <div class="terminal-idol-list" role="group" aria-label="偶像名单">
      <button v-for="idol in visible" :key="idol.id" type="button" :aria-pressed="modelValue === idol.id" :data-idol-code="idol.id" @click="emit('update:modelValue', idol.id)">
        <ArchiveIdolAvatar :idol-code="idol.id" :accent-color="idol.color" :size="44" decorative :fallback-text="displayName(idol).slice(0, 1) || '?'" />
        <span><strong>{{ displayName(idol) }}</strong><small>{{ idol.unitName || '315 STARS' }}</small></span>
      </button>
    </div>
    <p v-if="!matches.length" class="terminal-help">没有找到符合条件的偶像。</p>
    <button v-if="matches.length > limit" class="terminal-text-button" type="button" @click="limit += 12">显示更多</button>
  </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import ArchiveIdolAvatar from '../ArchiveIdolAvatar.vue'
const props = defineProps({
  idols: { type: Array, default: () => [] }, modelValue: { type: String, default: '' },
  idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' },
})
const emit = defineEmits(['update:modelValue'])
const query = ref(''), limit = ref(12)
watch(query, () => { limit.value = 12 })
function displayName(idol) { return props.idolName(idol.id) || idol.name || '' }
const matches = computed(() => props.idols.filter(idol => `${props.idolSearch(idol.id, idol.name)} ${displayName(idol)} ${idol.name || ''} ${idol.unitName || ''}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())))
const visible = computed(() => matches.value.slice(0, limit.value))
const selectedName = computed(() => {
  const idol = props.idols.find(idol => idol.id === props.modelValue)
  return idol ? displayName(idol) : ''
})
</script>
