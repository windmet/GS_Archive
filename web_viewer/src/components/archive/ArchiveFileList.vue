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
          <span class="file-title">{{ entry.title }}</span>
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
  width: 100%; text-align: left; background: #fff; border: 1px solid #eee;
  border-radius: 6px; padding: 8px 12px; margin-bottom: 4px; cursor: pointer;
  color: #444; font-size: 0.78rem; transition: background 0.15s;
}
.file-btn:hover { background: #f0f4ff; color: #222; }
.file-btn:disabled { cursor: not-allowed; color: #999; opacity: 0.75; }
.file-btn-missing { border-style: dashed; background: #f8f8f8; }
.file-status-icon { display: grid; place-items: center; color: #15978e; }
.file-btn-missing .file-status-icon { color: #9aa2a9; }
.file-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.file-title { font-size: 0.86rem; color: #333; line-height: 1.35; }
.file-subtitle { font-family: monospace; font-size: 0.7rem; color: #888; line-height: 1.25; overflow-wrap: anywhere; }
.file-availability { padding: 3px 7px; border-radius: 4px; background: #eaf8f6; color: #13877f; font-size: 0.65rem; white-space: nowrap; }
.file-btn-missing .file-availability { background: #eceff1; color: #707a82; }
.empty-state { margin: 28px 0; color: #7a858e; font-size: 0.78rem; text-align: center; }

@media (max-width: 560px) {
  .file-list { padding: 8px 10px 16px; }
  .file-btn { grid-template-columns: 24px minmax(0, 1fr); }
  .file-availability { grid-column: 2; justify-self: start; }
}
</style>
