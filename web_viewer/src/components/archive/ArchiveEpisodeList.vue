<template>
  <section class="screen list-screen">
    <ArchiveListHeader v-if="!embedded" :title="unit?.unit_name || 'Episodes'" @back="emit('back')" />
    <div class="episode-list">
      <button v-for="episode in unit?.episodes || []" :key="episode.id" class="episode-btn" @click="emit('select', episode)">
        <span class="episode-title">{{ episode.title || episode.id }}</span>
        <span class="episode-count">{{ groupFileCount(episode) }} files</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import ArchiveListHeader from './ArchiveListHeader.vue'
import { groupFileCount } from '../../utils/IndexNormalizer.js'

defineProps({
  unit: { type: Object, default: null },
  embedded: { type: Boolean, default: false },
})
const emit = defineEmits(['back', 'select'])
</script>

<style scoped>
.list-screen { padding: 0; height: 100%; overflow-y: auto; overflow-x: hidden; }
.episode-list { padding: 8px 16px 16px; }
.episode-btn {
  display: block; width: 100%; text-align: left; background: #fff;
  border: 1px solid #e8e8e8; border-radius: 8px; padding: 12px 16px;
  margin-bottom: 6px; cursor: pointer; color: #444; transition: background 0.15s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
.episode-btn:hover { background: #f5f7fa; color: #222; }
.episode-title { display: block; font-size: 0.9rem; margin-bottom: 2px; color: #333; }
.episode-count { font-size: 0.7rem; color: #999; }
</style>
