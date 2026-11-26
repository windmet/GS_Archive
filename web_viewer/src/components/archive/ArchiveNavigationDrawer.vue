<template>
  <div ref="backdrop" class="archive-drawer-backdrop gs-enter-backdrop" @click.self="emit('close')">
    <nav ref="sheet" class="archive-drawer gs-enter-sheet" aria-label="全部栏目" tabindex="-1" @keydown.esc.prevent="emit('close')">
      <div class="drawer-grab" aria-hidden="true"><span></span></div>

      <div class="drawer-head">
        <form class="drawer-search" role="search" @submit.prevent="submitSearch">
          <Search :size="17" aria-hidden="true" />
          <input
            v-model="drawerQuery"
            type="search"
            placeholder="搜索偶像、卡片、歌曲、剧情、活动…"
            aria-label="全站搜索"
            autocomplete="off"
          />
          <button v-if="drawerQuery.trim()" type="submit" class="drawer-search-go">搜索</button>
        </form>
        <div v-if="$slots.identity" class="drawer-identity">
          <slot name="identity" />
        </div>
      </div>

      <div class="drawer-body">
        <section v-if="coreItems.length" class="drawer-section" aria-label="资料目录">
          <h2>资料目录</h2>
          <div class="drawer-core-grid">
            <button
              v-for="item in coreItems"
              :key="item.id"
              type="button"
              class="drawer-core-item"
              :class="{ active: item.id === activeSection }"
              :aria-current="item.id === activeSection ? 'page' : undefined"
              @click="emit('navigate', item.id)"
            >
              <span class="drawer-item-icon" aria-hidden="true">
                <component :is="item.icon" :size="19" :stroke-width="1.8" />
              </span>
              <span class="drawer-item-copy">
                <strong>{{ item.label }}</strong>
                <small v-if="item.hint">{{ item.hint }}</small>
              </span>
            </button>
          </div>
        </section>

        <section v-if="collectionItems.length" class="drawer-section" aria-label="图鉴">
          <h2>图鉴</h2>
          <div class="drawer-chip-list">
            <button
              v-for="item in collectionItems"
              :key="item.id"
              type="button"
              class="drawer-chip"
              :class="{ active: item.id === activeSection }"
              :aria-current="item.id === activeSection ? 'page' : undefined"
              @click="emit('navigate', item.id)"
            >
              <component :is="item.icon" :size="16" :stroke-width="1.8" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </section>

        <section v-if="toolItems.length" class="drawer-section" aria-label="工具">
          <h2>工具</h2>
          <div class="drawer-tool-grid">
            <button
              v-for="item in toolItems"
              :key="item.id"
              type="button"
              class="drawer-tool-card"
              :class="{ active: item.id === activeSection }"
              :aria-current="item.id === activeSection ? 'page' : undefined"
              @click="emit('navigate', item.id)"
            >
              <component :is="item.icon" :size="19" :stroke-width="1.8" aria-hidden="true" />
              <span class="drawer-item-copy">
                <strong>{{ item.label }}</strong>
                <small v-if="item.hint">{{ item.hint }}</small>
              </span>
              <ArrowUpRight class="drawer-tool-arrow" :size="15" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>

      <p class="archive-drawer-footer">
        <template v-for="item in footerItems" :key="item.id">
          <button type="button" :aria-current="item.id === activeSection ? 'page' : undefined" @click="emit('navigate', item.id)">{{ item.label }}</button>
          <span aria-hidden="true">·</span>
        </template>
        <button type="button" :aria-current="activeSection === 'about' ? 'page' : undefined" @click="emit('navigate', 'about')">{{ sectionLabel('about') }}</button>
      </p>
    </nav>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ArrowUpRight, Search } from '@lucide/vue'
import { ARCHIVE_SECTIONS, sectionLabel } from '../../core/archiveSections.js'
import { archiveNavigationIcons } from './archiveNavigationIcons.js'
import { useSheetDrag } from '../../composables/useSheetDrag.js'

