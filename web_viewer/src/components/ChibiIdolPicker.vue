<template>
  <ArchiveTerminalDialog
    class="chibi-idol-picker"
    :open="open"
    :title="title"
    :title-id="titleId"
    :data-position="position"
    @close="emit('close')"
  >
    <div class="chibi-picker-filters">
      <label class="chibi-picker-search">
        <span>查找偶像</span>
        <input v-model="query" type="search" placeholder="姓名、假名或拼写" autocomplete="off" />
      </label>
      <label class="chibi-picker-unit">
        <span>组合</span>
        <select v-model="unitCode" :title="selectedUnitName">
          <option value="">全部组合</option>
          <option v-for="unit in units" :key="unit.code" :value="unit.code">{{ unit.name }}</option>
        </select>
      </label>
    </div>
    <p class="chibi-picker-count" role="status">{{ matches.length }} 位可用偶像<span v-if="selectedName"> · 当前：{{ selectedName }}</span></p>
    <div class="chibi-picker-grid" role="group" aria-label="可用舞台偶像">
      <button
        v-for="idol in matches"
        :key="idol.id"
        class="chibi-picker-idol"
        type="button"
        :data-idol-code="idol.id"
        :aria-pressed="selectedIdolCode === idol.id"
        :aria-label="`选择 ${idol.displayName}`"
        @click="emit('select', idol.id)"
      >
        <ArchiveIdolAvatar
          :idol-code="idol.id"
          :accent-color="idol.color"
          :size="48"
          decorative
          :fallback-text="Array.from(idol.displayName)[0] || '?'"
        />
        <strong>{{ idol.displayName }}</strong>
        <small v-if="idol.unitName">{{ idol.unitName }}</small>
        <span v-if="selectedIdolCode === idol.id" class="chibi-picker-current">当前</span>
      </button>
    </div>
    <p v-if="!matches.length" class="chibi-picker-empty">没有找到符合条件的可用偶像。</p>
  </ArchiveTerminalDialog>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue'
import ArchiveTerminalDialog from './archive/terminal/ArchiveTerminalDialog.vue'
import ArchiveIdolAvatar from './archive/ArchiveIdolAvatar.vue'
import { chibiIdolSearchAliases } from '../presentation/ChibiIdolSearch.js'

const props = defineProps({
  open: Boolean,
  position: { type: Number, default: 0 },
  characters: { type: Array, default: () => [] },
  idolDirectory: { type: Array, default: () => [] },
  selectedIdolCode: { type: String, default: '' },
  idolName: { type: Function, default: (_id, fallback) => fallback || '' },
  idolSearch: { type: Function, default: (_id, fallback) => fallback || '' },
})
const emit = defineEmits(['close', 'select'])
const query = ref('')
const unitCode = ref('')
const titleId = `chibi-idol-picker-${useId()}`
const title = computed(() => props.position > 0 ? `替换 ${props.position} 号位偶像` : '选择舞台偶像')

watch(() => props.open, (open, previousOpen) => {
  if (open && !previousOpen) {
    query.value = ''
    unitCode.value = ''
  }
}, { immediate: true })

function searchText(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase()
}

const directory = computed(() => new Map(props.idolDirectory.map(idol => [idol.id, idol])))
const availableIdols = computed(() => {
  const seen = new Set()
  return props.characters.filter(character => {
    if (typeof character?.id !== 'string' || !character.id || seen.has(character.id)) return false
    seen.add(character.id)
    return true
  }).map(character => {
    const metadata = directory.value.get(character.id)
    const fallback = metadata?.name || character.name || character.id
    const displayName = props.idolName(character.id, fallback) || fallback
    return {
      id: character.id,
      displayName,
      unitCode: metadata?.unitCode || '',
      unitName: metadata?.unitName || '',
      color: metadata?.color || '',
      searchText: searchText([
        props.idolSearch(character.id, fallback), displayName, fallback, character.name,
        metadata?.kana, metadata?.unitName, character.id, character.id.replace(/^\d+/, ''), chibiIdolSearchAliases(character.id),
      ].filter(Boolean).join(' ')),
    }
  })
})
const units = computed(() => {
  const byCode = new Map()
  for (const idol of availableIdols.value) {
    if (idol.unitCode && !byCode.has(idol.unitCode)) byCode.set(idol.unitCode, { code: idol.unitCode, name: idol.unitName || idol.unitCode })
  }
  return [...byCode.values()]
})
const selectedUnitName = computed(() => units.value.find(unit => unit.code === unitCode.value)?.name || '全部组合')
const matches = computed(() => {
  const needle = searchText(query.value.trim())
  return availableIdols.value.filter(idol => (!unitCode.value || idol.unitCode === unitCode.value)
    && (!needle || idol.searchText.includes(needle)))
})
const selectedName = computed(() => availableIdols.value.find(idol => idol.id === props.selectedIdolCode)?.displayName || '')
</script>

