<template>
  <div class="chibi-song-picker">
    <section class="song-current" aria-label="当前歌曲与编排">
      <template v-if="selectedGroup">
        <div class="selected-song" aria-label="当前歌曲">
          <img v-if="selectedGroup.jacketUrl && !failedJackets.has(selectedGroup.jacketUrl)" :src="selectedGroup.jacketUrl" alt="" width="40" height="40" @error="failedJackets.add(selectedGroup.jacketUrl)" />
          <Music2 v-else class="selected-song-icon" :size="24" aria-hidden="true" />
          <div class="selected-song-copy"><strong>{{ selectedGroup.title }}</strong><small>{{ songSummary(selectedGroup) }}</small></div>
          <div v-if="$slots['current-actions']" class="current-song-actions"><slot name="current-actions" /></div>
        </div>
        <div class="stage-arrangement">
          <!-- Phones: one row names the current arrangement and opens the same picker as a bottom sheet. -->
          <button v-if="compact && selectedGroup.versions.length > 1" class="arrangement-summary" type="button" aria-haspopup="dialog" :aria-expanded="drawerOpen" :disabled="disabled" @click="drawerOpen = true"><span>编排</span><strong>{{ [kindLabels[selectedKind], selectedScript?.label].filter(Boolean).join(' · ') }}</strong><ChevronRight :size="17" aria-hidden="true" /></button>
          <component :is="compact ? ArchiveTerminalDialog : 'div'" v-if="selectedGroup.versions.length > 1" v-bind="compact ? { class: 'filter-sheet arrangement-sheet', open: drawerOpen, title: '编排', titleId: 'stage-arrangement-sheet-title' } : { class: 'arrangement-inline' }" @close="drawerOpen = false">
          <div class="arrangement-picker">
            <span v-if="!compact" class="arrangement-title">编排</span>
            <!-- Kinds are sections of one list, not filters: only the kinds this song really has. -->
            <div v-if="versionSections.length > 1" class="stage-segment" role="radiogroup" aria-label="编排种类">
              <button v-for="section in versionSections" :key="section.kind" type="button" role="radio" :aria-checked="section.kind === selectedKind" :disabled="disabled" @click="chooseKind(section)">{{ section.label }}<span v-if="section.versions.length > 1"> {{ section.versions.length }}</span></button>
            </div>
            <div v-if="visibleVersions.length > 1" class="arrangement-options" :class="`is-${selectedKind}`" role="radiogroup" aria-label="演出编排版本">
              <button v-for="version in visibleVersions" :key="version.id" type="button" role="radio" :data-version-id="version.id" :aria-checked="version.id === selectedScript?.id" :disabled="disabled" :aria-label="unitLogo(version) ? `${version.label}${version.participantCount ? ` ${version.participantCount}人` : ''}` : undefined" @click="chooseVersion(version.id); drawerOpen = false"><img v-if="unitLogo(version)" :src="unitLogo(version)" alt="" loading="lazy" decoding="async" @error="failedLogos = new Set(failedLogos).add(version.unitCode)" /><template v-else>{{ version.label }}<small v-if="version.participantCount"> {{ version.participantCount }}人</small></template></button>
            </div>
            <small v-if="compact && selectedKind === 'unit'" class="arrangement-sheet-note">点一个组合即切换并收起</small>
          </div>
          </component>
          <p v-if="selectedGroup.versions.length <= 1" class="single-arrangement"><span>编排</span><strong>{{ selectedScript?.label || selectedGroup.versions[0]?.label }}</strong></p>
          <p v-if="selectedScript" class="arrangement-description"><span>{{ selectedScript.positionLabel || '出场站位待确认' }}</span></p>
        </div>
      </template>
      <p v-else class="song-empty" role="status">{{ library.length ? '选择一首歌曲开始' : '正在读取可演出曲目…' }}</p>
      <slot />
    </section>

    <section class="song-library" aria-label="舞台歌曲库">
      <h3 class="song-library-title">切换曲目</h3>
      <div class="song-library-toolbar">
        <label class="song-search">
          <Search :size="17" aria-hidden="true" />
          <input v-model="query" type="search" aria-label="搜索舞台歌曲" placeholder="搜索歌名或组合" autocomplete="off" enterkeyhint="search" :disabled="disabled" />
        </label>
      </div>
      <div class="song-category-filters stage-segment" role="group" aria-label="舞台歌曲分类">
        <button v-for="filter in categoryOptions" :key="filter.id" type="button" :aria-pressed="category === filter.id" :disabled="disabled" @click="category = filter.id">
          {{ compactCategoryLabels[filter.id] || filter.label }} <span>{{ filter.count }}</span>
        </button>
      </div>
      <p class="song-match-count" role="status">{{ matches.length }} 首匹配歌曲</p>
      <div class="song-list" role="group" aria-label="可演出歌曲">
        <button v-for="group in matches" :key="group.songCode" class="song-row" type="button" :data-song-code="group.songCode" :aria-pressed="selectedGroup?.songCode === group.songCode" :aria-label="`选择歌曲 ${group.title}`" :disabled="disabled" @click="chooseGroup(group)">
          <img v-if="group.jacketUrl && !failedJackets.has(group.jacketUrl)" :src="group.jacketUrl" alt="" width="36" height="36" loading="lazy" @error="failedJackets.add(group.jacketUrl)" />
          <Music2 v-else class="song-row-icon" :size="18" aria-hidden="true" />
          <span class="song-row-copy">
            <span class="song-row-title"><strong>{{ group.title }}</strong><span v-if="selectedGroup?.songCode === group.songCode" class="song-current-badge"><i aria-hidden="true"></i><i aria-hidden="true"></i><i aria-hidden="true"></i><span class="song-current-text">当前曲目</span></span></span>
            <small>{{ songSummary(group) }}</small>
          </span>
        </button>
        <p v-if="!matches.length" class="song-empty">没有找到符合条件的曲目。</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronRight, Music2, Search } from '@lucide/vue'
