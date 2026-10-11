<template>
  <button type="button" class="stage-idol-switch" :aria-label="idol ? `担当：${name}，切换担当或配色` : '设置担当'" @click="open = true">
    <ArchiveIdolAvatar v-if="idol" :idol-code="idol.id" :size="32" :ring-width="2" :gap="2" :accent-color="ring" decorative />
    <span v-else class="stage-idol-empty" aria-hidden="true"><UserRound :size="18" /></span>
    <span class="stage-idol-copy"><strong>{{ idol ? name : '设置担当' }}</strong><small>{{ idol ? (stageLight ? '担当 · 配色中' : '担当') : '选择后可跟随配色' }}</small></span>
    <ChevronDown :size="16" aria-hidden="true" />
  </button>
  <ArchiveTerminalDialog :open="open" title="担当" title-id="stage-idol-switch-title" @close="open = false">
    <label class="stage-light-row">
      <span><span>跟随担当配色</span><small>{{ idol ? '选中、播放与进度改用担当色。' : '设置担当后可用。' }}</small></span>
      <input type="checkbox" aria-label="跟随担当配色" :checked="stageLight" :disabled="!idol" @change="emit('save-startup', { stageLight: $event.target.checked ? 'idol' : 'mint' })" />
    </label>
    <ArchiveIdolPickerPanel :idols="idols" :idol-name="idolName" :idol-search="idolSearch" :model-value="idol?.id || ''" @update:model-value="emit('save-preferred', $event); open = false" />
  </ArchiveTerminalDialog>
</template>
<script setup>
import { computed, ref } from 'vue'
import { ChevronDown, UserRound } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
import ArchiveIdolPickerPanel from './terminal/ArchiveIdolPickerPanel.vue'
import { idolStageLight } from '../../presentation/idolStageLight.js'
// The 担当 in the sidebar is also its switch: colour on/off and a new 担当 without leaving the page.
const props = defineProps({
  idol: { type: Object, default: null }, name: { type: String, default: '' }, stageLight: Boolean,
  idols: { type: Array, default: () => [] }, idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' },
})
const emit = defineEmits(['save-preferred', 'save-startup'])
const open = ref(false)
// Colour shows only while the stage light follows the 担当; otherwise the ring stays neutral.
const ring = computed(() => props.stageLight ? idolStageLight(props.idol?.color)?.light || '' : 'var(--gs-chrome-ink)')
</script>
<style scoped>
.stage-idol-switch { display: flex; align-items: center; gap: var(--gs-space-4); width: calc(100% - 2 * var(--gs-space-3)); min-height: var(--gs-control-touch); margin: calc(-1 * var(--gs-space-3)) var(--gs-space-3) var(--gs-space-5); padding: var(--gs-space-2) var(--gs-space-4); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-chrome-ink); font: inherit; text-align: left; cursor: pointer; }
.stage-idol-switch :deep(.idol-avatar-shell) { background: var(--gs-chrome); }
.stage-idol-switch > svg { flex-shrink: 0; margin-left: auto; }
.stage-idol-empty { display: grid; flex-shrink: 0; place-items: center; width: 32px; height: 32px; border: 1px dashed var(--gs-chrome-ink); border-radius: 50%; }
.stage-idol-copy { display: flex; flex-direction: column; min-width: 0; }
.stage-idol-copy strong { overflow: hidden; color: var(--gs-chrome-ink-active); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.stage-idol-copy small { color: var(--gs-chrome-ink); font-size: var(--gs-text-meta); white-space: nowrap; }
.stage-idol-switch:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
@media (hover: hover) { .stage-idol-switch:hover { background: var(--gs-chrome-hover); color: var(--gs-chrome-ink-active); } }
.stage-light-row { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-5); margin-bottom: var(--gs-space-5); padding-bottom: var(--gs-space-5); border-bottom: 1px solid var(--gs-line); cursor: pointer; }
.stage-light-row > span { display: flex; flex-direction: column; gap: var(--gs-space-1); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.stage-light-row small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.stage-light-row input { width: 20px; height: 20px; flex-shrink: 0; accent-color: var(--gs-mint); }
</style>