const TOOL_GROUPS = new Set(['live', 'studio'])
const CORE_HINTS = Object.freeze({
  stories: '主线与活动',
  interactions: '聊天与电话',
  idols: '49 位成员',
  units: '16 支组合',
  cards: '卡面与台词',
  songs: '分轨试听',
  scores: '场景配乐',
  events: '活动历程',
  gashas: '历史卡池',
})

const props = defineProps({
  groups: { type: Array, required: true },
  activeSection: { type: String, default: '' },
  keyboard: Boolean,
})
const emit = defineEmits(['navigate', 'close', 'search'])

const backdrop = ref(null)
const sheet = ref(null)
const drawerQuery = ref('')

const decorate = (item, group) => ({
  ...item,
  icon: archiveNavigationIcons[item.id] || group.icon,
  hint: ARCHIVE_SECTIONS[item.id]?.blurb || CORE_HINTS[item.id] || '',
})
const pickGroups = predicate => props.groups.filter(predicate).flatMap(group => group.items.map(item => decorate(item, group)))

const coreItems = computed(() => pickGroups(group => group.id !== 'collection' && !TOOL_GROUPS.has(group.id) && group.id !== 'resources'))
const collectionItems = computed(() => pickGroups(group => group.id === 'collection'))
const toolItems = computed(() => pickGroups(group => TOOL_GROUPS.has(group.id)))
const footerItems = computed(() => props.groups.filter(group => group.id === 'resources').flatMap(group => group.items))

function submitSearch() {
  emit('search', drawerQuery.value.trim())
  drawerQuery.value = ''
}

useSheetDrag(sheet, {
  handle: '.drawer-grab',
  onClose: () => emit('close'),
  isShowing: () => true,
  backdrop: () => backdrop.value,
})

onMounted(() => {
  const current = sheet.value?.querySelector('.drawer-body [aria-current="page"]')
  const target = props.keyboard ? current || sheet.value?.querySelector('button') : sheet.value
  target?.focus({ preventScroll: true })
  current?.scrollIntoView({ block: 'nearest' })
})
</script>

<style scoped>
/* Sits above the content and below the bar, so the bar's 收起 stays where the reader tapped. */
.archive-drawer-backdrop {
  position: fixed;
  inset: 0 0 calc(74px + env(safe-area-inset-bottom, 0px));
  z-index: 19;
  display: flex;
  align-items: flex-end;
  background: rgb(21 43 67 / calc(34% * var(--sheet-backdrop, 1)));
}
.archive-drawer {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: min(86dvh, 100%);
  overflow: hidden;
  border-radius: var(--gs-radius-panel);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  background: var(--gs-surface);
  color: var(--gs-ink);
  box-shadow: 0 -8px 32px rgb(16 42 64 / 14%);
}
.archive-drawer:focus { outline: none; }
.drawer-grab { display: grid; flex: none; place-items: center; height: 24px; touch-action: none; cursor: grab; }
.drawer-grab span { width: 36px; height: 4px; border-radius: var(--gs-radius-pill); background: var(--gs-rule); }
.drawer-head { display: grid; flex: none; gap: var(--gs-space-3); padding: var(--gs-space-1) max(var(--gs-space-5), env(safe-area-inset-right, 0px)) var(--gs-space-4) max(var(--gs-space-5), env(safe-area-inset-left, 0px)); }
.drawer-search { display: flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-touch); padding: 0 var(--gs-space-2) 0 var(--gs-space-4); border-radius: var(--gs-radius-field); background: var(--gs-paper-2); color: var(--gs-ink-3); }
.drawer-search:focus-within { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: var(--gs-focus-offset); }
.drawer-search input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--gs-ink); font: inherit; font-size: var(--gs-text-ui); }
.drawer-search input:focus-visible { outline: none; }
.drawer-search-go { min-height: var(--gs-control-compact); padding: 0 var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: var(--gs-action-bg); color: var(--gs-action-ink); font: inherit; font-size: var(--gs-text-meta); font-weight: var(--gs-weight-semibold); cursor: pointer; }

