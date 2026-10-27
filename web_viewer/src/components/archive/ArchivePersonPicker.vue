<template>
  <div class="person-picker">
    <button type="button" class="person-trigger" :aria-haspopup="'dialog'" :aria-label="`${label}：${currentName}，更换`" @click="open = true">
      <ArchiveIdolAvatar v-if="current" class="person-avatar" :idol-code="current.id" :accent-color="current.color" :size="28" :ring-width="0" :gap="0" decorative />
      <span v-else class="person-empty" aria-hidden="true"><Users :size="16" /></span>
      <span class="person-name">{{ currentName }}</span>
      <ChevronsUpDown class="person-caret" :size="14" aria-hidden="true" />
    </button>
    <ArchiveTerminalDialog :open="open" :title="`选择${label}`" :title-id="titleId" @close="open = false">
      <button v-if="allowAll" type="button" class="person-all" :aria-pressed="!modelValue" @click="choose('')">{{ allLabel }}</button>
      <ArchiveIdolPickerPanel :idols="idols" :idol-name="idolName" :idol-search="idolSearch" :model-value="modelValue" @update:model-value="choose" />
    </ArchiveTerminalDialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ChevronsUpDown, Users } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import ArchiveTerminalDialog from './terminal/ArchiveTerminalDialog.vue'
import ArchiveIdolPickerPanel from './terminal/ArchiveIdolPickerPanel.vue'

// The one person selector (偶像 / 组合成员): the same face as the sidebar's 担当 row, an avatar and a name with a
// vertical chevron, opening the shared picker panel (search, units, avatars). allowAll adds a 「全部」 choice
// that clears the selection. idols: [{ id, name, color?, unitCode?, unitName?, kana? }].
const props = defineProps({
  idols: { type: Array, default: () => [] }, modelValue: { type: String, default: '' },
  idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' },
  label: { type: String, default: '偶像' }, allowAll: Boolean, allLabel: { type: String, default: '全部偶像' },
})
const emit = defineEmits(['update:modelValue'])
const open = ref(false)
const titleId = `person-picker-${Math.random().toString(36).slice(2, 8)}`
const current = computed(() => props.idols.find(idol => idol.id === props.modelValue) || null)
const currentName = computed(() => current.value ? props.idolName(current.value.id) || current.value.name || '' : props.allowAll ? props.allLabel : `选择${props.label}`)
function choose(id) { open.value = false; emit('update:modelValue', id) }
</script>

<style scoped>
.person-picker { min-width: 0; }
.person-trigger { display: flex; align-items: center; gap: var(--gs-space-4); box-sizing: border-box; width: 100%; min-width: 0; height: var(--gs-control-normal); padding: 0 var(--gs-space-4) 0 var(--gs-space-3); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); text-align: left; cursor: pointer; }
.person-avatar { flex: none; }
.person-empty { display: grid; flex: none; place-items: center; width: 28px; height: 28px; border: 1px dashed var(--gs-ink-3); border-radius: 50%; color: var(--gs-ink-3); }
.person-name { flex: 1; min-width: 0; overflow: hidden; font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.person-caret { flex: none; color: var(--gs-ink-3); }
.person-trigger:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@media (hover: hover) { .person-trigger:hover { background: var(--gs-hover); } }
.person-all { display: flex; align-items: center; width: 100%; min-height: var(--gs-control-touch); margin-bottom: var(--gs-space-3); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }
.person-all[aria-pressed=true] { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); color: var(--gs-selected-ink); font-weight: var(--gs-weight-semibold); }
.person-all:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
</style>
