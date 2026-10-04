<template>
  <ArchiveTerminalDialog class="wallpaper-picker" :open="open" title="SSR 卡面壁纸" title-id="wallpaper-title" @close="emit('close')">
    <div class="wallpaper-picker-content">
    <div class="wallpaper-picker-tools"><p class="terminal-help">选一张喜欢的卡面作为背景。</p><button type="button" class="terminal-text-button" :aria-pressed="!preferences.wallpaperKey" @click="choose('')">使用默认背景</button></div>
    <p v-if="loading" role="status">正在读取壁纸目录…</p>
    <div v-else-if="error" role="status">{{ error }} <button type="button" class="terminal-text-button" @click="load(true)">重试</button></div>
    <template v-else>
      <label class="terminal-search"><span>查找卡名或偶像</span><input v-model="query" type="search" placeholder="卡名 / 偶像姓名" enterkeyhint="search" /></label>
      <div class="wallpaper-picker-filters">
        <label><span>卡面</span><select v-model="variantFilter"><option value="">全部卡面</option><option value="base">卡面 A</option><option value="p">卡面 B</option></select></label>
        <label><span>组合</span><select v-model="unitFilter" :disabled="!units.length"><option value="">全部组合</option><option v-for="unit in units" :key="unit.code" :value="unit.code">{{ unit.name }}</option></select></label>
      </div>
      <p v-if="matches.length" class="wallpaper-picker-count">已显示 {{ visible.length }} / {{ matches.length }} 张卡面</p>
      <div class="terminal-wallpaper-grid">
        <button v-for="entry in visible" :key="entry.id" type="button" :aria-pressed="preferences.wallpaperKey === entry.id" :aria-label="`${cardLabel(entry.label)}，${idolLabel(entry)}，${entry.variantLabel}`" :title="`${cardLabel(entry.label)} · ${idolLabel(entry)} · ${entry.variantLabel}`" @click="choose(entry.id)">
          <span class="wallpaper-thumbnail"><img :src="entry.landscape?.url || entry.portrait.url" alt="" loading="lazy" decoding="async" /><span class="wallpaper-variant">SSR</span><span v-if="preferences.wallpaperKey === entry.id" class="wallpaper-selected">✓ 已选</span></span>
          <strong>{{ cardLabel(entry.label) }}</strong><small class="wallpaper-details">{{ idolLabel(entry) }} · {{ idolMetadata.get(entry.idolCode)?.unitName }} · {{ entry.variantLabel }}</small>
        </button>
      </div>
      <p v-if="!matches.length" class="terminal-help">{{ catalogue?.entries?.length ? '没有找到匹配的卡面，试试其他名称或筛选条件。' : '壁纸目录暂时为空。' }}</p>
      <button v-if="matches.length > limit" type="button" class="terminal-secondary wallpaper-more" @click="limit += PAGE_SIZE">继续浏览 · 还有 {{ matches.length - visible.length }} 张</button>
    </template>
    <p v-if="notice" role="status">{{ notice }}</p>
    </div>
  </ArchiveTerminalDialog>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import ArchiveTerminalDialog from './ArchiveTerminalDialog.vue'
