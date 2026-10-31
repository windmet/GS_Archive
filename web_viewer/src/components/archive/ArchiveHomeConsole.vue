<template>
  <div ref="root" class="home-console" :class="{ 'is-open': open }" @keydown.esc="close">
    <!-- Three things: who and what they wear, how it is shown, scene settings. The two idol / costume dropdowns that
         used to cut names short are one capsule that opens a panel. -->
    <div class="console-bar">
      <button type="button" class="console-capsule" :aria-expanded="open" aria-haspopup="dialog" aria-controls="home-console-panel" :aria-label="`人物与衣装：${activeName}，${activeSubject}`" @click="open ? close() : openPanel()">
        <ArchiveIdolAvatar :idol-code="activeIdol.id" :size="28" :ring-width="0" :gap="0" class="console-avatar" :style="{ '--console-ring': ringColor }" decorative />
        <span class="console-copy"><strong>{{ activeName }}</strong><small>{{ activeSubject }}</small></span>
        <ChevronsUpDown :size="14" aria-hidden="true" />
      </button>
      <GsSegmented class="console-mode" :model-value="homeMode" :options="MODES" aria-label="首页显示方式" @update:model-value="emit('update:homeMode', $event)" />
      <button type="button" class="console-settings" aria-label="场景设置" aria-haspopup="dialog" :aria-expanded="settingsOpen" title="场景设置" @click="emit('settings')"><SlidersHorizontal :size="17" /></button>
    </div>

    <button v-if="open" type="button" class="console-scrim" aria-label="关闭人物与衣装" @click="close"></button>
    <section v-if="open" id="home-console-panel" class="console-panel" role="dialog" aria-label="人物与衣装" :data-tab="tab">
      <div class="console-tabs" role="tablist" aria-label="选择内容">
        <button type="button" role="tab" :aria-selected="tab === 'idol'" @click="tab = 'idol'">偶像</button>
        <button type="button" role="tab" :aria-selected="tab === 'subject'" @click="tab = 'subject'">{{ homeMode === 'card' ? '卡面' : '衣装' }}</button>
      </div>
      <div class="console-columns">
        <div class="console-column console-idols" :class="{ 'is-hidden': tab !== 'idol' }">
          <label class="console-search"><Search :size="15" aria-hidden="true" /><input v-model="query" type="search" placeholder="搜索偶像或组合" aria-label="搜索偶像或组合" /></label>
          <div class="console-list" role="listbox" aria-label="首页偶像">
            <section v-for="group in groups" :key="group.unit">
              <h3>{{ group.unit }}</h3>
              <button v-for="idol in group.idols" :key="idol.id" type="button" role="option" class="console-idol" :class="{ 'is-current': idol.id === selectedId }" :aria-selected="idol.id === selectedId" @click="pickIdol(idol)">
                <ArchiveIdolAvatar :idol-code="idol.id" :size="28" :ring-width="0" :gap="0" class="console-avatar" :style="{ '--console-ring': colorOf(idol) }" decorative />
                <span>{{ idolLabel(idol) }}</span>
              </button>
            </section>
            <p v-if="!groups.length" class="console-empty" role="status">没有符合的偶像。</p>
          </div>
        </div>
        <div class="console-column console-subjects" :class="{ 'is-hidden': tab !== 'subject' }">
          <template v-if="homeMode === 'spine'">
            <div class="console-chips" role="group" aria-label="衣装类别">
              <button type="button" :aria-pressed="!costumeCategory" @click="emit('update:costumeCategory', '')">全部 <small>{{ activeIdol.costumes.length }}</small></button>
              <button v-for="group in categoryCounts" :key="group.id" type="button" :aria-pressed="costumeCategory === group.id" @click="emit('update:costumeCategory', group.id)">{{ group.label }} <small>{{ group.count }}</small></button>
            </div>
            <p v-if="filteredCostumes.pinned" class="console-note">当前：{{ costumeLabel(filteredCostumes.pinned) }}（不在此类别）</p>
            <div class="console-grid">
              <button v-for="costume in filteredCostumes.rows" :key="costume.modelId" type="button" class="console-costume" :class="{ 'is-current': activeCostume?.modelId === costume.modelId }" :aria-pressed="activeCostume?.modelId === costume.modelId" @click="emit('update:selectedCostume', costume.modelId)">
                <img v-if="thumbOf(costume)" class="console-costume-thumb" :src="thumbOf(costume)" alt="" loading="lazy" decoding="async" /><Shirt v-else :size="16" aria-hidden="true" /><span>{{ costumeLabel(costume) }}</span>
              </button>
            </div>
            <p v-if="!filteredCostumes.rows.length" class="console-empty" role="status">这个类别下没有衣装。</p>
          </template>
          <template v-else>
            <div class="console-list" role="listbox" aria-label="首页卡面">
              <button type="button" role="option" class="console-card" :class="{ 'is-current': !cardKey }" :aria-selected="!cardKey" @click="emit('update:cardKey', '')"><span>使用这位偶像的默认卡面</span></button>
              <button v-for="card in cards" :key="card.id" type="button" role="option" class="console-card" :class="{ 'is-current': cardKey === card.id }" :aria-selected="cardKey === card.id" @click="emit('update:cardKey', card.id)"><span>{{ card.label }}</span><small>{{ card.variantLabel }}</small></button>
            </div>
            <p v-if="!cards.length" class="console-empty" role="status">这位偶像暂无可选卡面。</p>
          </template>
        </div>
      </div>
    </section>

    <!-- First visit only: where the controls went. Dismissed for good by any tap on it. -->
    <div v-if="showIntro && !open" class="console-intro" role="status">
      <p>人物、衣装和显示方式都在这里切换。</p>
      <button type="button" @click="dismissIntro">知道了</button>
    </div>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronsUpDown, Search, Shirt, SlidersHorizontal } from '@lucide/vue'
