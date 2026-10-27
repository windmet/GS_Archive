<template>
  <div ref="root" class="stage-idol" @keydown.esc="open = false">
    <button type="button" class="stage-idol-switch" :class="{ 'is-open': open }" :style="{ '--stage-idol-ring': ringColor }" :aria-haspopup="idol ? 'true' : 'dialog'" :aria-expanded="idol ? open : undefined" :aria-label="idol ? `我的担当：${name}，担当设置` : '设置担当'" @click="idol ? toggle() : pickerOpen = true">
      <ArchiveIdolAvatar v-if="idol" class="stage-idol-avatar" :idol-code="idol.id" :size="28" :ring-width="0" :gap="0" decorative />
      <span v-else class="stage-idol-empty" aria-hidden="true"><UserRound :size="16" /></span>
      <span class="stage-idol-copy"><strong>{{ idol ? name : '设置担当' }}</strong><small v-if="idol">我的担当</small></span>
      <ChevronsUpDown v-if="idol" class="stage-idol-caret" :size="14" aria-hidden="true" />
    </button>
    <div v-if="open && idol" class="stage-idol-pop" :style="popStyle" role="group" aria-label="担当设置">
      <div class="stage-idol-light"><span>舞台光 · 担当色</span><GsSwitch :model-value="stageLight" aria-label="舞台光跟随担当色" @update:model-value="emit('save-startup', { stageLight: $event ? 'idol' : 'mint' })" /></div>
      <button type="button" class="stage-idol-change" @click="pickerOpen = true; open = false">更换担当<ChevronRight :size="14" aria-hidden="true" /></button>
    </div>
  </div>
  <ArchiveTerminalDialog :open="pickerOpen" title="更换担当" title-id="stage-idol-switch-title" @close="pickerOpen = false">
    <ArchiveIdolPickerPanel :idols="idols" :idol-name="idolName" :idol-search="idolSearch" :model-value="idol?.id || ''" @update:model-value="emit('save-preferred', $event); pickerOpen = false" />
  </ArchiveTerminalDialog>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronRight, ChevronsUpDown, UserRound } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
import ArchiveIdolPickerPanel from './terminal/ArchiveIdolPickerPanel.vue'
import GsSwitch from '../gs/GsSwitch.vue'
import { normalizeIdolAccentColor } from '../../presentation/idolAccentColor.js'
// The 担当 in the sidebar is also its switch: a one-line row on the paper. Opened, it lifts to a white slice with two
// choices underneath (stage light on/off, change 担当). The ring is an outline with an offset, so its gap stays
// transparent whatever the row's background is (rest, hover or lifted).
const props = defineProps({
  idol: { type: Object, default: null }, name: { type: String, default: '' }, stageLight: Boolean,
  idols: { type: Array, default: () => [] }, idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' },
})
const emit = defineEmits(['save-preferred', 'save-startup'])
const open = ref(false), pickerOpen = ref(false), root = ref(null), popStyle = ref({})
// The sidebar scrolls and clips, so the pop-up is fixed to the window: under the row, or beside it on the 58px rail.
function toggle() {
  open.value = !open.value
  if (!open.value) return
  const rect = root.value.getBoundingClientRect()
  const rail = Boolean(root.value.closest('.is-rail'))
  popStyle.value = rail
    ? { top: `${rect.top}px`, left: `${rect.right + 8}px`, width: '220px' }
    : { top: `${rect.bottom + 4}px`, left: `${rect.left}px`, width: `${rect.width}px` }
}
function closeOnScroll(event) { if (open.value && !root.value?.contains(event.target)) open.value = false }
// Identity colour is always on; it only draws the ring.
const ringColor = computed(() => normalizeIdolAccentColor(props.idol?.color) || 'var(--gs-rule)')
function outside(event) { if (open.value && !root.value?.contains(event.target)) open.value = false }
onMounted(() => { document.addEventListener('pointerdown', outside); document.addEventListener('scroll', closeOnScroll, true) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', outside); document.removeEventListener('scroll', closeOnScroll, true) })
</script>
<style scoped>
.stage-idol { position: relative; margin: 0 var(--gs-space-3) var(--gs-space-4); }
.stage-idol-switch { display: flex; align-items: center; gap: var(--gs-space-4); box-sizing: border-box; width: 100%; height: var(--archive-identity-row, 52px); padding: 0 var(--gs-space-3) 0 7px; border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-2); font: inherit; text-align: left; cursor: pointer; }
.stage-idol-switch.is-open { background: var(--gs-current-bg); box-shadow: var(--gs-current-shadow); }
.stage-idol-avatar { outline: 2px solid var(--stage-idol-ring); outline-offset: 2px; }
.stage-idol-avatar :deep(.idol-avatar-clip::after) { box-shadow: none; }
.stage-idol-empty { display: grid; flex: none; place-items: center; width: 28px; height: 28px; border: 1px dashed var(--gs-ink-3); border-radius: 50%; color: var(--gs-ink-3); }
.stage-idol-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.stage-idol-copy strong { overflow: hidden; color: var(--gs-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.stage-idol-copy small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.1; white-space: nowrap; }
.stage-idol-caret { flex: none; margin-left: auto; color: var(--gs-ink-3); }
.stage-idol-switch:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
@media (hover: hover) { .stage-idol-switch:not(.is-open):hover { background: var(--gs-hover); } }
.stage-idol-pop { position: fixed; z-index: 30; box-sizing: border-box; padding: var(--gs-space-2); border-radius: var(--gs-radius-panel); background: var(--gs-surface); box-shadow: var(--gs-shadow-console); }
.stage-idol-light { display: flex; align-items: center; justify-content: space-between; gap: var(--gs-space-3); min-height: var(--gs-row); padding: 0 var(--gs-space-3); color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.stage-idol-change { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: var(--gs-row); padding: 0 var(--gs-space-3); border: 0; border-top: 1px solid var(--gs-line); background: transparent; color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }
.stage-idol-change:hover { background: var(--gs-hover); }
.stage-idol-change:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
/* Short windows: one line, name only (the row's label keeps 我的担当). */
@media (max-height: 720px) { .stage-idol-copy small { display: none; } }
</style>
