<template>
  <section class="terminal-preferred-slot">
    <button class="terminal-slot-main" type="button" @click="open = true">
      <ArchiveIdolAvatar v-if="idol" :idol-code="idol.id" :accent-color="idol.color" :size="48" decorative :fallback-text="idol.name?.slice(0, 1)" />
      <span v-else class="terminal-slot-empty" aria-hidden="true"><UserRoundPlus :size="24" /></span>
      <span><small>我的偶像 · 快捷工作台</small><strong>{{ idol?.name || '选择我的偶像' }}</strong><small>{{ idol?.unitName || '在门户快速打开资料、故事和通信' }}</small></span>
      <ChevronRight :size="18" aria-hidden="true" />
    </button>
    <ArchiveTerminalDialog :open="open" title="选择我的偶像" :title-id="`${idPrefix}-preferred-title`" @close="open = false">
      <p class="terminal-help">选择即保存。只设置门户快捷入口，不改变游戏风首页人物。</p>
      <ArchiveIdolPickerPanel :idols="idols" :model-value="value || ''" @update:model-value="save" />
      <button class="terminal-text-button" type="button" @click="save(null)">暂不设置我的偶像</button>
    </ArchiveTerminalDialog>
  </section>
</template>
<script setup>
import { computed, ref } from 'vue'
import { ChevronRight, UserRoundPlus } from '@lucide/vue'
import ArchiveIdolAvatar from '../ArchiveIdolAvatar.vue'
import ArchiveIdolPickerPanel from './ArchiveIdolPickerPanel.vue'
import ArchiveTerminalDialog from './ArchiveTerminalDialog.vue'
const props = defineProps({ idols: { type: Array, default: () => [] }, value: { type: String, default: '' }, idPrefix: { type: String, required: true } })
const emit = defineEmits(['save'])
const open = ref(false)
const idol = computed(() => props.idols.find(x => x.id === props.value))
function save(id) { if (id && !props.idols.some(x => x.id === id)) return; emit('save', id); open.value = false }
</script>