import ArchiveTerminalDialog from './archive/terminal/ArchiveTerminalDialog.vue'
import { buildStageSongLibrary, filterStageSongLibrary, findStageSongGroup, stageSongCategoryOptions } from '../presentation/ChibiSongLibrary.js'
import { getUnitLogoUrl } from '../utils/AssetResolver.js'

const props = defineProps({
  songs: { type: Array, default: () => [] },
  songDirectory: { type: [Array, Object], default: () => [] },
  selectedSongId: { type: String, default: '' },
  disabled: Boolean,
})
const emit = defineEmits(['select-song'])
// Same split as ArchiveFilterSheet: inline on wide panels, a bottom sheet behind one row on phones.
const compactQuery = typeof window === 'undefined' ? null : window.matchMedia?.('(max-width: 620px)')
const compact = ref(Boolean(compactQuery?.matches))
const drawerOpen = ref(false)
const syncCompact = event => { compact.value = event.matches; if (!event.matches) drawerOpen.value = false }
compactQuery?.addEventListener?.('change', syncCompact)
onBeforeUnmount(() => compactQuery?.removeEventListener?.('change', syncCompact))
const compactCategoryLabels = { all: '全部', collective: '代表曲', unit: '组合曲', special: '特别' }
const query = ref('')
const category = ref('all')
const failedJackets = ref(new Set())
// 组合版 is chosen by the unit's logo, as on the song catalogue; the name stays as the label and returns if the logo fails.
const failedLogos = ref(new Set())
const unitLogo = version => version.kind === 'unit' && version.unitCode && !failedLogos.value.has(version.unitCode) ? getUnitLogoUrl(version.unitCode) : ''
const library = computed(() => buildStageSongLibrary(props.songs, props.songDirectory))
const categoryOptions = computed(() => stageSongCategoryOptions(library.value))
const matches = computed(() => filterStageSongLibrary(library.value, { query: query.value, category: category.value }))
const selectedGroup = computed(() => findStageSongGroup(library.value, props.selectedSongId))
const selectedScript = computed(() => selectedGroup.value?.versions.find(version => version.id === props.selectedSongId) || null)
// Ensemble songs carry one script per way of singing them: the free formation, each unit's own
// version, and the centre solo. Grouping them keeps 按组合演唱 findable in a 20-entry list.
const versionKindSections = [['collective', '全员 / 自由编成'], ['unit', '按组合演唱'], ['center', '单人中心'], ['standard', '标准'], ['special', '特别演出'], ['variant', '其他编排']]
const versionSections = computed(() => {
  const versions = selectedGroup.value?.versions || []
  return versionKindSections.map(([kind, label]) => ({ kind, label: kindLabels[kind] || label, versions: versions.filter(version => version.kind === kind) }))
    .filter(section => section.versions.length)
})
const kindLabels = { collective: '自由编成', unit: '组合版', center: '单人中心', variant: '教学' }
const selectedKind = computed(() => selectedScript.value?.kind || versionSections.value[0]?.kind || '')
const visibleVersions = computed(() => versionSections.value.find(section => section.kind === selectedKind.value)?.versions || [])
// Picking a kind keeps the current script when it already belongs to it; otherwise the kind's first script.
function chooseKind(section) {
  if (props.disabled || section.kind === selectedKind.value) return
  const next = section.versions[0]
  if (next) chooseVersion(next.id)
}

