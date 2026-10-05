<template>
  <section class="idol-picker">
    <label class="idol-picker-search"><span>查找偶像或组合</span><input v-model="query" type="search" placeholder="输入姓名或组合名" autocomplete="off" /></label>
    <div class="idol-picker-units" role="group" aria-label="按组合筛选">
      <button type="button" :aria-pressed="!unitFilter" @click="unitFilter=''">全部 <small>{{ idols.length }}</small></button>
      <button v-for="unit in units" :key="unit.id" type="button" :aria-pressed="unitFilter===unit.id" @click="unitFilter=unit.id">{{ unit.name }}</button>
    </div>
    <p class="idol-picker-status" role="status">{{ matches.length }} 位偶像<span v-if="selectedName"> · 已选：{{ selectedName }}</span></p>
    <div class="idol-picker-groups">
      <section v-for="group in groups" :key="group.id">
        <h3>{{ group.name }}</h3>
        <div class="idol-picker-grid">
          <button v-for="idol in group.idols" :key="idol.id" type="button" :aria-label="`${displayName(idol)} · ${group.name}`" :aria-pressed="modelValue===idol.id" :data-idol-code="idol.id" @click="emit('update:modelValue',idol.id)">
            <ArchiveIdolAvatar :idol-code="idol.id" :accent-color="idol.color" :size="48" decorative :fallback-text="displayName(idol).slice(0, 1) || '?'" />
            <strong>{{ displayName(idol) }}</strong>
          </button>
        </div>
      </section>
    </div>
    <p v-if="!matches.length" class="idol-picker-status">没有找到符合条件的偶像。</p>
  </section>
</template>
<script setup>
import { computed, ref } from 'vue'
import ArchiveIdolAvatar from '../ArchiveIdolAvatar.vue'
// The one idol picker: search, a scrolling row of units, then avatars grouped by unit.
const props = defineProps({
  idols: { type: Array, default: () => [] }, modelValue: { type: String, default: '' },
  idolName: { type: Function, default: () => '' }, idolSearch: { type: Function, default: () => '' },
})
const emit = defineEmits(['update:modelValue'])
const query = ref(''), unitFilter = ref('')
const unitId = idol => idol.unitCode || idol.unitName || '315'
const units = computed(() => [...new Map(props.idols.map(idol => [unitId(idol), { id: unitId(idol), name: idol.unitName || '315 STARS' }])).values()])
const groups = computed(() => units.value.map(unit => ({ ...unit, idols: matches.value.filter(idol => unitId(idol) === unit.id) })).filter(unit => unit.idols.length))
function displayName(idol) { return props.idolName(idol.id) || idol.name || '' }
const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, '')
const matches = computed(() => props.idols.filter(idol => (!unitFilter.value || unitId(idol) === unitFilter.value) &&
  normalize(`${props.idolSearch(idol.id, idol.name)} ${displayName(idol)} ${idol.name || ''} ${idol.kana || ''} ${idol.unitName || ''}`).includes(normalize(query.value))))
const selectedName = computed(() => {
  const idol = props.idols.find(idol => idol.id === props.modelValue)
  return idol ? displayName(idol) : ''
})
</script>
<style scoped>
.idol-picker { container: idol-picker / inline-size; color: var(--gs-ink); font-family: var(--gs-font-body); }
.idol-picker-search { display: grid; gap: var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.idol-picker-search input { width: 100%; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-field); background: var(--gs-surface); color: var(--gs-ink); font: inherit; font-size: var(--gs-text-subtitle); box-sizing: border-box; }
.idol-picker-units { display: flex; gap: var(--gs-space-2); overflow-x: auto; margin: var(--gs-space-4) 0 0; padding: var(--gs-space-1) 0; scrollbar-width: none; }
.idol-picker-units button { flex: none; display: inline-flex; align-items: center; gap: 6px; min-height: var(--gs-control-compact); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: var(--gs-surface); color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); white-space: nowrap; cursor: pointer; }
.idol-picker-units button small { color: var(--gs-ink-3); font-size: var(--gs-text-caption); }
.idol-picker-units button[aria-pressed=true] { border-color: var(--gs-ink); background: var(--gs-ink); color: var(--gs-paper); }
.idol-picker-units button[aria-pressed=true] small { color: inherit; }
.idol-picker-status { margin: var(--gs-space-3) 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.idol-picker-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: var(--gs-space-5) var(--gs-space-7); }
.idol-picker-groups h3 { margin: 0 0 var(--gs-space-2); padding-bottom: var(--gs-space-2); border-bottom: 1px solid var(--gs-line); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); }
.idol-picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: var(--gs-space-1); }
.idol-picker-grid button { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; padding: var(--gs-space-3) var(--gs-space-1); border: 1px solid transparent; border-radius: var(--gs-radius-control); background: none; color: var(--gs-ink-2); font: inherit; cursor: pointer; }
.idol-picker-grid button strong { font-size: var(--gs-text-meta); font-weight: var(--gs-weight-medium); line-height: 1.4; text-align: center; overflow-wrap: anywhere; }
.idol-picker-grid button[aria-pressed=true] { border-color: var(--gs-mint); background: var(--gs-mint-wash); color: var(--gs-ink); }
.idol-picker button:focus-visible, .idol-picker input:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
@media (hover: hover) { .idol-picker-grid button:hover { background: var(--gs-mint-wash); } }
@container idol-picker (max-width: 420px) { .idol-picker-units button { min-height: var(--gs-control-touch); } }
</style>
