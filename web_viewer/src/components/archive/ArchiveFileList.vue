<template>
  <section class="screen list-screen">
    <ArchiveListHeader
      v-if="!embedded"
      :title="title"
      filter-placeholder="Search scenario..."
      :model-value="modelValue"
      @back="emit('back')"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <div class="file-list">
      <p v-if="!entries.length" class="empty-state">没有符合当前条件的剧情文件</p>
      <button
        v-for="entry in entries"
        :key="entry.file || entry.resourceId"
        class="file-btn"
        :class="{ 'file-btn-missing': entry.missing }"
        :disabled="entry.missing"
        @click="emit('select', entry)"
      >
        <span class="file-status-icon" aria-hidden="true">
          <FileWarning v-if="entry.missing" :size="18" />
          <Play v-else :size="17" fill="currentColor" />
        </span>
        <span class="file-main">
          <span class="file-title">{{ presentProducerAddressingText(entry.title) }}</span>
          <span v-if="entry.subtitle" class="file-subtitle">{{ entry.subtitle }}</span>
        </span>
        <span class="file-availability">{{ entry.missing ? '缺少文件' : '可播放' }}</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { FileWarning, Play } from '@lucide/vue'
import ArchiveListHeader from './ArchiveListHeader.vue'
import { presentProducerAddressingText } from '../../presentation/ProducerAddressingText.js'

defineProps({
  title: { type: String, default: '' },
  entries: { type: Array, default: () => [] },
  modelValue: { type: String, default: '' },
  embedded: { type: Boolean, default: false },
})

const emit = defineEmits(['back', 'select', 'update:modelValue'])
</script>

<style scoped>
.list-screen { padding: 0; height: 100%; overflow-y: auto; overflow-x: hidden; }
.file-list { padding: 8px 16px 16px; }
.file-btn {
  display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 10px;
  width: 100%; text-align: left; background: var(--gs-surface); border: 1px solid var(--gs-line);
  border-radius: 6px; padding: 8px 12px; margin-bottom: 4px; cursor: pointer;
  color: var(--gs-ink-2); font-size: 0.78rem; transition: background 0.15s;
}
.file-btn:hover { background: var(--gs-paper); color: var(--gs-ink); }
.file-btn:disabled { cursor: not-allowed; color: var(--gs-ink-3); opacity: 0.75; }
.file-btn-missing { border-style: dashed; background: var(--gs-paper); }
.file-status-icon { display: grid; place-items: center; color: var(--gs-mint-ink); }
.file-btn-missing .file-status-icon { color: var(--gs-ink-3); }
.file-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.file-title { font-size: 0.86rem; color: var(--gs-ink); line-height: 1.35; }
.file-subtitle { font-family: monospace; font-size: 0.7rem; color: var(--gs-ink-3); line-height: 1.25; overflow-wrap: anywhere; }
.file-availability { padding: 3px 7px; border-radius: 4px; background: var(--gs-mint-wash); color: var(--gs-mint-ink); font-size: 0.65rem; white-space: nowrap; }
.file-btn-missing .file-availability { background: var(--gs-line); color: var(--gs-ink-3); }
.empty-state { margin: 28px 0; color: var(--gs-ink-3); font-size: 0.78rem; text-align: center; }

@media (max-width: 560px) {
  .file-list { padding: 8px 10px 16px; }
  .file-btn { grid-template-columns: 24px minmax(0, 1fr); }
  .file-availability { grid-column: 2; justify-self: start; }
}
</style>