watch(categoryOptions, options => {
  if (!options.some(option => option.id === category.value)) category.value = 'all'
})

function songSummary(group) {
  const label = group.category === 'unit' && group.unitName ? group.unitName : group.category === 'collective' ? '代表曲' : group.categoryLabel
  return [label, String(group.versions.length) + ' 种编排'].filter(Boolean).join(' · ')
}

function chooseGroup(group) {
  if (props.disabled) return
  const current = group.versions.find(version => version.id === props.selectedSongId)
  const next = current || group.versions.find(version => version.id === group.defaultScriptId) || group.versions[0]
  if (!next) return
  if (next.id !== props.selectedSongId) emit('select-song', next.id)
}

function chooseVersion(id) {
  if (props.disabled || id === props.selectedSongId || !selectedGroup.value?.versions.some(version => version.id === id)) return
  emit('select-song', id)
}
</script>

<style scoped>
.chibi-song-picker { display: flex; flex-direction: column; flex: 1 1 auto; width: 100%; height: 100%; min-width: 0; min-height: 0; color: var(--gs-ink); font-size: var(--gs-text-ui); }
.song-current { box-sizing: border-box; flex: 0 0 auto; min-width: 0; padding: 0 0 12px; border: 0; border-bottom: 1px solid var(--gs-line); border-radius: 0; background: transparent; }
.selected-song { display: flex; align-items: center; gap: 10px; min-width: 0; margin-bottom: 10px; }
.selected-song img { flex: none; border-radius: var(--gs-radius-media); object-fit: cover; }
.selected-song-icon { box-sizing: content-box; flex: none; padding: 8px; border-radius: var(--gs-radius-media); color: var(--gs-ink-3); background: var(--gs-line); }
.selected-song-copy { display: grid; flex: 1; gap: 3px; min-width: 0; }
.current-song-actions { display: flex; flex: none; align-items: center; }
.selected-song strong { font-size: var(--gs-text-subtitle); font-weight: var(--gs-weight-semibold); line-height: 1.4; overflow-wrap: anywhere; }
.selected-song small { color: var(--gs-ink-3); line-height: 1.5; }
.song-search { display: flex; flex: 0 0 auto; align-items: center; gap: 8px; min-width: 0; padding: 0 11px; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink-3); }
.song-search svg { flex: none; }
.song-search input { width: 100%; min-width: 0; min-height: 44px; margin: 0; padding: 8px 0; border: 0; color: var(--gs-ink); background: transparent; font: inherit; font-size: 16px; }
.song-search input:focus { outline: none; }
.song-search:focus-within { outline: 2px solid var(--gs-mint); outline-offset: 2px; }
.song-search input::placeholder { color: var(--gs-ink-3); opacity: 1; }
.song-library-toolbar { flex: 0 0 auto; min-width: 0; }
.song-library { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; min-height: 0; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--gs-line); background: var(--gs-surface); }
.song-library-title { flex: none; margin: 0 0 8px; color: var(--gs-ink); font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.4; }
/* Segmented switch: a recessed track, one white thumb on the chosen segment; counts sit inside. */
.stage-segment { display: flex; gap: var(--gs-space-1); box-sizing: border-box; min-width: 0; padding: var(--gs-space-2); border-radius: var(--gs-radius-control); background: var(--gs-mode-track); }
.stage-segment > button { flex: 1 1 0; min-width: 0; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-3); border: 0; border-radius: var(--gs-radius-segment); background: transparent; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); white-space: nowrap; cursor: pointer; }
.stage-segment > button span { margin-left: var(--gs-space-1); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-regular); }
.stage-segment > button[aria-checked="true"], .stage-segment > button[aria-pressed="true"] { background: var(--gs-mode-thumb); box-shadow: var(--gs-shadow-1); color: var(--gs-mode-ink); }
.stage-segment > button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.stage-segment > button:disabled { opacity: .6; cursor: default; }
.song-category-filters { flex: 0 0 auto; margin-top: var(--gs-space-3); }
/* Arrangement: kind switch, then the kind's own options (a unit grid, the solo rows). */
.arrangement-inline { display: contents; }
.arrangement-summary { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--gs-space-4); width: 100%; min-height: var(--gs-control-touch); padding: 0; border: 0; background: none; color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); text-align: left; cursor: pointer; }
.arrangement-summary > span { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); }
.arrangement-summary > strong { overflow: hidden; font-weight: var(--gs-weight-medium); text-overflow: ellipsis; white-space: nowrap; }
.arrangement-summary > svg { color: var(--gs-ink-3); }
.arrangement-summary:disabled { opacity: .6; cursor: default; }
.arrangement-sheet-note { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.arrangement-picker { display: flex; flex-direction: column; gap: var(--gs-space-3); }
.arrangement-title { color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); letter-spacing: var(--gs-track-label); }
.arrangement-options { display: grid; gap: var(--gs-space-1); }
.arrangement-options.is-unit { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.arrangement-options > button { display: flex; align-items: center; justify-content: center; gap: var(--gs-space-1); min-width: 0; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-2); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-meta); text-align: center; cursor: pointer; }
.arrangement-options.is-center > button { justify-content: flex-start; padding: 0 var(--gs-space-4); font-size: var(--gs-text-ui); text-align: left; }
.arrangement-options > button small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.arrangement-options > button img { display: block; width: 100%; max-width: 76px; height: 28px; object-fit: contain; }
.arrangement-options > button:hover { background: var(--gs-hover); }
.arrangement-options > button[aria-checked="true"] { background: var(--gs-current-bg-inset); color: var(--gs-ink); }
.arrangement-options > button:disabled { opacity: .6; cursor: default; }
.arrangement-options > button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
.song-match-count { flex: 0 0 auto; margin: 8px 0 4px; color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.4; }
.song-list { flex: 1 1 auto; min-width: 0; min-height: 44px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--gs-line) transparent; }
.song-row { box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; min-height: 56px; padding: 8px 5px; border: 0; border-bottom: 1px solid var(--gs-line); color: var(--gs-ink); background: transparent; font: inherit; text-align: left; cursor: pointer; }
.song-row > img { flex: none; border-radius: var(--gs-radius-media); object-fit: cover; }
.song-row > svg { flex: none; color: var(--gs-ink-3); }
.song-row-icon { box-sizing: content-box; width: 20px; padding: 8px; }
.song-row-copy { display: grid; gap: 3px; flex: 1; min-width: 0; }
.song-row-title { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.song-row-title > strong { flex: 1; min-width: 0; }
.song-current-badge { position: relative; display: inline-flex; flex: none; align-items: flex-end; gap: 2px; height: 14px; }
.song-current-badge i { width: 3px; border-radius: var(--gs-radius-media); background: var(--gs-mint); }
.song-current-badge i:nth-child(1) { height: 6px; }
.song-current-badge i:nth-child(2) { height: 12px; }
.song-current-badge i:nth-child(3) { height: 9px; }
.song-current-text { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.song-row strong { font-size: 13px; font-weight: 600; line-height: 1.5; overflow-wrap: anywhere; }
.song-row small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.45; overflow-wrap: anywhere; }
.song-row[aria-pressed="true"] { color: var(--gs-ink); background: var(--gs-current-bg-inset); }
.song-row:active { background: var(--gs-hover); }
.song-row:disabled { opacity: 0.6; cursor: default; }
.song-row:focus-visible { outline: 2px solid var(--gs-mint); outline-offset: -2px; }
.stage-arrangement { margin-top: 8px; padding-top: 10px; border-top: 1px solid var(--gs-line); }
.single-arrangement { display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 0; font-size: 12px; line-height: 1.5; }
.single-arrangement > span { color: var(--gs-ink-3); }
.single-arrangement > strong { font-weight: 600; }
.arrangement-description { display: grid; gap: 3px; margin: 7px 0 0; color: var(--gs-ink-3); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.arrangement-description strong { color: var(--gs-ink); font-weight: 600; }
.song-empty { margin: 12px 0; color: var(--gs-ink-3); font-size: 13px; line-height: 1.6; }
@media (max-width: 900px) {
  .song-current { padding: 0 0 8px; }
  .selected-song { gap: 8px; margin-bottom: 0; }
  .selected-song small { font-size: var(--gs-text-meta); line-height: 1.4; }
  .stage-arrangement { margin-top: 4px; padding-top: 0; border-top: 0; }
  .arrangement-description { display: none; }
  .song-library { margin-top: 4px; padding-top: 4px; }
  .song-library-title { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .song-library-toolbar { display: flex; align-items: center; gap: 6px; }
  .song-search { flex: 1; }
  .song-match-count { margin: 4px 0 2px; }
  .song-row { min-height: 44px; padding: 4px 5px; }
  .song-row-copy { gap: 2px; }
  .song-row strong, .song-row small { line-height: 1.4; }
}
@media (hover: hover) and (pointer: fine) {
  .song-row:hover { background: var(--gs-paper); }
}
</style>
