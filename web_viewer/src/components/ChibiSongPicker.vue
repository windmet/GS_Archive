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
          <label v-if="selectedGroup.versions.length > 1" class="arrangement-selector">
            <span>演出编排</span>
            <select :value="selectedScript?.id || ''" aria-label="演出编排版本" :disabled="disabled" @change="chooseVersion($event.target.value)">
              <option v-if="!selectedScript" value="" disabled>选择编排版本</option>
              <option v-for="version in selectedGroup.versions" :key="version.id" :value="version.id">{{ version.label }}{{ version.participantCount ? ` · ${version.participantCount}人` : '' }}</option>
            </select>
          </label>
          <p v-else class="single-arrangement"><span>演出编排</span><strong>{{ selectedScript?.label || selectedGroup.versions[0]?.label }}</strong></p>
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
        <label class="song-category-select">
          <select v-model="category" aria-label="舞台歌曲分类" :disabled="disabled">
            <option v-for="filter in categoryOptions" :key="filter.id" :value="filter.id">{{ compactCategoryLabels[filter.id] || filter.label }} {{ filter.count }}</option>
          </select>
        </label>
      </div>
      <div class="song-category-filters" role="group" aria-label="舞台歌曲分类">
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
            <span class="song-row-title"><strong>{{ group.title }}</strong><span v-if="selectedGroup?.songCode === group.songCode" class="song-current-badge">当前曲目</span></span>
            <small>{{ songSummary(group) }}</small>
          </span>
        </button>
        <p v-if="!matches.length" class="song-empty">没有找到符合条件的曲目。</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Music2, Search } from '@lucide/vue'
import { buildStageSongLibrary, filterStageSongLibrary, findStageSongGroup, stageSongCategoryOptions } from '../presentation/ChibiSongLibrary.js'

const props = defineProps({
  songs: { type: Array, default: () => [] },
  songDirectory: { type: [Array, Object], default: () => [] },
  selectedSongId: { type: String, default: '' },
  disabled: Boolean,
})
const emit = defineEmits(['select-song'])
const compactCategoryLabels = { all: '全部', collective: '全员/编成', unit: '组合曲', special: '特别编成' }
const query = ref('')
const category = ref('all')
const failedJackets = ref(new Set())
const library = computed(() => buildStageSongLibrary(props.songs, props.songDirectory))
const categoryOptions = computed(() => stageSongCategoryOptions(library.value))
const matches = computed(() => filterStageSongLibrary(library.value, { query: query.value, category: category.value }))
const selectedGroup = computed(() => findStageSongGroup(library.value, props.selectedSongId))
const selectedScript = computed(() => selectedGroup.value?.versions.find(version => version.id === props.selectedSongId) || null)

watch(categoryOptions, options => {
  if (!options.some(option => option.id === category.value)) category.value = 'all'
})

function songSummary(group) {
  const label = group.category === 'unit' && group.unitName ? group.unitName : group.categoryLabel
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
.song-category-select { display: none; }
.song-category-select select { box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px; padding: 8px 6px; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); color: var(--gs-ink); background: var(--gs-surface); font: inherit; font-size: 16px; }
.song-library { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; min-height: 0; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--gs-line); background: var(--gs-surface); }
.song-library-title { flex: none; margin: 0 0 8px; color: var(--gs-ink); font-size: var(--gs-text-body); font-weight: var(--gs-weight-semibold); line-height: 1.4; }
.song-category-filters { display: grid; flex: 0 0 auto; grid-template-columns: repeat(auto-fit, minmax(62px, 1fr)); gap: 4px; margin-top: 8px; }
.song-category-filters button { min-width: 0; min-height: 44px; padding: 5px 7px; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); color: var(--gs-ink-3); background: var(--gs-surface); font: inherit; font-size: var(--gs-text-meta); cursor: pointer; }
.song-category-filters button span { margin-left: 3px; color: var(--gs-ink-3); font-size: var(--gs-text-caption); font-weight: 400; }
.song-category-filters button[aria-pressed="true"] { border-color: var(--gs-selected-line); color: var(--gs-selected-ink); background: var(--gs-selected-bg); }
.song-category-filters button[aria-pressed="true"] span { color: inherit; }
.song-match-count { flex: 0 0 auto; margin: 8px 0 4px; color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.4; }
.song-list { flex: 1 1 auto; min-width: 0; min-height: 44px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: var(--gs-line) transparent; }
.song-row { box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; min-height: 56px; padding: 8px 5px; border: 0; border-bottom: 1px solid var(--gs-line); color: var(--gs-ink); background: transparent; font: inherit; text-align: left; cursor: pointer; }
.song-row > img { flex: none; border-radius: var(--gs-radius-media); object-fit: cover; }
.song-row > svg { flex: none; color: var(--gs-ink-3); }
.song-row-icon { box-sizing: content-box; width: 20px; padding: 8px; }
.song-row-copy { display: grid; gap: 3px; flex: 1; min-width: 0; }
.song-row-title { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.song-row-title > strong { flex: 1; min-width: 0; }
.song-current-badge { flex: none; color: var(--gs-mint-ink); font-size: var(--gs-text-caption); line-height: 1.5; white-space: nowrap; }
.song-row strong { font-size: 13px; font-weight: 600; line-height: 1.5; overflow-wrap: anywhere; }
.song-row small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.45; overflow-wrap: anywhere; }
.song-row[aria-pressed="true"] { color: var(--gs-ink); background: var(--gs-mint-wash); box-shadow: inset 2px 0 var(--gs-mint); }
.song-row:active, .song-category-filters button:active { background: var(--gs-mint-wash); }
.song-row:disabled, .song-category-filters button:disabled { opacity: 0.6; cursor: default; }
.song-row:focus-visible, .song-category-filters button:focus-visible, .arrangement-selector select:focus-visible, .song-category-select select:focus-visible { outline: 2px solid var(--gs-mint); outline-offset: -2px; }
.stage-arrangement { margin-top: 8px; padding-top: 10px; border-top: 1px solid var(--gs-line); }
.arrangement-selector { display: grid; gap: 7px; color: var(--gs-ink-3); font-size: 12px; }
.arrangement-selector select { box-sizing: border-box; width: 100%; min-width: 0; min-height: 44px; padding: 8px 9px; border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); color: var(--gs-ink); background: var(--gs-surface); font: inherit; font-size: 16px; }
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
  .arrangement-selector { display: flex; align-items: center; gap: 8px; }
  .arrangement-selector > span { flex: none; }
  .arrangement-selector select { flex: 1; width: auto; }
  .arrangement-description { display: none; }
  .song-library { margin-top: 4px; padding-top: 4px; }
  .song-library-title { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .song-library-toolbar { display: flex; align-items: center; gap: 6px; }
  .song-search { flex: 1; }
  .song-category-select { display: block; flex: 0 0 100px; min-width: 0; }
  .song-category-filters { display: none; }
  .song-match-count { margin: 4px 0 2px; }
  .song-row { min-height: 44px; padding: 4px 5px; }
  .song-row-copy { gap: 2px; }
  .song-row strong, .song-row small { line-height: 1.4; }
}
@media (hover: hover) and (pointer: fine) {
  .song-row:hover { background: var(--gs-paper); }
  .song-category-filters button:hover { border-color: var(--gs-line); }
}
</style>