<style scoped>
.chibi-idol-picker {
  --picker-safe-top: var(--gs-safe-top, env(safe-area-inset-top, 0px));
  --picker-safe-right: var(--gs-safe-right, env(safe-area-inset-right, 0px));
  --picker-safe-bottom: var(--gs-safe-bottom, env(safe-area-inset-bottom, 0px));
  --picker-safe-left: var(--gs-safe-left, env(safe-area-inset-left, 0px));
  --picker-mint: #33a8a5;
  box-sizing: border-box;
  width: min(720px, calc(100vw - max(16px, var(--picker-safe-left)) - max(16px, var(--picker-safe-right))));
  max-width: none;
  max-height: calc(100dvh - max(16px, var(--picker-safe-top)) - max(16px, var(--picker-safe-bottom)));
  margin: auto;
  padding: 0;
  border: 1px solid #cddfda;
  border-top: 3px solid var(--picker-mint);
  border-radius: 12px;
  background: #ffffff;
  color: #243c45;
  color-scheme: light;
  font-family: var(--gs-font-directory, Inter, 'Noto Sans JP', 'Noto Sans SC', system-ui, sans-serif);
  font-size: var(--gs-text-body, 14px);
  overflow: hidden;
}
.chibi-idol-picker[open] { display: flex; flex-direction: column; }
.chibi-idol-picker::backdrop { background: #03151cd9; }
.chibi-idol-picker :deep(.terminal-dialog-header) {
  gap: 12px;
  padding: 12px 16px;
  border-bottom-color: #cddfda;
  background: #f2faf7;
}
.chibi-idol-picker :deep(.terminal-dialog-header h2) { min-width: 0; font-size: 20px; line-height: 1.4; font-weight: 600; }
.chibi-idol-picker :deep(.terminal-icon-button) {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border: 1px solid #cddfda;
  color: #365860;
  background: #e7f3f0;
}
.chibi-idol-picker :deep(.terminal-dialog-body) { min-width: 0; min-height: 0; padding: 16px; overflow-x: hidden; overflow-y: auto; }
.chibi-idol-picker :deep(.terminal-icon-button:focus-visible),
.chibi-picker-filters input:focus-visible,
.chibi-picker-filters select:focus-visible,
.chibi-picker-idol:focus-visible { outline: 3px solid #168f87; outline-offset: 3px; }
.chibi-picker-filters { display: flex; flex-wrap: wrap; gap: 12px; min-width: 0; }
.chibi-picker-filters label { display: grid; gap: 8px; min-width: 0; max-width: 100%; color: #526e73; font-size: var(--gs-text-ui, 13px); }
.chibi-picker-search { flex: 1 1 240px; }
.chibi-picker-unit { flex: 0 1 auto; }
.chibi-picker-filters input,
.chibi-picker-filters select {
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #cddfda;
  border-radius: 6px;
  color: #243c45;
  background: #ffffff;
  font: inherit;
}
.chibi-picker-filters input { width: 100%; }
.chibi-picker-filters input::placeholder { color: #768d89; opacity: 1; }
.chibi-picker-filters select { width: auto; }
.chibi-picker-count { margin: 12px 0; color: #607e79; font-size: var(--gs-text-meta, 12px); line-height: 1.6; overflow-wrap: anywhere; }
.chibi-picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(136px, 1fr)); gap: 8px; min-width: 0; }
.chibi-picker-idol {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  min-width: 0;
  min-height: 116px;
  padding: 12px 8px;
  border: 1px solid #cddfda;
  border-radius: 8px;
  color: inherit;
  background: #f8fbfa;
  font: inherit;
  text-align: center;
  cursor: pointer;
  touch-action: manipulation;
}
.chibi-picker-idol strong { width: 100%; font-size: var(--gs-text-body, 14px); font-weight: 600; line-height: 1.5; white-space: normal; word-break: normal; overflow-wrap: anywhere; }
.chibi-picker-idol small { width: 100%; color: #607e79; font-size: var(--gs-text-meta, 12px); line-height: 1.5; white-space: normal; overflow-wrap: anywhere; }
.chibi-picker-idol[aria-pressed=true] { border-color: var(--picker-mint); background: #e8f7f0; box-shadow: inset 0 0 0 1px var(--picker-mint); }
.chibi-picker-idol:active, .chibi-idol-picker :deep(.terminal-icon-button:active) { background: #d9efe8; }
.chibi-picker-current { padding: 2px 8px; border-radius: 12px; color: #197264; background: #d5eee4; font-size: var(--gs-text-meta, 12px); line-height: 1.5; }
.chibi-picker-empty { margin: 16px 0 0; color: #526e73; font-size: var(--gs-text-body, 14px); line-height: 1.6; }
@media (hover: hover) and (pointer: fine) {
  .chibi-picker-idol:hover, .chibi-idol-picker :deep(.terminal-icon-button:hover) { border-color: #63c4bf; background: #e9f5ee; }
}
@media (max-width: 600px), (pointer: coarse) {
  .chibi-picker-filters input, .chibi-picker-filters select { font-size: 16px; }
}
@media (max-width: 600px) {
  .chibi-picker-search, .chibi-picker-unit { flex: 1 1 100%; }
  .chibi-picker-filters select { width: 100%; }
}
@media (max-width: 420px) {
  .chibi-picker-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
