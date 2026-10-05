<template>
  <ArchiveTerminalDialog class="wallpaper-picker" :open="open" title="SSR 卡面壁纸" title-id="wallpaper-title" @close="emit('close')">
    <div class="wallpaper-picker-content">
    <div class="wallpaper-picker-tools"><p class="wallpaper-help">选一张喜欢的卡面作为背景。</p><button type="button" class="wallpaper-text-button" :aria-pressed="!preferences.wallpaperKey" @click="choose('')">使用默认背景</button></div>
    <p v-if="loading" role="status">正在读取壁纸目录…</p>
    <div v-else-if="error" role="status">{{ error }} <button type="button" class="wallpaper-text-button" @click="load(true)">重试</button></div>
    <template v-else>
      <label class="wallpaper-search"><span>查找卡名或偶像</span><input v-model="query" type="search" placeholder="卡名 / 偶像姓名" enterkeyhint="search" /></label>
      <div class="wallpaper-picker-filters">
        <label><span>卡面</span><select v-model="variantFilter"><option value="">全部卡面</option><option value="base">卡面 A</option><option value="p">卡面 B</option></select></label>
        <label><span>组合</span><select v-model="unitFilter" :disabled="!units.length"><option value="">全部组合</option><option v-for="unit in units" :key="unit.code" :value="unit.code">{{ unit.name }}</option></select></label>
      </div>
      <p v-if="matches.length" class="wallpaper-picker-count">已显示 {{ visible.length }} / {{ matches.length }} 张卡面</p>
      <div class="wallpaper-grid">
        <button v-for="entry in visible" :key="entry.id" type="button" :aria-pressed="preferences.wallpaperKey === entry.id" :aria-label="`${cardLabel(entry.label)}，${idolLabel(entry)}，${entry.variantLabel}`" :title="`${cardLabel(entry.label)} · ${idolLabel(entry)} · ${entry.variantLabel}`" @click="choose(entry.id)">
          <span class="wallpaper-thumbnail"><img :src="entry.landscape?.url || entry.portrait.url" alt="" loading="lazy" decoding="async" /><span class="wallpaper-variant">SSR</span><span v-if="preferences.wallpaperKey === entry.id" class="wallpaper-selected">已选</span></span>
          <strong>{{ cardLabel(entry.label) }}</strong><small class="wallpaper-details">{{ idolLabel(entry) }} · {{ idolMetadata.get(entry.idolCode)?.unitName }} · {{ entry.variantLabel }}</small>
        </button>
      </div>
      <p v-if="!matches.length" class="wallpaper-help">{{ catalogue?.entries?.length ? '没有找到匹配的卡面，试试其他名称或筛选条件。' : '壁纸目录暂时为空。' }}</p>
      <button v-if="matches.length > limit" type="button" class="wallpaper-more" @click="limit += PAGE_SIZE">继续浏览 · 还有 {{ matches.length - visible.length }} 张</button>
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
.wallpaper-picker-content { container: wallpaper-picker / inline-size; min-width: 0; color: var(--gs-ink); font-size: var(--gs-text-ui); }
.wallpaper-picker-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--gs-space-2) var(--gs-space-4); margin-bottom: var(--gs-space-3); }
.wallpaper-help { margin: 0; color: var(--gs-ink-3); }
.wallpaper-text-button { min-height: var(--gs-control-touch); padding: 0; border: 0; background: none; color: var(--gs-mint-ink); font: inherit; cursor: pointer; }
.wallpaper-text-button[aria-pressed=true] { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
.wallpaper-search, .wallpaper-picker-filters label { display: grid; gap: var(--gs-space-2); min-width: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.wallpaper-search input, .wallpaper-picker-filters select { width: 100%; min-width: 0; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-subtitle); }
.wallpaper-picker-filters { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: var(--gs-space-4); margin-top: var(--gs-space-3); }
.wallpaper-picker-count { margin: var(--gs-space-3) 0 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.wallpaper-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--gs-space-5) var(--gs-space-4); padding-block: var(--gs-space-4); }
.wallpaper-grid > button { display: grid; align-content: start; gap: var(--gs-space-2); min-width: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; touch-action: manipulation; }
.wallpaper-thumbnail { position: relative; display: block; overflow: hidden; aspect-ratio: 1600 / 853; border-radius: var(--gs-radius-media); background: var(--gs-line); }
.wallpaper-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
.wallpaper-grid > button[aria-pressed=true] .wallpaper-thumbnail { box-shadow: 0 0 0 2px var(--gs-mint); }
.wallpaper-variant, .wallpaper-selected { position: absolute; top: var(--gs-space-3); padding: 0 6px; border-radius: var(--gs-radius-control); font-family: var(--gs-font-stage); font-size: var(--gs-text-caption); line-height: 1.6; }
.wallpaper-variant { left: var(--gs-space-3); background: rgb(19 33 58 / 72%); color: var(--gs-surface); }
.wallpaper-selected { right: var(--gs-space-3); background: var(--gs-mint); color: var(--gs-ink); font-family: var(--gs-font-body); }
.wallpaper-grid strong { font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); overflow-wrap: anywhere; }
.wallpaper-details { color: var(--gs-ink-3); font-size: var(--gs-text-caption); line-height: 1.5; }
.wallpaper-grid > button:hover strong { color: var(--gs-mint-ink); }
.wallpaper-more { width: 100%; min-height: var(--gs-control-touch); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink); font: inherit; cursor: pointer; }
.wallpaper-picker-content :is(button, input, select):focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@container wallpaper-picker (max-width: 550px) { .wallpaper-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
