<template>
  <div class="story-inspector">
    <div class="inspector-heading">
      <div>
        <h2>{{ entry.title }}</h2>
        <p>{{ entry.missing ? '资源缺失' : '可播放' }}</p>
      </div>
      <CircleCheck v-if="!entry.missing" :size="18" />
      <CircleAlert v-else :size="18" />
    </div>
    <section>
      <h3>故事信息</h3>
      <dl>
        <div>
          <dt>资源 ID</dt>
          <dd>{{ entry.resourceIds?.join(' / ') || entry.resourceId }}</dd>
        </div>
        <div v-if="entry.voiceCount || entry.lipCount">
          <dt>语音 · 唇形</dt>
          <dd>{{ entry.voiceCount || 0 }} voices · {{ entry.lipCount || 0 }} lips</dd>
        </div>
      </dl>
    </section>
    <section class="inspector-actions">
      <h3>播放</h3>
      <button :disabled="entry.missing || !entry.file" @click="emit('play')">
        <Play :size="17" fill="currentColor" />
        播放
      </button>
    </section>
  </div>
</template>

<script setup>
import { CircleAlert, CircleCheck, Play } from '@lucide/vue'

defineProps({ entry: { type: Object, required: true } })
const emit = defineEmits(['play'])
</script>

<style scoped>
.story-inspector { padding: 20px 18px; color: #1c252d; }
.inspector-heading { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 18px; border-bottom: 1px solid #e0e5e8; }
.inspector-heading h2 { margin: 0 0 8px; font-size: 0.95rem; line-height: 1.35; }
.inspector-heading p { margin: 0; color: #159a77; font-size: 0.72rem; }
.inspector-heading svg { color: #24a874; flex: 0 0 auto; }
.story-inspector section { padding: 18px 0; border-bottom: 1px solid #e0e5e8; }
.story-inspector h3 { margin: 0 0 14px; font-size: 0.78rem; color: #4d5862; }
.story-inspector dl { margin: 0; }
.story-inspector dl > div { display: grid; gap: 6px; padding: 10px 0; }
.story-inspector dt { color: #8a949e; font-size: 0.68rem; }
.story-inspector dd { margin: 0; color: #4c5660; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 0.69rem; line-height: 1.55; overflow-wrap: anywhere; }
.inspector-actions button {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; height: 42px; border: 0; border-radius: 6px;
  background: #19a79d; color: #fff; cursor: pointer; font: inherit; font-size: 0.84rem; font-weight: 700;
}
.inspector-actions button:hover { background: #138f87; }
.inspector-actions button:disabled { background: #c9d0d4; cursor: not-allowed; }
</style>