import { useTerminalWallpaper } from '../../../data/terminal/useTerminalWallpaper.js'
import { archiveNamedText, archiveNamedSearchText, loadArchiveNames } from '../useArchiveNamedText.js'
const props = defineProps({ open: Boolean, idols: { type: Array, default: () => [] }, idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' } })
const emit = defineEmits(['close'])
const { catalogue, preferences, error, notice, loading, load, choose: select } = useTerminalWallpaper()
const PAGE_SIZE = 12
const query = ref(''), limit = ref(PAGE_SIZE), variantFilter = ref('p'), unitFilter = ref('')
watch([query, variantFilter, unitFilter], () => { limit.value = PAGE_SIZE })
watch(() => props.open, open => { if (open) {
  prepareOpeningFilters()
  load()
  void loadArchiveNames('cards').catch(error => console.warn('Wallpaper card names unavailable', error))
} }, { immediate: true })
watch(catalogue, () => { if (props.open) prepareOpeningFilters() })
const cardLabel = source => archiveNamedText('card', source, 'title')
const idolLabel = entry => props.idolName(entry.idolCode, entry.idolName) || entry.idolName
const normalizeQuery = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, '')
const idolMetadata = computed(() => new Map(props.idols.filter(idol => idol?.id).map(idol => [idol.id, idol])))
const units = computed(() => {
  const available = new Set((catalogue.value?.entries || []).map(entry => entry.idolCode))
  const found = new Map()
  for (const idol of idolMetadata.value.values()) {
    if (available.has(idol.id) && typeof idol.unitCode === 'string' && idol.unitCode && typeof idol.unitName === 'string' && idol.unitName) found.set(idol.unitCode, { code: idol.unitCode, name: idol.unitName })
  }
  return [...found.values()]
})
const matches = computed(() => (catalogue.value?.entries || []).filter(entry => {
  const idol = idolMetadata.value.get(entry.idolCode)
  if (variantFilter.value && entry.variant !== variantFilter.value) return false
  if (unitFilter.value && idol?.unitCode !== unitFilter.value) return false
  return normalizeQuery(`${archiveNamedSearchText('card', entry.label, 'title')} ${entry.idolName} ${idolLabel(entry)} ${props.idolSearch(entry.idolCode, entry.idolName)} ${idol?.name || ''} ${idol?.kana || ''} ${idol?.unitName || ''}`).includes(normalizeQuery(query.value))
}))
const visible = computed(() => {
  const selected = matches.value.find(entry => entry.id === preferences.value.wallpaperKey)
  return (selected ? [selected, ...matches.value.filter(entry => entry !== selected)] : matches.value).slice(0, limit.value)
})
function prepareOpeningFilters() {
  const selected = catalogue.value?.entries.find(entry => entry.id === preferences.value.wallpaperKey)
  query.value = ''; unitFilter.value = ''; variantFilter.value = selected?.variant || 'p'; limit.value = PAGE_SIZE
}
function choose(id) { if (select(id)) emit('close') }
</script>
<style scoped>
.wallpaper-picker { color:var(--terminal-ink);font-family:var(--gs-font-directory);font-size:var(--gs-text-ui); }
.wallpaper-picker :deep(.terminal-dialog-body) { padding:16px;scrollbar-width:thin; }
.wallpaper-picker-content { container-type:inline-size;min-width:0; }
.wallpaper-picker-tools { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px 12px;margin-bottom:8px; }
.wallpaper-picker-tools .terminal-help { margin:0;font-size:var(--gs-text-ui); }
.wallpaper-picker-tools .terminal-text-button { min-height:44px;font-size:var(--gs-text-ui); }
.wallpaper-picker-tools .terminal-text-button[aria-pressed=true] { color:var(--portal-accent,#177f78);font-weight:600; }
.terminal-search { display:grid;gap:4px;font-size:var(--gs-text-ui); }
.terminal-search input { min-width:0;min-height:44px;font-size:16px; }
.wallpaper-picker-filters { display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:12px;margin-top:8px; }
.wallpaper-picker-filters label { display:grid;gap:4px;min-width:0;font-size:var(--gs-text-ui); }
.wallpaper-picker-filters select { width:100%;min-width:0;min-height:44px;padding:8px;border:1px solid #c7dcdd;border-radius:6px;background:#fff;color:var(--terminal-ink);font:inherit;font-size:16px; }
.wallpaper-picker-count { margin:8px 0 0;color:var(--terminal-muted);font-size:var(--gs-text-meta); }
.terminal-wallpaper-grid { grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:1fr;gap:8px;padding-block:12px; }
.terminal-wallpaper-grid > button { min-width:0;min-height:44px;gap:4px;padding:4px;border:0;border-radius:4px;background:transparent;touch-action:manipulation; }
.terminal-wallpaper-grid > button[aria-pressed=true] { border:0;background:transparent; }
.terminal-wallpaper-grid > button[aria-pressed=true] .wallpaper-thumbnail { box-shadow:0 0 0 2px var(--portal-accent,#177f78); }
.wallpaper-thumbnail { position:relative;display:block;width:min(100%,64px);aspect-ratio:4 / 5;justify-self:center;overflow:hidden;border-radius:4px;background:#e8eff1; }
.terminal-wallpaper-grid .wallpaper-thumbnail img { width:100%;height:100%;aspect-ratio:auto;object-fit:contain; }
.wallpaper-variant { position:absolute;right:2px;top:2px;padding:1px 4px;border:1px solid #ffffffa6;border-radius:3px;background:#fffffff0;color:#314c55;font-size:11px;font-weight:600;line-height:1.4; }
.wallpaper-idol { position:absolute;inset:auto 0 0;padding:2px 3px;background:#102c37bf;color:#fff;font-size:12px;line-height:1.4;font-weight:500;text-align:center;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere; }
.terminal-wallpaper-grid strong { display:block;min-width:0;min-height:1.4em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--gs-text-meta);line-height:1.4;font-weight:400;color:var(--terminal-muted); }
.terminal-wallpaper-grid > button:focus-visible, .wallpaper-more:focus-visible, .wallpaper-picker-filters select:focus-visible { outline:var(--gs-focus-ring) solid var(--portal-accent,#177f78);outline-offset:var(--gs-focus-offset); }
.terminal-wallpaper-grid > button:active { background:var(--portal-tint,#edf8f5);transform:scale(.98); }
.wallpaper-more { width:100%;min-height:44px;font-size:var(--gs-text-ui); }
@container (max-width:440px) { .terminal-wallpaper-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
@media (hover:hover) and (pointer:fine) { .terminal-wallpaper-grid > button:hover { background:var(--portal-tint,#edf8f5); } }

.terminal-wallpaper-grid {grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;grid-auto-rows:auto;}
.terminal-wallpaper-grid > button {display:grid;align-content:start;gap:7px;padding:0 0 10px;background:#ffffff80;border-radius:10px;text-align:left;overflow:hidden;}
.wallpaper-thumbnail {width:100%;aspect-ratio:1600/853;border-radius:10px 10px 0 0;}
.wallpaper-variant {left:8px;right:auto;top:8px;background:#fff5d9c9;color:#876622;}
.wallpaper-selected {position:absolute;top:8px;right:8px;background:#177f78;color:#fff;border-radius:5px;padding:2px 6px;font-size:11px;}
.terminal-wallpaper-grid strong {padding:0 10px;white-space:normal;font-size:13px;color:var(--terminal-ink);font-weight:600;}
.wallpaper-details {padding:0 10px;font-size:11px;color:var(--terminal-muted);line-height:1.5;}
.terminal-wallpaper-grid > button[aria-pressed=true] {box-shadow:inset 0 0 0 2px var(--portal-accent,#177f78);background:#edf8f5;}
@container(max-width:550px){.terminal-wallpaper-grid {grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}}
</style>