import ArchiveIdolAvatar from './ArchiveIdolAvatar.vue'
import GsSegmented from '../gs/GsSegmented.vue'
import { costumeImage } from '../../presentation/CostumeCollection.js'
import { costumeCategoryCounts } from '../../presentation/CostumeCategories.js'
import { groupConsoleIdols } from '../../presentation/HomeConsole.js'
import { normalizeIdolAccentColor } from '../../presentation/idolAccentColor.js'

const INTRO_KEY = 'sidem:home-console-intro-seen'
const MODES = [{ value: 'spine', label: '立绘' }, { value: 'card', label: '卡面' }]
const props = defineProps({
  idols: { type: Array, default: () => [] }, activeIdol: { type: Object, required: true },
  selectedId: { type: String, default: '' }, homeMode: { type: String, default: 'spine' },
  activeCostume: { type: Object, default: null }, costumeCategory: { type: String, default: '' },
  filteredCostumes: { type: Object, default: () => ({ rows: [], pinned: null }) },
  cards: { type: Array, default: () => [] }, cardKey: { type: String, default: '' }, activeCard: { type: Object, default: null },
  settingsOpen: Boolean, idolLabel: { type: Function, required: true }, costumeLabel: { type: Function, required: true },
})
const emit = defineEmits(['update:selectedId', 'update:selectedCostume', 'update:homeMode', 'update:cardKey', 'update:costumeCategory', 'settings'])
const root = ref(null), open = ref(false), tab = ref('idol'), query = ref('')
const activeName = computed(() => props.idolLabel(props.activeIdol))
const activeSubject = computed(() => props.homeMode === 'card'
  ? (props.activeCard?.label || '默认卡面')
  : (props.activeCostume ? props.costumeLabel(props.activeCostume) : '未选衣装'))
// Site renders of the spine models (CostumeCollection's own map); a model without one keeps the Shirt icon.
const thumbOf = costume => costumeImage(costume.modelId, null)?.url || ''
const colorOf = idol => normalizeIdolAccentColor(idol.color) || 'var(--gs-rule)'
const ringColor = computed(() => colorOf(props.activeIdol))
const categoryCounts = computed(() => costumeCategoryCounts(props.activeIdol.costumes))
const groups = computed(() => groupConsoleIdols(props.idols, props.idolLabel, query.value))
function openPanel() { open.value = true; tab.value = 'idol'; query.value = '' }
function close() { open.value = false }
function pickIdol(idol) { emit('update:selectedId', idol.id); tab.value = 'subject' }
function outside(event) { if (open.value && !root.value?.contains(event.target)) open.value = false }