.drawer-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: grid; gap: var(--gs-space-5); padding: 0 max(var(--gs-space-5), env(safe-area-inset-right, 0px)) var(--gs-space-3) max(var(--gs-space-5), env(safe-area-inset-left, 0px)); }
.drawer-section { display: grid; gap: var(--gs-space-2); }
.drawer-section h2 { margin: 0; color: var(--gs-ink-3); font-size: var(--gs-text-caption); font-weight: var(--gs-weight-semibold); letter-spacing: var(--gs-track-label); }

.drawer-core-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-2); }
.drawer-core-item { display: flex; align-items: center; gap: var(--gs-space-3); min-width: 0; min-height: 48px; padding: var(--gs-space-2) var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: var(--gs-paper); color: var(--gs-ink); font: inherit; text-align: left; cursor: pointer; }
.drawer-item-icon { display: grid; flex: none; place-items: center; width: 32px; height: 32px; border-radius: var(--gs-radius-control); background: var(--gs-surface); color: var(--gs-ink-2); }
.drawer-item-copy { display: grid; min-width: 0; gap: 1px; }
.drawer-item-copy strong { overflow: hidden; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-semibold); text-overflow: ellipsis; white-space: nowrap; }
.drawer-item-copy small { overflow: hidden; color: var(--gs-ink-3); font-size: var(--gs-text-caption); text-overflow: ellipsis; white-space: nowrap; }
.drawer-core-item.active, .drawer-tool-card.active { background: var(--gs-selected-bg); color: var(--gs-selected-ink); }
.drawer-core-item.active .drawer-item-icon { color: var(--gs-mint-ink); }

.drawer-chip-list { display: flex; flex-wrap: wrap; gap: var(--gs-space-2); }
.drawer-chip { display: inline-flex; align-items: center; gap: var(--gs-space-2); min-height: var(--gs-control-normal); padding: 0 var(--gs-space-4); border: 0; border-radius: var(--gs-radius-pill); background: var(--gs-paper); color: var(--gs-ink-2); font: inherit; font-size: var(--gs-text-ui); font-weight: var(--gs-weight-medium); cursor: pointer; }
.drawer-chip.active { background: var(--gs-selected-bg); color: var(--gs-selected-ink); font-weight: var(--gs-weight-semibold); }

.drawer-tool-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--gs-space-2); }
.drawer-tool-card { display: flex; align-items: center; gap: var(--gs-space-3); min-width: 0; min-height: 52px; padding: var(--gs-space-2) var(--gs-space-3); border: 0; border-radius: var(--gs-radius-control); background: var(--gs-paper-2); color: var(--gs-ink); font: inherit; text-align: left; cursor: pointer; }
.drawer-tool-card > svg { flex: none; color: var(--gs-ink-2); }
.drawer-tool-arrow { margin-left: auto; color: var(--gs-ink-3); }

.archive-drawer button:focus-visible { outline: var(--gs-focus-ring) solid var(--gs-mint); outline-offset: -2px; }
.archive-drawer-footer { display: flex; flex: none; align-items: center; justify-content: center; gap: var(--gs-space-1); margin: var(--gs-space-1) 0 0; padding: 0 var(--gs-space-4) var(--gs-space-2); color: var(--gs-ink-3); font-size: var(--gs-text-meta); }
.archive-drawer-footer button { min-height: var(--gs-control-touch); padding: 0 var(--gs-space-3); border: 0; background: none; color: var(--gs-ink-3); font: inherit; font-size: var(--gs-text-meta); cursor: pointer; }
.archive-drawer-footer button[aria-current='page'] { color: var(--gs-ink); font-weight: var(--gs-weight-semibold); }
/* The drawer belongs to the phone bar; a wider window has the sidebar instead. */
@media (min-width: 761px) { .archive-drawer-backdrop { display: none; } }
</style>
