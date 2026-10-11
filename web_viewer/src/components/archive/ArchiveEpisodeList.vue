<template>
  <section class="screen list-screen">
    <ArchiveListHeader v-if="!embedded" :title="unit?.unit_name || 'Episodes'" @back="emit('back')" />
    <div class="episode-list">
      <button v-for="episode in unit?.episodes || []" :key="episode.id" class="episode-btn" @click="emit('select', episode)">
        <span class="episode-title">{{ episode.title || episode.id }}</span>
        <span class="episode-count">{{ episode.fileCount ?? groupFileCount(episode) }} files</span>
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
  display: block; width: 100%; text-align: left; background: var(--gs-surface);
  border: 1px solid var(--gs-line); border-radius: 8px; padding: 12px 16px;
  margin-bottom: 6px; cursor: pointer; color: var(--gs-ink-2); transition: background 0.15s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
.episode-btn:hover { background: var(--gs-paper); color: var(--gs-ink); }
.episode-title { display: block; font-size: 0.9rem; margin-bottom: 2px; color: var(--gs-ink); }
.episode-count { font-size: 0.7rem; color: var(--gs-ink-3); }
</style>