let seen = true
try { seen = globalThis.localStorage?.getItem(INTRO_KEY) === '1' } catch { /* private mode: show once per visit */ seen = false }
const showIntro = ref(!seen)
function dismissIntro() { showIntro.value = false; try { globalThis.localStorage?.setItem(INTRO_KEY, '1') } catch { /* unsaved, shows again next visit */ } }

onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>
<style scoped>
.home-console { position: absolute; z-index: 6; top: 22px; right: 24px; }
.console-bar { display: flex; align-items: center; gap: var(--gs-space-3); padding: var(--gs-space-2); border-radius: var(--gs-radius-control); background: var(--chrome-bg, var(--gs-surface)); box-shadow: var(--gs-shadow-console); }
.console-capsule { display: flex; align-items: center; gap: var(--gs-space-3); box-sizing: border-box; min-width: 0; max-width: 280px; min-height: var(--gs-control-touch); padding: 0 var(--gs-space-3) 0 7px; border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-2); font: inherit; text-align: left; cursor: pointer; }
.console-capsule:hover { background: var(--gs-hover); }
.console-capsule[aria-expanded=true] { background: var(--gs-current-bg-inset); }
.console-avatar { outline: 2px solid var(--console-ring); outline-offset: 2px; flex: none; }
.console-avatar :deep(.idol-avatar-shell) { box-shadow: none; }
.console-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.console-copy strong, .console-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.console-copy strong { color: var(--gs-ink); font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); }
.console-copy small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); line-height: 1.1; }
.console-capsule > svg { flex: none; color: var(--gs-ink-3); }
.console-settings { display: grid; place-items: center; width: var(--gs-control-touch); height: var(--gs-control-touch); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-2); cursor: pointer; }
.console-costume-thumb { flex: none; width: 28px; height: 28px; border-radius: var(--gs-radius-media); object-fit: contain; background: var(--gs-paper); }
.console-settings:hover { background: var(--gs-hover); }
.console-capsule:focus-visible, .console-settings:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.console-scrim { display: none; }
.console-panel { position: absolute; top: calc(100% + var(--gs-space-3)); right: 0; display: flex; flex-direction: column; width: 640px; max-width: calc(100vw - 2 * var(--gs-space-6)); max-height: min(560px, calc(100vh - 120px)); overflow: hidden; border-radius: var(--gs-radius-panel); background: var(--gs-surface); box-shadow: var(--gs-shadow-float); }
.console-tabs { display: none; }
.console-columns { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 0; flex: 1; }
.console-column { display: flex; flex-direction: column; gap: var(--gs-space-3); min-height: 0; padding: var(--gs-space-4); overflow: hidden; }
.console-idols { border-right: 1px solid var(--gs-line); }
.console-search { display: flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-3); border-radius: var(--gs-radius-field); background: var(--gs-paper-2); color: var(--gs-ink-3); }
.console-search input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.console-search input:focus-visible { outline: none; }
.console-search:focus-within { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.console-list { display: flex; flex-direction: column; gap: var(--gs-space-1); min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.console-list h3 { margin: var(--gs-space-3) 0 var(--gs-space-1); padding: 0 var(--gs-space-3); color: var(--gs-ink-3); font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); letter-spacing: var(--gs-track-label); }
.console-idol, .console-card { display: flex; align-items: center; gap: var(--gs-space-4); box-sizing: border-box; width: 100%; min-height: var(--gs-row); padding: 0 var(--gs-space-3) 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); text-align: left; cursor: pointer; }
.console-idol span, .console-card span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.console-card small { margin-left: auto; color: var(--gs-ink-3); font-size: var(--gs-text-meta); white-space: nowrap; }
.console-idol:hover, .console-card:hover, .console-costume:hover { background: var(--gs-hover); }
.console-idol.is-current, .console-card.is-current, .console-costume.is-current { background: var(--gs-current-bg-inset); color: var(--gs-ink); }
.console-chips { display: flex; flex-wrap: wrap; gap: var(--gs-space-2); }
.console-chips button { min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 1px solid var(--gs-line); border-radius: var(--gs-radius-pill); background: transparent; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }
.console-chips button small { color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.console-chips button[aria-pressed=true] { border-color: var(--gs-selected-line); background: var(--gs-selected-bg); color: var(--gs-selected-ink); }
.console-note { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.console-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--gs-space-1); min-height: 0; overflow-y: auto; overscroll-behavior: contain; align-content: start; }
.console-costume { display: flex; align-items: center; gap: var(--gs-space-3); min-width: 0; min-height: var(--gs-row); padding: 0 var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-meta); text-align: left; cursor: pointer; }
.console-costume svg { flex: none; color: var(--gs-ink-3); }
.console-costume span { min-width: 0; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-height: var(--gs-leading-ui); }
.console-empty { margin: 0; padding: var(--gs-space-4); color: var(--gs-ink-3); font-size: var(--gs-text-ui); }
.console-idol:focus-visible, .console-card:focus-visible, .console-costume:focus-visible, .console-chips button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
.console-intro { position: absolute; top: calc(100% + var(--gs-space-3)); right: 0; display: flex; align-items: center; gap: var(--gs-space-4); width: max-content; max-width: 280px; padding: var(--gs-space-3) var(--gs-space-4); border-radius: var(--gs-radius-control); background: var(--gs-surface); box-shadow: var(--gs-shadow-console); color: var(--gs-ink-2); font-size: var(--gs-text-ui); }
.console-intro p { margin: 0; }
.console-intro button { flex: none; min-height: var(--gs-control-normal); padding: 0 var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: transparent; color: var(--gs-mint-ink); font: inherit; font-weight: var(--gs-weight-semibold); cursor: pointer; }
@media (max-width: 1100px) { .home-console { right: 16px; } .console-capsule { max-width: 200px; } }
@media (max-width: 760px) {
  .home-console { top: 14px; right: 12px; }
  /* Two rows: [avatar][settings] over the full-width 立绘 | 卡面 switch. */
  .console-bar { display: grid; grid-template-columns: 1fr 1fr; align-items: stretch; gap: var(--gs-space-2); }
  .console-capsule { grid-area: 1 / 1; }
  .console-settings { grid-area: 1 / 2; width: auto; }
  .console-mode { grid-area: 2 / 1 / 3 / 3; }
  .console-capsule { justify-content: center; padding: 0; }
  .console-capsule .console-copy, .console-capsule > svg { display: none; }
  .console-mode :deep(.gs-segmented-option) { padding: 0 var(--gs-space-3); }
  .console-intro { right: 0; max-width: 220px; }
  /* A bottom sheet with an idol tab and a costume tab. */
  .console-scrim { position: fixed; z-index: 7; inset: 0; display: block; border: 0; background: rgb(11 20 36 / 25%); }
  .console-panel { position: fixed; z-index: 8; top: auto; right: 0; bottom: 0; left: 0; width: auto; max-width: none; max-height: 72vh; border-bottom-left-radius: 0; border-bottom-right-radius: 0; padding-bottom: env(safe-area-inset-bottom, 0px); }
  .console-tabs { display: grid; grid-template-columns: repeat(2, 1fr); border-bottom: 1px solid var(--gs-line); }
  .console-tabs button { min-height: var(--gs-control-touch); border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-ui); cursor: pointer; }
  .console-tabs button[aria-selected=true] { border-bottom-color: var(--gs-selected-line); color: var(--gs-ink); }
  .console-columns { grid-template-columns: minmax(0, 1fr); }
  .console-column.is-hidden { display: none; }
  .console-idols { border-right: 0; }
  .console-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) { .console-panel { scroll-behavior: auto; } }
</style>
